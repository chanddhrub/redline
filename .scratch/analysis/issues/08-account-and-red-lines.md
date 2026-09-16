# 08: The account and persistent red lines

Status: done 2026-09-16 (migrations unrun)

**What to build:** Sign-in, and one thing behind it: the user's red lines,
kept between sittings so they are not retyped.

PRD §3 calls for an account "sufficient to hold the current document's text and
the user's red lines. Not a library." This ticket holds the red lines and **not
the document text**. The crisis user (ADR 0002) has no reason to come back for
it, and not storing someone's salary is the stronger default. The decision is
recorded in the spec so it is visible rather than assumed.

**The saved library is not built.** ADR 0002 defers it and `CLAUDE.md` excludes
it. Reserve its slot in the topology, as the app shell brief already does, and
ship nothing of it.

No Supabase project exists yet. Build against the Supabase client, reading
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Every table and
policy ships as a SQL migration under `supabase/migrations/`, to be run by hand.

The account is not a toll gate. With those two variables absent the app must
start, intake must work and an analysis must run; red lines fall back to the
session and the interface says plainly that they will not be kept. **Auth is
never mocked in the product.**

**Blocked by:** intake 07, intake 08.

- [x] Sign-in and sign-out work against the Supabase client, reading both
      variables from the environment
- [x] A signed-in user's red lines persist between sittings and are theirs alone
- [x] Red lines edited after an analysis re-run it, per PRD §3.3
- [x] SQL migrations under `supabase/migrations/` create the table, enable row
      level security, and carry owner-only policies
- [x] The document's text is never written to the database
- [x] With both environment variables absent the app starts, intake works and an
      analysis runs; red lines fall back to the session
- [x] The interface says plainly, in that case, that red lines will not be kept
- [x] Auth is not mocked anywhere in the product
- [x] No library ships, and no table backs one
- [x] All copy has been through the humanizer skill
