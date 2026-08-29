# 3. Severity is escapability, then money — accepted 2026-08-28

## Decision

A clause is dangerous in proportion to **how hard it is to get out of**, with
**money at stake** as the second axis. Escapability ranks first: where two
clauses cost the same, the one that binds longer or is harder to exit ranks
higher. Unusualness is not severity — a clause can be strange and harmless.

Each of the four v1 clause types carries a default severity. A matching red
line **promotes** a flag to the top of the list and states which red line it
crossed. Red lines cannot demote a flag below its default.

v1 flags four clause types for job seekers:

1. Non-compete / non-solicit
2. Mandatory arbitration and class-action waiver
3. IP assignment and moonlighting restrictions
4. Equity vesting, clawback and signing-bonus repayment

## Alternatives

- **Deviation from market norm**, which is what a lawyer does. Rejected: it
  needs a corpus of normal offer letters we do not have, and "unusual for this
  document type" is a claim no source sentence can support (ADR 0001).
- **Probability × harm.** Rejected: the model would be inventing both numbers.
- **Purely personal severity**, driven only by red lines. Rejected: a user who
  sets none gets no ranking, and two users get contradictory answers on the
  same document.
- **Purely objective severity**, red lines only filtering the view. Rejected:
  that makes red lines a display toggle rather than something that drives the
  analysis.
- **Equity clawback alone**, as a wedge inside the wedge. Rejected on review:
  silence on arbitration and non-competes would fail the segment on its two
  best-evidenced exposures.

## Why

A reader can check the ranking against their own situation. "This binds you
for 18 months across your whole industry" is verifiable from the sentence
quoted; "this is unusual" is not. Escapability also matches every pain in the
research — the harm was always being stuck, not being surprised.

Clause types 1, 2 and 4 rest on the research; **3 does not**. IP assignment
appears in the product hypothesis with no supporting complaint or enforcement
data, and ships on judgement: it is the clause most likely to catch an engineer
with side projects. Recorded here so the gap is visible rather than assumed.

## Consequences

- Severity needs a stated basis per clause type — duration, scope, cost to
  exit — not a number the model picks. Two runs on the same document should
  rank the same way.
- Red lines need a defined vocabulary to match against clause types, or
  promotion cannot be implemented.
- Two axes need a tie-break. Escapability wins; where it is equal, money wins.
- A clause outside the four types may still be genuinely dangerous. v1 will
  miss it, and the output should not imply the document was fully reviewed.
