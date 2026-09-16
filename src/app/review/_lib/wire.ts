/**
 * The analysis as it arrives over the wire, and the reader-facing values
 * derived from it.
 *
 * **Why this file exists at all.** `Analysis` holds `Citation`s, and a
 * `Citation` carries a property keyed to a `unique symbol` that `verify.ts`
 * declares and does not export. That brand is what makes a flag without a
 * located sentence unconstructible (ADR 0001) — and a symbol key does not
 * survive `JSON.stringify`. So the body `/api/analysis` returns is
 * structurally identical to an `Analysis` and is not one. Casting it back
 * would hand the browser a forged brand: the compiler would then believe every
 * sentence on screen had been through the gate, on the word of a cast. The
 * wire types below are the honest description of what actually arrives — the
 * same fields, minus a guarantee this side of the network cannot hold.
 *
 * `parseAnalysis` is the gate that replaces it. The browser checks the shape it
 * was sent rather than trusting it, for the same reason the route validates its
 * own body: a response is not proof of a response. A body that does not check
 * out is a failure the reader is told about, never a half-rendered result.
 *
 * No React, no DOM, no fetch. Everything here is a pure function of data, so
 * the round trip is tested against the real pipeline's real output rather than
 * against a shape someone typed out by hand.
 */

import type { CoverageReceipt } from "@/lib/analysis/coverage";
import type { EnforceabilityTopic } from "@/lib/analysis/enforceability";
import type { ClauseType, Severity } from "@/lib/model/payloads";

export interface WireSpan {
  readonly start: number;
  readonly end: number;
}

/** A sentence the gate located, and where in the stored text it sits. The
 *  brand is gone; the evidence — the document's own bytes and their offsets —
 *  is not, and the reader checks those against their own copy. */
export interface WireCitation {
  readonly text: string;
  readonly span: WireSpan;
}

export interface WireDocumentStatement {
  readonly register: "document";
  readonly statement: string;
  readonly citation: WireCitation;
}

/**
 * A note from the labelled second layer, as it arrives (ADR 0005).
 *
 * It has no citation and no span, and there is no field here to put one in.
 * That is not an omission in the wire shape; it is the same absence the server
 * type has, carried across unchanged, because the absence is the whole
 * permission this layer runs on.
 *
 * `topic` is how the screen sits a note beside the flag it is about. The join
 * happens at render time and runs one way: the note finds the flag, and the
 * flag never learns the note is there.
 */
export interface WireGeneralStatement {
  readonly register: "general";
  readonly topic: EnforceabilityTopic;
  readonly statement: string;
  readonly basis: string;
  readonly asOf: string;
}

export interface WireFactor {
  readonly factor: string;
  readonly value: string;
}

export interface WireFlag {
  readonly id: string;
  readonly clauseType: ClauseType;
  readonly severity: Severity;
  readonly citation: WireCitation;
  readonly meaning: string;
  readonly counterOffer: string;
  readonly escapability: readonly WireFactor[];
  readonly claimedRedLineId: string | null;
}

export interface WirePromotion {
  readonly redLineId: string;
  readonly redLineText: string;
}

export interface WireRankedFlag {
  readonly flag: WireFlag;
  readonly severity: Severity;
  readonly rank: number;
  readonly promotion: WirePromotion | null;
}

export interface WireAnalysis {
  readonly summary: { readonly claims: readonly WireDocumentStatement[] };
  readonly flags: readonly WireRankedFlag[];
  readonly coverage: CoverageReceipt;
  readonly context: readonly WireGeneralStatement[];
  readonly governingLaw: WireCitation | null;
}

/* ── Checking what arrived ───────────────────────────────────────────── */

const CLAUSE_TYPES: ReadonlySet<string> = new Set([
  "non-compete",
  "arbitration",
  "ip-assignment",
  "equity-clawback",
]);

