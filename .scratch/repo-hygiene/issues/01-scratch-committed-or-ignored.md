# 01 — Is `.scratch/` committed or ignored?

Status: reversed 2026-09-11 — committed. `/.scratch/` has been removed from
`.gitignore` and issues now live in the repository, reviewable in a diff
alongside the code they describe. The accepted cost is that half-formed
thinking lands in the permanent record.

Superseded: decided 2026-09-06 — ignored, on the grounds that issues should
stay local and disposable. Reversed when the first implementation tickets were
written and the argument for reviewable tickets outweighed it. Note the
asymmetry below: this direction was the cheap one to take, and it is the one
that cannot now be undone for free.

`docs/agents/issue-tracker.md` puts issues and specs in `.scratch/<feature>/`.
This repo has no `.gitignore`, so `.scratch/` is currently neither ignored nor
committed — it just shows up as untracked in `git status`.

Both answers are defensible and they are not reversible for free, because
committing then ignoring leaves the files in history:

- **Committed**: issues survive a clone and are reviewable in a diff alongside
  the code they describe. The cost is that half-formed thinking lands in the
  permanent record.
- **Ignored**: issues stay local and disposable. The cost is that they die with
  the machine, and a second contributor sees no tickets at all.

Redline is currently solo with a GitHub remote, so nothing forces the choice
yet. It gets harder to change once tickets exist.

Decide before the second feature directory is created.
