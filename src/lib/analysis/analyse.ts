/**
 * The pipeline (ticket 04). One `AnalysisRequest` in, one `Analysis` out.
 *
 * The model is asked once. Everything it returns is a claim, and every claim it
 * makes about the document goes through the gate in `verify.ts` before it can
 * become part of a result. What survives is ordered by `rank.ts`. Neither is
 * reimplemented here and neither is bypassed: this module is the wiring, the
 * derivation of the coverage receipt, and nothing else.
 *
 * The order of operations matters in one place. The receipt is built *after*
 * the gate, from the flags that survived, so it counts what the reader is about
 * to see rather than what the model proposed. A candidate the gate dropped is
 * invisible to the reader and is invisible to the receipt too, which is the
 * honest reading: we cannot show a clause we cannot quote, so we have not found
 * one we can show.
 *
 * Drops are carried out and never rendered (ADR 0001). They are the product's
 * own instrument: a run where most candidates are dropped means the prompt has
 * started paraphrasing, and the number is how anyone finds out.
 */

import { parseDocument, type ParsedDocument } from "../intake/parse-document";
import type { AnalysisRequest } from "../intake/analysis-request";
import type { ModelClient, ModelFailure } from "../model/client";
import { ANALYSIS_OPERATION, analysisSchema } from "../model/payloads";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUser } from "./prompt";
import { buildCoverageReceipt, type CoverageReceipt } from "./coverage";
import { rankFlags, type RankedFlag } from "./rank";
import { documentStatement, type DocumentStatement } from "./register";
import type { EnforceabilityNote } from "./enforceability";
import {
  verifyFlags,
  verifyQuote,
  type Citation,
  type DroppedFlag,
  type DroppedQuote,
} from "./verify";

/**
 * The summary, after the gate. A list of claims rather than a paragraph,
 * because a claim whose support did not locate is removed on its own and the
 * rest of the summary stands. Every claim carries the sentence it rests on, so
 * the reader checks a summary the way they check a flag.
 */
export interface Summary {
  readonly claims: DocumentStatement[];
}

/** What the gate rejected. Counted, never rendered. */
export interface Drops {
  readonly flags: DroppedFlag[];
  readonly summaryClaims: DroppedQuote[];
  readonly governingLaw: DroppedQuote | null;
  /** Claimed matches to red lines the user never declared, which `rankFlags`
   *  refuses. The flag itself survives, unpromoted; only the claim is dropped. */
  readonly redLineClaims: number;
}

export interface Analysis {
  readonly summary: Summary;
  readonly flags: RankedFlag[];
  readonly coverage: CoverageReceipt;
  /**
   * The general register: what a court or an employer might do. Supplied by the
   * caller (the enforceability layer), never produced here, and never consulted
   * by the ranking — running with and without it gives the same flags in the
   * same order with the same severities (ADR 0005). It is carried through
   * untouched and joined to a flag by topic at render time; nothing on this
   * side of the wire reads it.
   */
  readonly context: EnforceabilityNote[];
  /** In the document, so it is a citation rather than a flag: a governing-law
   *  sentence has no clause type, no severity and no counter-offer. */
  readonly governingLaw: Citation | null;
  readonly dropped: Drops;
}

export type AnalysisFailure =
  | { kind: "model"; failure: ModelFailure }
  /** The stored text will not re-read as a document. Empty, or not text. */
  | { kind: "unreadable-document" };

export type AnalysisOutcome =
  | { ok: true; analysis: Analysis }
  | { ok: false; failure: AnalysisFailure };

export interface AnalyseOptions {
  /** The labelled second layer, if the caller has one for this reader. */
  context?: EnforceabilityNote[];
}

/**
 * An `AnalysisRequest` carries the canonical text and its sentences but not
 * `locate`, because a method does not survive the JSON trip from the browser.
 * The gate needs the real one, so the text is read back through the same parser
 * that produced it. The parser is a pure function of the text, so the document
 * that comes out is the one the reader confirmed on screen — re-deriving it is
 * what keeps every span an index into the text the reader is looking at.
 *
 * Exported because the question box needs the same document this pipeline
 * needs, for the same reason. Two copies of this would be two chances for a
 * span to mean something different on one screen than on the other.
 */
export async function rereadDocument(
  text: string,
): Promise<ParsedDocument | null> {
  const bytes = new TextEncoder().encode(text);
  const result = await parseDocument(
    bytes.buffer.slice(0) as ArrayBuffer,
    "analysis-request.txt",
  );
  return result.ok ? result.document : null;
}

export async function analyse(
  request: AnalysisRequest,
  model: ModelClient,
  options: AnalyseOptions = {},
): Promise<AnalysisOutcome> {
  const document = await rereadDocument(request.text);
  if (!document) {
    return { ok: false, failure: { kind: "unreadable-document" } };
  }

  const result = await model.complete({
    operation: ANALYSIS_OPERATION,
    system: ANALYSIS_SYSTEM_PROMPT,
    user: buildAnalysisUser(request),
    schema: analysisSchema,
  });
  if (!result.ok) {
    return { ok: false, failure: { kind: "model", failure: result.failure } };
  }
  const payload = result.value;

  const verified = verifyFlags(payload.candidates, document);
  const flags = rankFlags(verified.flags, request.redLines);

  // A claim at a time. The gate decides which of them the reader sees, and a
  // claim that loses its sentence is removed rather than shown unsupported.
  const claims: DocumentStatement[] = [];
  const droppedClaims: DroppedQuote[] = [];
  for (const claim of payload.summary.claims) {
    const citation = verifyQuote(claim.sourceSentence, document);
    if (citation) claims.push(documentStatement(claim.claim, citation));
    else {
      droppedClaims.push({
        claimedSentence: claim.sourceSentence,
        reason: claim.sourceSentence.trim() ? "quote-not-found" : "quote-empty",
      });
    }
  }

  let governingLaw: Citation | null = null;
  let droppedGoverningLaw: DroppedQuote | null = null;
  if (payload.governingLawSentence !== null) {
    governingLaw = verifyQuote(payload.governingLawSentence, document);
    if (!governingLaw) {
      droppedGoverningLaw = {
        claimedSentence: payload.governingLawSentence,
        reason: payload.governingLawSentence.trim()
          ? "quote-not-found"
          : "quote-empty",
      };
    }
  }

  // A candidate can claim a red line the reader never declared. `rankFlags`
  // refuses the claim and ranks the flag unpromoted; counting the refusals here
  // is what makes that visible in a test and in the smoke run.
  const redLineClaims = flags.filter(
    (ranked) => ranked.flag.claimedRedLineId !== null && ranked.promotion === null,
  ).length;

  return {
    ok: true,
    analysis: {
      summary: { claims },
      flags,
      coverage: buildCoverageReceipt(flags),
      context: options.context ?? [],
      governingLaw,
      dropped: {
        flags: verified.dropped,
        summaryClaims: droppedClaims,
        governingLaw: droppedGoverningLaw,
        redLineClaims,
      },
    },
  };
}
