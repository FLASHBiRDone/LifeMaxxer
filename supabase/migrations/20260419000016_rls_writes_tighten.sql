-- Defense-in-depth tightening of write policies discovered during
-- the security audit. All current server-side routes already check
-- user_id = auth.uid() before writing, but RLS policies were too
-- permissive — a future route that forgot the check could let a
-- household member credit themselves XP or modify another member's
-- quest payout. Lock it down at the policy layer.
--
-- Note: service-role writes (via the admin client used by cron jobs
-- and a few /api routes that intentionally bypass RLS) are unaffected
-- because RLS doesn't apply to the service role.

set search_path = public;

-- ---------------------------------------------------------------------------
-- xp_adjustments / token_transactions: an authenticated client now
-- can only insert rows where the user_id matches their own auth.uid().
-- ---------------------------------------------------------------------------
drop policy if exists xa_ins on public.xp_adjustments;
create policy xa_ins on public.xp_adjustments for insert
  with check (
    public.is_household_member(household_id)
    and user_id = auth.uid()
  );

drop policy if exists tt_ins on public.token_transactions;
create policy tt_ins on public.token_transactions for insert
  with check (
    public.is_household_member(household_id)
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- quests: prevent non-owner household members from changing bounty-
-- sensitive fields (xp_value, is_main, title, scheduled_for). RLS has
-- no column-level granularity, so the constraint is implemented as a
-- BEFORE UPDATE trigger that reverts those fields when the writer is
-- not the original owner of the quest. The legitimate non-owner
-- updates — completed_at + completed_by_user_id — flow through.
-- ---------------------------------------------------------------------------
create or replace function public.quests_protect_bounty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid;
begin
  current_uid := auth.uid();
  -- Service-role writes (cron jobs, admin client) have a null
  -- auth.uid(); let them through unchanged.
  if current_uid is null then
    return new;
  end if;
  -- Owner can change any field.
  if current_uid = old.user_id then
    return new;
  end if;
  -- Non-owner household member: preserve bounty-sensitive fields.
  new.xp_value := old.xp_value;
  new.is_main := old.is_main;
  new.title := old.title;
  new.scheduled_for := old.scheduled_for;
  new.user_id := old.user_id;
  new.household_id := old.household_id;
  return new;
end;
$$;

drop trigger if exists quests_protect_bounty on public.quests;
create trigger quests_protect_bounty
  before update on public.quests
  for each row execute function public.quests_protect_bounty();
