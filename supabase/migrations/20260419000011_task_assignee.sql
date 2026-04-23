-- Household tasks can optionally be assigned to a specific member.
-- Unassigned = open to anyone in the household (current behaviour).
-- Assigned = only that member can complete; the poster retains the
-- right to cancel and refund. Lets a parent post homework/test prep
-- to a specific kid without inviting a sibling to steal the bounty.

set search_path = public;

alter table public.household_tasks
  add column if not exists assignee_user_id uuid
    references auth.users(id) on delete set null;

create index if not exists household_tasks_assignee_idx
  on public.household_tasks (assignee_user_id)
  where assignee_user_id is not null;
