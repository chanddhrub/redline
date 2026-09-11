# 02: A model's quote still finds its sentence

Status: ready-for-agent

**What to build:** A source sentence stays findable when it comes back in a slightly different shape than the document wrote it. A job seeker whose PDF uses curly quotes, ligatures, or a hyphen broken across a line should not silently lose a flag to typography — and should never be shown a quote that is not actually theirs.

Normalisation is reversible and lives only inside `locate`: a normalised view of the canonical text is built alongside an index map back to canonical positions, the quote is normalised the same way and matched in normalised space, and the resulting span is mapped back. `locate` always returns offsets into the canonical text, so the text the user checked and the text the analysis quotes are the same text.

The negative half matters more than the positive half. A near-miss returns `null`, never a best guess: a dropped flag is the intended cost, a wrong flag is the failure this product exists to rule out.

**Blocked by:** 01.

- [ ] Normalisation covers whitespace collapsing, smart quotes and apostrophes, ligatures, soft hyphens, and hyphenation broken across a line or page
- [ ] Normalisation never changes a word
- [ ] Spans returned by `locate` are offsets into the canonical text, and slice back to the original sentence exactly
- [ ] Positive corpus, built from real fixture sentences: curly quotes where the document has straight ones and the reverse, a ligature spelled out, a hyphen broken across a line, collapsed or doubled whitespace, leading or trailing space — each returns a span slicing back to the original
- [ ] Negative corpus: a sentence with one word changed, a plausible sentence from a different fixture, a paraphrase, a subtly reworded clause — each returns `null`
- [ ] No fuzzy or best-effort matching exists anywhere in `locate`
