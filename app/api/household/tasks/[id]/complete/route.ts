import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { payoutBounty } from '@/lib/marketplace';

export const runtime = 'nodejs';

/**
 * Mark an open task as done and pay the bounty to the completer.
 * If the task has an assignee, only that member can complete it (the
 * poster can still cancel). Otherwise any household member can
 * complete on a first-come-first-served basis.
 */
export async function POST(
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
      'id, household_id, bounty_xp, bounty_tokens, bounty_reward_id, status, assignee_user_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
  if ((task as any).status !== 'open') {
    return NextResponse.json(
      { error: 'Oppgaven er allerede lukket.' },
      { status: 400 },
    );
  }

  const assignee = (task as any).assignee_user_id as string | null;
  if (assignee && assignee !== user.id) {
    return NextResponse.json(
      { error: 'Denne oppgaven er kun tilgjengelig for den tildelte personen.' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('household_tasks')
    .update({
      status: 'done',
      completed_by_user_id: user.id,
      completed_at: nowIso,
    })
    .eq('id', id)
    .eq('status', 'open'); // avoid race — only claim if still open
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await payoutBounty(supabase, user.id, (task as any).household_id, id, {
      xp: (task as any).bounty_xp,
      tokens: (task as any).bounty_tokens,
      rewardId: (task as any).bounty_reward_id,
    });
  } catch (err) {
    console.error('[tasks] payout failed', err);
  }

  return NextResponse.json({ ok: true });
}
