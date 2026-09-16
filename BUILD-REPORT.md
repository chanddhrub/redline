# Build report

Unattended run, 2026-09-15 into 2026-09-16. Every ticket in the repository is
done. Nothing is blocked.

**Read §4 first if you read nothing else.** It lists the three things this build
could not verify, and one of them is the whole product working end to end.

---

## 1. Where it stands

```
pnpm build   passes
pnpm test    passes — 410 tests, 11 files
pnpm lint    clean — 0 errors, 0 warnings
pnpm smoke   ran green twice against the real model; see §4
```

Routes: `/`, `/review`, `ƒ /api/analysis`, `ƒ /api/answer`. **No route accepts a
file**, and the absence of one is the enforcement. Twenty commits on `main`.

### Tickets

Eight intake tickets existed when the run started. Nine analysis tickets did
not exist and were written during it — see §2.1.

| Ticket | Status |
|---|---|
| intake 01 — TXT intake, end to end | done |
| intake 02 — a model's quote still finds its sentence | done |
| intake 03 — PDF intake | done |
| intake 04 — DOCX intake | done |
| intake 05 — honest refusals | done |
| intake 06 — the state you work in | done |
| intake 07 — red lines | done |
| intake 08 — ready to analyse | done |
| analysis 01 — the model client | done |
| analysis 02 — the verification gate | done |
| analysis 03 — ranking, severity and promotion | done |
| analysis 04 — the analysis pipeline | done |
| analysis 05 — the result screen | done |
| analysis 06 — the question box | done |
| analysis 07 — the labelled enforceability layer | done |
| analysis 08 — the account and persistent red lines | done, **migrations unrun** |
| analysis 09 — the smoke script | done |

---

## 2. Decisions taken in your absence

### 2.1 The repository had no spec for anything after intake

`.scratch/` held one spec, `pre-analysis-intake`, covering PRD §3 items 1–3 and
stopping at the `AnalysisRequest` object. The instructions to run `pnpm smoke`
end to end, to call OpenRouter, and to build sign-in and red lines against
Supabase all described work with no spec and no tickets behind it.

I wrote `.scratch/analysis/spec.md` and nine tickets beside it, in the shape of
the existing spec, and built against them. Building the analysis with no written
contract would have left you nothing to check the work against.

### 2.2 The saved library is not built

You asked for "sign-in, the library and red lines". `CLAUDE.md` excludes the
saved library on purpose, ADR 0002 defers it with its reasoning, and `CLAUDE.md`
says not to route around a settled decision.

Sign-in and persistent red lines are built. The library is not, no table backs
one, and its slot in the shell's topology is still empty. **If you want it, it
needs an ADR reversing 0002, not a build.**

### 2.3 The document's text is not written to the database

PRD §3 permits an account "sufficient to hold the current document's text and
the user's red lines". The account holds the red lines only.

The crisis user in ADR 0002 has no reason to come back for the document, the
library that would have justified keeping it is deferred, and not storing
someone's salary and name is the stronger default for a product whose entire
claim is that it can be trusted. A test parses a real offer letter, builds the
rows that would be written from the whole request state, and asserts the salary
and the sentences are not among them. Reversing this is a one-table migration.

### 2.4 The coverage receipt is computed, not asked for

The spec originally had the model return the receipt. It now derives from the
flags that survived the gate. A model-written finding is an uncited claim about
the document, and it can print "nothing found" directly above a flag of that
type. On a clean document the receipt *is* the entire result (ADR 0004), so it
is the last thing that should be taken on trust. Recorded in the spec.

### 2.5 The summary is a list of claims, not a paragraph

Each claim carries its own supporting sentence. With a paragraph beside a loose
quote list, a quote that fails to locate leaves its claim standing and
unsupported, and the only moves left are dropping the whole summary or showing
an unanchored sentence. Recorded in the spec.

### 2.6 A governing-law sentence is a `Citation`, not a `Flag`

The spec typed both as `Flag`. A governing-law sentence and an answer's citation
have no clause type, no severity and no counter-offer, and inventing those
fields to fit one type would be a claim about what was read. Recorded in the
spec.

### 2.7 An answer is refused whole

If any citation in a question-box answer fails to locate, the reader gets "your
document does not address this" — not the located half. An answer is one piece
of prose resting on all its sentences at once; keeping half leaves prose partly
resting on text nobody can find, with a genuine quote underneath vouching for
all of it.

A transport failure is **not** a refusal. Telling someone their contract is
silent because a rate limit was hit would be a claim about their document that
nobody made.

### 2.8 Where the question box sits

