import type { SupabaseClient } from '@supabase/supabase-js';

export type XpBalance = {
  earned: number;
  spent: number;
  balance: number;
};

export async function getXpBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<XpBalance> {
  const [
    { count: habitLogs },
    { data: completedQuests },
    { data: redemptions },
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
  ]);

  const questXp = ((completedQuests as any[]) ?? []).reduce(
    (acc: number, q: any) => acc + (q.xp_value ?? 5) + (q.is_main ? 5 : 0),
    0,
  );
  const earned = (habitLogs ?? 0) + questXp;
  const spent = ((redemptions as any[]) ?? []).reduce(
    (acc: number, r: any) => acc + (r.xp_spent ?? 0),
    0,
  );

  return { earned, spent, balance: Math.max(0, earned - spent) };
}
