-- LifeMaxxer RLS policies.
-- Default: DENY. Every table below is locked down, then opened only as needed.
-- The privacy firewall between household members lives here.
-- See PRIVACY_ARCHITECTURE.md for the full matrix.

set search_path = public;

-- Helper: is the current auth user a member of the given household?
create or replace function public.is_household_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = h
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- PRIVATE tables: user_id = auth.uid() only
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  private_tables text[] := array[
    'user_profiles',
    'google_tokens',
    'calendar_events',
    'quests',
    'habits',
    'habit_logs',
    'mana_logs',
    'respawn_tokens',
    'brain_dump',
    'medications',
    'medication_logs',
    'ai_messages',
    'pantry',
    'push_subscriptions',
    'user_settings'
  ];
begin
  foreach t in array private_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- user_profiles: keyed on id
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select using (id = auth.uid());
drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- For the rest of the private tables, policy text is identical. Generate.
do $$
declare
  t text;
  keyed_on_user text[] := array[
    'google_tokens',
    'calendar_events',
    'quests',
    'habits',
    'habit_logs',
    'mana_logs',
    'respawn_tokens',
    'brain_dump',
    'medications',
    'medication_logs',
    'ai_messages',
    'pantry',
    'push_subscriptions',
    'user_settings'
  ];
begin
  foreach t in array keyed_on_user loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format('drop policy if exists %I_ins on public.%I', t, t);
    execute format('drop policy if exists %I_upd on public.%I', t, t);
    execute format('drop policy if exists %I_del on public.%I', t, t);

    execute format(
      'create policy %I_sel on public.%I for select using (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_ins on public.%I for insert with check (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_upd on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
    execute format(
      'create policy %I_del on public.%I for delete using (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SHARED (household) tables: household members can read and write.
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.households force row level security;
alter table public.household_members enable row level security;
alter table public.household_members force row level security;
alter table public.shopping_list_items enable row level security;
alter table public.shopping_list_items force row level security;

drop policy if exists households_sel on public.households;
create policy households_sel on public.households
  for select using (public.is_household_member(id));
drop policy if exists households_mutate on public.households;
create policy households_mutate on public.households
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists hm_sel on public.household_members;
create policy hm_sel on public.household_members
  for select using (public.is_household_member(household_id));
drop policy if exists hm_ins on public.household_members;
create policy hm_ins on public.household_members
  for insert with check (user_id = auth.uid());
drop policy if exists hm_del on public.household_members;
create policy hm_del on public.household_members
  for delete using (user_id = auth.uid());

drop policy if exists shopping_sel on public.shopping_list_items;
create policy shopping_sel on public.shopping_list_items
  for select using (public.is_household_member(household_id));
drop policy if exists shopping_ins on public.shopping_list_items;
create policy shopping_ins on public.shopping_list_items
  for insert with check (
    added_by = auth.uid() and public.is_household_member(household_id)
  );
drop policy if exists shopping_upd on public.shopping_list_items;
create policy shopping_upd on public.shopping_list_items
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
drop policy if exists shopping_del on public.shopping_list_items;
create policy shopping_del on public.shopping_list_items
  for delete using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- PUBLIC READ tables: ingredients, recipes, recipe_ingredients.
-- Authenticated users can read; only service role can write.
-- ---------------------------------------------------------------------------
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

drop policy if exists ingredients_read on public.ingredients;
create policy ingredients_read on public.ingredients
  for select to authenticated using (true);

drop policy if exists recipes_read on public.recipes;
create policy recipes_read on public.recipes
  for select to authenticated using (true);

drop policy if exists recipe_ingredients_read on public.recipe_ingredients;
create policy recipe_ingredients_read on public.recipe_ingredients
  for select to authenticated using (true);
