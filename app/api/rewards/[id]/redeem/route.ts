import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getXpBalance } from '@/lib/xp';
import { getTokenBalance } from '@/lib/tokens';

export const runtime = 'nodejs';

const bodySchema = z.object({
  note: z.string().trim().max(200).optional(),
  // If the reward is priced in BOTH XP and tokens, client picks which
  // currency to spend. For single-currency rewards this is auto-picked.
  currency: z.enum(['xp', 'tokens']).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: reward } = await supabase
    .from('rewards')
    .select('id, household_id, cost_xp, cost_tokens, archived')
    .eq('id', id)
    .maybeSingle();
  if (!reward || (reward as any).archived) {
    return NextResponse.json({ error: 'Belønning finnes ikke' }, { status: 404 });
  }

  const xpCost = (reward as any).cost_xp as number;
  const tokenCost = ((reward as any).cost_tokens ?? 0) as number;

  // Pick which currency to spend. Prefer explicit request; else default
  // to the one that's priced (xp if both are priced).
  let currency: 'xp' | 'tokens';
  if (parsed.data.currency) {
    currency = parsed.data.currency;
  } else if (xpCost > 0 && tokenCost === 0) {
    currency = 'xp';
  } else if (tokenCost > 0 && xpCost === 0) {
    currency = 'tokens';
  } else {
    currency = 'xp';
  }

  if (currency === 'xp') {
    if (xpCost <= 0) {
      return NextResponse.json(
        { error: 'Belønningen har ingen XP-pris' },
        { status: 400 },
      );
    }
    const { balance } = await getXpBalance(supabase, user.id);
    if (balance < xpCost) {
      return NextResponse.json(
        { error: 'ikke nok XP', balance, cost: xpCost },
        { status: 402 },
      );
    }
    const { error } = await supabase.from('reward_redemptions').insert({
      reward_id: id,
      user_id: user.id,
      household_id: (reward as any).household_id,
      xp_spent: xpCost,
      note: parsed.data.note ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      currency,
      spent: xpCost,
      balance: balance - xpCost,
    });
  }

  // tokens
  if (tokenCost <= 0) {
    return NextResponse.json(
      { error: 'Belønningen har ingen token-pris' },
      { status: 400 },
    );
  }
  const { balance } = await getTokenBalance(supabase, user.id);
  if (balance < tokenCost) {
    return NextResponse.json(
      { error: 'ikke nok tokens', balance, cost: tokenCost },
      { status: 402 },
    );
  }
  const { error } = await supabase.from('token_transactions').insert({
    user_id: user.id,
    household_id: (reward as any).household_id,
    delta: -tokenCost,
    source: 'reward_spend',
    note: parsed.data.note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    currency,
    spent: tokenCost,
    balance: balance - tokenCost,
  });
}
