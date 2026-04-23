import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';
import {
  assertCanFundBounty,
  debitBountyForPost,
} from '@/lib/marketplace';

export const runtime = 'nodejs';

const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  bountyXp: z.number().int().min(0).max(100000).default(0),
  bountyTokens: z.number().int().min(0).max(100000).default(0),
  bountyRewardId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  recurrence: z.enum(['daily', 'weekly']).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'open';

  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  const householdIds = ((memberships as any[]) ?? []).map((m) => m.household_id);
  if (householdIds.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  let q = supabase
    .from('household_tasks')
    .select(
      'id, household_id, posted_by_user_id, assignee_user_id, title, description, category_id, bounty_xp, bounty_tokens, bounty_reward_id, due_at, recurrence, status, completed_by_user_id, completed_at, created_at',
    )
    .in('household_id', householdIds)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status === 'open') q = q.eq('status', 'open');
  else if (status === 'done') q = q.eq('status', 'done');
  else if (status === 'all') {
    /* no filter */
  } else q = q.eq('status', status);

  const { data: tasks, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: tasks ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid request' },
      { status: 400 },
    );
  }

  let householdId: string;
  try {
    householdId = await getOrCreateHouseholdId(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'household error' },
      { status: 500 },
    );
  }

  const bounty = {
    xp: parsed.data.bountyXp,
    tokens: parsed.data.bountyTokens,
    rewardId: parsed.data.bountyRewardId ?? null,
  };

  const fundError = await assertCanFundBounty(supabase, user.id, bounty);
  if (fundError) {
    return NextResponse.json({ error: fundError }, { status: 400 });
  }

  // If an assignee is specified, verify they're actually a member of
  // the same household — no cross-household assignment possible.
  let assigneeUserId: string | null = null;
  if (parsed.data.assigneeUserId) {
    const { data: member } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('user_id', parsed.data.assigneeUserId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json(
        { error: 'Personen er ikke medlem av husholdet.' },
        { status: 400 },
      );
    }
    assigneeUserId = parsed.data.assigneeUserId;
  }

  const { data: task, error } = await supabase
    .from('household_tasks')
    .insert({
      household_id: householdId,
      posted_by_user_id: user.id,
      assignee_user_id: assigneeUserId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category_id: parsed.data.categoryId ?? null,
      bounty_xp: bounty.xp,
      bounty_tokens: bounty.tokens,
      bounty_reward_id: bounty.rewardId,
      due_at: parsed.data.dueAt ?? null,
      recurrence: parsed.data.recurrence ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await debitBountyForPost(supabase, user.id, householdId, (task as any).id, bounty);
  } catch (err) {
    console.error('[tasks] debit failed — rolling back task', err);
    await supabase.from('household_tasks').delete().eq('id', (task as any).id);
    return NextResponse.json(
      { error: 'Kunne ikke reservere belønningen fra saldoen din.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ task });
}
