/**
 * Seam 3 of analysis (ticket 03) — severity, ranking and promotion.
 *
 * The order the reader sees is decided here, by us, and not by the model. Pure,
 * deterministic, no I/O, no model call, no React, no storage. The same flags in
 * a shuffled input order come back in the same order every time, because the
 * comparator is a *total* order: it never returns 0 for two distinct flags.
 * PRD §4 T3 calls two flags swapping between runs a bug, not variance.
 *
 * **Severity is not a number the model picked.** A candidate carries a
 * `severity` field, because the schema asks for one, but the band a flag ranks
 * in comes from `DEFAULT_SEVERITY` below — the four defaults fixed by PRD §5,
 * set in exactly one place. If a default is wrong it needs an ADR, not an edit
 * at a call site (PRD §5 says so in as many words).
 *
 * **"Unusual is not dangerous" (ADR 0003).** Nothing here reads unusualness,
 * rarity, or deviation from a norm. There is no corpus of normal offer letters,
 * and no source sentence can support the claim that a clause is unusual. The
 * only things this module reads are the clause type, the escapability inputs
 * the model read out of the quoted sentence, the dollar figures in that
 * sentence, and where the sentence sits in the document.
 *
 * **What is read out of free text, and what is not.** The escapability inputs
 * arrive as `{ factor, value }` pairs of model prose (a strict JSON schema
 * cannot carry per-clause-type keys). Two things in that prose are objectively
 * extractable and are extracted: a stated duration, and a stated dollar figure.
 * A yes/no answer to one of the named inputs of PRD §5.1–§5.4 is the third, and
 * its polarity — does "yes" widen the restriction or limit it — comes from the
 * table in `FACTOR_POLARITY`, keyed by the input names PRD §5 lists. Free-text
 * scope prose ("the United States and Canada") is deliberately *not* converted
 * into a number: there is no scale for it, and inventing one would make the
 * reader's order depend on our prose rather than on their contract.
 *
 * **A missing or unparseable input sorts last.** A duration or an amount we
 * could not read cannot support the claim that this clause binds longer or
 * costs more than the one below it, so it ranks below every flag that states
 * one. Two unreadable values are equal to each other and fall through to the
 * next key, so the absence never produces an unstable comparison.
 */

import type { ClauseType, Severity } from "../model/payloads";
import type { RedLine } from "../intake/analysis-request";
import type { Flag } from "./verify";

/**
 * The four default bands, PRD §5.1–§5.4, in one place and nowhere else.
 * Non-compete/non-solicit and arbitration/class-action waiver are Critical; IP
 * assignment/moonlighting and equity vesting/clawback/signing-bonus repayment
 * are High.
 */
export const DEFAULT_SEVERITY: Readonly<Record<ClauseType, Severity>> = {
  "non-compete": "critical",
  arbitration: "critical",
  "ip-assignment": "high",
  "equity-clawback": "high",
};

export function defaultSeverityFor(clauseType: ClauseType): Severity {
  return DEFAULT_SEVERITY[clauseType];
}

/** Critical above High. The only place a band becomes a number. */
const BAND_ORDER: Readonly<Record<Severity, number>> = {
  critical: 0,
  high: 1,
};

/** The red line a flag crossed, named so the reader can see their constraint
 *  did work. Present only when the claimed id is one the user declared. */
export interface Promotion {
  readonly redLineId: string;
  readonly redLineText: string;
}

/**
 * A flag in its place in the list. The flag itself is untouched — `Flag` has no
 * writable severity and this module never tries to write one — so `severity`
 * here is the clause type's default band, stated beside the flag rather than
 * stamped onto it.
 */
export interface RankedFlag {
  readonly flag: Flag;
  /** The default band for the clause type. Never the model's number. */
  readonly severity: Severity;
  /** 1-based position in the list the reader sees. */
  readonly rank: number;
  /** The declared red line this flag crossed, or `null`. */
  readonly promotion: Promotion | null;
}

/**
 * Seam 3. Flags in, the reader's order out.
 *
 * Promotion raises and names. It never demotes, never filters and never lowers
 * a severity: `severity` is a pure function of `clauseType`, so no red line —
 * declared, undeclared or absent — can change it.
 */
