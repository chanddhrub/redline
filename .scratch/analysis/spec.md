# Spec — Analysis

Status: ready-for-agent

Covers PRD §3 items 4–9: the plain-English summary, the ranked flags with their
verified source sentences, the counter-offer per flag, the question box, the
coverage receipt, and the labelled enforceability layer. Plus the account that
PRD §3 says supports them.

Written 2026-09-15 from `PRD.md`, `CONTEXT.md`, ADRs 0001–0005 and
`.scratch/pre-analysis-intake/spec.md`, whose `AnalysisRequest` is the input.

---

## Problem Statement

Intake ends with an `AnalysisRequest`: the canonical document text, its
sentences, the state the user works in, and the red lines they declared.
Nothing reads it. Everything this product exists to prove sits downstream of
that object and does not exist yet.

The risk is not that the analysis is hard to produce. A model will produce one
on demand, fluently, at any length. The risk is that it will produce one that
cannot be checked: a paraphrase that sounds like a quote, a severity that came
from nowhere, an answer to a question the document does not address. PRD §4
names the single falsifying result, a flag whose quoted sentence does not
support the claim made about it. Everything below is arranged so that result
cannot ship quietly.

## Solution

One server-side pipeline, and a verification gate between the model and the
reader that the model cannot talk its way past.

The model is asked for structured JSON: a summary, a set of candidate flags,
and for each flag the source sentence it read the risk from. Every candidate
then goes through `locate` against the canonical text. A candidate whose quote
does not land is **dropped**. Not softened, not paraphrased, not shown with a
warning. What survives is ranked by the basis in ADR 0003, promoted where a red
line matches, and rendered with its span so the reader can put our claim and
their contract side by side.

A clean document returns a coverage receipt rather than an empty page. The
question box runs the same gate in a narrower shape: the answer must cite
sentences from the document, and where it cannot, it says the document does not
address the question.

Enforceability is a second pass, keyed to the user's state, kept in its own
labelled layer that never touches a flag's severity.

## User Stories

**Reading the document back**

1. As a job seeker, I want a plain-English summary of what this document commits
   me to, so that I understand the shape of it before I read the flags.
2. As a job seeker, I want the summary to say only what the text supports, so
   that I can check it the same way I check a flag.

**The flags**

3. As a job seeker, I want a ranked list of risks, so that I know what to deal
   with first.
4. As a job seeker, I want each flag to quote the exact sentence it came from,
   so that I can find it in my own copy and settle any disagreement alone.
5. As a job seeker, I want a flag whose sentence cannot be found in my document
   dropped before I see it, so that a wrong reading never reaches me.
6. As a job seeker, I want severity to be explicable from the sentence quoted,
   so that I can judge whether the ranking is fair.
7. As a job seeker, I want the same document to rank the same way every time, so
   that I can trust the order rather than the run.
8. As a job seeker, I want a strange but harmless clause left unflagged, so that
   the list stays worth reading.

**The counter-offer**

9. As a job seeker, I want replacement language drafted for each flagged clause,
   written against the sentence shown, so that I have something to send back.

**The question box**

10. As a job seeker, I want to ask a question about my document and get an
    answer drawn from the document alone.
11. As a job seeker asking something the document is silent on, I want to be
    told it does not address it, rather than handed a plausible answer.
12. As a job seeker, I want an answer to show the sentences it rests on, so that
    I can check it the way I check a flag.

**Clean documents**

13. As a job seeker whose document has no qualifying flags, I want a coverage
    receipt naming what was checked, what was found for each, and what was not
    reviewed, so that "no flags" is never read as "safe to sign".

**Red lines**

14. As a job seeker whose red line is crossed, I want that flag at the top, with
    the red line it crossed named, so that I can see my constraint did work.
15. As a job seeker, I want a red line added after the analysis to re-run it, so
    that reading the document can teach me what I care about.

**Enforceability**

16. As a Californian, I want enforceability context keyed to my state, clearly
    marked as not coming from my document, so that I am not told a void
    non-compete is critical for my life.
17. As a job seeker, I want the governing-law clause shown where the document
    has one, because it is in the document and often differs from where I work.
18. As a job seeker, I want to be able to tell at a glance which statements came
    from my document and which are general context.

**The account**

