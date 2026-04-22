import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { TrainingClient } from '@/components/training/training-client';

export const dynamic = 'force-dynamic';

export default async function TrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: prefs }, { data: planRow }] = await Promise.all([
    supabase
      .from('training_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('ai_messages')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .eq('context_type', 'training_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let initialPlan: any = null;
  if (planRow?.content) {
    try {
      initialPlan = JSON.parse(planRow.content);
    } catch {
      /* ignore */
    }
  }

  const activePlanId = (prefs as any)?.active_plan_id as string | null;
  const latestPlanId = (planRow as any)?.id ?? null;
  const isCommitted = Boolean(activePlanId && latestPlanId === activePlanId);

  const { dateString } = osloDayBounds();
  let exerciseLogs: Array<{ day_index: number; exercise_index: number }> = [];
  if (latestPlanId) {
    const { data: logs } = await supabase
      .from('training_exercise_logs')
      .select('day_index, exercise_index')
      .eq('user_id', user.id)
      .eq('plan_message_id', latestPlanId)
      .eq('logged_for', dateString);
    exerciseLogs = (logs as any[]) ?? [];
  }

  return (
    <main className="container max-w-xl py-6">
      <TrainingClient
        initialPreferences={(prefs as any) ?? null}
        initialPlan={initialPlan}
        initialPlanId={latestPlanId}
        initialPlanCreatedAt={(planRow as any)?.created_at ?? null}
        initialIsCommitted={isCommitted}
        initialExerciseLogs={exerciseLogs}
      />
    </main>
  );
}
