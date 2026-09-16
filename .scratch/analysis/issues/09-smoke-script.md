# 09: The smoke script

Status: ready-for-agent

**What to build:** `pnpm smoke` — one command that runs the planted fixture
contract through the real pipeline, end to end, and prints the flags it produced
with their source sentences.

This is not a test and it does not stub the model. It is the thing you run to
find out whether the analysis actually works, and its most useful number is the
one the suite cannot produce: **how many candidates the verification gate
dropped.** If most of them are being dropped, the prompt has started
paraphrasing, and that is a tuning job with a number attached rather than a
vague worry.

It reads the fixture from disk, parses it through the real `parseDocument`,
builds a real `AnalysisRequest`, calls the real model client, and prints:
every surviving flag with its severity, its stamped clause type, its verbatim
source sentence and its character span; the counter-offer; the coverage receipt;
and the count of candidates dropped with each drop's reason.

With no `OPENROUTER_API_KEY` set it says so plainly and exits non-zero, rather
than pretending to have run.

**Blocked by:** 04.

- [ ] `pnpm smoke` is a package script and runs from a clean checkout
- [ ] It runs the planted fixture through the real parse, the real request and
      the real model client — nothing stubbed
- [ ] It prints each flag with its severity, clause type, verbatim source
      sentence and character span
- [ ] It prints the coverage receipt
- [ ] It prints how many candidates were dropped and why
- [ ] It asserts, and reports, that every printed flag's span slices the stored
      text back to the printed sentence exactly
- [ ] With no API key it says so and exits non-zero
- [ ] It writes nothing to the database and sends no file anywhere
