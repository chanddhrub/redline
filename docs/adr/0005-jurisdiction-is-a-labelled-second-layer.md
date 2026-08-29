# 5. Jurisdiction is a labelled second layer — accepted 2026-08-28

## Decision

Redline asks the user for the state they work in, and shows enforceability as a
**second layer, explicitly labelled as not coming from the document** and
visually distinct from cited flags. Every flag still carries its source
sentence; the enforceability note sits beside it, marked as general legal
context rather than a reading of the text.

This narrows the rule in `CLAUDE.md` — "state only what the document says" —
which now governs the flag layer. The second layer is permitted only when it is
labelled, and it may never silently change a flag's severity.

## Alternatives

- **Stay silent on enforceability.** The purest form of the trust rule.
  Rejected: a Californian would be told their void non-compete is critical —
  accurate about the text, badly misleading about their life.
- **Use the document's governing-law clause**, which is in the document and so
  breaks no rule. Rejected as the primary source: governing law often differs
  from where the employee works, and for non-competes the employee's state
  frequently prevails. Still worth showing where present.
- **A generic "enforceability varies by state" caveat.** Rejected: it is the
  hedged language ADR 0004 rules out.

## Why

The reader can tell the two layers apart and check each in the way it deserves:
the flag against their contract, the enforceability note against their state.
Merging them would make the whole output only as trustworthy as its weakest
half.

## Consequences

- The product now holds a claim it cannot cite a sentence for. That is a real
  weakening of ADR 0001's guarantee, confined deliberately to a labelled layer.
- State-level content is needed for four clause types. Its provenance and
  staleness become a maintenance burden, and it goes out of date silently.
- Asking for a state adds friction before the user has seen any value.
- The line between "general legal context" and legal advice is now the product's
  main regulatory exposure.
