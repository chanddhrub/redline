/**
 * The seam between the reader's red lines and the one table that holds them.
 *
 * Pure. No client, no network, no React. Everything that decides what leaves
 * the browser and what is trusted on the way back in lives here, so both can
 * be tested without a database — which matters more than usual, because no
 * Supabase project exists yet and nothing downstream of this file has ever
 * been run against one.
 *
 * The narrow type is the point. `rowsFor` takes red lines, not the analysis
 * request that holds them. The document's text is not a field it could reach
 * even by accident, and a later edit that wanted to store the text would have
 * to widen this signature to do it.
 */

import type { RedLine } from "@/lib/intake/analysis-request";

/** One row of `public.red_lines`. Four columns and no fifth: the table has no
 *  column for the document's text and this type has no field for it. */
export interface RedLineRow {
  id: string;
  owner: string;
  text: string;
  ordinal: number;
}

/** Every column the application writes, named once so a test can hold the
 *  write path to exactly this set. */
export const RED_LINE_COLUMNS = ["id", "owner", "text", "ordinal"] as const;

/**
 * What goes to the database.
 *
 * Each field is copied by name. Nothing is spread, so an object that arrived
 * carrying more than a red line leaves carrying less — a red line is an id and
 * some words, and the row is built from those two and the position in the
 * list.
 *
 * Blank and whitespace-only lines are dropped rather than written, the same
 * way intake refuses to add them: the table's own check constraint refuses
 * them too, and a write that trips a constraint is a saved list that silently
 * did not save.
 */
export function rowsFor(owner: string, lines: readonly RedLine[]): RedLineRow[] {
  if (!owner.trim()) {
    // Not a reachable state in the product — the store only builds rows inside
    // a signed-in branch — but an unowned row is the one row row level
    // security cannot protect, and returning an empty list here would read as
    // "this reader has no red lines" and delete the ones they have.
    throw new Error("A red line row needs an owner.");
  }
  const rows: RedLineRow[] = [];
  for (const line of lines) {
    if (typeof line?.id !== "string" || typeof line?.text !== "string") continue;
    if (!line.id.trim() || !line.text.trim()) continue;
    rows.push({ id: line.id, owner, text: line.text, ordinal: rows.length });
  }
  return rows;
}

/**
 * What comes back.
 *
 * Read defensively. The rows arrive as JSON from a service, and a row that is
 * not two strings is not a red line however it got there. Anything that does
 * not survive intact is dropped rather than half-restored, which is the rule
 * `restoreIntake` already follows for the session.
 *
 * Order is the reader's own: `ordinal` first, and ties fall back to the order
 * the rows arrived in so the list is stable rather than arbitrary.
 */
export function redLinesFrom(value: unknown): RedLine[] {
  if (!Array.isArray(value)) return [];
  const ordered: { line: RedLine; ordinal: number; seen: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id, text, ordinal } = entry as {
      id?: unknown;
      text?: unknown;
      ordinal?: unknown;
    };
    if (typeof id !== "string" || typeof text !== "string") continue;
    if (!id.trim() || !text.trim()) continue;
    ordered.push({
      line: { id, text },
      ordinal: typeof ordinal === "number" && Number.isFinite(ordinal) ? ordinal : 0,
      seen: ordered.length,
    });
  }
  ordered.sort((a, b) => a.ordinal - b.ordinal || a.seen - b.seen);
  return ordered.map((o) => o.line);
}

/**
 * Signing in on a page where the reader has already typed.
 *
 * Neither list wins outright. The kept lines come first, in their order, and
 * anything typed in this sitting that is not already among them follows. A
 * reader who signs in mid-session keeps what they just wrote, and a reader
 * signing in on a fresh tab gets what they left behind.
 *
 * Identity is the id, not the words. Two lines that say the same thing were
 * typed twice and are the reader's business; the same line edited on another
 * day is one line, and the kept version is the one already on the screen they
 * are signing in from.
 */
export function mergeRedLines(kept: readonly RedLine[], typed: readonly RedLine[]): RedLine[] {
  const ids = new Set(kept.map((line) => line.id));
  const merged = [...kept];
  for (const line of typed) {
    if (ids.has(line.id)) continue;
    ids.add(line.id);
    merged.push(line);
  }
  return merged;
}

/** Whether two lists are the same lines saying the same things in the same
 *  order. The store writes on a change and not on a render, and "a change" has
 *  to mean something more than a new array. */
export function sameRedLines(a: readonly RedLine[], b: readonly RedLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((line, i) => line.id === b[i].id && line.text === b[i].text);
}
