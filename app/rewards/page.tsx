import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getXpBalance } from '@/lib/xp';
import { getTokenBalance } from '@/lib/tokens';
import { getOrCreateHouseholdId } from '@/lib/household';
import { seedSampleRewards } from '@/lib/seed-samples';
import { RewardsClient } from '@/components/rewards/rewards-client';

export const dynamic = 'force-dynamic';

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ensure a household exists and seed starter rewards for fresh users.
  let primaryHouseholdId: string | null = null;
  try {
    primaryHouseholdId = await getOrCreateHouseholdId(supabase, user.id);
    await seedSampleRewards(supabase, user.id, primaryHouseholdId);
  } catch (err) {
    console.error('[rewards] seed skipped', err);
  }

  const [{ data: memberships }, xp, tokens] = await Promise.all([
    supabase.from('household_members').select('household_id').eq('user_id', user.id),
    getXpBalance(supabase, user.id),
    getTokenBalance(supabase, user.id),
  ]);
  const householdIds = ((memberships as any[] | null) ?? []).map((m) => m.household_id);

  let rewards: any[] = [];
  let recent: any[] = [];
  let vouchers: any[] = [];
  if (householdIds.length > 0) {
    const [{ data: r }, { data: hist }, { data: vs }] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, title, emoji, cost_xp, cost_tokens, created_by, created_at')
        .in('household_id', householdIds)
        .eq('archived', false)
        .order('cost_xp', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('id, xp_spent, redeemed_at, reward_id, user_id')
        .in('household_id', householdIds)
        .order('redeemed_at', { ascending: false })
        .limit(10),
      supabase
        .from('reward_vouchers')
        .select('id, reward_id, earned_at, redeemed_at, from_task_id')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(30),
    ]);
    rewards = (r as any[]) ?? [];
    recent = (hist as any[]) ?? [];
    vouchers = (vs as any[]) ?? [];
  }

  return (
    <main className="container max-w-xl py-6">
      <RewardsClient
        initialRewards={rewards}
        initialRecent={recent}
        initialVouchers={vouchers}
        initialXp={xp.balance}
        initialTokens={tokens.balance}
        currentUserId={user.id}
      />
    </main>
  );
}
