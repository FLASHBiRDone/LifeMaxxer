-- Adds rested + focus check-ins alongside the existing energy ("level")
-- so the morning ritual on /today can capture all three dimensions in
-- one row per day. Same low/medium/high scale to keep stats charts
-- consistent. Both nullable so older rows (level-only) stay valid.
--
-- Also adds an optional `extra_note` so the multi-step flow can stash
-- a one-off thought (dream journal, scratch note) on the same row
-- when the user picks the "Notér noe" option in step 4 — saves a
-- round-trip to the inbox table for purely-throwaway notes.

set search_path = public;

alter table public.mana_logs
  add column if not exists rested text
    check (rested is null or rested in ('low', 'medium', 'high')),
  add column if not exists focus text
    check (focus is null or focus in ('low', 'medium', 'high')),
  add column if not exists extra_note text
    check (extra_note is null or length(extra_note) <= 1000);
