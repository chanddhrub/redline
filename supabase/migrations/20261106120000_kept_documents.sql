-- The one document a reader has chosen to keep (ADR 0007).
--
-- This narrows what the header of 20260916120000_red_lines said must stay
-- absent. The reader now decides: nothing lands here unless they press the
-- button that says so, and they can delete it. Two things stay absent:
--
--   * the original file. There is no column for it. Text, analysis and
--     questions only (CLAUDE.md, Settled).
--   * a saved library (ADR 0002). `owner` alone is the primary key, so a reader
--     can hold one row. Keeping a second document replaces the first. This key
--     is the enforcement: a library would have to change it.

create table if not exists public.kept_documents (
  owner              uuid        primary key references auth.users (id) on delete cascade,

  -- The canonical text as intake produced it. Citations are offsets into these
  -- exact characters, so nothing trims or tidies it.
  text               text        not null
    check (btrim(text) <> '' and char_length(text) <= 5000000),

  -- A restored page that cannot name its document has to be taken on trust.
  filename           text        not null check (char_length(filename) <= 1024),
  source             text        not null check (source in ('yours', 'sample')),
  jurisdiction       text,

  -- As the route returned them. Believed only after every citation is found
  -- again in `text` (src/lib/account/kept-document.ts).
  analysis           jsonb,
  -- The red lines that analysis ranked against.
  analysed_red_lines jsonb       not null default '[]'::jsonb,
  exchanges          jsonb       not null default '[]'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.kept_documents enable row level security;

-- Owner-only, one policy per operation, as on red_lines. `(select auth.uid())`
-- so it is evaluated once per statement rather than once per row.

drop policy if exists "kept documents are readable by their owner" on public.kept_documents;
create policy "kept documents are readable by their owner"
  on public.kept_documents for select
  to authenticated
  using ((select auth.uid()) = owner);

drop policy if exists "kept documents are written by their owner" on public.kept_documents;
create policy "kept documents are written by their owner"
  on public.kept_documents for insert
  to authenticated
  with check ((select auth.uid()) = owner);

drop policy if exists "kept documents are edited by their owner" on public.kept_documents;
create policy "kept documents are edited by their owner"
  on public.kept_documents for update
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

drop policy if exists "kept documents are deleted by their owner" on public.kept_documents;
create policy "kept documents are deleted by their owner"
  on public.kept_documents for delete
  to authenticated
  using ((select auth.uid()) = owner);

create or replace function public.kept_documents_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kept_documents_touch_updated_at on public.kept_documents;
create trigger kept_documents_touch_updated_at
  before update on public.kept_documents
  for each row execute function public.kept_documents_touch_updated_at();