19. As a job seeker, I want to sign in so that my red lines are mine and persist
    between sittings.
20. As a job seeker without an account, I want to paste a document and get an
    analysis anyway, so that the account is not a toll gate.

## Implementation Decisions

**Three seams, all pure or near-pure, all testable with a stubbed model client.**

### Seam 1 — the model client

```ts
interface ModelClient {
  complete<T>(request: StructuredRequest<T>): Promise<T>
}
```

- One transport, used by every call: OpenRouter's OpenAI-compatible endpoint.
- The model id comes from `OPENROUTER_MODEL` and is **never written into code**,
  not as a default and not as a fallback. Its absence is an error whose message
  names the variable.
- Provider pinned on every request: `order: ["fireworks"]`,
  `allow_fallbacks: false`, `require_parameters: true`. Reasoning effort `low`.
- Every call requests structured JSON output against a declared schema, strict.
  A response that does not parse against the schema is an error, not a value to
  be coerced.
- Server only. The key never reaches the browser, and the client is never
  imported from a client component.
- **In tests this is the one permitted stub**: a `ModelClient` built from a
  fixture sidecar. It replaces the network, never the code under test. The
  verification gate, the ranking and the promotion all run for real against it.

### Seam 2 — verification

```ts
verifyFlags(candidates: CandidateFlag[], document: ParsedDocument): {
  flags: Flag[]
  dropped: DroppedFlag[]
}
```

- Every candidate's `sourceSentence` goes through `locate`. `null` means
  dropped, with the reason recorded so the drop is countable in tests and in the
  smoke script. A drop is never rendered to the reader.
- A `Flag` carries a `Span`, so the interface can always show the quote and
  point at the document. **A `Flag` cannot be constructed without a located
  span.** That is a type-level guarantee rather than a convention, and it is
  what makes PRD §4's T1 a standing check rather than a review item.
- The same gate runs over the summary and over question answers: any sentence
  either of them claims to quote is located, or the claim is dropped.

### Seam 3 — ranking and promotion

```ts
rankFlags(flags: Flag[], redLines: RedLine[]): RankedFlag[]
```

- Pure, deterministic, no model. Order is: promoted flags first, then by
  severity band (Critical above High), then by the escapability inputs read from
  the sentence, then by money. Equal on everything sorts by span start, so the
  order is total and a re-run cannot swap two flags (PRD §4 T3).
- **Promotion is a red line matching a flag.** The match itself is a model
  judgement, since it is free text against a clause, so it arrives on the
  candidate as a claimed red-line id and is verified here: the id must be one
  the user actually declared. A claimed match to a red line that does not exist
  is dropped, and the flag ranks unpromoted.
- Promotion raises and names. It never demotes, never filters, and `Flag` has no
  writable severity field after construction.

### The pipeline

```ts
analyse(request: AnalysisRequest, model: ModelClient): Promise<Analysis>

interface Analysis {
  summary: Summary
  flags: RankedFlag[]
  coverage: CoverageReceipt
  enforceability: EnforceabilityNote[]
  governingLaw: Flag | null
  dropped: DroppedFlag[]
}
```

- `coverage` is returned on **every** analysis, not only a clean one: the four
  clause types from ADR 0003, the finding for each, and a plain statement of
  what was not reviewed. Never an empty result, never a manufactured
  low-severity finding (ADR 0004).
- `enforceability` is a separate array keyed to the user's state, each note
  labelled and carrying no span, because it does not come from the document. It
  is joined to a flag by clause type at render time and may never alter a
  severity. **This spec ships no state-level legal corpus.** It ships the layer,
  its labelling, and a small honest starting set whose provenance and staleness
  are recorded beside it (ADR 0005, PRD §6.6).
- `governingLaw` is a `Flag`-shaped citation because it *is* in the document.
- `dropped` is carried out of the pipeline so the smoke script and the tests can
  count what the gate rejected. It is not rendered.

### The question box

```ts
answer(question: string, request: AnalysisRequest, model: ModelClient):
  Promise<Answer>

type Answer =
  | { kind: 'answered'; text: string; citations: Flag[] }
  | { kind: 'not-addressed' }
```

- An answer that cites nothing locatable becomes `not-addressed`. There is no
  third state in which an unsupported answer is shown with a caveat, because
  PRD §4 T5 says one fabricated answer destroys the thesis more thoroughly than
  ten missed flags.

