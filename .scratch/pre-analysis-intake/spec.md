# Spec — Pre-analysis intake

Status: ready-for-agent

Covers PRD §3 items 1–3: accept one document parsed in the browser, ask for the
state the user works in, and take an editable list of red lines. Everything the
crisis user does before any analysis runs.

Written 2026-09-06 from `PRD.md`, `CONTEXT.md` and ADRs 0001–0005.

---

## Problem Statement

I have an offer letter in my inbox and a deadline. I want to hand it to Redline
and get an answer I can check.

Three things are in my way before any analysis can happen.

First, the document is a PDF or a Word file, and I am not going to retype it.
If it is a photo of a signed page, I need to be told that plainly rather than
handed a confident analysis of text a machine guessed at — a quoted sentence
that was misread on the way in is worse than no quote at all, because it looks
checkable.

Second, I do not want my offer letter sitting on somebody's server. The salary
is in it. My name is in it.

Third, the analysis is not the same for everyone. I work in California, where a
non-compete is void, and I have a side project I am not signing away. If
Redline does not know those two things it will tell me the wrong thing in a
confident voice — a Californian told their unenforceable non-compete is
Critical is accurate about the text and badly misleading about their life.

Today none of this exists. The repository has a Next.js scaffold and nothing
else.

## Solution

A single intake flow that produces one object: everything the analysis needs,
and nothing the user did not agree to hand over.

I drop a PDF, DOCX or TXT onto the page. It is parsed **in my browser** — the
file itself never leaves the machine, and only the extracted text is kept. I
can see the text that was extracted, so I know what is about to be read.

If the document has no text layer — a scan, a photo, a signed-and-returned PDF
— I get a refusal that says what happened and what to do about it, in plain
words. Not a degraded analysis. OCR is not a missing feature here; it is
excluded on purpose, and the refusal says so in ordinary language.

I am asked which US state I work in, **and told why it is being asked**: the
same clause carries different weight in different states, and that information
will be shown to me as a separate, labelled layer rather than mixed into the
quoted-sentence findings.

I add my own red lines in my own words — "I will not sign an IP assignment
covering personal projects". I can edit and delete them. They are mine, they
persist across a re-run, and they will *promote* a matching flag to the top and
name the line it crossed rather than filtering anything out.

When the document is parsed and the state is set, the analysis becomes
available to run. Red lines are optional; a user with none gets a normal
analysis.

## User Stories

**Getting the document in**

1. As a job seeker with an offer letter, I want to drop a PDF onto the page and
   have its text extracted, so that I do not have to retype my contract.
2. As a job seeker whose offer arrived as a Word file, I want DOCX accepted
   too, so that I do not have to convert it first.
3. As a job seeker who has already pasted the text somewhere, I want plain text
   accepted, so that the simplest case is not the hardest one.
4. As a job seeker, I want to pick a file with a normal file chooser as well as
   drag-and-drop, so that the page works the way I expect on a laptop.
5. As a job seeker on a phone, I want the upload control to be usable on a small
   screen, so that I can do this on the train.
6. As a job seeker, I want to see that parsing is in progress, so that I do not
   assume the page is broken on a long document.
7. As a job seeker, I want a document that takes a while to parse to still
   finish rather than silently stall, so that I am not left guessing.
8. As a job seeker, I want to replace the document with a different one without
   reloading the page, so that I can correct picking the wrong file.
9. As a job seeker, I want to see the extracted text before analysis runs, so
   that I can confirm the right document was read and that it came through
   intact.
10. As a job seeker, I want the page to tell me the file never left my browser,
    so that I know my salary is not sitting on someone's server.

**Being refused honestly**

11. As a job seeker with a scanned contract, I want to be told the document has
    no readable text, so that I do not receive an analysis built on guesses.
12. As a job seeker who was refused, I want to be told *why* in plain words —
    that reading a picture of text would make every quoted sentence
    untrustworthy — so that the refusal reads as a standard rather than a
    limitation.
13. As a job seeker who was refused, I want to be told what I can do instead
    (ask for the Word or PDF original, or paste the text), so that the refusal
    is not a dead end.
14. As a job seeker with a mostly-scanned document that has a little text on it,
    I want that treated as a scan rather than analysed from the fragments, so
    that a thin result is never mistaken for a whole reading.
