# 07: Red lines

Status: done 2026-09-15

**What to build:** A job seeker declares, in their own words, what they will not sign — "I will not sign an IP assignment covering personal projects". They can add several, sharpen one once they have seen the document, and delete one they have changed their mind about. Blank and whitespace-only entries are rejected so the list stays meaningful; anything else is stored exactly as typed.

The page states plainly what a red line does: it promotes a matching flag to the top and names the line it crossed. It does not hide or filter anything, and it never demotes a flag below its default severity. Saying this is part of the ticket — a user who expects filtering has been misled.

Intake carries red lines faithfully and does nothing else with them. No parsing, no taxonomy, no matching: deciding that a red line is crossed belongs to the analysis feature. The `RedLine` type must not grow a severity field.

**Blocked by:** 01.

- [x] A red line can be written in free text and added to the list
- [x] Several red lines can be held at once
- [x] A red line can be edited and deleted
- [x] Blank and whitespace-only entries are rejected; other text is stored as typed
- [x] The page states in plain words that a red line promotes and names the line crossed, and hides nothing
- [x] Red lines are optional: a user with none can still run the analysis
- [x] Add, edit and remove are pure operations on the analysis-request state, each returning new state
- [x] No red-line matching, parsing or taxonomy exists in intake
