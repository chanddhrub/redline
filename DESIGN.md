---
name: Redline
description: A contract-reading tool built on a spot-orange field where every flag shows the sentence it came from.
colors:
  spot: "#FF5A1F"
  ink: "#0A0A0A"
  paper: "#FFF1E0"
  burnt: "#4A1200"
  tint: "#FF8A50"
  peach: "#FFC7A6"
typography:
  display:
    fontFamily: "Anton, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.5rem, 8vw, 7.5rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "Anton, ui-sans-serif, sans-serif"
    fontSize: "clamp(1.9rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Anton, ui-sans-serif, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.5rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.4vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  body-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
  document:
    fontFamily: "Tinos, Times, Times New Roman, serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  gutter-sm: "20px"
  gutter-lg: "32px"
  stack: "12px"
  block: "40px"
  section: "80px"
components:
  slug-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.spot}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.95rem 4.6rem 0.95rem 1.8rem"
  slug-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.95rem 4.6rem 0.95rem 1.8rem"
  slug-on-ink:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.95rem 4.6rem 0.95rem 1.8rem"
  finding-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "16px 16px"
  finding-row-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.spot}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "16px 16px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.document}"
    rounded: "{rounded.none}"
    padding: "28px 32px 28px 48px"
  panel-cited:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.document}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  panel-not-from-document:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  stamp:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.spot}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 8px"
---

# Design System: Redline

## Overview

**Creative North Star: "The Session Sleeve"**

Redline is printed, not rendered. The whole product sits on a flat field of spot
orange run at full strength — ground, never accent — the way a Blue Note session
sleeve commits its entire cover to one ink and lets black type do the work. There
is no card stack floating over a neutral canvas, no soft surface hierarchy, no
gradient. Depth exists only as two flat plates (orange field, ink plate) and one
punched material (cream paper). A screen is either the field or a hole cut in it.

The world assigns every material a job and refuses to let materials drift. Ink
black is Redline's own voice. Warm cream is the reader's document — it appears
only inside a window punched into the field, never as a page background, never as
a card. Halftone screens mark anything that did not come from the reader's
document. The three typefaces are not a pairing exercise: Anton displays, Archivo
speaks for Redline, Tinos is the contract's own words. Because register is
carried by a typeface change rather than a colour, the distinction between "your
contract said this" and "Redline says this" survives greyscale, photocopying and
colour-blindness alike.

Density is high and the geometry is deliberately off-square: display lines rotate
-2.6deg with a hairline rule tracking the same angle, controls are skewed
parallelograms with hatch fills, and the document panel bleeds off the right edge
instead of being politely contained. Confirmed anti-references: the legal-tech
hero in all its forms — floating document mockup, feature triptych, tilted
dashboard screenshot, logo wall, testimonial band, and any eyebrow or kicker line
above a heading.

**Key Characteristics:**
- Spot orange as ground, at full saturation, across the whole product
- Zero corner radius anywhere; borders are 1px, 2px or 3px hard rules
- Three faces with three jobs; register is a typeface change, not a colour
- Meaning never carried by hue alone — length, stamp and word carry severity
- Off-angle display type (-2.6deg) and skewed (-11deg) controls
- Flat: no shadows, no blur, no gradient fills except hatch and halftone screens

## Colors

A single high-chroma orange field, one near-black, one warm cream, and exactly
one hue-tinted secondary — no greys anywhere in the system.

### Primary
- **Spot Orange** (`{colors.spot}`): The ground. It fills `html`, `body`, every
  un-plated section, the scrollbar track, and the type colour of anything set on
  an ink plate. It is not rationed; it is the field the product lives on.

### Secondary
- **Ink Black** (`{colors.ink}`): Redline's voice. All body and display type on
  the field, every rule and border, the active finding row, the coverage-receipt
  plate, the closing plate, and the focus outline on orange grounds. Measures
  6.35:1 on spot, and spot measures 6.35:1 back on ink.

### Tertiary
- **Paper Cream** (`{colors.paper}`): The document's stock, and only that. It
  appears inside the punched reading window, inside cited-sentence panels, and as
  the type colour on ink plates. Ink on paper measures 17.8:1. It is never a page
  background and never a card.

