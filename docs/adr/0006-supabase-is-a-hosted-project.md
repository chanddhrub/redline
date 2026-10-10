# 6. Supabase is a hosted project, migrations applied through the MCP — accepted 2026-10-06, amended 2026-10-09

## Decision

The database is a hosted Supabase project only. SQL is kept as versioned files
in `supabase/migrations/` and applied through the Supabase MCP server's
`apply_migration`, one file at a time in filename order, with the file's name
(without `.sql`) as the migration name and its contents unedited. The Supabase
CLI is not set up: no `supabase/config.toml`, no local Docker database, no
`supabase db push`. Each run is still logged in `supabase/README.md`.

## Amendment, 2026-10-09

As first accepted, migrations were pasted into the dashboard's SQL editor and
the README ledger was the only record of what had run. The first migration was
applied through the MCP instead, and that is now the route: it applies the
file as written rather than whatever survived a copy and paste, and Supabase
records each run in the project's own migration history (`list_migrations`).
Pasting into the SQL editor remains the fallback when the MCP is unavailable,
but a migration run that way does not appear in that history.

## Alternatives

- **Supabase CLI with versioned migrations.** Supabase tracks which migrations
  have run, `db push` applies them repeatably, and a local database can be
  started in Docker. Rejected for now: the schema is one table, and the CLI is a
  new dependency plus Docker for a benefit that only appears with several
  migrations and more than one person applying them. The MCP gives the
  tracking without the dependency or Docker.
- **Pasting into the SQL editor.** The original decision. Superseded by the
  MCP; kept only as a fallback.

## Why

Nothing in this build makes the analysis more trustworthy by adding database
tooling. The account holds only a reader's red lines, and the product works
fully without it. The MCP was already connected, so using it adds nothing to
the build.

## Consequences

- Each project's migration history in Supabase shows what has run there. The
  ledger in `supabase/README.md` records the same across projects in one place,
  and is only as good as whoever updates it.
- The MCP can run any SQL against whichever project it is pointed at. Check the
  project id before applying, and check `list_migrations` and `list_tables`
  first so a file is not run twice against a project that already has it.
- There is no local database, so the store's queries are tested only against a
  real hosted project.
- Moving to the CLI later is cheap while there is one migration: `supabase
  init`, link the project, and mark the existing file as applied.
