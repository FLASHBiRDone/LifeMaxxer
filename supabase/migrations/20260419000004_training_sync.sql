-- Training sync: tie a single "Trening" habit to each user's training
-- preferences, and persist the preferred wall-clock time training events
-- should land on in Google Calendar. Enables bi-directional sync between
-- training_logs, habit_logs, and calendar events.

set search_path = public;

alter table public.training_preferences
  add column if not exists training_habit_id uuid
    references public.habits(id) on delete set null,
  add column if not exists training_time time not null default '17:00';

create index if not exists training_prefs_habit_idx
  on public.training_preferences (training_habit_id);
