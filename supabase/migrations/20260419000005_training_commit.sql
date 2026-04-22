-- Training plan commit + per-exercise tracking + dedicated LifeMaxxing
-- Google Calendar. The commit flow turns a preview plan into the user's
-- active program, populating the calendar and linking the habit. Exercise
-- checkmarks roll up into a percentage that is mirrored onto habit_logs.

set search_path = public;

-- --------------------------------------------------------------------------
-- Dedicated Google calendar for all LifeMaxxer-generated events
-- --------------------------------------------------------------------------
alter table public.google_tokens
  add column if not exists lifemaxxing_calendar_id text;

-- --------------------------------------------------------------------------
-- Active plan reference (user's currently committed program)
-- --------------------------------------------------------------------------
alter table public.training_preferences
  add column if not exists active_plan_id uuid
    references public.ai_messages(id) on delete set null;

-- --------------------------------------------------------------------------
-- Exercise-level completion log
-- --------------------------------------------------------------------------
create table if not exists public.training_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_message_id uuid not null references public.ai_messages(id) on delete cascade,
  day_index int not null check (day_index between 0 and 6),
  exercise_index int not null check (exercise_index >= 0 and exercise_index < 30),
  logged_for date not null,
  completed_at timestamptz not null default now(),
  unique (user_id, plan_message_id, day_index, exercise_index, logged_for)
);

create index if not exists training_exercise_logs_user_day_idx
  on public.training_exercise_logs (user_id, logged_for);

create index if not exists training_exercise_logs_plan_idx
  on public.training_exercise_logs (plan_message_id, day_index);

alter table public.training_exercise_logs enable row level security;
alter table public.training_exercise_logs force row level security;

drop policy if exists tel_sel on public.training_exercise_logs;
create policy tel_sel on public.training_exercise_logs for select
  using (user_id = auth.uid());

drop policy if exists tel_ins on public.training_exercise_logs;
create policy tel_ins on public.training_exercise_logs for insert
  with check (user_id = auth.uid());

drop policy if exists tel_del on public.training_exercise_logs;
create policy tel_del on public.training_exercise_logs for delete
  using (user_id = auth.uid());
