-- Family-scoped quests + rewards economy.
-- Adds optional household scope to quests (personal if null), tracks which
-- member claimed / completed the quest, and introduces a rewards catalog with
-- a redemption ledger so earned XP can be spent on shared household rewards.

set search_path = public;

-- ---------------------------------------------------------------------------
-- QUESTS: household scope + assignee + completer + xp_value
-- ---------------------------------------------------------------------------

alter table public.quests
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists xp_value int not null default 5;

create index if not exists quests_household_idx on public.quests (household_id, scheduled_for);
create index if not exists quests_assignee_idx on public.quests (assignee_user_id);
create index if not exists quests_completed_by_idx on public.quests (completed_by_user_id);

-- Replace existing strict user-scoped policies with household-aware ones.
drop policy if exists quests_sel on public.quests;
drop policy if exists quests_ins on public.quests;
drop policy if exists quests_upd on public.quests;
drop policy if exists quests_del on public.quests;

create policy quests_sel on public.quests for select using (
  user_id = auth.uid()
  or (household_id is not null and public.is_household_member(household_id))
);

create policy quests_ins on public.quests for insert with check (
  user_id = auth.uid()
  and (household_id is null or public.is_household_member(household_id))
);

-- Creator can always update; household members can update shared quests
-- (which is how a different member marks a family quest as completed).
create policy quests_upd on public.quests for update using (
  user_id = auth.uid()
  or (household_id is not null and public.is_household_member(household_id))
) with check (
  user_id = auth.uid()
  or (household_id is not null and public.is_household_member(household_id))
);

-- Only the creator can delete a quest.
create policy quests_del on public.quests for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- REWARDS: household-scoped catalog (e.g. "30 min TikTok" for 100 XP)
-- ---------------------------------------------------------------------------

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  emoji text check (emoji is null or length(emoji) between 1 and 8),
  cost_xp int not null check (cost_xp > 0),
  created_by uuid references auth.users(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rewards_household_idx on public.rewards (household_id, archived);

alter table public.rewards enable row level security;
alter table public.rewards force row level security;

drop policy if exists rewards_sel on public.rewards;
create policy rewards_sel on public.rewards for select
  using (public.is_household_member(household_id));

drop policy if exists rewards_ins on public.rewards;
create policy rewards_ins on public.rewards for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());

drop policy if exists rewards_upd on public.rewards;
create policy rewards_upd on public.rewards for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists rewards_del on public.rewards;
create policy rewards_del on public.rewards for delete
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- REWARD REDEMPTIONS: per-user debit ledger against earned XP
-- ---------------------------------------------------------------------------

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  xp_spent int not null check (xp_spent > 0),
  note text check (note is null or length(note) <= 200),
  redeemed_at timestamptz not null default now()
);

create index if not exists reward_redemptions_user_idx on public.reward_redemptions (user_id, redeemed_at desc);
create index if not exists reward_redemptions_household_idx on public.reward_redemptions (household_id, redeemed_at desc);

alter table public.reward_redemptions enable row level security;
alter table public.reward_redemptions force row level security;

drop policy if exists reward_redemptions_sel on public.reward_redemptions;
create policy reward_redemptions_sel on public.reward_redemptions for select
  using (public.is_household_member(household_id));

drop policy if exists reward_redemptions_ins on public.reward_redemptions;
create policy reward_redemptions_ins on public.reward_redemptions for insert
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists reward_redemptions_del on public.reward_redemptions;
create policy reward_redemptions_del on public.reward_redemptions for delete
  using (user_id = auth.uid());
