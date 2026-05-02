-- Add an opt-out toggle for the dynamic time/weather/moon theme.
-- Defaults to true so the feature is visible by default; users who
-- want consistency can flip it from /settings.

set search_path = public;

alter table public.user_settings
  add column if not exists theme_dynamic boolean not null default true;
