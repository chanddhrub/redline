# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary, and the only audience v1 serves:** a job seeker holding an offer
letter, non-compete, or IP assignment that they have not signed, with a
deadline. One document, one decision, now.

`CONTEXT.md` calls this the **crisis user**, and the narrowing is deliberate:
not a habitual user, not someone building a filing habit. They are employed or
about to be, literate, and capable of reading the document — and still could
not turn reading it into a decision. The one first-person account the research
found is an anonymous poster who noticed an arbitration clause in a Google
offer letter, was uncomfortable, and had nowhere to take that discomfort.

What they do instead today, in descending likelihood: sign it; ask a forum;
ask a general-purpose chatbot; pay a lawyer (~$542.59 average for a
non-compete review, the only sourced per-document price for this work).

**Explicitly not served in v1:** tenants, freelancers, small businesses.
Tenants are named in `CONTEXT.md` because they are harmed often and have the
least money to defend themselves — excluding them is a choice on the record,
not an oversight (ADR 0002).

## Product Purpose

Redline reads one unsigned employment document and returns what it commits the
person to, in plain English, with the clauses that could hurt them ranked by
how hard they are to escape — each one showing the exact sentence it came from.

It exists to prove one thing: that the analysis can be trusted. Every decision
in the project is judged against that, and several capabilities are weaker than
they could be because of it.

Success is not comprehensiveness. Success is that a frightened person can put
our claim and their contract side by side and settle it themselves — confirm
the sentence is theirs, read what surrounds it, judge whether our severity is
fair, and check that the counter-offer rewrites the clause in front of them.
When Redline is wrong, being wrong is visible rather than plausible.

## Positioning

Contract-review tools are not short on output. They are short on output you can
check. Trust is the universal complaint at every price tier — false positives
in the expensive tools, "generic and sometimes inaccurate" in the cheap ones,
fabricated citations when people use a general chatbot — and no product answers
it by showing you the sentence.

The mechanism a neighboring product cannot truthfully copy without adopting the
same costs: **a flag whose source sentence cannot be located in the stored text
is dropped before the user sees it.** Not paraphrased, not softened into an
unsourced note, not shown with a section reference instead. Competitors can
claim accuracy; they cannot claim this without accepting what it forfeits —
no OCR, measurably lower recall, and no ability to flag a clause that is
*missing*, because an absence has no sentence to quote.

## Operating Context

The document arrives as a PDF or Word attachment in an email, or occasionally
as pasted text. It is the user's own offer — it has their name and their salary
in it, which is why the file is parsed in the browser and never uploaded.

**Both desktop and phone are primary, equally.** The laptop scene is the email
attachment opened at a desk, where reading a flag beside the contract is
realistic. The phone scene is the train, the corridor, the gap between
interviews. Neither is a fallback: every surface is designed at both sizes from
the start, with no ordering between them. This is a real constraint rather than
a preference — verbatim legal sentences are long, and two visually distinct
registers have to survive a 390px viewport.

The session is short and singular. There is no return visit to design for, no
library to browse, no history to accumulate. The user arrives with a deadline
and leaves with a decision.

## Capabilities and Constraints

**What v1 does** (PRD §3 — this list is closed; anything that looks like the
obvious next step gets asked about before it is built):

1. Accepts one document, parsed in the browser. Only extracted text is stored,
   never the original file.
2. Asks which US state the user works in, and says why before asking.
3. Takes an editable list of **red lines** — constraints the user declares in
   their own words.
4. Returns a plain-English summary of what the document commits them to.
5. Returns a ranked list of **flags**, each carrying four things: the source
   sentence quoted verbatim, a severity, a plain statement of what it means,
   and a counter-offer.
6. Drafts a **counter-offer** per flag, written against the sentence shown.
7. Answers questions about the document, from the document only.
8. Returns a **coverage receipt** on every analysis including a clean one.
9. Shows enforceability as a labelled **second layer**, keyed to the user's
   state and visually distinct from cited flags.

**Four clause types are in scope** (ADR 0003), with default severities:
non-compete / non-solicit (Critical); mandatory arbitration and class-action
waiver (Critical); IP assignment and moonlighting restrictions (High); equity
vesting, clawback and signing-bonus repayment (High). A dangerous clause
outside these four will be missed, and the output must not imply the document
was fully reviewed.

**Vocabulary that must not drift** (`CONTEXT.md` narrows each of these
deliberately; synonyms reintroduce the ambiguity the glossary removed):
crisis user · before-signature · source sentence · flag · red line ·
counter-offer · escapability · promotion · coverage receipt · second layer.

**Hard constraints:**

- The file is parsed client-side. There is no server route that accepts a file;
  the absence of that route is the enforcement.
- Severity ranks by **escapability first, money second**. Unusual is not
  dangerous — a strange clause can be harmless.
- A red line **promotes** a matching flag to the top and names the line it
  crossed. It never demotes, filters, or hides anything.
- The two registers — what the text says, and what a court or employer might do
  about it — must be distinguishable **in the interface**, not merely in the
  prompt. If a reader cannot tell them apart on screen, the distinction does not
  exist.
- A refusal is product surface, not an error string. It says what happened, why
  the standard exists, and what to do instead, in ordinary words.
