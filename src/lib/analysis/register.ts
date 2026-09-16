/**
 * The two registers, carried in the data rather than only in the prose.
 *
 * ADR 0004 splits everything this product says into two kinds of statement, and
 * PRD §3 and §4 T7 require them to be distinguishable on screen. An interface
 * can only render them as different things if the shape hands it different
 * things, so the split is made here, in the types, and not left to a convention
 * about how a sentence is worded.
 *
 * - A `DocumentStatement` is about the reader's document. It carries a
 *   `Citation`, which the gate alone can mint, so it cannot exist without a
 *   located sentence. The reader checks it against their own copy.
 * - A `GeneralStatement` is about what a court or an employer might do. No
 *   sentence supports it, so it carries no citation and no span — there is no
 *   field to put one in. It carries where it came from and how old it is
 *   instead, because that is all a reader has to judge it by (ADR 0005).
 *
 * The two are not assignable to each other in either direction. Merging a
 * general statement into a cited flag would take the whole output down to the
 * credibility of its weaker half, and the compiler now refuses the merge.
 */

import type { Citation } from "./verify";

/** Something the document says, and where it says it. */
export interface DocumentStatement {
  readonly register: "document";
  /** Our words. The reader checks them against `citation.text`. */
  readonly statement: string;
  readonly citation: Citation;
}

/**
 * Context about a state or a court, marked as not coming from the document.
 *
 * `basis` and `asOf` are required rather than nice to have: this layer goes
 * stale silently (ADR 0005), and a note whose age and source are not printed
 * beside it is a claim the reader has no way to weigh.
 */
export interface GeneralStatement {
  readonly register: "general";
  readonly statement: string;
  /** Where this came from, in enough detail to go and look. */
  readonly basis: string;
  /** ISO date the basis was last checked. */
  readonly asOf: string;
}

export type Statement = DocumentStatement | GeneralStatement;

/** The only way to build a document-register statement: a citation is an
 *  argument, so there is no path that forgets one. */
export function documentStatement(
  statement: string,
  citation: Citation,
): DocumentStatement {
  return { register: "document", statement, citation };
}
