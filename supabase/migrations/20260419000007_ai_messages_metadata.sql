-- Add a free-form metadata column to ai_messages so generated plans
-- can store sidecar data (e.g. googleEventIds per day) alongside the
-- plan JSON in `content`. Keeps the schema stable while letting us
-- track per-day calendar events for later patch/delete operations.

set search_path = public;

alter table public.ai_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
