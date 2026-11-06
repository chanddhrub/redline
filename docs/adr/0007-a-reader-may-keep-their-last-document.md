# 7. A reader may keep their last document — accepted 2026-11-06

## Decision

A signed-in reader can choose to keep one document in their account: its text,
its analysis and the questions they asked. Nothing is kept unless they press the
button, and they can delete it. A signed-in reader who comes back sees it again.

The original file is never stored. Keeping a second document replaces the first.

## Alternatives

- **Keep nothing.** The previous position, recorded in the header of the
  `red_lines` migration: the reader is signing something this week, and not
  holding someone's salary is the stronger default. Overturned by the product
  owner: a reader who logs out loses the work.
- **Keep it automatically on sign-in.** Simpler, and it breaks the promise most
  sharply. These are offer letters with salaries in them, and the reader would
  learn it was stored afterwards.
- **Keep several documents.** That is the library, which ADR 0002 defers. This
  decision does not reopen it: `owner` alone is the primary key.
- **Keep the text and re-run the analysis on return.** Cheaper to store, but a
  model run can differ, so the reader would not get back what they saw.

## Why

PRD §3 already allowed an account to hold the current document's text. The test
this version is judged by is whether the analysis can be trusted, so a stored
analysis is not trusted because it was stored. Every citation is checked against
the stored text on the way back, and one that fails takes the whole analysis
with it (ADR 0001). The reader is told, and can run it again.

## Consequences

- Redline now holds salaries and contract terms in a database, in plain text
  behind row level security. This is a real change in what a breach would cost.
- The promise that a document is never stored is gone. The product now says the
  file is never stored and the text is only kept if you choose.
- Signing out clears a kept document from the screen, because it is safe in the
  account and a shared machine should not go on showing it.
- `exchanges` makes the question box a thread rather than one answer, signed in
  or not.
