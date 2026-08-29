# Redline

Upload an offer letter, non-compete or IP agreement before signing. Get back a
plain-English summary, the clauses that could hurt you ranked by severity with
the exact source sentence shown, a drafted counter-offer for each flagged
clause, a question box answered only from the document, and an editable list
of your own red lines that drives the analysis. Job seekers only (ADR 0002).

This version exists to prove the analysis can be trusted. Judge every decision
against that.

## Read first

- `research/summary.md` — user research. Read before deciding what to build.
- `CONTEXT.md` — vocabulary. `docs/adr/` — decisions and the reasons for them.
- `PRD.md` — the brief, once it exists. Read before building.
- `docs/agents/` — where issues (`.scratch/<feature>/`) and domain docs live.

## Settled

Not open for reinterpretation. If one of these looks wrong, say so and stop;
do not route around it.

- Next.js, Supabase for auth and database, Vercel for deploy.
- The uploaded file is parsed in the browser. Only text is stored — never the
  original file.
- Every risk flag cites the exact sentence it came from. A flag whose source
  sentence cannot be shown is a bug, not a degraded result.
- The model is called through OpenRouter.

## Scope

Build the capabilities listed at the top and stop there. When something looks
like the obvious next step and is not on that list, ask before building it.

Excluded on purpose: payments, billing, OCR for scanned documents, sharing a
document between users, and the saved library (deferred, not cut — ADR 0002).
None make the analysis more trustworthy. OCR actively undermines it — a
citation is worthless when the text it points at was misread.

## Rules

- Credentials live in `.env.local`, which is gitignored. Never commit a
  secret: a key is public the moment it is pushed and has to be rotated.
- State only what the document says. Where the text does not support a claim,
  the product does not make it — the summary, the severity ranking, the
  counter-offers and the question box alike. The one exception is the labelled
  enforceability layer (ADR 0005), which is never merged into a cited flag.
- Ask before adding a dependency.
- Keep this file to 60 lines. Pointers, not pasted contents.

## Open decisions — ask, do not pick

Undecided as of 2026-08-28. Stop and ask rather than picking a default.

- Package manager and scaffold flags.
- Supabase local CLI with versioned migrations vs. a hosted project only.
- Which OpenRouter model is the default.
- Whether to commit during an unattended build, and on which branch.
