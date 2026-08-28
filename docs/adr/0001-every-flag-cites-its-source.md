# 1. Every flag cites its source sentence — accepted 2026-08-28

## Decision

Every risk flag carries the exact sentence from the uploaded document it came
from, shown next to the flag and matching the stored text verbatim. A flag
whose source sentence cannot be shown is a bug — not a formatting preference,
and not a result to ship in a degraded form.

## Alternatives

- Let the model describe risks in its own words with nothing quoted. Reads
  fluently, never fails to produce output, and nothing in it can be checked.
- Cite the clause, section or page instead. Cheaper, but sends the reader
  back into the document to find what we meant.
- Quote where easy, paraphrase otherwise. The reader cannot tell the two
  apart, so the weakest flag sets the trust level for all of them.

## Why

A reader can put our claim and their contract side by side and settle it
themselves: confirm the sentence is theirs, read what surrounds it, judge
whether our severity is fair, and check that the counter-offer rewrites the
clause in front of them. When we are wrong, it is visible rather than
plausible. That is what this version exists to prove.

## Consequences

- OCR is ruled out: a citation is worthless when the text it points at was
  misread.
- Recall drops on purpose: a risk we cannot anchor to a sentence is dropped,
  not softened into an unsourced note.
- Browser-side parsing must preserve sentence text exactly as stored, and any
  normalisation sent to the model must be reversible, or quotes will not match.
- Model output is verified, not trusted: a returned quote not found in the
  stored text is a failed flag.
- Testing needs fixture documents with expected spans, and a standing check
  that no flag renders without a locatable source.
- Summary, severity ranking and the question box inherit the standard.