export function rankFlags(
  flags: readonly Flag[],
  redLines: readonly RedLine[],
): RankedFlag[] {
  const declared = new Map(redLines.map((line) => [line.id, line]));

  const keyed = flags.map((flag) => {
    // The match is a model judgement — free text against a clause — so it
    // arrives as a *claim*. A claimed match to a red line the user never
    // declared is dropped here, and the flag ranks unpromoted (ADR 0003).
    const claimed = flag.claimedRedLineId;
    const line = claimed === null ? undefined : declared.get(claimed);
    const promotion: Promotion | null = line
      ? { redLineId: line.id, redLineText: line.text }
      : null;
    return { flag, promotion, ...escapabilityKeys(flag) };
  });

  keyed.sort(compare);

  return keyed.map((entry, index) => ({
    flag: entry.flag,
    severity: defaultSeverityFor(entry.flag.clauseType),
    rank: index + 1,
    promotion: entry.promotion,
  }));
}

interface Keyed {
  readonly flag: Flag;
  readonly promotion: Promotion | null;
  /** How long the clause binds, in days. `null` where the sentence did not say. */
  readonly durationDays: number | null;
  /** Net count of named escapability inputs answered so as to widen the
   *  restriction, minus those answered so as to limit it. Never negative-going
   *  on unusualness — it counts answers, not deviations. */
  readonly scopeBreadth: number;
  /** The largest dollar figure at stake. `null` where none was stated. */
  readonly money: number | null;
}

/**
 * The precedence, in order:
 *
 * 1. promoted flags first;
 * 2. then severity band, Critical above High;
 * 3. then the escapability inputs read from the quoted sentence — longer
 *    duration first, then broader scope (PRD §5 names duration first, and ADR
 *    0003's basis is how long you are stuck before how wide the net is);
 * 4. then money, the larger dollar figure first;
 * 5. then span position, so nothing is ever tied.
 *
 * Step 5 makes the order total. The final `id` comparison exists for the one
 * case span cannot break — two flags citing the very same sentence — so that
 * "total" is true of every input, not merely of the inputs we have seen.
 */
function compare(a: Keyed, b: Keyed): number {
  const promoted = Number(b.promotion !== null) - Number(a.promotion !== null);
  if (promoted !== 0) return promoted;

  const band =
    BAND_ORDER[defaultSeverityFor(a.flag.clauseType)] -
    BAND_ORDER[defaultSeverityFor(b.flag.clauseType)];
  if (band !== 0) return band;

  const duration = descendingUnknownLast(a.durationDays, b.durationDays);
  if (duration !== 0) return duration;

  const scope = b.scopeBreadth - a.scopeBreadth;
  if (scope !== 0) return scope;

  const money = descendingUnknownLast(a.money, b.money);
  if (money !== 0) return money;

  const start = a.flag.citation.span.start - b.flag.citation.span.start;
  if (start !== 0) return start;

  const end = a.flag.citation.span.end - b.flag.citation.span.end;
  if (end !== 0) return end;

  return a.flag.id < b.flag.id ? -1 : a.flag.id > b.flag.id ? 1 : 0;
}

/**
 * Larger first; an absent value after every present one; two absent values
 * equal, so the comparison falls through to the next key rather than wobbling.
 */
function descendingUnknownLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * The escapability inputs of PRD §5.1–§5.4 that state *how long the clause
 * binds*. `repaymentWindow` is deliberately absent: a short window to pay a
 * clawback back is worse for the reader, not better, and folding it in with
 * "longer is worse" would invert the order it is meant to set.
 */
const DURATION_FACTORS: ReadonlySet<string> = new Set([
  "duration",
  "repaymenttrigger",
]);

/**
 * The named inputs of PRD §5.1–§5.4 that take a yes/no answer, and what "yes"
 * means for the reader.
 *
 * - `widening`: yes means the restriction reaches further.
 * - `limiting`: the input asks about a *limit*, so no means it reaches further.
 *
 * A factor not in this table contributes nothing. That is deliberate: without
 * knowing which way the question points, a "yes" is not evidence of anything,
 * and guessing would put the reader's order at the mercy of the model's choice
 * of wording.
 */
