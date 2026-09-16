# 01: TXT intake, end to end

Status: done 2026-09-15

**What to build:** A job seeker who already has the text of their offer letter can drop a `.txt` file onto the page, or pick it with a normal file chooser, and see the extracted text shown back to them before anything else happens. The page states plainly that the file never left their browser. They can replace the document with a different one without reloading. Parsing is visibly in progress on a long document.

This is the first end-to-end path through intake, and it establishes the two seams the rest of the feature hangs off: `parseDocument` (bytes and a filename in, either a parsed document or a typed refusal out) and the one route that renders it. Sentence segmentation and exact-match `locate` land here; normalisation does not (see 02).

This ticket also sets the repository's testing pattern, because there is no prior art: Vitest in a Node environment, fixtures committed as real files alongside the tests. Tests assert the external contract only — never the segmentation guard, the index map or any other internal.

**Blocked by:** None (can start immediately).

- [x] A `.txt` file dropped on the page, or chosen through a file picker, is parsed in the browser and its text is shown back to the user
- [x] The text shown is byte-for-byte the canonical stored text — nothing is cleaned, trimmed or reformatted on the way in
- [x] The upload control is usable on a phone-width screen
- [x] Parsing shows progress, and a long document finishes rather than silently stalling
- [x] A second document replaces the first without a page reload
- [x] The page tells the user the file never left their browser
- [x] There is no server route that accepts a file; the absence of the route is the enforcement
- [x] `parseDocument` returns a discriminated result: a parsed document, or a typed refusal
- [x] Every sentence's `start`/`end` slices the canonical text back to that sentence exactly, asserted against the text rather than a snapshot
- [x] Sentences survive `Inc.`, `No.`, `e.g.`, `i.e.` and section numbers like `3.2` without splitting mid-sentence
- [x] `locate` returns a span for a sentence quoted back verbatim, and `null` for one that is not in the text
- [x] Vitest runs from a package script; an empty file returns the `empty` refusal
