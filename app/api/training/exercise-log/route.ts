import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { todayDayIndex } from '@/lib/training-habit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planMessageId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
  exerciseIndex: z.number().int().min(0).max(29),
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

  const { planMessageId, dayIndex, exerciseIndex } = parsed.data;
  const { dateString } = osloDayBounds();

  const { data: existing } = await supabase
    .from('training_exercise_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('plan_message_id', planMessageId)
    .eq('day_index', dayIndex)
    .eq('exercise_index', exerciseIndex)
    .eq('logged_for', dateString)
    .maybeSingle();

  let logged: boolean;
  if (existing) {
    const { error } = await supabase
      .from('training_exercise_logs')
      .delete()
      .eq('id', (existing as any).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logged = false;
  } else {
    const { error } = await supabase.from('training_exercise_logs').insert({
      user_id: user.id,
      plan_message_id: planMessageId,
      day_index: dayIndex,
      exercise_index: exerciseIndex,
      logged_for: dateString,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logged = true;
  }

  // Recompute today's percentage for this day and mirror onto habit_logs.
  // The plan is re-read to know how many exercises that day has so the
  // percentage is meaningful even if only some checkboxes are ticked.
  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('content')
    .eq('id', planMessageId)
    .maybeSingle();

  let percent = 0;
  let totalExercises = 0;
  if (planRow?.content) {
    try {
      const plan = JSON.parse(planRow.content);
      const day = plan?.days?.[dayIndex];
      totalExercises = day?.exercises?.length ?? 0;
    } catch {
      /* ignore */
    }
  }

  const { data: completedRows } = await supabase
    .from('training_exercise_logs')
    .select('exercise_index')
    .eq('user_id', user.id)
    .eq('plan_message_id', planMessageId)
    .eq('day_index', dayIndex)
    .eq('logged_for', dateString);
  const completed = (completedRows as any[] | null)?.length ?? 0;

  if (totalExercises > 0) {
    percent = Math.round((completed / totalExercises) * 100);
  }

  // Only mirror when today's weekday matches the logged day so the habit
  // reflects today's engagement (not a future planned day).
  const isTodayDay = dayIndex === todayDayIndex();
  if (isTodayDay) {
    const { data: prefs } = await supabase
      .from('training_preferences')
      .select('training_habit_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const habitId = (prefs as any)?.training_habit_id as string | null;
    if (habitId) {
      if (completed === 0) {
        await supabase
          .from('habit_logs')
          .delete()
          .eq('habit_id', habitId)
          .eq('logged_for', dateString);
      } else {
        const { data: existingHabit } = await supabase
          .from('habit_logs')
          .select('id')
          .eq('habit_id', habitId)
          .eq('logged_for', dateString)
          .maybeSingle();
        if (existingHabit) {
          await supabase
            .from('habit_logs')
            .update({ value: percent })
            .eq('id', (existingHabit as any).id);
        } else {
          await supabase.from('habit_logs').insert({
            user_id: user.id,
            habit_id: habitId,
            logged_for: dateString,
            value: percent,
          });
        }
      }
    }
  }

  return NextResponse.json({
    logged,
    completed,
    total: totalExercises,
    percent,
  });
}
