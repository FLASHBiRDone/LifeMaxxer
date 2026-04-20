import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getXpBalance } from '@/lib/xp';
import { RewardsClient } from '@/components/rewards/rewards-client';

export const dynamic = 'force-dynamic';

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: memberships }, xp] = await Promise.all([
    supabase.from('household_members').select('household_id').eq('user_id', user.id),
    getXpBalance(supabase, user.id),
  ]);
  const householdIds = ((memberships as any[] | null) ?? []).map((m) => m.household_id);

  let rewards: any[] = [];
  let recent: any[] = [];
  if (householdIds.length > 0) {
    const [{ data: r }, { data: hist }] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, title, emoji, cost_xp, created_by, created_at')
        .in('household_id', householdIds)
        .eq('archived', false)
        .order('cost_xp', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('id, xp_spent, redeemed_at, reward_id, user_id')
        .in('household_id', householdIds)
        .order('redeemed_at', { ascending: false })
        .limit(10),
    ]);
    rewards = (r as any[]) ?? [];
    recent = (hist as any[]) ?? [];
  }

  return (
    <main className="container max-w-xl py-6">
      <RewardsClient
        initialRewards={rewards}
        initialRecent={recent}
        initialBalance={xp.balance}
        currentUserId={user.id}
      />
    </main>
  );
}
