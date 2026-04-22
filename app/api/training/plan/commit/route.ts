import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { addTrainingPlanToCalendar } from '@/lib/training-calendar';
import { clearPlanEvents, deletePlanEvents } from '@/lib/calendar-cleanup';
import { ensureTrainingHabit } from '@/lib/training-habit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  planMessageId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('id, content')
    .eq('id', parsed.data.planMessageId)
    .eq('user_id', user.id)
    .eq('context_type', 'training_plan')
    .maybeSingle();
  if (!planRow?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }

  let plan: any;
  try {
    plan = JSON.parse(planRow.content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }

  // Mark as the active plan and create/link the Trening habit.
  await supabase
    .from('training_preferences')
    .update({
      active_plan_id: planRow.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  const habitId = await ensureTrainingHabit(supabase, user.id);

  // Before creating fresh calendar events, delete any stale events:
  //  - clearPlanEvents wipes this plan's OWN existing events (re-commit)
  //  - deletePlanEvents wipes events from any previous training plan rows
  try {
    await clearPlanEvents(supabase, user.id, planRow.id);
    await deletePlanEvents(supabase, user.id, 'training_plan', planRow.id);
  } catch (err) {
    console.error('[training-commit] calendar cleanup failed', err);
  }

  // Create calendar events on the LifeMaxxing calendar.
  const { data: prefs } = await supabase
    .from('training_preferences')
    .select('training_time')
    .eq('user_id', user.id)
    .maybeSingle();
  const time = ((prefs as any)?.training_time as string) ?? '17:00';
  const calendar = await addTrainingPlanToCalendar(supabase, user.id, plan, time);

  if (calendar.status === 'added') {
    await supabase
      .from('ai_messages')
      .update({
        metadata: {
          calendarId: calendar.calendarId,
          byDay: calendar.byDay,
          trainingTime: time,
        },
      })
      .eq('id', planRow.id);
  }

  return NextResponse.json({
    committed: true,
    habitId,
    calendar,
  });
}
