import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addMealPlanToCalendar } from '@/lib/meal-calendar';
import { clearPlanEvents, deletePlanEvents } from '@/lib/calendar-cleanup';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('id, content')
    .eq('user_id', user.id)
    .eq('context_type', 'meal_plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planRow?.content) {
    return NextResponse.json({ error: 'Ingen plan funnet' }, { status: 404 });
  }

  let plan: any;
  try {
    plan = JSON.parse(planRow.content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }

  const planId = (planRow as any).id as string;

  // 1. Delete events previously created for THIS plan (so re-sync is
  //    idempotent and doesn't pile duplicates).
  try {
    await clearPlanEvents(supabase, user.id, planId);
  } catch (err) {
    console.error('[meal-plan] clearPlanEvents failed', err);
  }

  // 2. Also delete events from any older meal plan rows on record.
  try {
    await deletePlanEvents(supabase, user.id, 'meal_plan', planId);
  } catch (err) {
    console.error('[meal-plan] deletePlanEvents failed', err);
  }

  // 3. Create fresh events and persist the new byDay mapping.
  const calendar = await addMealPlanToCalendar(supabase, user.id, plan);
  if (calendar.status === 'added') {
    await supabase
      .from('ai_messages')
      .update({
        metadata: {
          calendarId: calendar.calendarId,
          byDay: calendar.byDay,
        },
      })
      .eq('id', planId);
  }

  return NextResponse.json({ calendar });
}
