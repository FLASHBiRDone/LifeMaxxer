-- Supplements + intake logs + dispenser triggers (NFC card / phone NFC /
-- physical button). Phase 1: software-only schedule, manual logging,
-- XP rewards. Phase 2 (hardware): the same tables back the dispense
-- endpoint that the hopper hits.
--
-- Scope is OTC supplements + vitamins. Prescription medications stay
-- in the existing `medications` table and are deliberately not part
-- of the dispenser path.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Schedule definitions
-- ---------------------------------------------------------------------------
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  -- Free-form dose label (e.g. "1 kapsel", "1000 IU"). Not parsed —
  -- shown verbatim in the UI and to the dispenser firmware so the
  -- hardware can decide how to dispense one unit.
  dose text not null default '1' check (length(dose) <= 40),
  emoji text check (emoji is null or length(emoji) <= 8),
  color text not null default 'emerald',
  -- Time-of-day slots this supplement should be taken in. Each entry
  -- is one of morning / noon / evening / night. A supplement can
  -- belong to multiple slots (e.g. magnesium morning + evening).
  slots text[] not null default array['morning']::text[]
    check (slots <@ array['morning','noon','evening','night']::text[] and array_length(slots, 1) >= 1),
  -- Empty schedule_days = every day. Otherwise weekday numbers
  -- (0=Sun..6=Sat), matching the habits table convention.
  schedule_days int[] not null default '{}'::int[]
    check (schedule_days <@ array[0,1,2,3,4,5,6]::int[]),
  xp_reward int not null default 1 check (xp_reward between 0 and 50),
  token_reward int not null default 0 check (token_reward between 0 and 20),
  notes text check (notes is null or length(notes) <= 500),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplements_user_idx
  on public.supplements (user_id, archived);

-- ---------------------------------------------------------------------------
-- Intake records — one row per slot per day per supplement.
-- ---------------------------------------------------------------------------
create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_for date not null,
  slot text not null check (slot in ('morning','noon','evening','night')),
  -- Where the log came from: a manual tap in /today, a dispenser
  -- confirm callback, or an automatic post-reminder log.
  source text not null default 'manual'
    check (source in ('manual','dispenser','reminder')),
  taken_at timestamptz not null default now(),
  xp_awarded int not null default 0,
  tokens_awarded int not null default 0,
  -- Dispense events get a hardware id so duplicate hopper triggers
  -- don't double-log the same physical pill.
  dispense_event_id uuid,
  created_at timestamptz not null default now(),
  unique (supplement_id, logged_for, slot)
);

create index if not exists supplement_logs_user_day_idx
  on public.supplement_logs (user_id, logged_for);

-- ---------------------------------------------------------------------------
-- Dispenser triggers (Phase 2). Each user has zero or more identifiers
-- the hopper recognises — an NFC card UID, a phone NFC tag, or the
-- internal id of a physical button. The dispenser firmware POSTs the
-- raw token here to resolve which user just scanned.
-- ---------------------------------------------------------------------------
create table if not exists public.dispense_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Hashed token (SHA-256 hex of the raw NFC UID / button id), so
  -- physical loss of an NFC card doesn't equal credential leakage.
  token_hash text not null unique,
  kind text not null check (kind in ('nfc_card','phone_nfc','button')),
  label text not null check (length(label) between 1 and 40),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dispense_tokens_user_idx
  on public.dispense_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Dispense events — append-only audit log of physical hopper actuations.
-- Phase 1 stays empty; the stub /api/dispense route writes here once
-- the hardware ships. Useful for support: "the hopper said it gave you
-- magnesium at 08:14, you said it didn't — here's the receipt."
-- ---------------------------------------------------------------------------
create table if not exists public.dispense_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_kind text not null check (trigger_kind in ('nfc_card','phone_nfc','button')),
  -- Which supplements + slots were resolved at trigger time.
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','dispensed','failed','cancelled')),
  failure_reason text check (failure_reason is null or length(failure_reason) <= 200),
  triggered_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists dispense_events_user_idx
  on public.dispense_events (user_id, triggered_at desc);

-- ---------------------------------------------------------------------------
-- RLS — same per-user pattern as habits/medications. Tables get added
-- to the dynamic policy generator in a follow-up below since the
-- original generator already executed.
-- ---------------------------------------------------------------------------
alter table public.supplements enable row level security;
alter table public.supplements force row level security;
alter table public.supplement_logs enable row level security;
alter table public.supplement_logs force row level security;
alter table public.dispense_tokens enable row level security;
alter table public.dispense_tokens force row level security;
alter table public.dispense_events enable row level security;
alter table public.dispense_events force row level security;

do $$
declare
  t text;
  tables text[] := array[
    'supplements',
    'supplement_logs',
    'dispense_tokens',
    'dispense_events'
  ];
begin
  foreach t in array tables loop
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
-- Allow XP + token ledgers to record supplement payouts so the standard
-- balance calc picks them up without a parallel ledger.
-- ---------------------------------------------------------------------------
alter table public.xp_adjustments
  drop constraint if exists xp_adjustments_source_check;
alter table public.xp_adjustments
  add constraint xp_adjustments_source_check
  check (source in ('task_payout','task_post_debit','task_refund','admin','supplement'));

alter table public.token_transactions
  drop constraint if exists token_transactions_source_check;
alter table public.token_transactions
  add constraint token_transactions_source_check
  check (source in ('task_payout','task_post_debit','task_refund','reward_spend','admin','supplement'));

