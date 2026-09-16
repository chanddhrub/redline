-- The one table behind sign-in: a reader's red lines, so they are not retyped
-- between sittings.
--
-- What is deliberately absent, and must stay absent:
--
--   * a column for the document's text, or its sentences, or anything derived
--     from them. PRD §3 permits an account to hold the text; this build does
--     not store it. The reader in ADR 0002 is signing something this week and
--     has no reason to come back for it, and not holding someone's salary is
--     the stronger default. The application's write path takes a red line's id
--     and its words and nothing else, so there is no column here for it to
--     fill.
--   * a table for a saved library of past documents. ADR 0002 defers it and
--     PRD §7 excludes it. Its absence here is the enforcement.
--
-- Written against a project that does not exist yet: this file has never been
-- run and nothing in it has been verified against a live database.

create table if not exists public.red_lines (
  -- Generated in the browser when the reader types the line, and kept through
  -- every edit, so an edited line is still the same line. Scoped by owner, so
  -- two readers can hold the same id without meeting.
  id          text        not null,
  owner       uuid        not null references auth.users (id) on delete cascade,

  -- The reader's own wording, stored exactly as typed. The analysis quotes it
  -- back when it names the line a flag crossed, so nothing trims, folds case
  -- or otherwise tidies it. Blank is refused here as well as in the interface.
  text        text        not null check (btrim(text) <> ''),

  -- The order the reader put them in.
  ordinal     integer     not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (owner, id)
);

create index if not exists red_lines_owner_ordinal_idx
  on public.red_lines (owner, ordinal);

alter table public.red_lines enable row level security;

-- Owner-only, one policy per operation so each one can be read on its own.
-- `with check` on write as well as `using` on read: without it a reader could
-- hand a row to somebody else, or claim one.

drop policy if exists "red lines are readable by their owner" on public.red_lines;
create policy "red lines are readable by their owner"
  on public.red_lines for select
  to authenticated
  using (auth.uid() = owner);

drop policy if exists "red lines are written by their owner" on public.red_lines;
create policy "red lines are written by their owner"
  on public.red_lines for insert
  to authenticated
  with check (auth.uid() = owner);

drop policy if exists "red lines are edited by their owner" on public.red_lines;
create policy "red lines are edited by their owner"
  on public.red_lines for update
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

drop policy if exists "red lines are deleted by their owner" on public.red_lines;
create policy "red lines are deleted by their owner"
  on public.red_lines for delete
  to authenticated
  using (auth.uid() = owner);

-- A signed-out visitor reaches this table with the `anon` role and has no
-- policy, so they get nothing. That is the intended reading of "the account is
-- not a toll gate": the rest of the product works signed out, and this table
-- is the only thing an account buys.

create or replace function public.red_lines_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists red_lines_touch_updated_at on public.red_lines;
create trigger red_lines_touch_updated_at
  before update on public.red_lines
  for each row execute function public.red_lines_touch_updated_at();
