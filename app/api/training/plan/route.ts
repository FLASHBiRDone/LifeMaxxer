import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTrainingPlan } from '@/lib/training-plan';
import type { TrainingGoal, TrainingEquipment } from '@/lib/prompts';
import { normalizeLocale } from '@/lib/prompts/locales';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('locale')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('training_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!prefs) {
    return NextResponse.json(
      { error: 'Sett opp treningspreferanser først.' },
      { status: 400 },
    );
  }

  const locale = normalizeLocale((profile as any)?.locale);

  try {
    const result = await generateTrainingPlan({
      locale,
      goals: (prefs as any).goals as TrainingGoal[],
      experience: (prefs as any).experience,
      daysPerWeek: (prefs as any).days_per_week,
      minutesPerSession: (prefs as any).minutes_per_session,
      equipment: ((prefs as any).equipment ?? []) as TrainingEquipment[],
      location: (prefs as any).location,
      injuries: (prefs as any).injuries ?? null,
      notes: (prefs as any).notes ?? null,
    });

    const { data: msg, error } = await supabase
      .from('ai_messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: JSON.stringify(result.output),
        context_type: 'training_plan',
        prompt_version: result.promptVersion,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: result.costUsd,
      })
      .select('id, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      plan: result.output,
      messageId: (msg as any).id,
      createdAt: (msg as any).created_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * Delete the user's latest training plan (or a specific one via
 * ?id=UUID), along with its Google Calendar events. Clears active_plan_id
 * on training_preferences so the UI drops back to empty state.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const targetId = url.searchParams.get('id');

  let planId: string | null = targetId;
  if (!planId) {
    const { data: row } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('user_id', user.id)
      .eq('context_type', 'training_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    planId = (row as any)?.id ?? null;
  }
  if (!planId) {
    return NextResponse.json({ error: 'Ingen plan å slette' }, { status: 404 });
  }

  const { clearPlanEvents } = await import('@/lib/calendar-cleanup');
  try {
    await clearPlanEvents(supabase, user.id, planId);
  } catch (err) {
    console.error('[training-plan] delete: event cleanup failed', err);
  }

  // Remove the plan's generated images so storage doesn't accumulate
  try {
    const { deletePlanImages } = await import('@/lib/image-storage');
    await deletePlanImages(supabase, user.id, `training/${planId}`);
  } catch (err) {
    console.error('[training-plan] delete: image cleanup failed', err);
  }

  // Unlink the active plan if this one was it — avoids dangling FK
  await supabase
    .from('training_preferences')
    .update({ active_plan_id: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('active_plan_id', planId);

  const { error } = await supabase
    .from('ai_messages')
    .delete()
    .eq('id', planId)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
