import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RecipesClient } from '@/components/recipes/recipes-client';

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('id, content, created_at')
    .eq('user_id', user.id)
    .eq('context_type', 'meal_plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialPlan: any = null;
  if (planRow?.content) {
    try {
      initialPlan = JSON.parse(planRow.content);
    } catch { /* ignore */ }
  }

  return (
    <main className="container max-w-xl py-6">
      <RecipesClient
        initialPlan={initialPlan}
        initialPlanId={(planRow as any)?.id ?? null}
        initialPlanCreatedAt={(planRow as any)?.created_at ?? null}
      />
    </main>
  );
}