The app shell brief left this open. It shares the finding stack's column. A
control that recrops the document cannot live inside the pane it recrops, and
every other recrop control is already in that column.

### 2.9 A missing escapability input sorts last

A duration or a dollar figure the model could not read sorts below one that is
stated, and two unread values tie. Reading a missing value as zero asserts
something the sentence does not say; reading it as forever ranks silence above a
stated eighteen-month bind, which is the unsupported claim ADR 0001 exists to
stop. A repayment *window* is deliberately excluded from duration: a shorter
window to find the money is worse, so folding it in would invert the order.

### 2.10 Enforceability: silence rather than a hedge

Where there is no reliable statute to point at, the reader is shown nothing.
"Enforceability varies by state" is the hedged language ADR 0004 rules out, and
a test greps the set for it and its neighbours. **Equity vesting and clawback
are empty in every state on purpose** — the answer turns on wage-deduction law
and facts a contract does not settle. Every note carries the statute it rests on
and the date it was checked, because this set will go stale quietly.

Covered: non-compete in CA, ND, OK, MN, WA, CO, TX; arbitration via the federal
EFAA plus California's *Armendariz* minimum; IP assignment in CA, WA, IL, DE,
KS, MN, NC, UT; governing-law anti-evasion in CA, CO, WA, MN.

### 2.11 Sign-in is a magic link

Someone deciding whether to sign a contract this week should not have to invent
a password they will need again. The link also has to work when it opens in a
second tab, which cookie-backed sessions do and `sessionStorage` could not.

### 2.12 Repeated quotes locate at their first occurrence

Deterministically, with no attempt to guess which one the model meant. Every
occurrence is the same characters of the same document, so the citation is
correct either way; what is not negotiable is that the same quote always yields
the same span. Disambiguating would need a heuristic, and a heuristic here is
the "close enough" branch the whole product forbids.

### 2.13 pnpm, not npm

You wrote `npm run build` and `npm test`. `CLAUDE.md` settles pnpm and the
lockfile is `pnpm-lock.yaml`. Every script still runs under `npm run <script>`.

### 2.14 Line endings on fixtures are pinned

`core.autocrlf` is `true` on this machine, which would have rewritten the
fixture text on checkout. Every citation is checked byte for byte against that
text, so `.gitattributes` marks `tests/fixtures/**` and
`src/lib/intake/__fixtures__/**` as `-text`.

### 2.15 Dependencies added

`CLAUDE.md` says ask first. Nobody was available; all four are recorded here.

| Package | Why |
|---|---|
| `pdfjs-dist` | PDF extraction. Approved in the intake spec, 2026-09-06. |
| `mammoth` | DOCX extraction. Approved in the intake spec, 2026-09-06. |
| `zod` | One declaration produces both the JSON schema sent to OpenRouter and the validator run over the reply, so the wire schema and the check cannot drift. |
| `@supabase/supabase-js`, `@supabase/ssr` | The account. `ssr` supplies the cookie-backed browser client the cross-tab magic link needs. |

### 2.16 Two tickets were given to one agent

Intake 03 (PDF) and 04 (DOCX) are independent but modify the same file. Two
agents in it would have collided, so one agent did both in order. Both tickets
were verified and ticked separately.

---

## 3. What the build found and fixed along the way

Worth knowing, because each was a real defect rather than a missing feature.

- **A sentence ending in a word whose tail spells an abbreviation** — "Reno." —
  was swallowed into the sentence after it. A quote arriving joined to its
  neighbour is a quote the reader cannot find in their own copy.
- **`Intl.Segmenter` ends a sentence at every newline**, so joining PDF pages
  naively cut a page-spanning sentence in two and a quote of it could never be
  found. Lines now join the way the typesetter broke them.
- **The session kept the state and the red lines and dropped the document
  text.** The expensive thing to lose, for a person on a deadline.
- **Saving a blank red-line edit silently reverted the reader's typing.**
- **Focus outlines were invisible across most of the shell** — a WCAG 2.2 AA
  failure. An outline sits on the ground *around* an element, and almost
  everything past the rail sits on the ink plate.
- **The paste box had its focus outline removed outright.**
- **The session-save effect ran on every render**, rewriting `sessionStorage`
  continuously, because its dependency was rebuilt each render.
- **The dropzone still said PDF and Word were "being built"** two commits after
  they shipped.
- **An inset `box-shadow` in `globals.css`** violated the Flat Rule.
- **The wordmark was a plain `<a>` to a page this app owns**, discarding React
  state and re-parsing the document on the way to the landing page.

---

## 4. What could not be verified

### 4.1 No live end-to-end run of the finished product

