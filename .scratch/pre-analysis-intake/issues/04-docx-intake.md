# 04: DOCX intake

Status: done 2026-09-15

**What to build:** A job seeker whose offer arrived as a Word file drops it on the page and it is accepted directly, without converting it to something else first.

Independent of 03: PDF and DOCX extraction are separate internals behind the same seam and can be built in either order.

**Blocked by:** 01.

- [x] A `.docx` file is parsed in the browser and its text is shown back to the user
- [x] `mammoth` is added as a dependency (approved in the spec, 2026-09-06)
- [x] Parsing works in the browser and under the Node test runner
- [x] A committed DOCX fixture with known text asserts the canonical text and the sentence offsets