const SEVERITIES: ReadonlySet<string> = new Set(["critical", "high"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): value is string {
  return typeof value === "string";
}

function citation(value: unknown): WireCitation | null {
  if (!isRecord(value) || !str(value.text)) return null;
  const span = value.span;
  if (!isRecord(span)) return null;
  const { start, end } = span;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  const from = start as number;
  const to = end as number;
  // A span that runs backwards, or that is the wrong length for the sentence
  // it carries, is not something to render around. The two have to agree or
  // the window would crop somewhere other than the words being quoted.
  if (from < 0 || to < from) return null;
  if (to - from !== value.text.length) return null;
  return { text: value.text, span: { start: from, end: to } };
}

function documentStatement(value: unknown): WireDocumentStatement | null {
  if (!isRecord(value) || value.register !== "document") return null;
  if (!str(value.statement)) return null;
  const cited = citation(value.citation);
  if (!cited) return null;
  return { register: "document", statement: value.statement, citation: cited };
}

const TOPICS: ReadonlySet<string> = new Set([...CLAUSE_TYPES, "governing-law"]);

/**
 * A note is checked the way everything else here is checked, and one extra
 * thing is checked about it: that it did not arrive carrying a citation or a
 * span. A body that tried to hand the browser a general statement with
 * evidence attached is a body making a claim this layer is not allowed to
 * make, and it fails the whole parse rather than being quietly trimmed.
 */
function generalStatement(value: unknown): WireGeneralStatement | null {
  if (!isRecord(value) || value.register !== "general") return null;
  if (!str(value.statement) || !str(value.basis) || !str(value.asOf)) return null;
  if (!str(value.topic) || !TOPICS.has(value.topic)) return null;
  if ("citation" in value || "span" in value) return null;
  return {
    register: "general",
    topic: value.topic as EnforceabilityTopic,
    statement: value.statement,
    basis: value.basis,
    asOf: value.asOf,
  };
}

function factors(value: unknown): WireFactor[] | null {
  if (!Array.isArray(value)) return null;
  const out: WireFactor[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !str(entry.factor) || !str(entry.value)) return null;
    out.push({ factor: entry.factor, value: entry.value });
  }
  return out;
}

function flag(value: unknown): WireFlag | null {
  if (!isRecord(value)) return null;
  if (!str(value.id) || !str(value.meaning) || !str(value.counterOffer)) return null;
  if (!str(value.clauseType) || !CLAUSE_TYPES.has(value.clauseType)) return null;
  if (!str(value.severity) || !SEVERITIES.has(value.severity)) return null;
  if (value.claimedRedLineId !== null && !str(value.claimedRedLineId)) return null;
  const cited = citation(value.citation);
  if (!cited) return null;
  const escapability = factors(value.escapability);
  if (!escapability) return null;
  return {
    id: value.id,
    clauseType: value.clauseType as ClauseType,
    severity: value.severity as Severity,
    citation: cited,
    meaning: value.meaning,
    counterOffer: value.counterOffer,
    escapability,
    claimedRedLineId: value.claimedRedLineId as string | null,
  };
}

function rankedFlag(value: unknown): WireRankedFlag | null {
  if (!isRecord(value)) return null;
  if (!str(value.severity) || !SEVERITIES.has(value.severity)) return null;
  if (!Number.isInteger(value.rank)) return null;
  const inner = flag(value.flag);
  if (!inner) return null;

  let promotion: WirePromotion | null = null;
  if (value.promotion !== null) {
    const claimed = value.promotion;
    if (!isRecord(claimed) || !str(claimed.redLineId) || !str(claimed.redLineText)) {
      return null;
    }
    promotion = { redLineId: claimed.redLineId, redLineText: claimed.redLineText };
  }

  return {
    flag: inner,
    severity: value.severity as Severity,
    rank: value.rank as number,
    promotion,
  };
}

/**
 * The receipt is the one part of a clean result the reader has nothing else to
 * check against (ADR 0004), so a receipt that did not arrive whole is not
 * shown at all. All four clause types or nothing.
 */
