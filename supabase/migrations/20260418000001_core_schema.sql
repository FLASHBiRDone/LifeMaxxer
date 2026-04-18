-- LifeMaxxer core schema
-- Tables with public RLS hooks. Policies live in a separate migration so
-- they are easy to audit in isolation. See PRIVACY_ARCHITECTURE.md.

set search_path = public, extensions;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users profile (linked to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  locale text not null default 'nb',
  timezone text not null default 'Europe/Oslo',
  onboarded_at timestamptz,
  custom_vocabulary jsonb not null default '{}'::jsonb,
  sensory_mode text not null default 'high' check (sensory_mode in ('high', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('primary', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members (user_id);

-- ---------------------------------------------------------------------------
-- Google integration (HIGH SENSITIVITY: tokens are encrypted at app layer)
-- ---------------------------------------------------------------------------
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  sync_token text,
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  description text,
  completed boolean not null default false,
  shared boolean not null default false,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, google_event_id)
);

create index if not exists calendar_events_user_day_idx
  on public.calendar_events (user_id, start_at);

-- ---------------------------------------------------------------------------
-- Quests & habits (PRIVATE per user)
-- ---------------------------------------------------------------------------
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  title text not null,
  scheduled_for date not null,
  scheduled_time time,
  is_main boolean not null default false,
  completed_at timestamptz,
  completed_in_boss_battle boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quests_user_day_idx on public.quests (user_id, scheduled_for);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('do', 'avoid', 'measure')),
  target_frequency text not null default 'daily',
  target_value numeric,
  color text not null default 'emerald',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_for date not null,
  value numeric,
  note text,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_for)
);

create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, logged_for);

-- ---------------------------------------------------------------------------
-- Mana, respawn tokens, brain dump (HIGH SENSITIVITY)
-- ---------------------------------------------------------------------------
create table if not exists public.mana_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_for date not null,
  level text not null check (level in ('low', 'medium', 'high')),
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, logged_for)
);

create table if not exists public.respawn_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  total int not null default 4,
  used int not null default 0,
  primary key (user_id, month)
);

create table if not exists public.brain_dump (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  processed boolean not null default false,
  converted_to text check (converted_to in ('quest', 'habit', 'discarded')),
  created_at timestamptz not null default now()
);

create index if not exists brain_dump_user_idx on public.brain_dump (user_id, processed, created_at desc);

-- ---------------------------------------------------------------------------
-- Medications (HIGH SENSITIVITY: never store prescription data)
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  remind_at time[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null,
  reminded_at timestamptz
);

-- ---------------------------------------------------------------------------
-- AI messages (HIGH SENSITIVITY)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  context_type text not null check (context_type in ('morning_briefing', 'weekly_debrief', 'chat')),
  prompt_version text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_user_idx on public.ai_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Recipes & food
-- ---------------------------------------------------------------------------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_nb text not null,
  allergens text[] not null default '{}',
  category text not null default 'other',
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_nb text not null,
  instructions_en text not null,
  instructions_nb text not null,
  servings int not null default 2,
  prep_minutes int not null default 10,
  cook_minutes int not null default 20,
  allergens text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  amount numeric not null,
  unit text not null,
  primary key (recipe_id, ingredient_id)
);

create table if not exists public.pantry (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity_estimate text not null default 'some' check (quantity_estimate in ('lots', 'some', 'low')),
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  freeform_text text,
  added_by uuid not null references auth.users(id) on delete cascade,
  checked boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_household_idx
  on public.shopping_list_items (household_id, checked, created_at desc);

-- ---------------------------------------------------------------------------
-- Push subscriptions + user settings
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_briefing_enabled boolean not null default true,
  morning_briefing_time time not null default '07:30',
  dinner_panic_enabled boolean not null default false,
  dinner_panic_time time not null default '16:30',
  weekly_debrief_enabled boolean not null default true,
  push_enabled boolean not null default false,
  reduce_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profile bootstrap trigger: ensure every new auth user gets a profile row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