15. As a job seeker with a password-protected PDF, I want to be told that
    specifically, so that I do not think my document is corrupt.
16. As a job seeker with a corrupt or unreadable file, I want a clear failure
    rather than a blank screen, so that I know to try another copy.
17. As a job seeker with an old `.doc` file, I want to be told that format is
    not supported and what to do, so that the failure is actionable.
18. As a job seeker who uploads something that is not a contract at all, I want
    intake to still work on it and let the analysis say what it finds, so that
    the tool is not guessing at my intent.

**The quoted sentence has to survive intake**

19. As a job seeker, I want every sentence in my document to keep its exact
    position in the stored text, so that a flag can quote it back to me
    verbatim and I can find it in my own copy.
20. As a job seeker whose PDF uses curly quotes, ligatures or hyphens broken
    across lines, I want a quoted sentence to still be findable, so that
    typography does not silently cost me a flag.
21. As a job seeker, I want the text shown back to me to be the same text the
    analysis reads, so that there is no gap between what I checked and what was
    analysed.
22. As a job seeker, I want a sentence that spans a page break to be treated as
    one sentence, so that a quote is not cut in half by the PDF's layout.
23. As a job seeker whose contract is full of "Section 3.2", "Inc." and "e.g.",
    I want those not to split a sentence in the middle, so that a quoted clause
    arrives whole.

**Saying where I work**

24. As a job seeker, I want to be asked which US state I work in, so that
    enforceability context can be keyed to my situation.
25. As a job seeker, I want to be told why my state is being asked for before I
    answer, so that the question does not feel like data collection.
26. As a job seeker, I want to change my state after answering, so that I can
    correct a mistake or check a role in another state.
27. As a job seeker in California, I want the state I chose to be visibly the
    one in use, so that I can tell the enforceability layer is actually keyed to
    me and not generic.
28. As a job seeker in a hurry, I want the state question to be one question
    with its reason attached rather than a form, so that the one thing standing
    between me and the analysis is worth the stop.

**Red lines**

29. As a job seeker with a side project, I want to write my own red line in my
    own words, so that the analysis reflects what I personally will not sign.
30. As a job seeker, I want to add several red lines, so that I can express more
    than one constraint.
31. As a job seeker, I want to edit a red line I have written, so that I can
    sharpen it once I see the document.
32. As a job seeker, I want to delete a red line, so that I am not stuck with a
    constraint I changed my mind about.
33. As a job seeker, I want my red lines kept when I re-run the analysis, so
    that I do not retype them.
34. As a job seeker, I want to add a red line *after* seeing the analysis and
    have it re-run, so that reading the document can teach me what I care about.
35. As a job seeker with no red lines, I want the analysis to run anyway, so
    that I am not forced to invent constraints before I know what is in the
    document.
36. As a job seeker, I want to be told plainly what a red line does — promote a
    matching flag and name the line it crossed — so that I do not expect it to
    hide anything.
37. As a job seeker, I want an empty or whitespace-only red line rejected, so
    that the list stays meaningful.

**Getting to analysis**

38. As a job seeker, I want to know exactly what is still needed before analysis
    can run, so that I am not hunting for a disabled button's reason.
39. As a job seeker who has supplied a document and a state, I want analysis to
    become available, so that the path forward is obvious.
40. As a job seeker, I want everything I have entered to survive an accidental
    in-page navigation, so that I do not start over.

## Implementation Decisions

**Two seams, both pure and both testable without a DOM.** The UI is a thin
shell over them. This is the whole structural decision; everything below is
detail.

### Seam 1 — `parseDocument`

Bytes and a filename in; either a parsed document or a typed refusal out. Format
detection, PDF and DOCX extraction, normalisation and sentence segmentation are
**internals with no seams of their own**.

```ts
parseDocument(bytes: ArrayBuffer, filename: string):
  Promise<
    | { ok: true;  document: ParsedDocument }
    | { ok: false; refusal: Refusal }
  >

interface ParsedDocument {
  text: string                  // canonical stored text, verbatim
  sentences: Sentence[]         // offsets into `text`
  locate(quote: string): Span | null
}

interface Sentence { text: string; start: number; end: number }
interface Span     { start: number; end: number }

type Refusal =
  | { kind: 'no-text-layer' }        // scan or photograph
  | { kind: 'encrypted' }
  | { kind: 'unsupported-format'; detected: string }
  | { kind: 'unreadable' }
  | { kind: 'empty' }
```

