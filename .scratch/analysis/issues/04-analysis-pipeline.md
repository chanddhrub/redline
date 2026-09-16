# 04: The analysis pipeline

Status: done 2026-09-15

**What to build:** The one function that takes an `AnalysisRequest` and returns
an `Analysis`, plus the server route that exposes it. This is where the summary,
the flags, the counter-offers and the coverage receipt are produced.

The model is asked once, for structured JSON: a plain-English summary of what
the document commits the user to, candidate flags drawn from the four clause
types in PRD §5, and for each candidate the verbatim source sentence, the
escapability inputs read from it, a plain statement of what it means, a drafted
counter-offer written against that sentence, and any red line it claims to
cross. Everything then goes through ticket 02's gate and ticket 03's ranking.

The summary is held to the same standard as a flag: only what the text supports.
Where it makes a claim it cannot anchor, the claim goes, not the standard.

The coverage receipt is returned on **every** analysis, clean or not: the four
clause types checked, the finding for each, and a plain statement of what was
not reviewed. Never an empty result. Never a manufactured low-severity finding
invented to fill space. ADR 0004 makes the receipt load-bearing — it is the only
thing standing between a dropped borderline flag and a false clean bill of
health.

The route takes the request as JSON — text, sentences, jurisdiction, red lines.
**No route accepts a file.** That constraint is inherited whole from intake and
the absence of the route is the enforcement.

**Blocked by:** 01, 02, 03, and intake 08 (`toAnalysisRequest`).

- [x] `analyse` takes an `AnalysisRequest` and a `ModelClient` and returns a
      summary, ranked flags, a coverage receipt, drops, and the governing-law
      citation where the document has one
- [x] Every flag carries its verbatim source sentence, a severity, a plain
      statement of what it means, and a counter-offer written against that
      sentence
- [x] The summary makes no claim the text does not support, and any sentence it
      quotes goes through the gate
- [x] The coverage receipt returns on every analysis, naming all four clause
      types, the finding for each, and what was not reviewed
- [x] The clean fixture returns zero flags and a full receipt — not an empty
      result, not an invented low-severity flag
- [x] The planted fixture returns the planted clauses at their expected severity
      bands, and never a decoy sentence
- [x] The two registers are carried in the data, not only in the prose: what the
      text says is separable from what a court or employer might do
- [x] A server route accepts the request as JSON and returns the analysis; no
      route anywhere accepts a file
- [x] The whole pipeline is tested against both fixtures through the stub client
- [x] Standing check: no flag in any pipeline output lacks a located span
