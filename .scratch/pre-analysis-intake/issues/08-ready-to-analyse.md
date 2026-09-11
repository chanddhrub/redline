# 08: Ready to analyse

Status: ready-for-agent

**What to build:** A job seeker can see exactly what is still needed before analysis can run, rather than hunting for a disabled button's reason. Once a document has been parsed and a state is set, analysis becomes available and the path forward is obvious. Red lines remain optional.

This closes intake by producing the one object the analysis feature will consume: the canonical text, its sentences, the jurisdiction and the red lines. `AnalysisRequest` is the contract with a feature that does not exist yet, and defining it here is the point — it is the seam the next spec builds against.

Everything the user has entered survives an accidental in-page navigation. State lives in memory for the session, with `sessionStorage` used only for that survival — never `localStorage`, so a shared machine does not keep someone's offer letter. Nothing is persisted to a database: the Supabase decision (local CLI with versioned migrations vs. hosted only) stays open, and this feature does not force it.

**Blocked by:** 06, 07.

- [ ] The page names what is still missing, in plain words, at every point before analysis is available
- [ ] Analysis becomes available once a parsed document and a state are both present
- [ ] Red lines are not required for readiness
- [ ] `toAnalysisRequest` returns `null` until both a document and a state are present, and otherwise returns text, sentences, jurisdiction and red lines
- [ ] Document text, state and red lines survive an accidental in-page navigation
- [ ] `sessionStorage` only; no `localStorage` anywhere
- [ ] No database, no auth, no Supabase
- [ ] Tests drive sequences of operations and assert the resulting state and readiness, including red lines surviving a jurisdiction change