- The model is called through OpenRouter; default `anthropic/claude-sonnet-5`.

**No account in v1** (confirmed 2026-09-11). Nothing persists beyond the
session: no sign-in, no sign-up, no account surface. Document text, state and
red lines live in memory, with `sessionStorage` used only to survive an
accidental in-page navigation — never `localStorage`, so a shared machine does
not keep someone's offer letter. This supersedes the line in PRD §3 describing
a Supabase-backed account, which is stale.

**Excluded on purpose:** payments and billing; document sharing; leases,
freelance agreements and terms of service; after-signature monitoring
(auto-renewal, cancellation — the best-evidenced harm in the research, and one
Redline barely helps with); and anything that acts on the user's behalf. Redline
drafts; the user decides and sends.

**OCR is excluded permanently, not deferred.** A citation is worthless when the
text it points at was misread. A scanned or photographed document is refused
with an explanation, never analysed from fragments.

**The saved library is deferred, not cut.** It is a retention feature, and v1
has no acquisition to retain (ADR 0002).

**Open product decisions, recorded rather than invented:**

- Whether Supabase runs as a local CLI with versioned migrations or as a hosted
  project only. Undecided; no feature to date forces it.
- Whether anyone will pay, and what for. See Evidence on Hand.

## Brand Commitments

**Name:** Redline. **Line in use:** "Read the offer letter before you sign it."

**Voice, as demonstrated across every document in the repository** — this is an
observed and confirmed constraint, not a style suggestion:

- Plain words. "What happened, why, what to do instead."
- Costs are stated rather than designed around. The README names what the
  citation rule forfeits; the research summary marks where evidence is thin;
  ADR 0003 records that one of the four clause types has no research behind it.
- Two registers, kept apart in language as well as layout: what a sentence says
  is stated flatly; what a court would do with it is marked uncertain.
- Never hedged into uselessness. Hedging hands the decision back to the person
  who came because they could not make it.
- Not legal advice, and it says so plainly rather than burying it.

**No visual identity exists.** No logo, no wordmark, no palette, no type
choices, no brand assets. `public/` contains only create-next-app placeholder
SVGs and `src/app/page.tsx` is the unmodified starter template — an
anti-reference, not incumbent design authority.

## Evidence on Hand

**Real and citable:**

- `research/summary.md` plus four research passes in `research/` — sourced
  quotes and URLs for the three sharpest pain points, clause-type rankings, and
  the competitive landscape. Every claim traces to a URL; gaps are marked.
- `PRD.md` — the v1 brief, including §4's four falsifiable tests (T1 citation
  integrity at 100%, T2 the reader can settle a disagreement alone, T3 stable
  ranking, T4 precision holds and recall is measured).
- `docs/adr/0001`–`0005` — five decisions with alternatives rejected and why.
- `CONTEXT.md` — the glossary.
- Sourced statistics available for use: 81 of the 100 largest US firms use
  mandatory arbitration; ~99% of consumers are unaware they are bound by it;
  91% of consumers accept terms of service without reading (97% among 18–34s).

**Absences that must not be filled with invention:**

- **Zero willingness-to-pay evidence.** Across four research passes, not one
  sourced "I would pay $X to have my contract read." Every price in the brief
  is what someone pays a lawyer or what a vendor lists. Recorded as an open
  decision on 2026-09-06: build first, validate later.
- No customers, no users, no testimonials, no case studies, no press.
- No pricing. Nobody has been asked to pay.
- No fixture corpus yet — the ~20 marked-up offer packets T4 needs, and the
  scanned and encrypted PDFs the refusal work needs, do not exist.
- The research found no first-person tenant account at all, and only Medium
  confidence on freelancers. Both are reasons those segments are excluded.

## Product Principles

1. **Checkable beats comprehensive.** Every claim is shown next to the evidence
   for it, so the reader can settle a disagreement without asking us. Output
   that cannot be checked is worth less than less output that can.
2. **Refuse rather than degrade.** Where the input cannot support an honest
   answer, say so plainly and say what to do instead. A degraded result that
   looks whole is the failure mode; a refusal that reads as a standard is not a
   limitation.
3. **Miss rather than cry wolf.** Where a flag is doubtful, drop it. The
   coverage receipt — not a padded list — is what stops "no flags" being read as
   "safe to sign," which makes it load-bearing rather than a footer.
4. **Keep the two registers apart, visibly.** What the document says and what
   the world might do about it are different kinds of claim and are never
   merged. Merging them makes the whole output only as trustworthy as its
   weaker half.
5. **State the cost.** Where a decision forfeits something, the product and its
   documents say so rather than routing around it.

## Accessibility & Inclusion

**WCAG 2.2 AA** is the committed standard.

One product-specific consequence, and the reason the question was asked:
**severity and register must survive greyscale.** Encoding either in color
alone would break PRD §3's requirement for a colorblind reader — the
distinction between a cited flag and the labelled enforceability layer, and the
ordering between Critical and High, each need a carrier that is not hue: shape,
label, position, weight, or rule.

Two further consequences of the audience rather than the standard: the reader
is under time pressure and often stressed, and long verbatim legal sentences
are unavoidable content. Reading comfort at both desktop and phone widths is a
functional requirement, not a refinement.