### Neutral
- **Burnt Umber** (`{colors.burnt}`): The only permitted secondary text colour on
  orange (4.89:1). It is tinted out of the orange hue, never desaturated toward
  grey. Used for supporting captions, measure labels, and footer fine print. It
  also supplies the 7% speckle in the paper stock texture.
- **Tint** (`{colors.tint}`) and **Peach** (`{colors.peach}`): declared lighter
  steps of the spot hue, reserved for non-text material use.

### Named Rules
**The No Cream On Orange Rule.** Paper cream is never set as text on the orange
field — it computes 2.81:1 and fails AA even at large size. On orange, text is
ink (6.35:1) or burnt umber (4.89:1). Nothing else.

**The Greyscale Rule.** No meaning may be carried by hue. Severity is a bar whose
*length* varies (44px Critical, 22px High) plus a stamped code (CR-1, HI-2) plus
the spelled word. Register is a typeface change. Print the screen in greyscale;
if any distinction disappears, the design is wrong.

**The Paper Is The Document Rule.** Cream means "these are the reader's own
words". If a surface is cream, the text on it came from the uploaded document —
or it is explicitly stamped as not having, on a dashed border with a halftone
rail.

## Typography

**Display Font:** Anton (400 only, with `ui-sans-serif` fallback)
**Body Font:** Archivo (variable, with `ui-sans-serif, system-ui` fallback)
**Document Font:** Tinos 400/700 (with Times, "Times New Roman" fallback)

**Character:** Heavy condensed caps shouting across the field, a clean grotesque
speaking at normal volume underneath, and a Times-metric serif that is not
Redline talking at all — it is the contract, reproduced. `font-synthesis-weight`
is off, so a weight that does not exist is never faked.

### Hierarchy
- **Display** (400, 2.5rem → 4.2rem → 7.5rem, lh 0.92, tracking -0.012em, caps):
  The page's single hero statement, set in three rotated lines with a 3px
  hairline rule beneath at the same angle.
- **Headline** (400, 1.9rem → 3rem → 4rem, same metrics, caps): Section heads,
  with a 2.2 → 3.4 → 5rem step for the closing statement. Held level — only the
  hero is angled.
- **Title** (400, 1.25rem → 1.5rem, caps): Definition terms in ruled lists, e.g.
  each refusal in "What Redline refuses to do".
- **Body** (400, 1.125rem → 1.25rem, lh 1.625): Redline's prose. Measured at
  62–68ch maximum; never wider.
- **Body Small** (400, 0.9375rem, lh 1.625): Finding explanations, counter-offer
  text, footnotes. Capped at 62ch.
- **Label** (700, 0.72rem, tracking 0.14em, uppercase): Micro-labels — finding
  codes, severity words, panel headers, char-offset receipts, the button face.
  Pairs with `tabular-nums` wherever a number is shown.
- **Document** (Tinos 400/700, 0.9375rem → 1rem, lh 1.62): The contract's own
  words, in the sheet and in every cited-sentence panel.

### Named Rules
**The Two Registers Rule.** Tinos means the document is speaking; Archivo means
Redline is speaking. Never set Redline's commentary in Tinos to look more legal,
and never retype a quoted sentence in Archivo.

**The No Eyebrow Rule.** Nothing sits above a heading. No kicker, no eyebrow, no
category line. The uppercase Label style belongs *inside* panels, on buttons and
on receipts — never as a standalone line introducing a headline.

**The Tabular Receipt Rule.** Every character offset, count and measured value is
set in tabular figures so columns of evidence line up and can be compared.

## Layout

One centred column at `max-w-[92rem]` with a 20px gutter on phones and 32px from
`sm` up. Vertical rhythm is coarse: 80px between major sections, 40px between
blocks inside one, 12px inside a stack. Sections alternate between the orange
field and full-bleed ink plates; the plate's own padding matches the field's, so
the column never shifts when the ground changes.

