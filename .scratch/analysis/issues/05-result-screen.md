# 05: The result screen

Status: done 2026-09-16

**What to build:** The reader's side of the analysis, inside the `/review` shell
that already exists. The summary, the ranked flag stack, each flag's expansion
with its measures, its plain-English meaning and its counter-offer, the cited
sentence panel, and the coverage receipt.

The shell's signature interaction becomes real here: **selecting a flag recrops
the document to its source sentence.** On the landing page that is a
demonstration. Here it is the working control, driven by the flag's span. The
document's own words never move, transform or animate — Redline's layer travels.
`DESIGN.md` specifies the travelling window exactly; follow it, including
`prefers-reduced-motion`.

Two registers must be visually distinguishable on screen, not merely in the
prompt: the document's words in Tinos on cream, Redline's claims in Archivo on
the frame. If a reader cannot tell them apart, the distinction does not exist
(PRD §3, PRD §4 T7).

Severity is carried by bar length, a stamped code and the spelled word together
— never by hue alone. Print the screen in greyscale; if a distinction
disappears, it is wrong.

The coverage receipt is not a footer. On a clean document it is the result.

**Blocked by:** 04.

- [x] The summary, the ranked flags and the coverage receipt render from a real
      `Analysis`, with no synthetic sample material left in the path
- [x] Every flag shows its source sentence verbatim, in the document register
- [x] Selecting a flag recrops the document sheet to that flag's span, with the
      document's words never moving
- [x] `prefers-reduced-motion` removes the travel and keeps the crop
- [x] Severity survives greyscale: bar length, stamped code and spelled word
- [x] The coverage receipt renders on every analysis and is the result on a
      clean document
- [x] Analysis-running, zero-flag and error states are product surface, not
      spinners and error strings
- [x] Phone width is a different composition of the same mechanic, not a
      squeezed desktop; the source sentence never drops below reading size
- [x] `DESIGN.md` is obeyed: zero radius, no shadows, three faces with three
      jobs, no glyph icons, no eyebrow above a heading
- [x] All copy has been through the humanizer skill
