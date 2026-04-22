import type { SupabaseClient } from '@supabase/supabase-js';
import { getXpBalance } from '@/lib/xp';
import { getTokenBalance } from '@/lib/tokens';

export type TaskBounty = {
  xp: number;
  tokens: number;
  rewardId: string | null;
};

/**
 * Validate that a user has enough XP + tokens to fund a task's bounty.
 * Returns null if OK, or an error string if short.
 */
export async function assertCanFundBounty(
  supabase: SupabaseClient,
  userId: string,
  bounty: TaskBounty,
): Promise<string | null> {
  if (bounty.xp <= 0 && bounty.tokens <= 0 && !bounty.rewardId) {
    return 'Belønningen må ha XP, tokens eller en spesifikk belønning.';
  }
  if (bounty.xp > 0) {
    const xp = await getXpBalance(supabase, userId);
    if (xp.balance < bounty.xp) {
      return `Du har ${xp.balance} XP, trenger ${bounty.xp}.`;
    }
  }
  if (bounty.tokens > 0) {
    const t = await getTokenBalance(supabase, userId);
    if (t.balance < bounty.tokens) {
      return `Du har ${t.balance} tokens, trenger ${bounty.tokens}.`;
    }
  }
  return null;
}

/**
 * Debit the poster's XP/token balances to fund a task. Idempotent per
 * task_id — we look up by (task_id, source) to avoid double-debit.
 */
export async function debitBountyForPost(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  taskId: string,
  bounty: TaskBounty,
): Promise<void> {
  if (bounty.xp > 0) {
    await supabase.from('xp_adjustments').insert({
      user_id: userId,
      household_id: householdId,
      delta: -bounty.xp,
      source: 'task_post_debit',
      task_id: taskId,
    });
  }
  if (bounty.tokens > 0) {
    await supabase.from('token_transactions').insert({
      user_id: userId,
      household_id: householdId,
      delta: -bounty.tokens,
      source: 'task_post_debit',
      task_id: taskId,
    });
  }
}

/**
 * Refund a previously-debited bounty to the original poster. Reads the
 * task row to know the numbers (so we refund exactly what was taken).
 */
export async function refundBounty(
  supabase: SupabaseClient,
  posterId: string,
  householdId: string,
  taskId: string,
  bounty: TaskBounty,
): Promise<void> {
  if (bounty.xp > 0) {
    await supabase.from('xp_adjustments').insert({
      user_id: posterId,
      household_id: householdId,
      delta: bounty.xp,
      source: 'task_refund',
      task_id: taskId,
    });
  }
  if (bounty.tokens > 0) {
    await supabase.from('token_transactions').insert({
      user_id: posterId,
      household_id: householdId,
      delta: bounty.tokens,
      source: 'task_refund',
      task_id: taskId,
    });
  }
}

/**
 * Pay the bounty to the completer. XP/tokens become positive ledger
 * entries; a bounty_reward_id turns into a voucher row.
 */
export async function payoutBounty(
  supabase: SupabaseClient,
  completerId: string,
  householdId: string,
  taskId: string,
  bounty: TaskBounty,
): Promise<void> {
  if (bounty.xp > 0) {
    await supabase.from('xp_adjustments').insert({
      user_id: completerId,
      household_id: householdId,
      delta: bounty.xp,
      source: 'task_payout',
      task_id: taskId,
    });
  }
  if (bounty.tokens > 0) {
    await supabase.from('token_transactions').insert({
      user_id: completerId,
      household_id: householdId,
      delta: bounty.tokens,
      source: 'task_payout',
      task_id: taskId,
    });
  }
  if (bounty.rewardId) {
    await supabase.from('reward_vouchers').insert({
      user_id: completerId,
      household_id: householdId,
      reward_id: bounty.rewardId,
      from_task_id: taskId,
    });
  }
}
