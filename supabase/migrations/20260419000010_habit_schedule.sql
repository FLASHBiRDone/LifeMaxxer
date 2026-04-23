-- Habits gain a per-weekday schedule + an optional grace window.
-- Empty schedule_days array = daily (every day). Otherwise it lists
-- the weekday numbers the habit is due on (0=Sunday … 6=Saturday).
-- grace_days extends the visible window after a missed scheduled day.
-- 0 = strict (disappears at midnight).

set search_path = public;

alter table public.habits
  add column if not exists schedule_days int[] not null default '{}'::int[],
  add column if not exists grace_days int not null default 0
    check (grace_days between 0 and 14);

-- Each weekday number must be 0..6 if any are listed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'habits_schedule_days_valid'
  ) then
    alter table public.habits
      add constraint habits_schedule_days_valid
      check (
        schedule_days <@ array[0,1,2,3,4,5,6]::int[]
      );
  end if;
end $$;