function coverage(value: unknown): CoverageReceipt | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.checked) || !Array.isArray(value.notReviewed)) return null;
  if (value.checked.length !== CLAUSE_TYPES.size) return null;

  const checked: CoverageReceipt["checked"][number][] = [];
  for (const entry of value.checked) {
    if (!isRecord(entry)) return null;
    if (!str(entry.clauseType) || !CLAUSE_TYPES.has(entry.clauseType)) return null;
    if (!str(entry.label) || !str(entry.finding)) return null;
    if (!Number.isInteger(entry.flagCount)) return null;
    checked.push({
      clauseType: entry.clauseType as ClauseType,
      label: entry.label,
      flagCount: entry.flagCount as number,
      finding: entry.finding,
    });
  }

  const notReviewed: string[] = [];
  for (const line of value.notReviewed) {
    if (!str(line)) return null;
    notReviewed.push(line);
  }
  if (notReviewed.length === 0) return null;

  return { checked, notReviewed };
}

/**
 * The body, checked. `null` means the reader is shown the failure surface
 * rather than a partial result: half a rendered analysis is the shape a reader
 * would take for a whole one.
 */
export function parseAnalysis(value: unknown): WireAnalysis | null {
  if (!isRecord(value)) return null;

  const summary = value.summary;
  if (!isRecord(summary) || !Array.isArray(summary.claims)) return null;
  const claims: WireDocumentStatement[] = [];
  for (const entry of summary.claims) {
    const claim = documentStatement(entry);
    if (!claim) return null;
    claims.push(claim);
  }

  if (!Array.isArray(value.flags)) return null;
  const flags: WireRankedFlag[] = [];
  for (const entry of value.flags) {
    const ranked = rankedFlag(entry);
    if (!ranked) return null;
    flags.push(ranked);
  }

  const receipt = coverage(value.coverage);
  if (!receipt) return null;

  if (!Array.isArray(value.context)) return null;
  const context: WireGeneralStatement[] = [];
  for (const entry of value.context) {
    const statement = generalStatement(entry);
    if (!statement) return null;
    context.push(statement);
  }

  let governingLaw: WireCitation | null = null;
  if (value.governingLaw !== null) {
    governingLaw = citation(value.governingLaw);
    if (!governingLaw) return null;
  }

  return { summary: { claims }, flags, coverage: receipt, context, governingLaw };
}

/* ── The answer ──────────────────────────────────────────────────────── */

/**
 * The two states of an answer, as they arrive. There is no third one here for
 * the same reason there is no third one in `answer.ts`: PRD §4 T5 counts one
 * fabricated answer as worse than ten missed flags, and a "shown with a caveat"
 * state is where a fabricated answer would live.
 *
 * `not-addressed` carries no fields. There is nothing about the reader's
 * document to say, so there is nothing to serialise, and the copy the reader
 * reads is written on this side.
 */
export type WireAnswer =
  | { readonly kind: "answered"; readonly text: string; readonly citations: readonly WireCitation[] }
  | { readonly kind: "not-addressed" };

/**
 * The body, checked. `null` is not "not addressed" — a body we cannot read is
 * a failure, and reporting it as a document that does not address the question
 * would be a claim about the reader's contract we never made.
 */
export function parseAnswer(value: unknown): WireAnswer | null {
  if (!isRecord(value)) return null;
  if (value.kind === "not-addressed") return { kind: "not-addressed" };
  if (value.kind !== "answered") return null;
  if (!str(value.text) || !value.text.trim()) return null;
  if (!Array.isArray(value.citations) || value.citations.length === 0) return null;

  const citations: WireCitation[] = [];
  for (const entry of value.citations) {
    const cited = citation(entry);
    // One citation that does not check out fails the whole answer, the way it
    // does server-side. Prose resting jointly on sentences we cannot place is
    // prose we cannot stand behind.
    if (!cited) return null;
    citations.push(cited);
  }
  return { kind: "answered", text: value.text, citations };
}

/* ── Severity, in three signals ──────────────────────────────────────── */

/**
 * The spelled word. Never the only carrier, and never on its own: the bar
 * length and the stamped code go beside it everywhere it appears, so the band
 * survives greyscale, a photocopier and colour-blindness alike (DESIGN.md,
 * The Greyscale Rule).
 */
export const SEVERITY_WORD: Readonly<Record<Severity, string>> = {
  critical: "Critical",
  high: "High",
};

