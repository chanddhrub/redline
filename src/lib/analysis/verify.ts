/**
 * Seam 2 of analysis (ticket 02) — the verification gate.
 *
 * Everything the model says it read out of the document arrives here as a
 * claim. A candidate flag claims a `sourceSentence`; a summary claims the
 * sentences it rests on; an answer claims the sentences it cites. Each claim is
 * put through `locate` against the canonical stored text. It lands, or it is
 * dropped (ADR 0001).
 *
 * Dropped means dropped. Not softened into an unsourced note, not shown with a
 * warning, not paraphrased, not repaired. There is no fuzzy match here, no edit
 * distance, no nearest-sentence fallback, no "the model probably meant this"
 * branch — the whole matching decision is `ParsedDocument.locate`, which
 * already normalises reversibly and returns `null` rather than a guess. A quote
 * matched loosely would be a wrong flag, and a wrong reading of a shown
 * sentence is the single result this version exists to rule out (PRD §4).
 *
 * The drop is recorded with a reason and handed back to the caller, because the
 * dropped count is the product's own instrument: a run where most candidates
 * are dropped means the prompt has started paraphrasing, and that is a tuning
 * job with a number attached. Drops are carried, never rendered.
 *
 * **A `Flag` cannot be constructed without a located span, and the compiler is
 * what enforces it.** A `Flag` holds a `Citation`, and a `Citation` carries a
 * brand keyed to a `unique symbol` this module declares and does not export.
 * No code outside this file can write that property, so no code outside this
 * file can produce a `Citation` — or therefore a `Flag` — by any route other
 * than the gate. That is what turns PRD §4's T1 from a review item into a
 * standing check: there is no convention to remember and nothing to review.
 */

import type { Span, ParsedDocument } from "../intake/parse-document";
import type {
  CandidateFlag,
  ClauseType,
  Severity,
} from "../model/payloads";

/**
 * Declared, never exported. This is the whole enforcement: a value of a type
 * carrying this key can only be written where the key is in scope, which is
 * here.
 */
const VERIFIED = Symbol("located-in-the-document");

/**
 * A sentence that was found in the canonical text, and where it was found.
 *
 * `text` is the document's own bytes — `document.text.slice(span.start,
 * span.end)` — not the model's rendering of them. Where the two differ they
 * differ only in typography that `locate` folds, and the reader is owed the
 * text that is actually in their copy.
 */
export interface Citation {
  /** Present on every `Citation` and writable nowhere outside this module. */
  readonly [VERIFIED]: true;
  readonly text: string;
  readonly span: Span;
}

/**
 * A risk that survived the gate. It has a citation, so the interface can always
 * show the quote and point at the document; and it has one because there is no
 * way to build it without one.
 */
export interface Flag {
  readonly id: string;
  readonly clauseType: ClauseType;
  /** Not writable after construction: promotion raises, it never rewrites. */
  readonly severity: Severity;
  readonly citation: Citation;
  readonly meaning: string;
  readonly counterOffer: string;
  readonly escapability: CandidateFlag["escapability"];
  /**
   * Still a claim. The gate verifies the quote and nothing else; whether the
   * user declared this red line is checked in seam 3 (ADR 0003).
   */
  readonly claimedRedLineId: string | null;
}

export type DropReason =
  /** The claimed quote was blank. A prompt fault, not a paraphrase. */
  | "quote-empty"
  /** The claimed quote is not in the document. The paraphrase, the near miss,
   *  the sentence lifted from somewhere else — all land here. */
  | "quote-not-found";

/** A candidate that did not survive. Counted, never rendered. */
export interface DroppedFlag {
  readonly id: string;
  readonly clauseType: ClauseType;
  /** What the model claimed the document said, kept for the count and the log. */
  readonly claimedSentence: string;
  readonly reason: DropReason;
}

/** A quote a summary or an answer claimed, that did not survive. */
export interface DroppedQuote {
  readonly claimedSentence: string;
  readonly reason: DropReason;
}

export interface VerifiedFlags {
  readonly flags: Flag[];
  readonly dropped: DroppedFlag[];
}

export interface VerifiedQuotes {
  readonly citations: Citation[];
  readonly dropped: DroppedQuote[];
}

function reasonFor(quote: string): DropReason {
  return quote.trim() ? "quote-not-found" : "quote-empty";
}

/**
 * The gate, in its narrowest shape: one claimed sentence in, a citation or
 * `null` out. `null` is the only thing a quote that does not land produces.
 */
export function verifyQuote(
  quote: string,
  document: ParsedDocument,
): Citation | null {
  const span = document.locate(quote);
  if (!span) return null;
  return {
    [VERIFIED]: true,
    text: document.text.slice(span.start, span.end),
    span,
  };
}

/**
 * The same gate for the summary and for question answers. Both make quoted
 * claims and both are held to the standard a flag is held to: an answer that
 * cites nothing locatable has no citations, and the caller has nothing to show.
 */
export function verifyQuotes(
  quotes: readonly string[],
  document: ParsedDocument,
): VerifiedQuotes {
  const citations: Citation[] = [];
  const dropped: DroppedQuote[] = [];
  for (const quote of quotes) {
    const citation = verifyQuote(quote, document);
    if (citation) citations.push(citation);
    else dropped.push({ claimedSentence: quote, reason: reasonFor(quote) });
  }
  return { citations, dropped };
}

/**
 * Seam 2. Candidates in, the flags that survived and the drops with their
 * reasons out. Order is preserved; ranking is seam 3's business.
 */
export function verifyFlags(
  candidates: readonly CandidateFlag[],
  document: ParsedDocument,
): VerifiedFlags {
  const flags: Flag[] = [];
  const dropped: DroppedFlag[] = [];

  for (const candidate of candidates) {
    const citation = verifyQuote(candidate.sourceSentence, document);
    if (!citation) {
      dropped.push({
        id: candidate.id,
        clauseType: candidate.clauseType,
        claimedSentence: candidate.sourceSentence,
        reason: reasonFor(candidate.sourceSentence),
      });
      continue;
    }
    flags.push({
      id: candidate.id,
      clauseType: candidate.clauseType,
      severity: candidate.severity,
      citation,
      meaning: candidate.meaning,
      counterOffer: candidate.counterOffer,
      escapability: candidate.escapability,
      claimedRedLineId: candidate.claimedRedLineId,
    });
  }

  return { flags, dropped };
}