The signature layout is a two-column split at `lg`: findings occupy 1.55fr on the
left, the document sheet 1fr on the right, and the sheet is pushed `-5vw` past
the container so it bleeds off the viewport edge. The sheet sticks at `top: 8`
while the findings scroll. Below `lg` the split collapses to a single stacked
column, the sheet stops bleeding, and each expanded finding grows its own inline
cited-sentence panel so the reader never loses the quote — phone is a different
composition of the same mechanic, not a squeezed desktop.

Sheet height steps with the viewport: 26rem, 32rem at `sm`, 38rem at `lg`.
Horizontal overflow is clipped at the page root so the deliberate bleed cannot
produce a scrollbar.

## Elevation & Depth

**There are no shadows in this system. None.** Depth is plate-and-punch: the
orange field is the ground plane, ink plates sit on it as full-bleed colour
inversions, and the cream sheet is a hole punched through to the document
underneath. Separation is done with hard 2px ink rules and colour inversion,
never with a blur, a lift or a glow.

The one depth effect that exists is the veil: two `halftone-paper` screens (22%
ink dots on a 5px pitch over a 38% cream wash) cover the document above and below
the active sentence, leaving one sentence at full strength inside a 2px ink
bracket with a 7px orange tick in the left margin. Screened document text still
measures 5.4:1, so the un-windowed contract remains readable rather than merely
decorative.

### Named Rules
**The Flat Rule.** No `box-shadow` anywhere. A surface that needs to separate gets
a 2px ink rule or an inverted plate. Hard offset "sticker" shadows are foreign to
this world and are not a permitted substitute.

**The Screen Means Not-Yours Rule.** A halftone screen marks material that is not
the reader's document speaking — either not currently windowed (`halftone-paper`)
or not from the document at all (the `halftone` rail on the enforceability panel).

## Shapes

Radius is zero everywhere — `{rounded.none}` is the only value in the system, and
the focus outline explicitly resets `border-radius: 0` so the browser cannot
round it. Borders come in three weights: 1px hairline dividers (often at 25–40%
ink for list separators), 2px structural rules for panels and plates, 3px for the
hero's rule and the focus outline.

Two recurring geometries carry the world's hand. The **tilt**: display type and
its trailing rule rotate -2.6deg from a left-centre origin. The **skew**: controls
are parallelograms, `skewX(-11deg)` with their contents counter-skewed +11deg so
the label stays upright inside a slanted slab. A trailing 3.2rem panel of -52deg
hatch stripes closes every primary control.

A dashed 2px ink border is reserved, exclusively, for the labelled enforceability
layer: dashed means "not from your document".

## Components

### Buttons (Slugs)
- **Shape:** Hard parallelogram, zero radius, `skewX(-11deg)`, 2px ink border,
  contents counter-skewed upright. Asymmetric padding (`0.95rem 4.6rem 0.95rem
  1.8rem`) leaves room for the hatch panel at the trailing edge.
- **Primary:** Ink ground, spot type, plus the 3.2rem hatch panel. Face set in
  Label type.
- **Ghost:** Transparent ground, ink type, same 2px ink border.
- **On ink plates:** Cream ground, ink type; the hatch panel drops to 40% opacity
  so it reads as texture rather than noise.
- **Focus:** 3px ink outline at 3px offset. Inside an `.on-ink` region the outline
  switches to spot orange so it stays visible against black. Verified in capture.
- **Hover:** both variants invert ground and type over 180ms on the system's
  standard `cubic-bezier(0.16, 1, 0.3, 1)`. Primary goes ink-on-spot to
  spot-ground with ink type; ghost fills to ink with spot type. Verified in
  browser.

### Finding Rows
- Full-width ruled list items separated by 1px ink hairlines at 35% opacity.
- Each row carries, in order: the stamped code in tabular Label type, the severity
  bar, the severity word, the finding title in semibold Archivo, and a "Quote
  located · chars N–N" receipt in burnt umber.
- **Hover (inactive rows only):** a 10%-ink wash over the orange field, 200ms on
  the standard curve. The active ink plate does not react — it is already the
  selected state. Verified in browser.
