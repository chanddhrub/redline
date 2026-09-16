/**
 * The red lines table, reached through the Supabase client.
 *
 * Thin on purpose. Everything worth arguing about — what a row may contain,
 * what a row read back has to prove before it is believed, which lines have
 * gone — is in `red-lines.ts` and is pure. What is left here is three queries,
 * and they are the part that cannot be tested without a project.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RedLine } from "@/lib/intake/analysis-request";
import { redLinesFrom, rowsFor } from "./red-lines";

export const RED_LINES_TABLE = "red_lines";

export interface RedLineStore {
  load(): Promise<RedLine[]>;
  save(lines: readonly RedLine[]): Promise<void>;
}

/**
 * Which kept lines the reader has since deleted.
 *
 * Saving is a replacement, not an append: the list on the screen is the list,
 * and a line removed there is removed for good. Working out the removals here
 * rather than writing a negated `in` filter keeps the reader's own wording out
 * of a hand-assembled query string.
 */
export function idsToRemove(
  existing: readonly string[],
  keeping: readonly { id: string }[],
): string[] {
  const kept = new Set(keeping.map((row) => row.id));
  return existing.filter((id) => !kept.has(id));
}

export function supabaseRedLineStore(
  client: SupabaseClient,
  owner: string,
): RedLineStore {
  const table = () => client.from(RED_LINES_TABLE);

  return {
    async load() {
      // The owner filter is redundant under the policies in the migration and
      // is written anyway: a query that is only correct because of a policy is
      // a query that goes wrong quietly if a policy is ever widened.
      const { data, error } = await table()
        .select("id, text, ordinal")
        .eq("owner", owner)
        .order("ordinal", { ascending: true });
      if (error) throw new Error(error.message);
      return redLinesFrom(data);
    },

    async save(lines) {
      const rows = rowsFor(owner, lines);

      const { data, error } = await table().select("id").eq("owner", owner);
      if (error) throw new Error(error.message);
      const existing = redLineIds(data);

      if (rows.length) {
        const { error: written } = await table().upsert(rows, {
          onConflict: "owner,id",
        });
        if (written) throw new Error(written.message);
      }

      // Deletions go last. A failed upsert then leaves the reader with more
      // lines than they asked for, which they can see and fix; the other order
      // leaves them with fewer and nothing to show what went.
      const gone = idsToRemove(existing, rows);
      if (gone.length) {
        const { error: removed } = await table()
          .delete()
          .eq("owner", owner)
          .in("id", gone);
        if (removed) throw new Error(removed.message);
      }
    },
  };
}

function redLineIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { id } = entry as { id?: unknown };
    if (typeof id === "string" && id.trim()) ids.push(id);
  }
  return ids;
}
