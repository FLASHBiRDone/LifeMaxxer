import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { todayDayIndex } from '@/lib/training-habit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { dateString } = osloDayBounds();
  const loggedFor = body.logged_for ?? dateString;

  const { data: existing } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('habit_id', id)
    .eq('logged_for', loggedFor)
    .maybeSingle();

  // Check if this is the user's linked training habit — if so, mirror the
  // toggle onto training_logs (so completing/uncompleting the habit also
  // registers as training for today).
  const { data: prefs } = await supabase
    .from('training_preferences')
    .select('training_habit_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const trainingHabitId = (prefs as any)?.training_habit_id as string | null;
  const isTrainingHabit = trainingHabitId === id;

  if (existing) {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (isTrainingHabit && loggedFor === dateString) {
      // Remove any training_logs for today that came from this mirror.
      const dayStart = new Date(`${dateString}T00:00:00.000Z`).toISOString();
      await supabase
        .from('training_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('day_index', todayDayIndex())
        .gte('completed_at', dayStart);
    }

    return NextResponse.json({ logged: false });
  }

  const { error } = await supabase.from('habit_logs').insert({
    user_id: user.id,
    habit_id: id,
    logged_for: loggedFor,
    note: body.note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isTrainingHabit && loggedFor === dateString) {
    // Find the latest training plan message to attach the log to.
    const { data: planRow } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('user_id', user.id)
      .eq('context_type', 'training_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only insert if there isn't already a training_log for today (avoid
    // double-counting when user completes via /training page first).
    const dayStart = new Date(`${dateString}T00:00:00.000Z`).toISOString();
    const { data: existingLog } = await supabase
      .from('training_logs')
      .select('id')
      .eq('user_id', user.id)
      .gte('completed_at', dayStart)
      .limit(1)
      .maybeSingle();

    if (!existingLog) {
      await supabase.from('training_logs').insert({
        user_id: user.id,
        plan_message_id: (planRow as any)?.id ?? null,
        day_index: todayDayIndex(),
      });
    }
  }

  return NextResponse.json({ logged: true }, { status: 201 });
}
