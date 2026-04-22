-- Store user's home location so the morning briefing can pull weather
-- from the right place. City is a display label; lat/lon is what the
-- weather API receives. All fields nullable so existing users are
-- unaffected until they set it.

set search_path = public;

alter table public.user_profiles
  add column if not exists city text check (city is null or length(city) <= 120),
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6);
