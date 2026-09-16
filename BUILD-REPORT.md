# Build report

Run started 2026-09-15. Written while the build ran, so the decisions are
recorded at the moment they were taken rather than reconstructed afterwards.

**This file is rewritten at the end of the run.** If it still says "in
progress" anywhere, the run did not finish.

---

## Status: in progress

See the ticket tables below.

---

## Decisions taken in your absence

### 1. The repository had no spec for anything after intake

`.scratch/` held one spec, `pre-analysis-intake`, and eight tickets under it.
Those cover PRD §3 items 1–3 and stop at the `AnalysisRequest` object. The
instruction to run `pnpm smoke` end to end, to call OpenRouter, and to build
sign-in and red lines against Supabase all describe work that had no spec and no
tickets.

**Decision:** I wrote `.scratch/analysis/spec.md` and nine tickets beside it,
following the shape of the existing spec, and built against them. The
alternative was to build the analysis with no written contract, which would have
left the next session nothing to check the work against.

### 2. The saved library is not built

The instruction said to build "sign-in, the library and red lines" against
Supabase. `CLAUDE.md` excludes the saved library on purpose, and ADR 0002 defers
it with its reasoning. `CLAUDE.md` also says not to route around a settled
decision.

**Decision:** sign-in and persistent red lines are built. The library is not,
and no table backs one. Its slot stays reserved in the shell's topology, as the
app shell brief already had it. If you want the library, it needs an ADR
reversing 0002, not a build.

### 3. The document's text is not written to the database

PRD §3 permits an account "sufficient to hold the current document's text and
the user's red lines". The account holds the red lines only.

**Reason:** the crisis user in ADR 0002 has no reason to come back for the
document, the library that would have justified keeping it is deferred, and not
storing someone's salary and name is the stronger default for a product whose
whole claim is that it can be trusted. Reversing this is a one-table migration
if you disagree.

### 4. pnpm, not npm

The instruction used `npm run build` and `npm test`. `CLAUDE.md` settles pnpm,
and the lockfile is `pnpm-lock.yaml`.

**Decision:** pnpm. Every script still runs under `npm run <script>` if you
prefer, because they are plain package scripts.

### 5. Line endings on fixtures are pinned

`core.autocrlf` is `true` on this machine, which would have rewritten the
fixture text on checkout. Every citation in this product is checked byte for
byte against that text.

**Decision:** `.gitattributes` marks `tests/fixtures/**` and
`src/lib/intake/__fixtures__/**` as `-text`, so a clone on another machine reads
the same bytes the spans were measured against.

---

## Tickets

Filled in as the run proceeds.

---

## What could not be verified

Filled in at the end of the run.

---

## Where to start when you sit down

Filled in at the end of the run.
