/**
 * The coverage receipt reads as one block: a "Checked" row for each clause
 * type, then every `notReviewed` line as a bullet under the heading "Not
 * reviewed". Each line's opening sentence is read as the thing that was not
 * reviewed, so it must never name the four types the rows above say were
 * checked (FINDINGS.md #2).
 */

import { describe, expect, it } from "vitest";
import { buildCoverageReceipt } from "./coverage";

describe("coverage receipt", () => {
  it("never lists the checked clause types under Not reviewed", () => {
    const receipt = buildCoverageReceipt([]);

    for (const line of receipt.notReviewed) {
      const opening = line.split(". ")[0].toLowerCase();
      if (opening.includes("clause type")) {
        expect(opening).toMatch(/outside|other than/);
      }
    }
  });
});
