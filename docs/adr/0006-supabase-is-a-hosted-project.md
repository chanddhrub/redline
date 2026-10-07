# 6. Supabase is a hosted project, migrations applied by hand — accepted 2026-10-06

## Decision

The database is a hosted Supabase project only. SQL is kept as versioned files
in `supabase/migrations/` and applied by pasting it into the dashboard's SQL
editor. The Supabase CLI is not set up: no `supabase/config.toml`, no local
Docker database, no `supabase db push`. Which migrations each project has run
is recorded by hand in `supabase/README.md`.

## Alternatives

- **Supabase CLI with versioned migrations.** Supabase tracks which migrations
  have run, `db push` applies them repeatably, and a local database can be
  started in Docker. Rejected for now: the schema is one table, and the CLI is a
  new dependency plus Docker for a benefit that only appears with several
  migrations and more than one person applying them.

## Why

Nothing in this build makes the analysis more trustworthy by adding database
tooling. The account holds only a reader's red lines, and the product works
fully without it.

## Consequences

- Nothing stops a migration being skipped or run against the wrong project.
  The ledger in `supabase/README.md` is the only record, and it is only as
  good as whoever updates it.
- There is no local database, so the store's queries are tested only against a
  real hosted project.
- Moving to the CLI later is cheap while there is one migration: `supabase
  init`, link the project, and mark the existing file as applied.
