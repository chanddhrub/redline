---
version: 1
slug: "src-app-review"
primary_target: "src/app/review"
related_targets: []
---

# App shell

Scope: the frame at `/review` that holds intake, the result, the question box
and red lines. Visitor mode: **Operate**. **Brief only — no screen built.**

## Job and audience

The same job seeker, now inside the task. One document, one deadline, one
sitting. They arrive from the landing page having already decided to try it.

**There is no sign-in.** PRODUCT.md records no account in v1: the shell opens
straight into intake, holds state for the session, and persists nothing beyond
`sessionStorage` used only to survive an accidental in-page navigation. The
original brief asked for this shell "behind sign-in"; that was resolved against
product truth on 2026-09-11. No auth boundary, no account menu, no user avatar.

## What the frame holds

1. **Intake** — paste or upload; parsed in the browser; extracted text shown
   back before analysis. Refusals are product surface, not error strings.
2. **The result** — plain-English summary, ranked flags, and on a clean document
   the **coverage receipt**. Note the vocabulary: `CONTEXT.md` has no term
   "verdict", and PRD §3 forbids a verdict on whether to sign. The clean-document
   output is a coverage receipt — what was checked, what was found, what was not
   reviewed.
3. **The question box** — answers from the document only; says so when the text
   does not answer.
4. **Red lines** — editable before and after analysis, re-running on change.
   Promote and name the line crossed; never filter, never demote.
5. **The library** — **space reserved in the topology, not designed and not
   built.** Deferred by ADR 0002, and reserving the slot means a later arrival is
   not a restructure. Nothing about it ships in v1.

## Selected direction

Inherits The Session Sleeve wholesale — same world, Operate register. The
landing page's law carries straight in and becomes the shell's primary
interaction: **selecting a flag recrops the document to its source sentence.** On
the landing page that is a demonstration; here it is the working control.

Operate discipline applies over the world: orange recedes from full-field ground
to the structural frame (rails, active states, the finding stack), because a
reader spends twenty minutes here rather than twenty seconds. Cream paper windows
grow — the document is the largest thing on screen. Ink black holds the chrome.
Type keeps its three jobs: Anton for the few display moments, Archivo for all UI,
Tinos wherever the document speaks for itself.

## Layout and topology

Two panes at desktop: the document held at reading scale, findings alongside.
The document pane is the fixed thing; the finding stack is what moves. At phone
width the two stack rather than shrink — the source sentence never drops below
reading size, and the finding stack becomes a sheet over the document it points
at, never a separate route that loses the reader's place.

The question box and red lines are peers of the finding stack, not modals.
Reserve the library's slot as a rail position that stays absent in v1.

## States and ranges

First run, parsing in progress, each of the five refusals, analysis running,
0–8 flags, coverage receipt on a clean document, question with no answer in the
text, empty red lines, red line added mid-session triggering a re-run, and the
labelled enforceability layer sitting beside a flag without altering its
severity.

## Constraints and open decisions

WCAG 2.2 AA; severity and register survive greyscale. Desktop and phone equally
primary. No database, no auth, no Supabase — that decision stays open. The two
registers stay visually distinct: the document's words in Tinos on cream,
Redline's claims in Archivo on the frame, the enforceability layer on a halftone
screen and explicitly labelled as not from the document.

Open: whether the question box shares the finding stack's column or takes the
document pane's foot. Not resolved here; it needs the result screen's real
density, which does not exist yet.
