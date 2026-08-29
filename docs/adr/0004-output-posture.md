# 4. Output posture: miss rather than cry wolf — accepted 2026-08-28

## Decision

- **Precision over recall.** Where a flag is doubtful, drop it.
- **Certain about the text, explicit about the consequence.** What a sentence
  says is stated flatly. What a court would do with it is marked as uncertain.
- **A clean document returns a coverage receipt**: the clause types checked,
  the finding for each, and a plain statement of what was not reviewed. Never
  an empty result, never a manufactured low-severity finding.

## Alternatives

- **Over-flag rather than miss.** Safer for the individual, but the report
  grows, severity flattens, the user learns to skim, and the trust thesis dies.
  The research names false positives as the universal complaint at every tier.
- **Confident throughout, including consequences.** Most useful to a frightened
  reader; also how this category draws regulators (FTC v. DoNotPay, $193k).
- **Hedged throughout.** Legally safest and useless: it hands the decision back
  to the person who came because they could not make it.
- **Always show the lowest-severity items** so a report is never empty. This is
  precisely the behaviour that makes a tool stop being believed.

## Why

Every part of this is checkable by the reader. They can see which clause types
were examined and which were not, so "no flags" cannot be misread as "safe to
sign". They can see which statements are about the text — verifiable against
the quoted sentence — and which are predictions, which are not.

## Consequences

- A dropped borderline flag is invisible to the user. The coverage receipt is
  the only thing preventing that from reading as a clean bill of health, so it
  is load-bearing, not a footer.
- Two registers must be visually distinct in the interface, or the distinction
  exists only in the prompt and is lost on the reader.
- "Uncertain" needs a definition the model can apply consistently, or the split
  becomes arbitrary.
- Coverage is bounded by ADR 0003's four clause types, so the receipt is also a
  standing admission of what v1 does not do.
