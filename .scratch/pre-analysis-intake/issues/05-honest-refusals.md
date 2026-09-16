# 05: Honest refusals

Status: done 2026-09-15

**What to build:** A job seeker whose document cannot be read honestly is told so plainly, and never handed an analysis built on guesses. A scanned or photographed contract, a password-protected PDF, a legacy `.doc`, a corrupt file and an empty file each produce their own refusal on screen, in ordinary words, saying what happened, why the standard exists, and what to do instead — ask for the Word or PDF original, or paste the text.

A mostly-scanned document with a little text on it is treated as a scan, not analysed from the fragments: a thin result must never be mistaken for a whole reading. The scan threshold is a conservative constant with a comment, expected to be tuned against real scanned offer letters; refusing a thin real document is a recoverable annoyance, analysing a scan is a broken promise.

The refusal copy is product surface, not an error string. It is written once and reviewed as copy. OCR is not a missing feature here — it is excluded permanently, and the copy says so without sounding like a limitation.

A document that is not a contract at all is *not* refused: intake works on it and lets the analysis say what it finds.

**Blocked by:** 03, 04.

- [x] A scanned or photographed PDF returns `no-text-layer` and a refusal that explains why reading a picture of text would make every quoted sentence untrustworthy
- [x] A mostly-scanned PDF with a fragment of text is refused as a scan rather than parsed from the fragments
- [x] A password-protected PDF returns `encrypted` and says so specifically, so the user does not think the file is corrupt
- [x] A legacy `.doc` returns `unsupported-format` with actionable copy naming what to do instead
- [x] A corrupt or unreadable file returns `unreadable` — a clear failure, never a blank screen
- [x] Format is detected from content (magic bytes), not from the filename; the filename is used only in the message
- [x] Every refusal is rendered to the user as copy, not as a raw error string
- [x] A file that is not a contract at all parses normally and is not refused
- [x] Committed fixtures cover each refusal kind and assert the discriminated result
