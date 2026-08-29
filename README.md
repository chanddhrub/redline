# Redline

Read the offer letter before you sign it.

Upload an offer letter, non-compete, or IP assignment. Get back a plain-English
summary, the clauses that could hurt you ranked by how hard they are to escape,
**the exact sentence each flag came from**, a drafted counter-offer for each
one, and a question box that answers only from your document.

**Status: design, not code.** This repository currently contains research and
decisions. There is no application yet — nothing to install and nothing to run.

## The one idea

Contract-review tools are not short on output. They are short on output you can
check. Trust and accuracy is the universal complaint at every price tier —
false positives in the expensive tools, "generic and sometimes inaccurate" in
the cheap ones, invented citations when people use a general chatbot — and no
product answers it by showing you the sentence.

So every risk flag here carries the exact sentence it came from, quoted
verbatim from your document. You can put our claim and your contract side by
side and settle it yourself. **A flag whose source sentence cannot be shown is
a bug, not a degraded result** — it is dropped before you see it.

That constraint costs us things, deliberately: no OCR for scanned documents (a
citation is worthless when the text it points at was misread), lower recall
than a tool that guesses freely, and no way to flag a clause that is *missing*,
because an absence has no sentence to quote. Those costs are written down
rather than designed around.

## What it flags

Four clause types, for job seekers, ranked by **escapability first, money
second** — how hard a clause is to get out of, with the amount at stake as the
tie-break. Unusual is not the same as dangerous.

| Clause type | Default severity |
|---|---|
| Non-compete / non-solicit | Critical |
| Mandatory arbitration + class-action waiver | Critical |
| IP assignment / moonlighting restrictions | High |
| Equity vesting, clawback, signing-bonus repayment | High |

You can also declare your own **red lines** ("I will not sign an IP assignment
covering personal projects"). A red line promotes a matching flag to the top
and names the line it crossed.

A document with nothing to flag returns a **coverage receipt** — what was
checked, what was found, and what was not reviewed — so "no flags" is never
read as "safe to sign."

## Reading this repository

Start at the top; each file says why it exists.

| File | What it is |
|---|---|
| [`PRD.md`](PRD.md) | The brief for v1: who it serves, what it does, how you would know if the analysis is any good, and what each decision cost. |
| [`CONTEXT.md`](CONTEXT.md) | The vocabulary, deliberately narrowed. |
| [`docs/adr/`](docs/adr/) | The five decisions that shape everything else, each with the alternatives rejected and why. |
| [`research/`](research/) | The user research the brief is built on, with sources and gaps marked. |
| [`CLAUDE.md`](CLAUDE.md) | Working instructions for agents in this repo. |

The decisions, shortest form:

1. [Every flag cites its source sentence](docs/adr/0001-every-flag-cites-its-source.md)
2. [Job seekers are the wedge](docs/adr/0002-job-seekers-are-the-wedge.md)
3. [Severity is escapability, then money](docs/adr/0003-severity-is-escapability-then-money.md)
4. [Output posture: miss rather than cry wolf](docs/adr/0004-output-posture.md)
5. [Jurisdiction is a labelled second layer](docs/adr/0005-jurisdiction-is-a-labelled-second-layer.md)

## What this is not

Not building: payments, OCR, document sharing, a saved library, leases,
freelance agreements, terms of service, after-signature monitoring, or anything
that acts on your behalf. We draft; you decide and you send. Each exclusion has
a reason in [`PRD.md` §7](PRD.md).

**Not legal advice.** Redline reads a document and shows you what it says.
Enforceability information, where shown, is general context about your state,
labelled as not coming from your document, and it is not a substitute for a
lawyer.

## The open question

The riskiest assumption is not whether the analysis can be built. It is whether
anyone will pay for it. The research turned up **zero direct willingness-to-pay
evidence** — every price in the brief is what people pay a lawyer or what a
vendor lists. That gap is stated plainly in [`PRD.md` §8](PRD.md) rather than
papered over, and no amount of building settles it.

## Planned stack

Next.js, Supabase (auth and database), Vercel, and a model called through
OpenRouter. Documents are parsed in the browser; only text is stored, never the
original file.
