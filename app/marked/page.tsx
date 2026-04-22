import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getXpBalance } from '@/lib/xp';
import { getTokenBalance } from '@/lib/tokens';
import { getOrCreateHouseholdId } from '@/lib/household';
import { seedSampleRewards, seedSampleTasks } from '@/lib/seed-samples';
import { MarkedClient } from '@/components/marked/marked-client';

export const dynamic = 'force-dynamic';

export default async function MarkedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let householdId: string | null = null;
  try {
    householdId = await getOrCreateHouseholdId(supabase, user.id);
  } catch {
    /* ignore */
  }

  // Seed default task categories for this household on first visit,
  // plus sample rewards + sample chores so a fresh household sees a
  // populated catalog + marketplace instead of an empty state.
  if (householdId) {
    const { data: existing } = await supabase
      .from('task_categories')
      .select('id')
      .eq('household_id', householdId)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.rpc('seed_default_task_categories', { hid: householdId });
    }
    try {
      await seedSampleRewards(supabase, user.id, householdId);
      await seedSampleTasks(supabase, user.id, householdId);
    } catch (err) {
      console.error('[marked] seed skipped', err);
    }
  }

  const [
    xp,
    tokens,
    { data: openTasks },
    { data: recentDone },
    { data: categories },
    { data: rewards },
    { data: members },
  ] = await Promise.all([
    getXpBalance(supabase, user.id),
    getTokenBalance(supabase, user.id),
    supabase
      .from('household_tasks')
      .select(
        'id, household_id, posted_by_user_id, title, description, category_id, bounty_xp, bounty_tokens, bounty_reward_id, due_at, status, created_at',
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('household_tasks')
      .select(
        'id, title, bounty_xp, bounty_tokens, bounty_reward_id, completed_by_user_id, completed_at',
      )
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(10),
    supabase
      .from('task_categories')
      .select('id, label, emoji, is_system, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('rewards')
      .select('id, title, emoji, cost_xp, cost_tokens')
      .eq('archived', false)
      .order('created_at', { ascending: false }),
    householdId
      ? supabase
          .from('household_members')
          .select('user_id, role')
          .eq('household_id', householdId)
      : Promise.resolve({ data: [] }),
  ]);

  const memberList = (members as any[] | null) ?? [];
  let memberMap: Record<string, { label: string; initial: string }> = {};
  if (memberList.length > 0) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, email, display_name')
      .in(
        'id',
        memberList.map((m) => m.user_id),
      );
    for (const p of (profs as any[]) ?? []) {
      const label = p.display_name ?? p.email ?? 'Medlem';
      memberMap[p.id] = {
        label,
        initial: label.charAt(0).toUpperCase(),
      };
    }
  }

  return (
    <main className="container max-w-xl py-6">
      <MarkedClient
        currentUserId={user.id}
        xpBalance={xp.balance}
        tokenBalance={tokens.balance}
        initialOpenTasks={(openTasks as any[]) ?? []}
        initialRecentDone={(recentDone as any[]) ?? []}
        categories={(categories as any[]) ?? []}
        rewards={(rewards as any[]) ?? []}
        memberMap={memberMap}
      />
    </main>
  );
}
