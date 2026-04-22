import type { SupabaseClient } from '@supabase/supabase-js';

export type XpBalance = {
  earned: number;
  spent: number;
  balance: number;
};

/**
 * XP balance = (habit_logs count × 1) + quest xp (xp_value + main bonus)
 *           + sum of xp_adjustments.delta (task-related payouts/debits)
 *           - sum of reward_redemptions.xp_spent
 * Clamped to >= 0 so negative balances never show up in the UI.
 */
export async function getXpBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<XpBalance> {
  const [
    { count: habitLogs },
    { data: completedQuests },
    { data: redemptions },
    { data: adjustments },
  ] = await Promise.all([
    supabase
      .from('habit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('quests')
      .select('xp_value, is_main')
      .eq('completed_by_user_id', userId)
      .not('completed_at', 'is', null),
    supabase
      .from('reward_redemptions')
      .select('xp_spent')
      .eq('user_id', userId),
    supabase
      .from('xp_adjustments')
      .select('delta')
      .eq('user_id', userId),
  ]);

  const questXp = ((completedQuests as any[]) ?? []).reduce(
    (acc: number, q: any) => acc + (q.xp_value ?? 5) + (q.is_main ? 5 : 0),
    0,
  );
  const adjustmentsTotal = ((adjustments as any[]) ?? []).reduce(
    (acc: number, a: any) => acc + (a.delta ?? 0),
    0,
  );
  const earned = (habitLogs ?? 0) + questXp + Math.max(0, adjustmentsTotal);
  const negAdjustments = Math.min(0, adjustmentsTotal); // debits
  const spent =
    ((redemptions as any[]) ?? []).reduce(
      (acc: number, r: any) => acc + (r.xp_spent ?? 0),
      0,
    ) - negAdjustments; // subtracting a negative = add the debit to "spent"

  return { earned, spent, balance: Math.max(0, earned - spent) };
}
