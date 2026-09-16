/**
 * The question box (ticket 06). One question and one `AnalysisRequest` in, one
 * `Answer` out.
 *
 * **There are two answers and there is no third.** Either the document
 * addresses the question, and the answer arrives with the sentences it rests
 * on; or it does not, and the reader is told that. There is no state in which
 * an unsupported answer is shown with a caveat, a confidence score or a hedge,
 * and adding one would not be a degraded result — it would be the exact
 * failure PRD §4 T5 names. One fabricated answer here destroys the thesis more
 * thoroughly than ten missed flags, because a flag arrives beside a severity
 * band, a coverage receipt and three other flags to weigh it against, while an
 * answer arrives alone, phrased in the reader's own question, and reads as the
 * truth whether or not it is one.
 *
 * So the gate is the same gate. `verifyQuotes` puts every sentence the answer
 * claims to quote through `locate` against the canonical text, exactly as a
 * flag's `sourceSentence` goes through it. Nothing here re-implements matching,
 * softens it, or reaches for a nearest sentence.
 *
 * **An answer is refused whole.** If any one of its citations fails to locate,
 * the reader gets "not addressed" rather than the answer minus a sentence. A
 * summary can drop one claim and keep the rest because each claim carries its
 * own support (see `analyse.ts`); an answer is one piece of prose resting
 * jointly on all of them, and prose whose support is part fabricated is prose
 * that says something the document does not. Keeping the located half would be
 * showing a sentence and hoping it was the load-bearing one.
 *
 * A transport failure is not an answer of either kind. Telling someone their
 * document does not address a question because a rate limit was hit would be a
 * statement about their contract we never made, so failures come back on the
 * outcome, as data, the way `analyse` returns them.
 */

import type { AnalysisRequest } from "../intake/analysis-request";
import type { ModelClient, ModelFailure } from "../model/client";
import { ANSWER_OPERATION, answerSchema } from "../model/payloads";
import { rereadDocument } from "./analyse";
import { ANSWER_SYSTEM_PROMPT, buildAnswerUser } from "./prompt";
import { verifyQuotes, type Citation, type DroppedQuote } from "./verify";

/**
 * The two states, and there is no room in the type for a third. `answered`
 * cannot be built without `Citation`s, which only the gate can mint, so an
 * answer with nothing located is not a thing this module can return.
 */
export type Answer =
  | { readonly kind: "answered"; readonly text: string; readonly citations: Citation[] }
  | { readonly kind: "not-addressed" };

const NOT_ADDRESSED: Answer = { kind: "not-addressed" };

export type AnswerFailure =
  | { kind: "model"; failure: ModelFailure }
  /** The stored text will not re-read as a document. Empty, or not text. */
  | { kind: "unreadable-document" }
  /** Nothing was asked. Not a refusal about the document — no question ran. */
  | { kind: "no-question" };

/**
 * `dropped` rides on the outcome rather than inside `Answer`, so the two states
 * stay exactly two. It is the same instrument `analyse` carries out: a box that
 * starts refusing every question because the model has started paraphrasing
 * looks, from the outside, identical to a box refusing because the documents
 * are silent. The count is the only thing that tells them apart. It is never
 * rendered (ADR 0001).
 */
export type AnswerOutcome =
  | { ok: true; answer: Answer; dropped: DroppedQuote[] }
  | { ok: false; failure: AnswerFailure };

export async function answer(
  question: string,
  request: AnalysisRequest,
  model: ModelClient,
): Promise<AnswerOutcome> {
  const asked = question.trim();
  if (!asked) return { ok: false, failure: { kind: "no-question" } };

  const document = await rereadDocument(request.text);
  if (!document) {
    return { ok: false, failure: { kind: "unreadable-document" } };
  }

  const result = await model.complete({
    operation: ANSWER_OPERATION,
    system: ANSWER_SYSTEM_PROMPT,
    user: buildAnswerUser(asked, request),
    schema: answerSchema,
  });
  if (!result.ok) {
    return { ok: false, failure: { kind: "model", failure: result.failure } };
  }
  const payload = result.value;

  // Run the gate before reading `addressed`, so the drops are counted even on
  // a payload that was going to be refused anyway. A model that says it cannot
  // answer while quoting text that is not in the document is a model whose
  // quoting has come loose, and that is worth knowing before it starts doing
  // it on the answers it is confident about.
  const verified = verifyQuotes(payload.citations, document);
  const dropped = verified.dropped;

  // The model's own refusal. Taken at its word: a model that says the document
  // is silent is not talked into an answer by anything downstream.
  if (!payload.addressed) return { ok: true, answer: NOT_ADDRESSED, dropped };

  // Everything below is a confident answer being refused. Each of these is a
  // case where the words were fluent and the support was not there.
  const text = payload.text.trim();
  if (!text) return { ok: true, answer: NOT_ADDRESSED, dropped };
  if (dropped.length > 0) return { ok: true, answer: NOT_ADDRESSED, dropped };
  if (verified.citations.length === 0) {
    return { ok: true, answer: NOT_ADDRESSED, dropped };
  }

  return {
    ok: true,
    answer: { kind: "answered", text, citations: verified.citations },
    dropped,
  };
}
