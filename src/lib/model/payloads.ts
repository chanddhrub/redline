/**
 * The JSON the model is asked for.
 *
 * These live here because the fixture-backed stub has to speak something, and
 * a shape invented inside the stub would be a shape nothing else agrees with.
 * The pipeline (ticket 03) owns what it does with these payloads — locating the
 * quotes, ranking, promotion, the coverage receipt — and may extend the schemas
 * here. What it must not do is accept a payload that skipped `parse`.
 *
 * Nothing in a payload is trusted. `sourceSentence` is a *claim* that the
 * document contains that sentence, and `claimedRedLineId` is a *claim* that a
 * declared red line matches. Both are verified downstream (ADR 0001, spec
 * seams 2 and 3). The schema only guarantees the shape.
 *
 * Shape constraints imposed by strict structured output: no optional
 * properties, so "absent" is spelled `null`; and no free-form objects, so the
 * per-clause-type escapability inputs of ADR 0003 arrive as a list of named
 * factors rather than as keys.
 */

import { z } from "zod";
import { modelSchema } from "./schema";

/** The four clause types v1 flags (ADR 0003). */
export const CLAUSE_TYPES = [
  "non-compete",
  "arbitration",
  "ip-assignment",
  "equity-clawback",
] as const;

export const clauseTypeSchema = z.enum(CLAUSE_TYPES);
export type ClauseType = z.infer<typeof clauseTypeSchema>;

/**
 * Two bands. ADR 0004 rules out a manufactured low-severity finding, so there
 * is no band for one: a clause that does not qualify is simply not a candidate.
 */
export const SEVERITY_BANDS = ["critical", "high"] as const;

export const severitySchema = z.enum(SEVERITY_BANDS);
export type Severity = z.infer<typeof severitySchema>;

export const escapabilityFactorSchema = z.object({
  factor: z.string(),
  value: z.string(),
});

export const candidateFlagSchema = z.object({
  id: z.string(),
  clauseType: clauseTypeSchema,
  severity: severitySchema,
  /** Claimed verbatim from the document. Located downstream or dropped. */
  sourceSentence: z.string(),
  meaning: z.string(),
  counterOffer: z.string(),
  escapability: z.array(escapabilityFactorSchema),
  /** Claimed match to a red line the user declared. Verified downstream. */
  claimedRedLineId: z.string().nullable(),
});

export type CandidateFlag = z.infer<typeof candidateFlagSchema>;

export const coverageFindingSchema = z.object({
  clauseType: clauseTypeSchema,
  finding: z.string(),
});

export const analysisPayloadSchema = z.object({
  summary: z.object({
    text: z.string(),
    /** Sentences the summary rests on. Located downstream, same as a flag. */
    citations: z.array(z.string()),
  }),
  candidates: z.array(candidateFlagSchema),
  /** Quoted because it is in the document. `null` where there is none. */
  governingLawSentence: z.string().nullable(),
  coverage: z.array(coverageFindingSchema),
});

export type AnalysisPayload = z.infer<typeof analysisPayloadSchema>;

export const answerPayloadSchema = z.object({
  /** The model's claim that the document speaks to the question. */
  addressed: z.boolean(),
  text: z.string(),
  citations: z.array(z.string()),
});

export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

export const ANALYSIS_OPERATION = "analysis";
export const ANSWER_OPERATION = "answer";

export const analysisSchema = modelSchema("analysis", analysisPayloadSchema);
export const answerSchema = modelSchema("answer", answerPayloadSchema);
