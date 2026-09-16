/**
 * The coverage receipt.
 *
 * Not a footer. ADR 0004 makes it the only thing standing between a borderline
 * flag the gate dropped and a reader concluding their contract is fine, so it
 * is returned on every analysis, clean or not, and it is built here from the
 * flags that survived rather than from anything the model said about its own
 * work.
 *
 * Derived, for two reasons. A finding written by the model is a claim about the
 * document with no sentence behind it, which is the one thing this product does
 * not print; and a written finding can say "nothing found" directly above a
 * flag of that type, which is worse than saying nothing at all. Counting the
 * flags the reader is about to see cannot contradict the list the reader is
 * about to see.
 *
 * `notReviewed` is fixed text because the limit it describes is fixed: v1 looks
 * at four clause types and no others, and a missing clause has no sentence to
 * quote (PRD §5.5). It is the product's standing admission of its own bounds,
 * and it does not vary by document.
 */

import { CLAUSE_TYPES, type ClauseType } from "../model/payloads";
import type { RankedFlag } from "./rank";

/** What each clause type is called in front of a reader. PRD §5.1–§5.4. */
export const CLAUSE_TYPE_LABELS: Readonly<Record<ClauseType, string>> = {
  "non-compete": "Non-compete and non-solicit",
  arbitration: "Mandatory arbitration and class-action waiver",
  "ip-assignment": "IP assignment and moonlighting restrictions",
  "equity-clawback": "Equity vesting, clawback and signing-bonus repayment",
};

export interface CoverageEntry {
  readonly clauseType: ClauseType;
  readonly label: string;
  /** How many flags of this type the reader is being shown. */
  readonly flagCount: number;
  /** What was found, in one line. Derived from `flagCount`. */
  readonly finding: string;
}

export interface CoverageReceipt {
  /** All four clause types, in the order PRD §5 lists them, always. */
  readonly checked: CoverageEntry[];
  /** What this analysis did not look at. */
  readonly notReviewed: string[];
}

/**
 * What v1 does not look at, said plainly enough that a reader who has just been
 * shown no flags does not read it as "safe to sign" (PRD §4 T6).
 */
export const NOT_REVIEWED: readonly string[] = [
  "Only the four clause types above. Nothing here looked at pay, hours, notice, severance, benefits or confidentiality, and a clause outside those four can still be the one that hurts you.",
  "Anything the document leaves out. A term that is missing has no sentence to quote, so nothing here can flag it. An offer letter that says nothing about severance reads the same as one that treats you well.",
  "Whether a court where you work would hold you to any of this. Nothing above answers that.",
  "Any schedule, exhibit or handbook this document refers to but does not contain.",
];

function finding(flagCount: number): string {
  if (flagCount === 0) return "Checked. Nothing here qualifies.";
  if (flagCount === 1) return "Checked. One clause flagged.";
  return `Checked. ${flagCount} clauses flagged.`;
}

/**
 * The receipt for this analysis. Every clause type appears whether or not
 * anything was found, because a type that quietly vanishes from the list on a
 * clean document is a type the reader never learns was in scope.
 */
export function buildCoverageReceipt(
  flags: readonly RankedFlag[],
): CoverageReceipt {
  return {
    checked: CLAUSE_TYPES.map((clauseType) => {
      const flagCount = flags.filter(
        (ranked) => ranked.flag.clauseType === clauseType,
      ).length;
      return {
        clauseType,
        label: CLAUSE_TYPE_LABELS[clauseType],
        flagCount,
        finding: finding(flagCount),
      };
    }),
    notReviewed: [...NOT_REVIEWED],
  };
}
