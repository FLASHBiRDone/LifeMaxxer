import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refundBounty } from '@/lib/marketplace';

export const runtime = 'nodejs';

/**
 * Cancel an open task. Only the original poster can cancel.
 * Refunds the bounty (XP / tokens) to the poster's balance.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: task } = await supabase
    .from('household_tasks')
    .select(
      'id, household_id, posted_by_user_id, bounty_xp, bounty_tokens, bounty_reward_id, status',
    )
    .eq('id', id)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
  if ((task as any).posted_by_user_id !== user.id) {
    return NextResponse.json(
      { error: 'Bare den som la ut oppgaven kan avlyse den.' },
      { status: 403 },
    );
  }
  if ((task as any).status !== 'open') {
    return NextResponse.json(
      { error: 'Oppgaven er allerede lukket.' },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('household_tasks')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await refundBounty(
      supabase,
      user.id,
      (task as any).household_id,
      id,
      {
        xp: (task as any).bounty_xp,
        tokens: (task as any).bounty_tokens,
        rewardId: (task as any).bounty_reward_id,
      },
    );
  } catch (err) {
    console.error('[tasks] refund failed', err);
  }

  return NextResponse.json({ ok: true });
}