/** Length is the signal. 44px and 22px, as specified; the bar never changes
 *  colour. */
export const SEVERITY_BAR_PX: Readonly<Record<Severity, number>> = {
  critical: 44,
  high: 22,
};

/**
 * The stamped code, numbered within its own band down the ranked list: CR-1,
 * CR-2, HI-1. It is derived from the order the reader is looking at, so a code
 * is a position they can point at rather than an identifier from somewhere
 * they cannot see.
 */
export function stampCodes(flags: readonly WireRankedFlag[]): string[] {
  const seen: Record<Severity, number> = { critical: 0, high: 0 };
  return flags.map((ranked) => {
    seen[ranked.severity] += 1;
    return `${ranked.severity === "critical" ? "CR" : "HI"}-${seen[ranked.severity]}`;
  });
}

/**
 * The escapability inputs arrive as `{ factor, value }` pairs, and the factor
 * names are the ones PRD §5 lists — written the way a schema key is written.
 * This spaces them out and sentence-cases them for a measures table. It is a
 * presentational change to our own label and never touches `value`, which is
 * what the model read out of the reader's sentence.
 */
export function factorLabel(factor: string): string {
  const spaced = factor
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return factor;
  // No case folding beyond the first letter: the measures table is set in
  // Label type, which uppercases anyway, and folding would turn "IP" into
  // "Ip" anywhere the style ever changed.
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The one-line statement at the head of a finding row. It is the first
 * sentence of the model's plain-English meaning — our words, in our register,
 * never the document's — so the row says something about this clause rather
 * than naming its type. The full meaning still opens below it.
 */
export function headline(meaning: string): string {
  const trimmed = meaning.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  if (end === -1 || end > 180) return trimmed;
  return trimmed.slice(0, end + 1);
}

/** What is left of the meaning once the row has said the first sentence. */
export function remainder(meaning: string): string {
  const trimmed = meaning.trim();
  const head = headline(trimmed);
  return trimmed.slice(head.length).trim();
}

/* ── What went wrong, as data ────────────────────────────────────────── */

/**
 * Why an analysis did not come back. Kinds rather than messages: a transport's
 * own words are not something to put in front of a reader, and the difference
 * between "the model is unreachable" and "the model answered with something
 * unusable" is the difference between waiting and giving up.
 */
export type RunFailure =
  /** The request never left, or never came back. Offline, DNS, timeout. */
  | { kind: "no-connection" }
  /** The endpoint refused us. Rate limit, bad key, outage. */
  | { kind: "refused" }
  /** A key the server needs is not set. Named, because naming it is the fix. */
  | { kind: "not-configured"; variable: string }
  /** The model answered and the answer cannot be used: empty, not JSON, off
   *  its own schema, or a body that is not the analysis we asked for. */
  | { kind: "unusable" }
  /** The stored text would not re-read as a document. */
  | { kind: "unreadable-document" }
  /** The route rejected what we sent it. Ours to fix, not the reader's. */
  | { kind: "bad-request" };

/**
 * Reads the route's own error body. The route hands failures back as data
 * (`{ error: ... }`), so this reads that data rather than a status code alone —
 * a 502 that is a rate limit and a 502 that is a paraphrasing model are not
 * the same thing to say to someone.
 */
export function interpretFailure(status: number, body: unknown): RunFailure {
  if (status === 400) return { kind: "bad-request" };

  const error = isRecord(body) ? body.error : undefined;

  if (isRecord(error) && error.kind === "unreadable-document") {
    return { kind: "unreadable-document" };
  }

  const failure = isRecord(error) && error.kind === "model" ? error.failure : error;
  if (isRecord(failure)) {
    if (failure.kind === "missing-configuration" && str(failure.variable)) {
      return { kind: "not-configured", variable: failure.variable };
    }
    if (failure.kind === "unreachable") return { kind: "no-connection" };
    if (failure.kind === "rejected") return { kind: "refused" };
    if (failure.kind === "unusable-response") return { kind: "unusable" };
  }

  if (status === 422) return { kind: "unreadable-document" };
  return { kind: "refused" };
}
