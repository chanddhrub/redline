---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Landing page

Scope: the marketing route at `/`. Visitor mode: **Persuade**.

## Job and audience

A job seeker holding an unsigned offer letter, non-compete or IP assignment,
with a deadline. Per ADR 0002 they **can** negotiate — an offer letter is one of
the few genuinely negotiable documents — but they do not know which clause to
push on. The page's tension is not powerlessness; it is not knowing what to ask
for.

## Outcome and proof

One action: try it on a document. One thing demonstrated: a contract turning
into ranked flags, each showing the exact sentence it came from.

Proof is the mechanism running on the page, not a screenshot of it. The only
claims permitted are ones `PRD.md` supports. No prices, customers, testimonials
or quotes — none exist (PRODUCT.md, Evidence on Hand). No verdict on whether to
sign, no legal advice, no scanned documents, no document types outside the three
v1 serves. The sample contract is synthetic and labelled as such on the page.

## Scope and boundaries

Build `src/app/page.tsx` and its components only. Anti-goals: a pricing section,
a testimonial band, a logo wall, a feature triptych, a tilted dashboard
screenshot, any sign-in affordance (there is no account in v1).

## States and ranges

Flags per document: 0 to roughly 8; the demo carries 4. A clean document returns
a **coverage receipt**, never an empty result — shown on the page, because "no
flags" must never read as "safe to sign". Source sentences run 15–60 words and
must not be truncated. Severity: Critical and High only, per ADR 0003.

## Constraints

WCAG 2.2 AA. Severity and register must survive greyscale — no meaning carried
by hue alone. Desktop and phone are equally primary. The document's own words
never move, animate or transform.

## Direction contract

**THESIS:** Navigation recrops instead of repaginating — choosing a finding
crops the contract hard to the one sentence it came from, at full reading scale.
The page refuses the legal-tech hero: no floating document mockup, no feature
triptych, no tilted screenshot, no eyebrow above the heading.

**OWN-WORLD:** Spot orange at full strength owns the field — ground, not accent.
Ink black is Redline's voice; warm cream is the document's paper and appears only
inside punched windows. Heavy condensed caps set off-angle with a hairline rule
tracking the angle; skewed parallelogram controls with hatch fills; halftone
screens as the material for anything not from the document. Three faces, each
with a job: Anton displays, Archivo speaks, Tinos is the contract's own words —
so the two registers are a typeface change, legible in greyscale.

**STORY:** She understands that every flag is anchored to a sentence she can find
in her own contract; believes it because she watches the crop land on that
sentence rather than being told; and uploads her document.

**FIRST VIEWPORT:** Orange fills the frame. Wordmark boxed top-left. Headline in
three angled lines of condensed black caps across the left two-thirds, hairline
rule beneath. The contract sits cropped hard into the right corner, bleeding off
the edge, cream paper in Tinos, one sentence bracketed. Findings run as title
lines down the orange field under the headline; the active one reverses out. The
primary action sits at the foot of the finding stack.

**FORM:** The Session Sleeve (Blue Note), dealt challenger and leader by deal
order, chosen over the assigned grounded direction in a user-steered bolder hand.
Seed key c58fa671, re-roll round 1, register bolder. Code-led; no comp is owed.

Raises carried in, named for the declined hands that donated them: severity
arrives as a ruled table of measured rows — duration, scope, cost to exit — never
as an adjective (wax pack); only the legend is held level, so the document's
words never move and all motion belongs to Redline's layer (gravity garden); the
verification step is shown rather than assumed, because a quote that cannot be
located is a dropped flag (raku).

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
