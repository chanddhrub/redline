# Keep the last document

Status: built, 2026-11-06. Decision and reasons: ADR 0007.

A signed-in reader can log out, come back, and find the last document they
worked on, with its analysis and their questions.

## What was agreed

- Opt-in. The signed-in panel offers "Save the text and analysis". Nothing is
  written until the reader presses it.
- Text, analysis and questions only. The original file is never stored.
- One document per reader. Keeping another replaces it.
- The reader can delete it from the same panel.

## Behaviour

- Once kept, a question, a new analysis or a changed state is saved as it happens.
- A new document on screen is not kept automatically. The reader is offered the
  choice again, and told it replaces the kept one.
- Signing in with nothing on screen opens the kept document. Signing in with a
  different document on screen leaves it there and offers the kept one.
- Signing out clears a kept document from the screen, unless its latest change
  failed to save.
- A stored citation that is not found in the stored text drops the whole analysis,
  or that one answer, and the reader is told.
- A red line changed since the analysis re-runs it (PRD §3.3).

## Where it lives

- `src/lib/account/kept-document.ts`: what is written and what is believed.
- `src/lib/account/serial-writer.ts`: one write at a time, newest wins.
- `supabase/migrations/20261106120000_kept_documents.sql`: the table.
