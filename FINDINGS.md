# Redline production findings

Tested in Chrome against https://redline-roan-iota.vercel.app/ on November 9, 2026.

## 1. The sample flag says the employer gets to define its own competition

- **Steps.** Open https://redline-roan-iota.vercel.app/. Read the preselected CR-1 flag and compare its explanation with the highlighted non-compete sentence. Refresh and compare them again.
- **PRD promise (§4, “The single falsifying result”).** “a user or a lawyer produces a flag whose quoted sentence does not support the claim made about it.”
- **What happened.** Both times the sample said “the limit is whatever the Company later says it is.” Its source sentence restricts work for businesses that compete with the company. It does not give the company unilateral power to decide which businesses count. The interface presents that inference in the flag explanation as if it came from the contract.
- **Severity.** Misleads a reader.

## 2. The coverage receipt lists the four checked clause types under “Not reviewed”

- **Steps.** Open https://redline-roan-iota.vercel.app/, click Read your document, and use Replace if a saved document opens. Paste `Hello world.`, click Read this text, choose California, and analyse. Read the “Not reviewed” list. Repeat with an offer letter containing only salary and onboarding terms.
- **PRD promise (§3, item 8).** “the clause types checked, the finding for each, and a plain statement of what was not reviewed.”
- **What happened.** Both receipts marked all four clause types as “Checked. Nothing here qualifies.” The first bullet under “Not reviewed” then began “Only the four clause types above.” The following sentences say that pay, hours and other items were outside the review, so the first bullet contradicts the status immediately above it.
- **Severity.** Misleads a reader.

## 3. The landing page equates a clean receipt with “nothing is wrong”

- **Steps.** Open https://redline-roan-iota.vercel.app/. Click What a clean document returns and read the heading above the example receipt. Reload and read it again.
- **PRD promise (§4, T6).** “If they say "it's fine" rather than naming the four clause types and the limits, the coverage receipt has failed and that is a design bug, not a copy tweak.”
- **What happened.** On both loads, the heading said “When nothing is wrong, you still get a receipt.” The explanation below it says no flags does not mean safe to sign, and the sample receipt explicitly leaves other clauses and missing terms unreviewed.
- **Severity.** Misleads a reader.

## 4. The landing-page counter-offers are instructions to draft an edit

- **Steps.** Open https://redline-roan-iota.vercel.app/. Read the “Counter-offer to send back” under CR-1, then select CR-2 and read its counter-offer. Reload and select CR-2 again.
- **PRD promise (§3, item 6).** “replacement language for the flagged clause, written against the sentence shown.”
- **What happened.** CR-1 said to “Reduce the period to six months” and “Strike the clause entirely” in some cases. CR-2 said to “Carve out” claims and “Make the obligation mutual.” The same CR-2 instructions returned after reload. The sample shows editing directions beneath the send-back label, so the reader still has to draft the replacement clause.
- **Severity.** Stops a reader.

## Seen once

- **A single offer returned zero flags and then three.** From https://redline-roan-iota.vercel.app/, open Read your document, replace the on-screen document, paste the offer below, select California, and set the red line “<b>QA marker</b> I will not sign a non-compete longer than six months.” Double-click Analyse this document and ask “Who pays the arbitrator’s fees?” while it runs. The first result said “Nothing here qualifies” for all four categories, even though its own summary found the non-compete, non-solicit and arbitration clauses. Repeating those steps returned three flags, so the zero-flag result did not recur. PRD §4, T3 says “The same document analysed three times produces the same set of flags in the same order.” The analysis cap allowed two runs of this offer.
- **“Must not solicit” became a ban on contacting people.** The first analysis of the offer below said the employee was “barred from contacting” company customers and employees. The source sentence prohibits solicitation. The repeated analysis used “cannot solicit.” PRD §3, item 4 promises “only what the text supports.”
- **“May not bring” became “give up the right to bring or join.”** In the second analysis of the offer below, CR-3 said the employee gave up the right to join a class action. Its source says neither party may bring one and does not address joining. The first analysis had no CR-3 to compare. PRD §4 identifies a flag “whose quoted sentence does not support the claim made about it” as the falsifying result.
- **The French input returned a French summary.** From production, open Read your document, paste a French offer containing a non-compete and choose California. The first analysis returned a French summary and flag explanation. A second analysis of the same text, with a test red line present, returned both in English. PRD §3, item 4 promises a “plain-English summary.”

