-- Broaden ai_messages.context_type to cover every context the app
-- actually writes: morning_briefing, weekly_debrief, chat (existing) plus
-- meal_plan, training_plan, inbox_sort.
-- Training plans were failing outright before this migration with
-- "violates check constraint ai_messages_context_type_check".

set search_path = public;

alter table public.ai_messages
  drop constraint if exists ai_messages_context_type_check;

alter table public.ai_messages
  add constraint ai_messages_context_type_check
  check (
    context_type in (
      'morning_briefing',
      'weekly_debrief',
      'chat',
      'meal_plan',
      'training_plan',
      'inbox_sort'
    )
  );
