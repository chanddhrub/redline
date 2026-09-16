# 02: The verification gate

Status: ready-for-agent

**What to build:** The thing standing between the model and the reader. Every
candidate flag the model returns carries a source sentence; every one of them is
put through `locate` against the canonical stored text. A candidate whose quote
does not land is dropped — not softened into an unsourced note, not shown with a
warning, not paraphrased. Dropped.

A `Flag` carries its located `Span`. It must not be constructible without one:
that is a type-level guarantee, and it is what turns PRD §4's T1 from a review
item into a standing check. The drop is recorded with its reason and carried out
of the pipeline so the tests and the smoke script can count it — the dropped
count is the product's own instrument for noticing that the prompt has started
paraphrasing.

The negative half is the centre of this ticket. A paraphrase, a sentence with
one word changed, a plausible sentence lifted from the *other* fixture, a subtly
reworded clause: every one is dropped. A false positive here is PRD §4's single
falsifying result arriving through the back door.

**Blocked by:** intake tickets 01 and 02 (`locate` and its normalisation).

- [ ] `verifyFlags` takes candidates and a parsed document and returns the flags
      that survived alongside the drops and their reasons
- [ ] A `Flag` cannot be constructed without a located span; the compiler
      enforces it
- [ ] Every surviving flag's span slices the canonical text back to the quoted
      sentence exactly
- [ ] Positive corpus from the fixture sidecar: every planted clause's verbatim
      sentence survives
- [ ] Negative corpus: paraphrase, one word changed, a sentence from the other
      fixture, a subtle rewording — each is dropped, and zero reach the reader
- [ ] Drops carry a reason and are returned, never rendered
- [ ] The same gate is available to the summary and to question answers
- [ ] No fuzzy matching, no best-effort quote repair, no nearest-sentence
      fallback exists anywhere in the gate
