# 06: The question box

Status: ready-for-agent

**What to build:** A job seeker asks a question about their document and gets an
answer drawn from the document alone, showing the sentences it rests on. Where
the text does not answer, the product says so rather than reaching for general
knowledge.

There are two states and only two. An answer that cites nothing locatable
becomes "the document does not address this". There is no third state in which
an unsupported answer is shown with a caveat, because PRD §4 T5 is explicit: one
fabricated answer destroys the thesis more thoroughly than ten missed flags.

The citations run through the same verification gate as a flag. A confident
model answer citing a sentence that is not in the document is refused, not
softened.

**Blocked by:** 01, 02, 04.

- [ ] A question is answered from the document only, with the sentences it rests
      on shown verbatim
- [ ] A question the document is silent on returns "not addressed", in plain
      words, as product copy
- [ ] An answer whose citations do not locate becomes "not addressed", even when
      the model returned a confident answer
- [ ] Adversarial questions whose answers are genuinely absent ("is this
      enforceable in Texas?", "is this salary competitive?", "what happens if I
      quit in month three?") are refused, asserted in tests against both fixtures
- [ ] The answer's register is visually distinct from the cited sentences
- [ ] A server route carries the question and the request as JSON; no route
      accepts a file
- [ ] The box sits as a peer of the finding stack, not a modal
- [ ] All copy has been through the humanizer skill
