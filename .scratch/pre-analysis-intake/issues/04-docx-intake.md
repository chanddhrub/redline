# 04: DOCX intake

Status: ready-for-agent

**What to build:** A job seeker whose offer arrived as a Word file drops it on the page and it is accepted directly, without converting it to something else first.

Independent of 03: PDF and DOCX extraction are separate internals behind the same seam and can be built in either order.

**Blocked by:** 01.

- [ ] A `.docx` file is parsed in the browser and its text is shown back to the user
- [ ] `mammoth` is added as a dependency (approved in the spec, 2026-09-06)
- [ ] Parsing works in the browser and under the Node test runner
- [ ] A committed DOCX fixture with known text asserts the canonical text and the sentence offsets
