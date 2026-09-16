/**
 * The labelled second layer (ticket 07, ADR 0005).
 *
 * This is the one place in Redline allowed to say something the reader's
 * document does not say. It is allowed because of what it is not: an
 * `EnforceabilityNote` has no citation and no span, and there is no field to
 * put one in. The type is the promise. A note cannot be merged into a flag,
 * cannot be quoted as though it came out of the contract, and cannot acquire a
 * span later by someone adding a line.
 *
 * It is also allowed because it is labelled — in the styling, which `DESIGN.md`
 * reserves a dashed border and a halftone rail for, and in words, which is what
 * survives a screen reader, a photocopier and a reader who has never seen this
 * product before (PRD §4 T7).
 *
 * **Nothing here touches a flag.** This module is a pure lookup over a static
 * set. It does not see the flags, it is not consulted by `rankFlags`, and the
 * pipeline takes it as an argument rather than building it, so running with and
 * without the layer is the same run. That is asserted in the tests rather than
 * left as a claim.
 *
 * The set itself, its date and its provenance are in `enforceability-set.ts`,
 * next to a note on what is deliberately empty and why.
 */

import type { UsState } from "../intake/analysis-request";
import { US_STATES } from "../intake/analysis-request";
import { CLAUSE_TYPES, type ClauseType } from "../model/payloads";
import type { GeneralStatement } from "./register";
import {
  ENFORCEABILITY_SET,
  type EnforceabilityTopic,
  type SetEntry,
} from "./enforceability-set";

export type { EnforceabilityTopic } from "./enforceability-set";

/**
 * A `GeneralStatement` with the topic it attaches to.
 *
 * It extends the general register rather than sitting alongside it, so the
 * compiler still refuses to put one where a `DocumentStatement` belongs. The
 * extra field is `topic`, which is how the interface joins a note to a flag at
 * render time. Joining is all it does: the note is placed beside the flag, and
 * the flag it is placed beside was ranked without knowing it existed.
 */
export interface EnforceabilityNote extends GeneralStatement {
  readonly topic: EnforceabilityTopic;
}

/** The topics in the order the reader meets them: the four clause types as PRD
 *  §5 lists them, then the governing-law contrast. */
const TOPIC_ORDER: readonly EnforceabilityTopic[] = [
  ...CLAUSE_TYPES,
  "governing-law",
];

function holdsIn(entry: SetEntry, state: UsState): boolean {
  return entry.states === "every-state" || entry.states.includes(state);
}

function toNote(entry: SetEntry): EnforceabilityNote {
  return {
    register: "general",
    topic: entry.topic,
    statement: entry.statement,
    basis: entry.basis,
    asOf: entry.asOf,
  };
}

/**
 * Every note that holds in the state the reader works in, in a fixed order.
 *
 * A state with nothing recorded for a topic produces no note for that topic,
 * and a state with nothing recorded at all produces an empty array. Neither
 * case is filled with a hedge: "enforceability varies by state" is the sentence
 * ADR 0004 rules out, and it is exactly what would go here if this function
 * were allowed to return something rather than nothing.
 */
export function enforceabilityNotes(state: UsState): EnforceabilityNote[] {
  const notes: EnforceabilityNote[] = [];
  for (const topic of TOPIC_ORDER) {
    for (const entry of ENFORCEABILITY_SET) {
      if (entry.topic === topic && holdsIn(entry, state)) notes.push(toNote(entry));
    }
  }
  return notes;
}

/** The notes for one topic. What the interface uses to sit a note beside a
 *  flag of that clause type. */
export function notesForTopic(
  notes: readonly EnforceabilityNote[],
  topic: EnforceabilityTopic,
): EnforceabilityNote[] {
  return notes.filter((note) => note.topic === topic);
}

/* ── The state the document itself names ─────────────────────────────── */

/**
 * The state named in a governing-law sentence, read out of the sentence.
 *
 * This is not the second layer and does not go through it. The sentence is in
 * the reader's document and is shown as a citation with its span; this only
 * reads a state's name out of the words already on screen, so the reader can
 * check it against the quote sitting next to it. It says nothing about what
 * that choice of law achieves — that question is a `governing-law` note, on
 * the dashed panel, where it belongs.
 *
 * The earliest name in the sentence wins, and the longest at that position, so
 * "West Virginia" is never read as "Virginia" and a later "New York courts"
 * never displaces "the laws of the State of Delaware". `null` where the
 * sentence names no state, which is the honest answer for a clause that points
 * at a country, an arbitral body or nothing at all.
 */
export function stateNamedIn(sentence: string): UsState | null {
  let best: { state: UsState; at: number } | null = null;

  for (const state of US_STATES) {
    const at = indexOfWord(sentence, state);
    if (at === -1) continue;
    if (
      best === null ||
      at < best.at ||
      (at === best.at && state.length > best.state.length)
    ) {
      best = { state, at };
    }
  }

  return best ? best.state : null;
}

/** Case-insensitive, on word boundaries, without building a regex out of a
 *  value — the state names are fixed, but a substring match would read
 *  "Indiana" inside a company name and a regex built from text is a habit
 *  worth not having. */
function indexOfWord(haystack: string, needle: string): number {
  const text = haystack.toLowerCase();
  const target = needle.toLowerCase();
  let from = 0;
  for (;;) {
    const at = text.indexOf(target, from);
    if (at === -1) return -1;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + target.length] ?? "";
    if (!isWordCharacter(before) && !isWordCharacter(after)) return at;
    from = at + 1;
  }
}

function isWordCharacter(character: string): boolean {
  return character !== "" && /[a-z0-9]/i.test(character);
}

/* ── Naming the two states to the reader ─────────────────────────────── */

export interface GoverningLawStates {
  /** The state the reader told us they work in. `null` only where the
   *  interface has not got one yet; an analysis cannot run without it. */
  readonly worksIn: UsState | null;
  /** The state the quoted sentence names, or `null` if it names none. */
  readonly named: UsState | null;
  /** True where the document picks a state other than the reader's. The whole
   *  reason ADR 0005 keeps showing the clause: for a non-compete, the
   *  employee's state frequently prevails over the one the contract picked. */
  readonly differ: boolean;
}

export function governingLawStates(
  sentence: string,
  worksIn: UsState | null,
): GoverningLawStates {
  const named = stateNamedIn(sentence);
  return {
    worksIn,
    named,
    differ: named !== null && worksIn !== null && named !== worksIn,
  };
}

/** Re-exported so callers that only need the clause types do not reach past
 *  this module into the model's payload schema. */
export type { ClauseType };
