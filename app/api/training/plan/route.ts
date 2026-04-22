import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTrainingPlan } from '@/lib/training-plan';
import type { TrainingGoal, TrainingEquipment } from '@/lib/prompts';

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

  const locale = ((profile as any)?.locale ?? 'nb') as 'nb' | 'en';

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
