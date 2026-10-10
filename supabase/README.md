# Supabase

The database is a hosted Supabase project, with no CLI (ADR 0006). The SQL
lives here and is applied by hand in the dashboard's SQL editor.

It holds one table, `red_lines`, and nothing else. No document text and no
saved library: see the header of the migration for why.

## Migrations

Files in `migrations/` are named `YYYYMMDDHHMMSS_what.sql` and run in name
order. Each is written to be safe to run twice (`if not exists`,
`drop policy if exists`). Never edit one that has been applied anywhere; add a
new file instead.

Nothing records which files a project has run, so this table does. Add a row
when you apply one.

| Migration | Local / dev project | Production project |
|---|---|---|
| `20260916120000_red_lines.sql` | applied 2026-10-09 to `redline` (via the Supabase MCP's `apply_migration`) | not applied |

## Setting up a project

`scripts/setup-supabase.sh` walks a dev project end to end: create it, copy the
keys into `.env.local`, run the migration, allow the magic link back to
localhost, and check sign-in works.

For production, do the same against the production project, then:

1. **Auth → URL Configuration.** Site URL: `https://<production-domain>`.
   Redirect URLs: add `https://<production-domain>/**` (keep the localhost
   entry if the same project serves development). Sign-in sends readers back
   to `/review`, which `/**` covers.
2. **Vercel → Settings → Environment Variables.** Every name in `.env.example`,
   for the Production environment.
3. **Redeploy.** The `NEXT_PUBLIC_` values are fixed at build time.
4. **Sign in on the live site once**, add a red line, sign out and back in. It
   should still be there. Then mark the migration applied in the table above.