### The account

- Supabase auth, and one table: the user's red lines. **Not a library.** ADR
  0002 defers it and PRD §7 excludes it, and an instruction to build one does
  not override a recorded decision.
- The document's text is **not** persisted. PRD §3 permits an account to hold
  it; ADR 0002's crisis user has no reason to come back for it, and not storing
  someone's salary is the stronger default. Recorded here so the choice is
  visible rather than assumed.
- Tables and policies ship as SQL migrations under `supabase/migrations/`. Row
  level security on, owner-only policies.
- With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` absent the
  app starts, intake works and an analysis runs. Red lines fall back to the
  session, and the interface says plainly that they will not be kept. Auth is
  never mocked in the product.

### The route

One server route per model-backed operation, taking the `AnalysisRequest` (text,
sentences, jurisdiction, red lines) as JSON. **No route accepts a file.** That
constraint is inherited whole from intake, and the absence of the route is the
enforcement.

## Testing Decisions

**The model is stubbed; nothing else is.** The stub is built from the fixture
sidecars under `tests/fixtures/`, which record, for the planted contract, each
clause's verbatim sentence and its expected severity band. Every test below runs
the real gate, the real ranking and the real promotion over stubbed model
output.

- **The gate, positively:** candidates built from the sidecar's verbatim
  sentences all survive, and each surviving flag's span slices the canonical
  text back to that sentence exactly.
- **The gate, negatively, and this is the centre:** candidates whose quote is a
  paraphrase, has one word changed, is a plausible sentence lifted from the
  *other* fixture, or is a subtly reworded clause are all dropped. Zero reach
  the reader. This is PRD §4 T1 and T4 as an automated check.
- **The standing check intake's spec said would be missing:** no `Flag` can
  exist without a located span, asserted over the whole pipeline output for both
  fixtures.
- **Ranking is total and stable:** the same candidate set in a shuffled order
  ranks identically, three times over (T3).
- **Decoys stay unflagged:** the sidecar's `decoySentences` never appear as a
  flag's source sentence.
- **Clean is a receipt:** the clean fixture returns zero flags, a coverage
  receipt naming all four clause types with a finding for each, and a statement
  of what was not reviewed. Never an empty result and never an invented
  low-severity flag.
- **Promotion:** a red line matching a planted clause puts that flag first and
  names the line; a claimed match to a red line the user never declared is
  dropped and the flag ranks unpromoted; no red line ever lowers a severity.
- **The question box refuses:** questions whose answers are genuinely absent from
  the fixture ("is this enforceable in Texas?", "is this salary competitive?")
  return `not-addressed`, including when the stub returns a confident answer
  citing a sentence that is not in the document.
- **The enforceability layer stays apart:** notes carry no span, are labelled,
  and running the pipeline with and without them produces identical flag
  severities and identical order.

**Not tested here:** the model's actual judgement. Whether it finds the planted
clauses at all is what `pnpm smoke` exercises against the real endpoint, and
what T4's marked corpus would measure. The suite tests that what the model
returns cannot reach the reader unchecked.

## Out of Scope

- The saved library. Deferred by ADR 0002 and excluded by `CLAUDE.md`.
- Payments and billing.
- OCR. Excluded permanently (PRD §7).
- Sharing a document between users.
- A maintained state-by-state legal corpus. The layer ships; the corpus is a
  separate maintained artefact (ADR 0005).
- Non-US jurisdictions.
- Measuring recall against a marked 20-packet corpus (PRD §4 T4). The fixture
  set here is two documents; the corpus is a research task.

## Further Notes

**The dropped count is the product's own instrument.** If the smoke script
reports that most candidates are being dropped, the prompt is paraphrasing, and
that is a tuning job with a number attached. Carrying `dropped` out of the
pipeline is what makes it visible rather than invisible.

**Determinism is asserted over ranking, not over the model.** Two model runs may
return different candidate sets. T3's promise — same document, same order — is
kept by the ranking being a total order over whatever survives, and by the
severity bands being fixed in ADR 0003 rather than chosen per run.

**The enforceability corpus goes stale silently.** ADR 0005 accepts this. The
starting set ships with its date and source recorded next to it so a reader can
see how old it is.
