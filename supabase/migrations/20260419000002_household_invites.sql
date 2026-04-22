-- Household invite flow: lets a primary member generate a short join code
-- that another person can redeem to join the same household. Adds a display
-- name so initials show up on family quests, and opens the role constraint
-- to "child" alongside "primary" and "partner".

set search_path = public;

-- ---------------------------------------------------------------------------
-- user_profiles: optional display name for avatars/initials
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists display_name text;

-- ---------------------------------------------------------------------------
-- household_members: allow "child" role
-- ---------------------------------------------------------------------------

alter table public.household_members
  drop constraint if exists household_members_role_check;
alter table public.household_members
  add constraint household_members_role_check
  check (role in ('primary', 'partner', 'child'));

-- ---------------------------------------------------------------------------
-- household_invites: join codes with expiry + single-use
-- ---------------------------------------------------------------------------

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique check (length(code) between 6 and 16),
  role text not null default 'partner'
    check (role in ('primary', 'partner', 'child')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);

create index if not exists household_invites_code_idx on public.household_invites (code);
create index if not exists household_invites_household_idx
  on public.household_invites (household_id, used_at);

alter table public.household_invites enable row level security;
alter table public.household_invites force row level security;

-- Members can see invites for their household
drop policy if exists hi_sel on public.household_invites;
create policy hi_sel on public.household_invites for select
  using (public.is_household_member(household_id));

-- Members can create invites for their household
drop policy if exists hi_ins on public.household_invites;
create policy hi_ins on public.household_invites for insert
  with check (
    created_by = auth.uid() and public.is_household_member(household_id)
  );

-- Members can revoke (delete) invites
drop policy if exists hi_del on public.household_invites;
create policy hi_del on public.household_invites for delete
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- accept_household_invite: security-definer function so a NON-member can
-- redeem a code without needing select access on the invites table.
-- ---------------------------------------------------------------------------

create or replace function public.accept_household_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id, household_id, role, used_at, expires_at
    into invite
    from public.household_invites
    where code = invite_code
    limit 1;

  if not found then
    raise exception 'invalid code';
  end if;
  if invite.used_at is not null then
    raise exception 'code already used';
  end if;
  if invite.expires_at < now() then
    raise exception 'code expired';
  end if;

  -- Idempotent membership: do nothing if already a member
  insert into public.household_members (household_id, user_id, role)
    values (invite.household_id, uid, invite.role)
    on conflict (household_id, user_id) do nothing;

  update public.household_invites
    set used_at = now(), used_by = uid
    where id = invite.id;

  return invite.household_id;
end;
$$;

grant execute on function public.accept_household_invite(text) to authenticated;
