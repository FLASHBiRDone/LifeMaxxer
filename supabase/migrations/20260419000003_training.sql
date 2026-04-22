-- Training planner: structured quiz answers stored per user. Generated
-- programs live in ai_messages with context_type='training_plan' so they
-- inherit cost tracking from that table (matches the meal_plan pattern).

set search_path = public;

create table if not exists public.training_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goals text[] not null default '{}'
    check (array_length(goals, 1) between 1 and 6),
  experience text not null default 'beginner'
    check (experience in ('beginner', 'intermediate', 'advanced')),
  days_per_week int not null default 3
    check (days_per_week between 1 and 7),
  minutes_per_session int not null default 45
    check (minutes_per_session between 15 and 180),
  equipment text[] not null default '{}',
  location text not null default 'mixed'
    check (location in ('home', 'gym', 'outdoor', 'mixed')),
  injuries text check (injuries is null or length(injuries) <= 500),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_preferences enable row level security;
alter table public.training_preferences force row level security;

drop policy if exists tp_sel on public.training_preferences;
create policy tp_sel on public.training_preferences for select
  using (user_id = auth.uid());

drop policy if exists tp_ins on public.training_preferences;
create policy tp_ins on public.training_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists tp_upd on public.training_preferences;
create policy tp_upd on public.training_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists tp_del on public.training_preferences;
create policy tp_del on public.training_preferences for delete
  using (user_id = auth.uid());

-- Completed training sessions — one row per finished session. Used for
-- progress tracking and XP rewards.
create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_message_id uuid references public.ai_messages(id) on delete set null,
  day_index int not null check (day_index between 0 and 6),
  completed_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 500)
);

create index if not exists training_logs_user_idx
  on public.training_logs (user_id, completed_at desc);

alter table public.training_logs enable row level security;
alter table public.training_logs force row level security;

drop policy if exists tl_sel on public.training_logs;
create policy tl_sel on public.training_logs for select
  using (user_id = auth.uid());

drop policy if exists tl_ins on public.training_logs;
create policy tl_ins on public.training_logs for insert
  with check (user_id = auth.uid());

drop policy if exists tl_del on public.training_logs;
create policy tl_del on public.training_logs for delete
  using (user_id = auth.uid());
