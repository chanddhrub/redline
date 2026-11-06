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
- Matching text never writes. A change is saved only over a document the reader
  opened or chose to keep and has not closed. The same words loaded again are a
  bare copy, and are offered the choice like any other document.
- A stored citation that is not found in the stored text drops the whole analysis,
  or that one answer, and the reader is told.
- A red line changed since the analysis re-runs it (PRD §3.3).
- A read that fails is tried again before the reader hears of it, because the
  service can refuse a token in the moment it is issued. If it still fails, the
  reader can try again themselves, so deleting is never the only way forward.

## Where it lives

- `src/lib/account/kept-document.ts`: what is written and what is believed.
- `src/lib/account/serial-writer.ts`: one write at a time, newest wins.
- `src/lib/account/read-again.ts`: a read gets more than one chance.
- `supabase/migrations/20261106120000_kept_documents.sql`: the table.
