import type { SupabaseClient } from '@supabase/supabase-js';

export type TokenBalance = {
  earned: number;
  spent: number;
  balance: number;
};

/**
 * Token balance = sum of token_transactions.delta for the user, split
 * into positive (earned) and negative (spent) buckets. Never negative
 * in practice since debits are validated against balance at post time.
 */
export async function getTokenBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<TokenBalance> {
  const { data } = await supabase
    .from('token_transactions')
    .select('delta')
    .eq('user_id', userId);

  let earned = 0;
  let spent = 0;
  for (const row of ((data as any[]) ?? [])) {
    const d = row.delta as number;
    if (d >= 0) earned += d;
    else spent += -d;
  }
  return { earned, spent, balance: Math.max(0, earned - spent) };
}