const FACTOR_POLARITY: Readonly<Record<string, "widening" | "limiting">> = {
  // §5.1 non-compete / non-solicit
  survivesterminationwithoutcause: "widening",
  // §5.2 arbitration / class-action waiver
  classactionwaiver: "widening",
  carveouts: "limiting",
  // §5.3 IP assignment / moonlighting
  coversworkoutsideworkinghours: "widening",
  coversworkoffcompanyequipment: "widening",
  coversuncompensatedwork: "widening",
  outsideworkbarredoutright: "widening",
  limitedtoemployerfield: "limiting",
  priorinventionsschedule: "limiting",
  // §5.4 equity vesting / clawback / signing-bonus repayment
  vestedequityrepurchasable: "widening",
};

function normaliseFactor(factor: string): string {
  return factor.toLowerCase().replace(/[^a-z]/g, "");
}

function escapabilityKeys(
  flag: Flag,
): Pick<Keyed, "durationDays" | "scopeBreadth" | "money"> {
  let durationDays: number | null = null;
  let scopeBreadth = 0;
  // The quoted sentence itself is the most checkable source of a figure: it is
  // the document's own bytes, and the reader can see it.
  let money = largestAmount(flag.citation.text);

  for (const { factor, value } of flag.escapability) {
    const key = normaliseFactor(factor);

    if (DURATION_FACTORS.has(key)) {
      const days = longestDuration(value);
      if (days !== null && (durationDays === null || days > durationDays)) {
        durationDays = days;
      }
    }

    const polarity = FACTOR_POLARITY[key];
    if (polarity) {
      const answer = yesOrNo(value);
      if (answer !== null) {
        const widens = polarity === "widening" ? answer : !answer;
        scopeBreadth += widens ? 1 : -1;
      }
    }

    const amount = largestAmount(value);
    if (amount !== null && (money === null || amount > money)) money = amount;
  }

  return { durationDays, scopeBreadth, money };
}

/**
 * A stated yes or no, or `null` where the value answered with prose. "not
 * stated in the sentence" and "none stated" are non-answers and count as
 * neither: a sentence silent on an input is not evidence that the restriction
 * is wider *or* narrower, and reading silence either way would be a claim the
 * text does not support (ADR 0001).
 */
function yesOrNo(value: string): boolean | null {
  const leading = value.trim().toLowerCase().match(/^[a-z]+/)?.[0];
  if (leading === "yes") return true;
  if (leading === "no") return false;
  return null;
}

const DAYS_PER_UNIT: Readonly<Record<string, number>> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

const UNITS = Object.keys(DAYS_PER_UNIT).join("|");

/**
 * Digits win where the value offers both — "eighteen (18) months" is the shape
 * a contract writes, and the parenthesised digits are the same number.
 */
const DIGIT_DURATION = new RegExp(
  String.raw`(\d+)\s*\)?\s*(${UNITS})s?\b`,
  "gi",
);

const WORD_DURATION = new RegExp(
  String.raw`([a-z]+(?:[-\s][a-z]+)?)\s*\)?\s*(${UNITS})s?\b`,
  "gi",
);

const WORD_NUMBERS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

function wordNumber(words: string): number | null {
  const parts = words.toLowerCase().split(/[-\s]+/).filter(Boolean);
  let total = 0;
  for (const part of parts) {
    const value = WORD_NUMBERS[part];
    if (value === undefined) return null;
    total += value;
  }
  return total > 0 ? total : null;
}

/**
 * The longest stated period in the value, in days, or `null` where the value
 * states none. "during your employment" states no period and returns `null`,
 * which sorts last — we are not going to invent a length for it.
 */
export function longestDuration(value: string): number | null {
  let longest: number | null = null;

  for (const match of value.matchAll(DIGIT_DURATION)) {
    const days = Number(match[1]) * DAYS_PER_UNIT[match[2].toLowerCase()];
    if (longest === null || days > longest) longest = days;
  }
  if (longest !== null) return longest;

  for (const match of value.matchAll(WORD_DURATION)) {
    const count = wordNumber(match[1]);
    if (count === null) continue;
    const days = count * DAYS_PER_UNIT[match[2].toLowerCase()];
    if (longest === null || days > longest) longest = days;
  }
  return longest;
}

const AMOUNT = /\$\s*(\d[\d,]*(?:\.\d+)?)/g;

/** The largest dollar figure stated, or `null` where none is. */
export function largestAmount(value: string): number | null {
  let largest: number | null = null;
  for (const match of value.matchAll(AMOUNT)) {
    const amount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;
    if (largest === null || amount > largest) largest = amount;
  }
  return largest;
}
