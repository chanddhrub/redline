# 03: PDF intake

Status: ready-for-agent

**What to build:** A job seeker whose offer letter is a text-layer PDF drops it on the page and sees their contract's text come through intact — including a sentence that spans a page break, which arrives whole rather than cut in half by the PDF's layout.

Blocked by 02 because page-break and hyphenation handling is what makes a PDF quote findable at all; without it a PDF parses but its sentences cannot be cited.

**Blocked by:** 02.

- [ ] A text-layer PDF is parsed in the browser and its text is shown back to the user
- [ ] `pdfjs-dist` is added as a dependency (approved in the spec, 2026-09-06)
- [ ] A sentence spanning a page break is one sentence, and `locate` finds it when quoted verbatim
- [ ] A hyphenated word broken across a page boundary does not cost the sentence its span
- [ ] Parsing works in the browser and under the Node test runner, so the seam is testable without a DOM
- [ ] A committed text-layer PDF fixture with known text asserts the canonical text and the sentence offsets