- **The canonical text is stored verbatim.** Whatever the extractor produced is
  what is kept, shown to the user, and quoted from. Nothing is cleaned on the
  way in. This is what makes T1's "string-matches the stored text exactly"
  checkable at all.
- **Normalisation is reversible and lives only inside `locate`.** A normalised
  view of the canonical text is built alongside an index map from normalised
  positions back to canonical ones. A quote is normalised the same way, matched
  in normalised space, and the resulting span is mapped back — so `locate`
  always returns offsets into the canonical text. Normalisation covers
  whitespace collapsing, smart quotes and apostrophes, ligatures, soft hyphens,
  and hyphenation broken across a line or page. It never covers anything that
  changes a word.
- **`locate` returns `null` rather than a best guess.** A near-miss is a failed
  flag, and per ADR 0001 a failed flag is dropped. Fuzzy matching would convert
  a dropped flag into a wrong one, which is the exact failure this product
  exists to rule out.
- **Sentence segmentation uses `Intl.Segmenter`** with sentence granularity —
  built in, no dependency — plus a small guard that re-joins splits caused by
  legal abbreviations (`Inc.`, `No.`, `e.g.`, `i.e.`, section numbers like
  `3.2`). Segmentation is a convenience for the analysis prompt and the UI; it
  is **not** load-bearing for citation integrity, because `locate` works against
  the full canonical text and a quote is free to span sentence boundaries.
- **Scan detection is a refusal, not a degradation.** A PDF whose extractable
  text falls below a low threshold relative to its page count is refused as
  `no-text-layer`. The threshold is deliberately conservative: refusing a thin
  real document is a recoverable annoyance, analysing a scan is a broken
  promise. The number is a constant with a comment, expected to be tuned against
  fixtures.
- **Accepted formats: PDF, DOCX, TXT.** Legacy `.doc` is refused as
  `unsupported-format` with actionable copy. Format is detected from content
  (magic bytes) rather than trusting the extension, with the filename used only
  for the message.
- **Dependencies, approved 2026-09-06:** `pdfjs-dist` for PDF, `mammoth` for
  DOCX, `vitest` as the test runner. Both parsers run in the browser and in
  Node, which is what lets the seam be tested without a DOM.
- **Parsing runs in the browser only.** There is no server route that accepts a
  file. This is not a preference — it is the settled constraint, and the absence
  of the route is the enforcement.

### Seam 2 — the analysis request

A pure state module holding the two things the user supplies alongside the
document. No React, no storage, no I/O.

```ts
setJurisdiction(state, usState): AnalysisRequestState
addRedLine(state, text): AnalysisRequestState
editRedLine(state, id, text): AnalysisRequestState
removeRedLine(state, id): AnalysisRequestState
isReady(state): boolean

toAnalysisRequest(state): AnalysisRequest | null

interface RedLine { id: string; text: string }
interface AnalysisRequest {
  text: string
  sentences: Sentence[]
  jurisdiction: UsState
  redLines: RedLine[]
}
```

- **`AnalysisRequest` is the contract with the analysis feature**, which does not
  exist yet. Defining it here is the point: it is the seam the next spec builds
  against.
- **Jurisdiction is a US state, required before analysis, and asked with its
  reason attached.** ADR 0005 makes the enforceability layer state-keyed, and a
  state-keyed layer with no state is worse than none.
- **Red lines are free text with a generated id.** No parsing, no taxonomy, no
  matching logic here — matching a red line to a flag belongs to the analysis
  feature. Intake's job is to carry them faithfully. Blank and whitespace-only
  entries are rejected; text is stored as typed otherwise.
- **Red lines never demote.** Recorded here because the type must not grow a
  severity field: the promotion rule is the analysis feature's, and intake must
  not pre-empt it.
- **Nothing is persisted.** The Supabase decision (local CLI with versioned
  migrations vs. hosted only) is still open in `CLAUDE.md`, and this feature
  does not force it. State lives in memory for the session, with `sessionStorage`
  used only to survive an accidental in-page navigation (story 40) — never
  `localStorage`, so a shared machine does not keep someone's offer letter.
- **The refusal copy is product surface, not an error string.** It is written
  once, in plain words, and says what happened, why the standard exists, and
  what to do instead. It is reviewed as copy.

