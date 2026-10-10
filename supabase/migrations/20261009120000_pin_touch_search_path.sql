-- Pin the search_path of the trigger function from 20260916120000_red_lines.
--
-- The security advisor flagged it (lint 0011, function_search_path_mutable):
-- with no search_path set, the function resolves names through whatever path
-- the calling role has, so an object planted earlier on that path could stand
-- in for one it meant. It only calls now(), which lives in pg_catalog and is
-- always searched first, so the risk was small; an empty path makes it none.
--
-- Same body as before. `create or replace` keeps the trigger attached and
-- makes this safe to run twice.

create or replace function public.red_lines_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
