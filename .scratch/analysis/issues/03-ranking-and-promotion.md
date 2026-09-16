# 03: Ranking, severity and promotion

Status: done 2026-09-15

**What to build:** The order the reader sees, decided by us rather than by the
model. Pure, deterministic, no I/O.

Severity comes from ADR 0003 and PRD §5: the four clause types carry fixed
default bands — non-compete and arbitration Critical, IP assignment and equity
clawback High. Within a band, flags order by the escapability inputs read from
the quoted sentence (longer duration and broader scope rank higher), and where
those tie, the larger dollar figure wins. Where everything ties, span position
breaks it, so the order is **total**: the same set in a shuffled input order
ranks identically every time. PRD §4 T3 says two flags swapping between runs is
a bug, not variance.

Promotion is what a user's red line does to a flag: it lifts it above everything
else and names the line it crossed. The match is a model judgement, so it
arrives as a claimed red-line id and is verified here against the red lines the
user actually declared. A claimed match to a line that does not exist is
dropped, and the flag ranks unpromoted.

A red line never demotes, never filters and never lowers a severity below its
default. `Flag` has no writable severity field.

**Blocked by:** 02.

- [x] Default severity per clause type matches PRD §5 exactly and is set in one
      place
- [x] Ranking is a total order: promoted first, then band, then escapability
      inputs, then money, then span position
- [x] The same flags in a shuffled input order rank identically, asserted over
      repeated runs
- [x] A matching red line promotes its flag to the top and names the line
      crossed
- [x] A claimed match to a red line the user never declared is dropped and the
      flag ranks unpromoted
- [x] No red line ever lowers a flag's severity below its default, asserted
- [x] Ranking is pure — no React, no storage, no model call
- [x] "Unusual is not dangerous": nothing in the ranking reads unusualness
