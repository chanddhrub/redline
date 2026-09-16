# 07: The labelled enforceability layer

Status: ready-for-agent

**What to build:** The one place the product is allowed to say something the
document does not. Enforceability context keyed to the state the user works in,
sitting beside a flag, explicitly marked as not coming from their document, and
visually distinct from every cited claim.

ADR 0005 permits this layer only because it is labelled. It may never be merged
into a cited flag, and it may never silently change a severity. Running the
pipeline with the layer and without it must produce identical flags in an
identical order.

Where the document has a governing-law clause, that clause is shown too — it
*is* in the document, so it is a citation with a span, and it often names a
state other than the one the employee works in. Showing both is the point.

**This ticket ships no maintained legal corpus.** It ships the layer, its
labelling and a small honest starting set for the four clause types, with the
date it was written and its source recorded next to it, so a reader can see how
old it is. ADR 0005 accepts that it goes stale silently; recording the date is
what makes that visible.

**Blocked by:** 04, 05.

- [ ] Enforceability notes are keyed to the user's state and carry no span
- [ ] Every note is labelled as not coming from the reader's document, in words
      as well as in styling
- [ ] The layer is visually distinct per `DESIGN.md`: a 2px dashed ink border and
      a halftone rail, header reading "Not from your document", copy in Archivo
      and never in Tinos
- [ ] A note never alters a flag's severity or its position, asserted by running
      the pipeline with and without the layer
- [ ] A Californian reading a non-compete flag is told their state's position,
      beside the flag, without the flag's severity moving
- [ ] The governing-law clause is shown as a citation with its span where the
      document has one, and its state is named alongside the user's
- [ ] The starting set records its date and provenance in the repository
- [ ] A reader can classify every item on screen as "from my document" or
      "general context" (PRD §4 T7)
- [ ] All copy has been through the humanizer skill
