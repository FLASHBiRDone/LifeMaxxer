import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getXpBalance } from '@/lib/xp';

export const runtime = 'nodejs';

const bodySchema = z.object({
  note: z.string().trim().max(200).optional(),
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
    .select('id, household_id, cost_xp, archived')
    .eq('id', id)
    .maybeSingle();
  if (!reward || (reward as any).archived) {
    return NextResponse.json({ error: 'Belønning finnes ikke' }, { status: 404 });
  }

  const { balance } = await getXpBalance(supabase, user.id);
  const cost = (reward as any).cost_xp as number;
  if (balance < cost) {
    return NextResponse.json(
      { error: 'ikke nok XP', balance, cost },
      { status: 402 },
    );
  }

  const { error } = await supabase.from('reward_redemptions').insert({
    reward_id: id,
    user_id: user.id,
    household_id: (reward as any).household_id,
    xp_spent: cost,
    note: parsed.data.note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, spent: cost, balance: balance - cost });
}