Text for the repeated offer test:

> Offer of employment. Your annual salary is $100,000. For twelve months after employment ends, you must not work for any competitor of the Company anywhere in the United States. For twenty-four months after employment ends, you may work for competitors but must not solicit any of the Company’s customers or employees. All employment disputes must be resolved by binding arbitration, and neither party may bring a class action. You and the Company will each pay half of the arbitrator’s fees. The laws of Texas govern this agreement.

## Test limits

- Eight analysis submissions across six distinct texts. I used the eighth to repeat the zero-flag result. I did not refresh during an active analysis.
- The account has one saved document slot. Saving a test document would have overwritten the existing document, so I used the existing document for reopening, refresh and history checks. The address stayed at `/review`, with no document ID to replace.
- A test red line beginning with literal `<b>QA marker</b>` remains in the account. I left the Delete control alone because its dialog behavior was unverified.
- I inspected the source window transition under the current motion setting and tested keyboard focus. I did not exercise reduced motion, run a greyscale visual test, measure fixture-set recall, or test sign-in email. I replaced the recipe while it was running, so I did not verify its result.

## Checks that held up

- Empty pasted text got a plain refusal. Analysis stayed disabled until text and a work state were present. The 373,458-character paste was accepted and returned a cited salary summary.
- The hidden instruction did not suppress the non-compete. The three injected-offer flags, the three repeated-offer flags and the French flag all pointed to sentences that appeared verbatim in the pasted text. The two French runs reported the same source span. The four public sample flags also pointed to the displayed sample sentences.
- The question box declined to invent severance or insurance terms or give a legal verdict. It cited the offer when answering who pays the arbitrator’s fees and when answering a long salary question.
- The saved document reopened and survived reload and back/forward navigation. The review page had no horizontal page overflow at 375 pixels, and keyboard focus on the Document link had a visible outline.
- Pasted text, a displayed question and a saved test red line showed harmless HTML tags as literal text. Blank question and red-line inputs could not be submitted. The red-line editor accepted a 5,379-character edit.
- Double-clicking Ask yielded one displayed answer. The next Ask was disabled while that answer was pending. Double-clicking Analyse showed one running analysis, and a concurrent question received its own cited answer.
- When the repeated offer returned flags, the non-compete red line named and promoted the clause that restricted working for competitors. It did not promote the non-solicit. The Texas governing-law citation and California context were separately labelled.

## Security review

Reviewed on November 10, 2026, against `main` at e073752, following the method, confidence bar and false-positive rules in `.claude/commands/security-review.md` from anthropics/claude-code-security-review, applied to every file rather than to a diff. Covered every file in `supabase/migrations`, the sign-in and sign-out flow (`src/lib/account/use-account.ts`, `src/app/review/_components/account.tsx`; there are no server-side auth routes), both server routes (`src/app/api/analysis/route.ts`, `src/app/api/answer/route.ts`), every environment variable read, and the rest of `src/` and `scripts/`. Skipped node_modules, tests, fixtures and lock files.

No finding reached the bar of more than 80 percent confidence that someone could exploit it, so none is numbered here. Three candidates were each checked by a separate false-positive pass and scored 2 out of 10:

- **Model error detail returned to callers.** `src/app/api/analysis/route.ts:48` and `src/app/api/answer/route.ts:49` return the model failure, including up to 500 characters of OpenRouter's error body (`src/lib/model/openrouter.ts:125`). It carries no key, credential or internal host. At most it shows account state such as an out-of-credits message. Low.
- **Sign-in error text taken from the address.** `src/lib/account/use-account.ts:188` shows `error_description` from the URL after "Signing in did not go through:". React renders it as escaped text, so a crafted link can put one sentence of the attacker's wording in that box and nothing more: no markup, link or form. Low.
- **Model routes open to anyone.** Both routes run without a session and spend the server's OpenRouter key. Neither touches the database or returns anything but an answer about the caller's own text. What remains is cost abuse, which the method excludes. Low.

What held up: both tables enable row-level security with owner-only policies on select, insert, update and delete, with `with check` on writes. Both trigger functions pin `search_path`. `OPENROUTER_API_KEY` is read only in a `server-only` module and has no `NEXT_PUBLIC_` prefix. No secret is in a tracked file. No `dangerouslySetInnerHTML` or `eval` is in `src/`. Both route bodies are validated with zod.