### UI shell

One route. Upload → extracted-text confirmation → state question → red lines →
a clearly-stated readiness condition. Components read from the two seams and
hold no parsing or validation logic of their own. Next.js 16 App Router with
Tailwind; the parsing work happens in client components because it must.

## Testing Decisions

**A good test here asserts external behaviour only** — what `parseDocument`
returns for given bytes, and what the request module holds after a sequence of
edits. It must not reach for the normalisation index map, the segmentation
guard, the scan threshold or any other internal: those are precisely the things
we expect to change while the observable contract holds. A test that names an
internal is a test that will be deleted during the first refactor.

**Prior art: none.** This is the first test in the repository, so this spec sets
the pattern rather than following one. Vitest, Node environment, fixtures as
real files committed alongside the tests.

**Seam 1 — `parseDocument`.** Fixture documents with known text: a text-layer
PDF, a DOCX, a plain text file, a scanned PDF, an encrypted PDF, a `.doc`, a
corrupt file, an empty file. For each, assert the discriminated result. For the
readable ones, assert the canonical text matches the fixture's known text and
that every sentence's `start`/`end` slices `text` back to that sentence exactly
— the offsets are checked against the text they index, not against a snapshot.

**The adversarial `locate` corpus is the centre of this spec's testing.** For
each readable fixture, take real sentences and feed them back through `locate`
in the shapes a model returns them: curly quotes where the document has
straight ones and the reverse, a ligature spelled out, a hyphen broken across a
line, collapsed or doubled whitespace, a leading or trailing space, a sentence
spanning a page break. Every one must return a span that slices back to the
original sentence. Then the negative half, which matters more: a sentence with
one word changed, a plausible sentence from a *different* fixture, a
paraphrase, a subtly reworded clause. Every one must return `null`. A false
positive in `locate` is the single falsifying result of PRD §4 arriving through
the back door.

**Seam 2 — the analysis request.** Sequences of operations, asserting the
resulting state and `isReady`: adding, editing and removing red lines; blank
input rejected; red lines surviving a jurisdiction change; `toAnalysisRequest`
returning `null` until both a document and a state are present.

**The standing check T1 requires is not built here**, because there are no flags
yet to check. What is built here is the thing it will call. Its absence should
be visible in the next spec, not forgotten.

**Not tested here:** the UI shell beyond it rendering, since the logic lives
behind the seams and testing it through the DOM was explicitly rejected.

## Out of Scope

- The model call and everything downstream of it: the plain-English summary,
  flags, severity ranking, counter-offers, the question box, the coverage
  receipt. `AnalysisRequest` is where this spec stops.
- The enforceability second layer's **content**. Intake collects the state; it
  ships no state-level legal content, which is a separate maintained corpus
  (ADR 0005, and PRD §6.6 on its cost).
- Red-line **matching**. Intake carries red lines; deciding that one is crossed,
  and promoting the flag that crossed it, belongs to analysis.
- Persistence and auth. No Supabase, no database, no accounts — the
  local-vs-hosted decision stays open.
- OCR. Excluded on purpose, permanently, not deferred (PRD §7).
- Multiple documents, comparison, and the saved library.
- Payments and pricing.
- Non-US jurisdictions.

## Further Notes

**The Supabase decision is deliberately not forced by this feature.** If a
future ticket needs the document text to survive a page refresh, that is the
moment to decide, not now.

**`Intl.Segmenter` is the right default and may not survive contact with real
contracts.** Numbered sub-clauses and defined terms in legal text break naive
segmenters. Because segmentation is not load-bearing for citation integrity,
finding it inadequate is a tuning job rather than a redesign — but it is the
most likely part of this spec to need a second pass.

**The scan threshold will be wrong on the first try.** It is a judgement call
about how little text is too little, and the only way to set it is against real
scanned offer letters. Being conservative is the safe direction: refusing a real
document is recoverable, analysing a scan is not.

**Next.js 16 diverges from training data.** `AGENTS.md` at the repo root says to
read `node_modules/next/dist/docs/` before writing App Router code. Do that.

**Nothing in this feature tests whether anyone will pay.** PRD §8.1 and
`.scratch/validation/issues/01` hold that gap open on purpose. This spec builds
the foundation for the trust claim; it does not touch the commercial one.