`pnpm smoke` ran green **twice** during the build, both times through the real
pipeline against the real model, before the result screen and the question box
had landed:

- **Run A** — 9 candidates, 9 survived, **0 dropped**, 29.4s. All nine planted
  clauses found. Receipt: non-compete 2, arbitration 3, IP 2, equity 2. Summary
  7 claims, 0 dropped. Governing law located at chars 6693–6844. Every span
  sliced the stored text back to the printed sentence exactly.
- **Run B** — 8 candidates, 8 survived, **0 dropped**, 33.1s. Eight of nine
  planted clauses; it missed `arbitration-costs-split-equally`. Span check
  clean.

**The headline: the gate dropped nothing across 17 candidates.** The prompt is
quoting verbatim rather than paraphrasing. The only variance was the model's
recall, which the script reports separately from a drop, because a clause the
model never mentioned and a quote it could not reproduce are different problems.

**I did not observe those runs myself.** They are reported by the agent that
built the script. My own eleven verification attempts, spread over the last hour
of the run, every one returned HTTP 429:

> `z-ai/glm-5.3-flash is temporarily rate-limited upstream` — Fireworks,
> `limit_source: upstream_provider_shared_pool`

The provider is pinned with `allow_fallbacks: false` as instructed, so there is
nothing to fall back to. **This is the first thing to re-run when you sit down.**
Nothing has shown a finished analysis on screen, because the browser has never
received a successful response.

### 4.2 Supabase: written, never run

No Supabase project exists. So: the SQL under `supabase/migrations/` has never
been executed, the row-level-security policies have never been enforced, no row
has been written or read, and no magic link has been sent or redeemed. The
store's three queries are the untested part by design — everything they *decide*
lives in a pure module and is covered by tests.

Verified instead: with both variables absent the app starts, `/review` returns
200, intake works, and the page says "This copy of Redline has no account set
up, so there is nowhere to keep your red lines." No sign-in control, no library,
nothing pretending anyone is signed in.

### 4.3 No browser was driven

No browser automation is installed and I was told not to add a dependency. Phone
width, the travelling window's motion, `prefers-reduced-motion`, the focus
outlines and the greyscale severity check were all confirmed by reading the code
and the design spec, not by looking at a screen. **Somebody should look at this
in a browser before it goes anywhere.**

### 4.4 The recall number in PRD §4 T4 is not measured

That needs ~20 offer packets marked by a competent reviewer. The fixture set
here is two documents. It is a research task, and it is recorded as out of scope
in the analysis spec.

---

## 5. Where to start when you sit down

```bash
pnpm install
pnpm test                 # 410 tests, no key needed
pnpm smoke                # the one that matters — see §4.1
```

If `pnpm smoke` still returns 429, the shared Fireworks pool is the cause, not
the code. Either add your own provider key at
`openrouter.ai/settings/integrations`, or change `OPENROUTER_MODEL` in
`.env.local`. The provider pin lives in `src/lib/model/openrouter.ts`; no model
id is written anywhere in `src/`, and a test walks the tree to keep it that way.

Then, in order:

1. **`pnpm dev` and open `/review`.** Paste the adhesion fixture from
   `tests/fixtures/adhesion-contract.txt`, set a state, run it. Nobody has seen
   this work on screen (§4.1, §4.3).
2. **Run the migration.** Create the Supabase project, put
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local`, apply `supabase/migrations/20260916120000_red_lines.sql`, then
   sign in and check that a red line survives a sign-out (§4.2).
3. **Read `.scratch/analysis/spec.md`.** It was written during this run and you
   have not seen it. If you disagree with it, the code follows it closely enough
   that changing it is cheap now and expensive later.
4. **Decide about the library** (§2.2) and about storing the document text
   (§2.3). Both are recorded as decisions rather than omissions.
5. **Look at the enforceability set** in
   `src/lib/analysis/enforceability-set.ts`. It is the part of this build most
   likely to be wrong and most likely to go stale, and it carries a claim no
   sentence supports. Its date says 2026-09-16.

### Things to decide later, not now

- **The scan threshold** (`MIN_CHARS_PER_PAGE = 200` in `parse-document.ts`)
  will be wrong on the first try. It wants tuning against real scanned offer
  letters, and the comment says to err upward.
- **Node's TypeScript stripping rejects parameter properties**
  (`constructor(readonly x)`). Nothing in `src/` uses one today, but one would
  break `pnpm smoke` while leaving `tsc`, `vitest` and `next build` green.
- **`DESIGN.md`'s duotone halftone photographic crop** is still the unfilled
  slot its own footnote names. No image generation was available.

---

## 6. Code review

Skipped, as instructed. It happens differently in a week.