- **Active:** the entire row inverts to an ink plate with spot type and marks
  itself `.on-ink`; its expansion opens below on an 8%-ink wash carrying a
  two-column measures table, the plain-English meaning, and the counter-offer.
- **Severity bar:** a 9px-tall `currentColor` block whose width encodes severity —
  44px Critical, 22px High. Length is the signal; the bar never changes colour.

### Panels
- **Cited panel:** 2px solid ink border, cream ground, a Label header strip
  divided by a 2px rule, and the quoted sentence in Tinos.
- **Enforceability panel:** identical construction with a 2px *dashed* ink border
  and a 9-unit halftone rail down the left inside edge. Header reads "Not from
  your document". Its copy is Archivo, never Tinos.
- **Coverage receipt:** on an ink plate, 2px cream border, cream header strip with
  ink type, rows divided at 35% cream, findings column in spot Label type.

### The Travelling Window (signature)
Choosing a finding does not repaginate the contract — it recrops it. The
document's words never move, transform or animate. Instead Redline's own layer
travels: two halftone veils and a 2px ink bracket animate their `top` and
`height` over 520ms on `cubic-bezier(0.16, 1, 0.3, 1)`, closing around the cited
sentence, with a 7px spot tick in the left margin marking the crop. The scroller
eases the sentence to 28% of the panel height; the first paint jumps instantly
rather than animating on load. Under `prefers-reduced-motion: reduce` the veil and
bracket transitions are removed entirely and the scroll jumps — the crop still
lands, it simply does not travel.

### Browser Surfaces
Selection, scrollbars and focus rings belong to the system, not to the browser.
Selection is ink-on-spot inverted; inside the document sheet it flips to
spot-on-ink. Scrollbars are 12px, ink thumb with a 3px track-coloured border, the
track picking up whichever ground it sits on (spot on the field, cream in the
sheet).

## Do's and Don'ts

### Do:
- **Do** run spot orange as the ground of new surfaces. Starting a screen on white
  or on a neutral grey puts it outside this world.
- **Do** set the reader's own words in Tinos on cream and Redline's words in
  Archivo, so the register survives greyscale.
- **Do** encode severity with bar length (44px / 22px), a stamped code and the
  spelled word, together — never with any one of the three alone.
- **Do** use burnt umber for secondary text on orange, and keep it tinted from the
  hue; a grey here would read as a bug.
- **Do** mark anything not from the reader's document with a halftone screen, a
  dashed 2px border, and an explicit label.
- **Do** give every interactive element a 3px offset focus outline, switching to
  spot inside `.on-ink` regions.
- **Do** keep prose measures at 62–68ch and set every number in tabular figures.

### Don't:
- **Don't** set cream text on orange. It computes 2.81:1 and fails AA at any size.
  Ink or burnt umber only.
- **Don't** add a corner radius, a box-shadow, a blur, or a gradient fill. The only
  patterned fills in this world are the -52deg hatch and the 5px halftone screens.
- **Don't** animate, transform or reflow the document's own words. All motion
  belongs to Redline's layer, and all of it respects `prefers-reduced-motion`.
- **Don't** place a kicker, eyebrow or category line above a heading.
- **Don't** merge enforceability context into a cited flag, or let it alter a
  severity. The dashed border exists to keep them apart.
- **Don't** build the legal-tech hero: floating document mockup, feature triptych,
  tilted dashboard screenshot, logo wall, testimonial band.
- **Don't** introduce prices, customers, testimonials or benchmarks. None exist in
  this product, and demonstration content stays badged "Sample — not a real
  contract".
- **Don't** use glyph icons or an icon font. This world's marks are typographic and
  geometric: stamped codes, rules, bars, hatch, halftone.

<!-- Unfilled slot in this system's coverage: the world's loudest native device —
a duotone halftone photographic crop in ink and spot, bleeding off a corner — is
specified by the world but unused in this build. No image generation was
available and a CSS approximation of a photograph was refused as imitation
material. The photographic register exists in this system and is simply unfilled;
a later session should fill it with a real duotone raster rather than conclude the
world has no imagery. -->
