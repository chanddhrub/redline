# 06: The state you work in

Status: ready-for-agent

**What to build:** A job seeker is asked which US state they work in, and told why before they answer: the same clause carries different weight in different states, and that information will be shown as a separate, labelled layer rather than mixed into the quoted-sentence findings. One question with its reason attached, not a form — it is the one thing standing between the user and their analysis, so it has to be worth the stop.

The answer can be changed afterwards, to correct a mistake or check a role in another state. The state in use is visible on screen, so a Californian can tell the enforceability layer is keyed to them and not generic.

Intake collects the state and ships no state-level legal content; that corpus belongs to a later feature (ADR 0005).

**Blocked by:** 01.

- [ ] The user is asked for a US state, with the reason stated before they answer
- [ ] The state is required before analysis can run
- [ ] The state can be changed after it has been set
- [ ] The state currently in use is visible on screen
- [ ] `setJurisdiction` is a pure operation on the analysis-request state — no React, no storage, no I/O
- [ ] No state-level legal content ships in this ticket
