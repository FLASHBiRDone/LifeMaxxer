-- Household task marketplace + second currency (tokens) + voucher grants.
-- Rewards gain a tokens price so a single reward can be priced in either
-- XP or tokens (or both). Tasks get a bounty column set that can be any
-- combination of xp, tokens, or a specific reward (voucher grant).

set search_path = public;

-- --------------------------------------------------------------------------
-- rewards: cost_tokens alongside cost_xp
-- --------------------------------------------------------------------------
alter table public.rewards
  add column if not exists cost_tokens int not null default 0 check (cost_tokens >= 0);

-- Relax the old cost_xp > 0 constraint (now tokens may carry the price).
-- A reward must have at least one positive price.
alter table public.rewards
  drop constraint if exists rewards_cost_xp_check;
alter table public.rewards
  drop constraint if exists rewards_cost_positive;
alter table public.rewards
  add constraint rewards_cost_positive
  check (cost_xp >= 0 and (cost_xp > 0 or cost_tokens > 0));

-- --------------------------------------------------------------------------
-- task_categories: seeded with defaults per household + user-extensible
-- --------------------------------------------------------------------------
create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null check (length(label) between 1 and 40),
  emoji text check (emoji is null or length(emoji) between 1 and 8),
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, lower(label))
);
create index if not exists task_categories_household_idx on public.task_categories (household_id, sort_order);
alter table public.task_categories enable row level security;
alter table public.task_categories force row level security;
drop policy if exists tc_sel on public.task_categories;
create policy tc_sel on public.task_categories for select using (public.is_household_member(household_id));
drop policy if exists tc_ins on public.task_categories;
create policy tc_ins on public.task_categories for insert with check (public.is_household_member(household_id));
drop policy if exists tc_upd on public.task_categories;
create policy tc_upd on public.task_categories for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists tc_del on public.task_categories;
create policy tc_del on public.task_categories for delete using (public.is_household_member(household_id) and not is_system);

-- --------------------------------------------------------------------------
-- household_tasks: the marketplace
-- --------------------------------------------------------------------------
create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  posted_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 1000),
  category_id uuid references public.task_categories(id) on delete set null,
  bounty_xp int not null default 0 check (bounty_xp >= 0),
  bounty_tokens int not null default 0 check (bounty_tokens >= 0),
  bounty_reward_id uuid references public.rewards(id) on delete set null,
  due_at timestamptz,
  recurrence text check (recurrence is null or recurrence in ('daily', 'weekly')),
  recurrence_until timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled', 'expired')),
  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (bounty_xp > 0 or bounty_tokens > 0 or bounty_reward_id is not null)
);
create index if not exists household_tasks_household_status_idx on public.household_tasks (household_id, status, created_at desc);
create index if not exists household_tasks_due_idx on public.household_tasks (due_at) where status = 'open';
alter table public.household_tasks enable row level security;
alter table public.household_tasks force row level security;
drop policy if exists ht_sel on public.household_tasks;
create policy ht_sel on public.household_tasks for select using (public.is_household_member(household_id));
drop policy if exists ht_ins on public.household_tasks;
create policy ht_ins on public.household_tasks for insert with check (public.is_household_member(household_id) and posted_by_user_id = auth.uid());
drop policy if exists ht_upd on public.household_tasks;
create policy ht_upd on public.household_tasks for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists ht_del on public.household_tasks;
create policy ht_del on public.household_tasks for delete using (public.is_household_member(household_id) and posted_by_user_id = auth.uid());

-- --------------------------------------------------------------------------
-- xp_adjustments: marketplace XP movements (post debit, payout, refund)
-- Keeps the existing getXpBalance habit/quest/redemption math intact;
-- this ledger adds an extra delta term.
-- --------------------------------------------------------------------------
create table if not exists public.xp_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  delta int not null,
  source text not null check (source in ('task_payout', 'task_post_debit', 'task_refund', 'admin')),
  task_id uuid references public.household_tasks(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists xp_adjustments_user_idx on public.xp_adjustments (user_id, created_at desc);
alter table public.xp_adjustments enable row level security;
alter table public.xp_adjustments force row level security;
drop policy if exists xa_sel on public.xp_adjustments;
create policy xa_sel on public.xp_adjustments for select using (public.is_household_member(household_id));
drop policy if exists xa_ins on public.xp_adjustments;
create policy xa_ins on public.xp_adjustments for insert with check (public.is_household_member(household_id));
drop policy if exists xa_del on public.xp_adjustments;
create policy xa_del on public.xp_adjustments for delete using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- token_transactions: tokens are a second currency, ledger-only
-- --------------------------------------------------------------------------
create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  delta int not null,
  source text not null check (source in ('task_payout', 'task_post_debit', 'task_refund', 'reward_spend', 'admin')),
  task_id uuid references public.household_tasks(id) on delete set null,
  reward_redemption_id uuid references public.reward_redemptions(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists token_transactions_user_idx on public.token_transactions (user_id, created_at desc);
alter table public.token_transactions enable row level security;
alter table public.token_transactions force row level security;
drop policy if exists tt_sel on public.token_transactions;
create policy tt_sel on public.token_transactions for select using (public.is_household_member(household_id));
drop policy if exists tt_ins on public.token_transactions;
create policy tt_ins on public.token_transactions for insert with check (public.is_household_member(household_id));
drop policy if exists tt_del on public.token_transactions;
create policy tt_del on public.token_transactions for delete using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- reward_vouchers: direct grants earned from tasks with a bounty_reward_id
-- --------------------------------------------------------------------------
create table if not exists public.reward_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  from_task_id uuid references public.household_tasks(id) on delete set null,
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_note text
);
create index if not exists reward_vouchers_user_idx on public.reward_vouchers (user_id, redeemed_at nulls first, earned_at desc);
alter table public.reward_vouchers enable row level security;
alter table public.reward_vouchers force row level security;
drop policy if exists rv_sel on public.reward_vouchers;
create policy rv_sel on public.reward_vouchers for select using (public.is_household_member(household_id));
drop policy if exists rv_ins on public.reward_vouchers;
create policy rv_ins on public.reward_vouchers for insert with check (public.is_household_member(household_id));
drop policy if exists rv_upd on public.reward_vouchers;
create policy rv_upd on public.reward_vouchers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rv_del on public.reward_vouchers;
create policy rv_del on public.reward_vouchers for delete using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- Seed default task categories for an existing household. Call this
-- function whenever a household is created or the marketplace is first
-- opened and no rows exist yet for that household.
-- --------------------------------------------------------------------------
create or replace function public.seed_default_task_categories(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.task_categories where household_id = hid) then
    insert into public.task_categories (household_id, label, emoji, is_system, sort_order)
    values
      (hid, 'Hushold',   '🧽', true, 0),
      (hid, 'Ønske',     '⭐', true, 1),
      (hid, 'Skole',     '📚', true, 2),
      (hid, 'Aktivitet', '⚽', true, 3),
      (hid, 'Annet',     '📌', true, 4);
  end if;
end;
$$;
grant execute on function public.seed_default_task_categories(uuid) to authenticated;
