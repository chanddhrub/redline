# Redline — v1 brief

Written 2026-08-28 from `research/summary.md` and ADRs 0001–0005. Where a claim
rests on research, the source is linked. Where nothing supports it, that is
stated rather than filled in.

This version exists to prove the analysis can be trusted. Every section below
is written to be checked against that.

---

## 1. Who this is for, and what they do today instead

A job seeker who has an offer letter, non-compete, or IP assignment in hand,
has not signed it, and has a deadline. One document, one decision, now. Not a
habitual user — the **crisis user** of `CONTEXT.md`.

Concretely: the person in the only first-person account of this segment the
research found — an anonymous poster on Blind who noticed an arbitration clause
in a Google offer letter while reading it closely, and asked whether there was
any way to avoid signing it. They are employed or about to be, literate,
capable of reading the document, and still could not turn reading it into a
decision.

**What they do today, in descending order of how often it probably happens:**

- **Sign it.** No sourced figure exists for job seekers specifically. The
  nearest evidence is general: 91% of consumers accept terms of service without
  reading, 97% among 18–34s ([Deloitte](https://medium.com/deloitte-uk-design-blog/dont-read-t-cs-read-war-and-peace-981e8159529e)),
  and ~3 in 4 online users rarely read business ToS ([Brookings](https://www.brookings.edu/articles/brookings-survey-finds-three-quarters-of-online-users-rarely-read-business-terms-of-service/)).
  An offer letter is read more carefully than a ToS. How much more is unknown.
- **Ask a forum.** The Blind post is this behaviour. Free, fast, unaccountable,
  and answered by strangers who have not seen the document.
- **Ask a general-purpose chatbot.** Free and passable, and the failure mode is
  documented: a lawyer was sanctioned over fabricated case citations produced
  this way (`research/agent-3`). Nothing in the output distinguishes the parts
  that came from the document from the parts that did not.
- **Pay a lawyer.** A flat-fee non-compete review averages **$542.59**, with
  some firms at $1,000; employment contract review runs ~$420
  ([ContractsCounsel](https://www.contractscounsel.com/b/non-compete-agreement-cost)).
  National average attorney rate is $349/hr ([Clio](https://www.clio.com/resources/legal-trends/compare-lawyer-rates/)).
  This is the highest-quality option and it costs roughly a week of a junior
  salary for one document.
- **Buy a subscription for one document.** Rocket Lawyer bundles AI review into
  ~$40/mo; LegalZoom's attorney-consult add-on renews at $49/mo; LegalShield
  personal is $29.95/mo. Monthly billing for an episodic need. The research
  found **no pay-once, single-document option anywhere** (`research/summary.md` §3).

The gap Redline sits in: between a $9–$99 tool nobody trusts and a $450–$660
lawyer most people will not buy for one document. A **$29–$79 one-document
price** is the shape that fits. That figure is an inference from the anchors
above, **not** a sourced willingness-to-pay number, and no price is committed in
v1 — payments are out of scope (§7).

**Not served in v1:** tenants, freelancers, small businesses, founders,
consumers reading ToS. See §6.1 for what that costs and who pays it.

---

## 2. The problem

The document is read and still not understood as a decision.

> "Noticed my Google offer letter has an arbitration clause. From reading
> through it, it seems like it is basically signing away my right to a trial /
> legal processes vs Google."
> "This made me pretty uncomfortable... is there no way to avoid signing this?"
>
> — anonymous, Blind, https://www.teamblind.com/post/arbitration-clause-in-google-offer-aykxed3z

Three things in that quote define the product. The clause was **found**, so the
problem is not detection. Its meaning was **roughly grasped**, so the problem is
not translation alone. And the person still did not know **what to do** — so
what is missing is the step from "this says X" to "X is or is not acceptable to
me, and here is what I can say about it."

The exposure is not niche. 81 of the 100 largest US firms use mandatory
arbitration, and roughly 99% of consumers bound by such clauses are unaware of
it ([EPI](https://www.epi.org/publication/the-arbitration-epidemic/), [NCLC](https://www.nclc.org/study-99-of-consumers-unaware-they-are-forced-arbitration/)).
The Blind poster is in the top 1% of attentiveness and was still uncomfortable
and stuck.

The second half of the problem is what happens when the clause is not read at
all. The sharpest sourced case is not from an offer letter, so it is offered as
the mechanism rather than as the segment:

> A non-compete was enforced **four years** after a freelance gig that lasted a
> few weeks; the client sought to enforce it for up to seven years. The clause
> "effectively put some freelancers out of work, because they simply did not
> know that the non-compete clause they had signed was illegal."
>
> — Colleen Doran, https://colleendoran.substack.com/p/the-none-compete-clause

The harm there was doubled: the clause bound them, and **not knowing what it
meant** made them comply with something that may not have bound them at all.
That second harm is why enforceability appears in v1 as a labelled layer
(ADR 0005) rather than being left out for purity.

**And the honest limit.** The best-evidenced contract harm in the research is
auto-renewal and hard-to-cancel subscriptions — thousands of FTC complaints a
year from all 50 states, with active enforcement ([FTC/Goodwin](https://www.goodwinlaw.com/en/insights/publications/2026/02/alerts-practices-ba-ftcs-click-to-cancel-rule-gets-new-life)) —

> "Monthly charges have been withdrawn from my business debit card for over
> nine years without my authorization."
>
> — Steven Bond, complaint against Retro Fitness, https://www.yahoo.com/news/articles/retro-fitness-billed-n-j-131952680.html

— and Redline barely helps with it. That harm lands *after* signing and is a
cancellation problem, not a comprehension problem. We read documents before
signature. We are building against the second-best-evidenced pain on purpose
(§6.2).

---

## 3. What the first version does

Exactly this, and nothing else. Anything that looks like the obvious next step
and is not on this list gets asked about before it is built.

1. **Accepts one document, parsed in the browser.** The user uploads an offer
   letter, non-compete, or IP assignment. Text is extracted client-side; only
   the text is stored, never the original file. A scanned image is refused with
   a plain explanation, not processed (§6.3).
2. **Asks for the state the user works in**, before analysis, and says why.
3. **Takes an editable list of red lines** — constraints the user declares
   ("I will not sign an IP assignment covering personal projects"). Editable
   before and after analysis, with a re-run on change. Not a filter on the
   output: a red line **promotes** a matching flag to the top and names the red
   line it crossed. Red lines never demote a flag below its default severity.
4. **Returns a plain-English summary** of what the document commits the user to,
   held to the same standard as the flags: only what the text supports.
5. **Returns a ranked list of flags.** Each flag is one risk and carries four
   things: the **source sentence quoted verbatim** from the stored text, a
   severity, a plain statement of what it means, and a counter-offer. Flags are
   drawn from the four clause types in §5. A flag whose source sentence cannot
   be located in the stored text is dropped before it reaches the user — never
   shown in a degraded or paraphrased form (ADR 0001).
6. **Drafts a counter-offer per flag** — replacement language for the flagged
   clause, written against the sentence shown.
7. **Answers questions about the document, from the document only.** Where the
   text does not answer, it says so rather than reaching for general knowledge.
8. **Returns a coverage receipt on every analysis, including a clean one** — the
   clause types checked, the finding for each, and a plain statement of what was
   not reviewed. Never an empty result; never a manufactured low-severity
   finding invented to fill space (ADR 0004).
9. **Shows enforceability as a labelled second layer**, keyed to the user's
   state, visually distinct from flags and explicitly marked as not coming from
   the document. It sits beside a flag and may never silently change its
   severity. Where the document has a governing-law clause, that clause is shown
   too — it *is* in the document, and it often differs from where the employee
   works (ADR 0005).

Supporting these: an account (Supabase auth) sufficient to hold the current
document's text and the user's red lines. Not a library — see §7.

Two registers run through items 4–9 and must be **visually distinguishable in
the interface**, not merely in the prompt: what the text says (stated flatly,
checkable against the quoted sentence) and what a court or an employer might do
about it (marked uncertain). If a reader cannot tell them apart on screen, the
distinction does not exist.

---

## 4. What good looks like

The claim being tested is *trust*, so the tests are about verifiability, not
comprehensiveness. Each of these is meant to be run.

**T1 — Citation integrity is absolute.** On a fixture set of documents with
known text, **100%** of rendered flags carry a source sentence that string-
matches the stored text exactly after reversible normalisation. Not 99%. A
standing automated check fails the build if any flag renders without a locatable
span. Model output is verified, not trusted: a returned quote not found in the
stored text is a failed flag and is dropped.

**T2 — The reader can settle a disagreement alone.** Give five job seekers their
own real document and the output. Each should be able to take any flag, find
that sentence in their own contract, and say either "yes, that is what it says"
or "no, you are wrong about that" — without asking us. Target: every participant
locates every sentence. The failure we are looking for is not disagreement; it
is *inability to check*.

**T3 — Ranking is stable and explicable.** The same document analysed three
times produces the same set of flags in the same order. Where two flags swap,
that is a bug in the severity basis (§5), not variance to be tolerated.
Separately: for each flag, the ordering input taken from the text — duration,
scope, cost to exit, dollar amount — can be pointed at in the quoted sentence.

**T4 — Precision holds; recall is measured, not maximised.** On a fixture set of
~20 offer packets with clauses marked by a competent reviewer: **zero false
positives** among shown flags is the target, and any false positive is treated
as a serious defect. Recall across the four clause types is measured and
recorded, and a low number is an accepted cost (ADR 0004), not a bug to be fixed
by loosening the flag threshold.

**T5 — The question box refuses.** On a set of ~30 adversarial questions whose
answers are genuinely absent from the document ("is this enforceable in Texas?",
"is this salary competitive?", "what happens if I quit in month three?" against
a document silent on it), the answer says the document does not address it.
Target: no answer that asserts a fact the document does not contain. One
fabricated answer here destroys the thesis more thoroughly than ten missed
flags.

**T6 — Clean is not read as safe.** Give a user a document with no qualifying
flags. Ask afterwards what was checked and what was not. If they say "it's fine"
rather than naming the four clause types and the limits, the coverage receipt
has failed and that is a design bug, not a copy tweak. The receipt is
load-bearing: it is the only thing standing between a dropped borderline flag
(T4) and a false clean bill of health.

**T7 — The layers stay apart.** Show the output to a reader and ask which
statements came from their document and which are general context about their
state. Target: correct classification of every item. A reader who cannot tell
applies the credibility of the weaker layer to the stronger one.

**T8 — A promotion is legible.** With a red line set that a clause crosses, the
user can say which red line was crossed and which sentence crossed it. If red
lines do not visibly change the output, they are decoration and ADR 0003 is not
implemented.

**The single falsifying result:** a user or a lawyer produces a flag whose
quoted sentence does not support the claim made about it. Not a missed clause —
a *wrong reading of a shown sentence*. That is the failure this version exists
to rule out.

**What these tests deliberately do not measure:** whether anyone pays, and
whether the analysis changes what the user does. Both matter more commercially
than anything above, and neither is settled by building well (§8.1).

---

## 5. My red lines — the clauses I flag, how severely, and why

A note on vocabulary, because the term is used two ways. A **red line** in the
product is the user's own declared constraint (§3.3). What follows is *ours*:
the clause types v1 refuses to let pass unremarked, and the default severity
each carries before any user red line touches it.

**The severity basis is escapability, then money** (ADR 0003). A clause is
dangerous in proportion to how hard it is to get out of — duration, breadth,
cost to exit — with money at stake as the tie-break. **Unusual is not
dangerous**: a strange clause can be harmless, and "unusual for this document
type" is a claim no source sentence can support.

Defaults set the band. Within a band, flags order by the escapability inputs
read from the quoted sentence — longer duration and broader scope rank higher;
where those tie, the larger dollar figure ranks higher. A matching user red line
promotes a flag above all of it and names the line it crossed.

The four defaults below are set here for the first time; ADR 0003 fixed the
axis and the clause list but not the bands. If they turn out wrong, they need an
ADR, not a quiet edit.

### 5.1 Non-compete and non-solicit — default **Critical**

*Why it matters:* it is the only clause here that can stop the user earning at
all, for a period they do not control, with no exit but waiting it out or
litigating. The Doran account is the shape of it — enforcement attempted four
years after a few-weeks engagement, sought for up to seven years, and people
turning down work they were legally free to take.

*Escapability inputs read from the text:* duration; geographic scope; breadth of
the activity restricted (a named-competitor list is not an industry ban);
whether it survives termination without cause.

*Evidence:* Medium. 26,000+ comments on the FTC's proposed ban, >25,000 in
support ([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes)) —
documented public concern rather than a complaint count, and the rule was later
vacated in court.

### 5.2 Mandatory arbitration and class-action waiver — default **Critical**

*Why it matters:* there is no exit at all. It has no end date, it covers every
dispute that could arise from the relationship, and the cost of getting out is
not a fee — the remedy is simply gone. On pure escapability it is the least
escapable thing in the document. It sits below a broad non-compete only when
that non-compete's duration and scope win on the money tie-break; the ordering
between the two comes from the sentences, not from a prior.

*Escapability inputs:* scope of covered disputes; whether a class-action waiver
is present (a separate and additive loss); who selects the forum and who bears
the cost; any carve-outs.

*Evidence:* High. 81 of the 100 largest US firms; ~99% of those bound are
unaware ([EPI](https://www.epi.org/publication/the-arbitration-epidemic/),
[NCLC](https://www.nclc.org/study-99-of-consumers-unaware-they-are-forced-arbitration/)).
It is also the clause in our one first-person account from the segment.

### 5.3 IP assignment and moonlighting restrictions — default **High**

*Why it matters:* it reaches outside working hours and outside the job, and what
it takes is permanent — an assignment of something the user made does not lapse
when they leave. It is the clause most likely to catch an engineer with side
projects, which is a large fraction of this segment.

*Escapability inputs:* whether it covers work made outside working hours and off
company equipment; whether it is limited to the employer's field of business;
whether prior inventions can be excluded and whether a schedule for doing so
exists; whether outside work is barred outright or merely requires consent.

*Evidence: none.* This clause type has **no supporting complaint or enforcement
data in the research** — it is named there among the types excluded for lack of
sources. It ships on judgement, and it is the most likely of the four to be the
wrong pick. Recorded here so the gap stays visible instead of being assumed away
(ADR 0003).

### 5.4 Equity vesting, clawback, and signing-bonus repayment — default **High**

*Why it matters:* it converts leaving into a bill. A repayment or clawback term
does not prevent exit; it prices it, sometimes above what the user can pay,
which makes it an escapability problem wearing a money mask. This is where the
money axis does real work: the same structure at $5,000 and at $80,000 are
different clauses.

*Escapability inputs:* the repayment trigger and its window; whether the amount
is prorated or full; the cliff and vesting schedule; whether vested equity can
be repurchased on departure and at what price.

*Evidence:* not separately sourced in the research. Retained because it is
standard in offer packets for this segment and because the exit cost is concrete
and quotable from the sentence.

### 5.5 What this list admits

Four types is the whole of v1 coverage, so the coverage receipt is also a
standing admission of what we do not do. A clause outside these four may be
genuinely dangerous and we will miss it. The output must never imply the
document was fully reviewed.

And one class of harm is structurally out of reach: **a missing clause has no
sentence to cite.** The research's clearest freelance harms are absences — no
scope clause, so a client "started demanding eight pieces a month" against three
agreed (Sakshi Jha); no revision cap, so "six rounds of edits over two weeks on
a single 1,000 word article" (Zulie Rane); no late-payment clause, so no
leverage to collect (Dana Nicole), all [here](https://blog.zoho.com/index.php/sign/blog/why-you-need-to-have-a-freelance-contract-agreement.html).
The equivalent for a job seeker is an offer letter silent on severance, or on
what happens to vested equity at termination. ADR 0001 means we cannot flag any
of it. This is a real hole, it follows necessarily from the citation rule, and
it is not solved in v1.

---

## 6. The calls I made and what I gave up

### 6.1 Job seekers only (ADR 0002)

*Chose against:* tenants, freelancers, small businesses, and a general reader
covering all four document types.

*Who is worse off:* **tenants.** They are the largest affected population, they
pay $450–$660 for a lease review or more often skip legal help entirely, and a
tenant on a standard lease has the least leverage of anyone in the research.
They are excluded because there is **no first-person tenant account in the
research at all**, and because their lack of leverage makes a counter-offer
theatre. Freelancers lose too, and they were the segment with the most recurring
need. Both exclusions are choices, not oversights.

*Why anyway:* job seekers are the only segment with High confidence, a
deadline-driven one-time purchase, and a sourced per-document price for exactly
this work ($542.59). They are also the only segment where every capability in §3
does real work, because an offer letter is one of the few genuinely negotiable
documents.

### 6.2 Before signature only

*Chose against:* the auto-renewal and cancellation pain that ranks #1 by evidence
in the research.

*Who is worse off:* everyone in the Steven Bond position — nine years of charges
on a cancelled membership. We do not help them at all. That harm lands after
signing and is about exiting rather than understanding, which makes it a
different product rather than a feature we skipped.

*Why anyway:* the trust thesis needs a moment where the decision is still open.
Stated here rather than quietly reranking the evidence to flatter the product.

### 6.3 Every flag cites its source sentence (ADR 0001)

*Chose against:* fluent unsourced summaries; citing clause or page numbers;
quoting where easy and paraphrasing otherwise.

*Who is worse off:* the user whose real risk we drop because we cannot anchor it
to a sentence — recall falls on purpose. The user whose harm is a *missing*
clause, which has no sentence at all (§5.5). And the user with a scanned or
photographed document, who gets nothing: OCR is ruled out because a citation is
worthless when the text it points at was misread.

*Why anyway:* this is the one thing no competitor markets. Trust and accuracy is
the universal complaint at every price tier — false positives at LegalOn,
"generic and sometimes inaccurate" at Rocket Lawyer ([Forbes](https://www.forbes.com/advisor/business/rocket-lawyer-review/)),
hallucination when people use a chatbot directly — and no product answers it
with "here is the sentence" (`research/summary.md` §3).

### 6.4 Precision over recall (ADR 0004)

*Chose against:* over-flagging, which is safer for any individual document.

*Who is worse off:* the user with a genuinely dangerous borderline clause we
decided not to show. They get silence, and silence is invisible — they cannot
know what we withheld. The coverage receipt is the only mitigation, which is why
it is load-bearing rather than a footer.

*Why anyway:* over-flagging grows the report, flattens severity, teaches
skimming, and kills the thesis. False positives are the named universal
complaint in this category at every tier.

### 6.5 Escapability, not deviation from market norm (ADR 0003)

*Chose against:* the thing a lawyer actually does — "this is unusual for a role
like yours."

*Who is worse off:* the user with a weird one-off clause that is unusual and
harmful in a way our four types do not describe, and the user who wanted to know
whether they were being singled out.

*Why anyway:* market-deviation needs a corpus of normal offer letters we do not
have, and "this is unusual" is a claim no source sentence can support. "This
binds you for 18 months across your whole industry" is checkable against the
quoted sentence. Escapability also matches every pain in the research: the harm
was always being stuck, not being surprised.

### 6.6 Enforceability as a labelled second layer (ADR 0005)

*Chose against:* silence on enforceability — the purest form of the trust rule —
and a generic "varies by state" caveat.

*Who is worse off:* anyone in a state where our content is stale or wrong, and
who cannot tell, because this layer has no source sentence to check it against.
That is a real weakening of the ADR 0001 guarantee, confined deliberately to a
labelled layer. Also every user, slightly, who must answer a question about
their state before seeing any value.

*Why anyway:* without it, a Californian is told their void non-compete is
critical. Accurate about the text, badly misleading about their life. The Doran
case is exactly this harm: people who stopped working because of a clause that
likely did not bind them.

*The cost carried forward:* state-level content for four clause types has to be
maintained and goes out of date silently, and the line between "general legal
context" and legal advice is now this product's main regulatory exposure — in a
category where the FTC has already taken $193k from DoNotPay over "robot lawyer"
claims.

### 6.7 Keeping the counter-offer

*Chose against:* cutting it, which the evidence arguably supports.

*Who is worse off:* the user who acts on a drafted redline they have no leverage
to send. They can annoy an employer or damage an offer, and we will have handed
them the words. That risk is real and is being accepted.

*Why anyway:* the research found **no evidence at all** that anyone wants
drafted redlines, and it names the feature as possibly the weakest pillar. It
survives on one narrow argument: an offer letter is among the few genuinely
negotiable documents, and this is the one segment where the assumption of
leverage is not obviously false. If it fails a user test, it is the first thing
to go.

### 6.8 The library is deferred, not cut (ADR 0002)

*Who is worse off:* the returning user, who has to start over.

*Why anyway:* it is a retention feature, and v1 has no acquisition to retain.
Revisit once the crisis user is proven to come back at all — which, by
definition, v1 is not built to encourage.

---

## 7. What we are not building, and why

- **Payments and billing.** The price question is real (§1) but no amount of
  building answers it. Selling before the analysis is trustworthy tests the
  wrong thing.
- **OCR for scanned documents.** Not deferred — actively excluded. A cited
  sentence that was misread on the way in is worse than no citation, because it
  is wrong in a way that looks checkable.
- **Sharing a document between users.** No trust claim depends on it.
- **The saved library.** Deferred (§6.8).
- **Leases, freelance agreements, ToS.** Four document types point at four
  buyers with different urgency, clause sets and distribution (ADR 0002).
- **After-signature monitoring** — renewal, cancellation, deadline reminders.
  This is the #1 evidenced pain and it is a different product (§6.2).
- **Acting for the user** — sending the counter-offer, contacting an employer,
  representing them anywhere. We draft; they decide and they send.
- **Legal advice, or anything that reads as it.** The enforceability layer is
  labelled general context and stays labelled. Overclaiming in this category
  draws regulators, with a $193k precedent.
- **Clause types beyond the four in §5**, including ones the research ranks
  highly — limitation of liability, junk fees, security deposit withholding —
  because they belong to segments we are not serving.

---

## 8. What the research could not tell us

### 8.1 Whether anyone will pay — the biggest hole

Across four research passes there is **zero direct willingness-to-pay evidence**.
Not one sourced person saying they would pay $X to have a contract read. Every
price in §1 is what people pay a *lawyer* or what a *vendor lists*. No adoption,
conversion or churn number was found for any low-cost tool. The $29–$79 range is
an inference from anchors, and the research labels it as one. Desk research
cannot close this; the stated next step was talking to ~10 job seekers and
testing a price.

### 8.2 Whether not reading means cannot, or does not care

The 91–97% who skip terms are demonstrating **avoidance**. The chain from
avoidance to purchase is unproven — people who will not spend 90 seconds reading
may not spend $49 having it read to them. This is the single biggest threat to
the thesis and it is unresolved.

### 8.3 Whether the counter-offer is wanted

Nothing found. Not weak evidence — none (§6.7).

### 8.4 Whether IP assignment belongs in the flag set

No complaint or enforcement data exists for it in the research. It is one of the
four clause types and it rests entirely on judgement (§5.3).

### 8.5 How often job seekers actually get hurt

We have **one** first-person account from the wedge segment: the Blind
arbitration post. The rest of the segment case is built from prevalence data
(81/100 firms), price anchors, and harms documented in *other* segments — the
Doran non-compete cases are freelancers, not employees. The segment with the
strongest purchase evidence has the thinnest lived-experience evidence, and
those are not the same thing.

### 8.6 Sourcing limits worth knowing before trusting a number above

- No first-person tenant or lease account was found at all (`agent-1`), which is
  part of why tenants are excluded — an absence of evidence, not evidence of
  absence.
- The arbitration and security-deposit findings rest on **search snippets**;
  both page fetches failed (`agent-2`). The WorldCC "most negotiated terms"
  finding was read only secondhand.
- Reddit could not be fetched directly; the one Reddit case came via news
  coverage of the thread. No BBB, Trustpilot, HN or X material was reached.
- Pricing was not found for several named competitors, and several tools
  (Luminance, Kira/Litera, DocJuris, Lawhive, lease-specific tools) were never
  reached before the search cap (`agent-3`).

### 8.7 What no research could have told us

Whether a person, holding their own contract and our output, comes away able to
decide. That is what §4 is for.
