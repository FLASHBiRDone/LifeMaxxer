import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TrainingClient } from '@/components/training/training-client';

export const dynamic = 'force-dynamic';

export default async function TrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: prefs }, { data: planRow }, { data: recentLogs }] = await Promise.all([
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
    supabase
      .from('training_logs')
      .select('day_index, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(30),
  ]);

  let initialPlan: any = null;
  if (planRow?.content) {
    try {
      initialPlan = JSON.parse(planRow.content);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="container max-w-xl py-6">
      <TrainingClient
        initialPreferences={(prefs as any) ?? null}
        initialPlan={initialPlan}
        initialPlanId={(planRow as any)?.id ?? null}
        initialPlanCreatedAt={(planRow as any)?.created_at ?? null}
        initialLogs={(recentLogs as any[]) ?? []}
      />
    </main>
  );
}
