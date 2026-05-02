import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SLOTS = ['morning', 'noon', 'evening', 'night'] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dose: z.string().trim().max(40).optional().default('1'),
  emoji: z.string().trim().max(8).optional().nullable(),
  color: z.string().trim().max(20).optional().default('emerald'),
  slots: z.array(z.enum(SLOTS)).min(1).default(['morning']),
  schedule_days: z.array(z.number().int().min(0).max(6)).optional().default([]),
  xp_reward: z.number().int().min(0).max(50).optional().default(1),
  token_reward: z.number().int().min(0).max(20).optional().default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid request' },
      { status: 400 },
    );
  }

  // Tie the supplement to the user's household so household-scoped
  // ledger writes (xp_adjustments / token_transactions) work later.
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const dedupedSlots = Array.from(new Set(parsed.data.slots));
  const dedupedDays = Array.from(new Set(parsed.data.schedule_days));

  const { data, error } = await supabase
    .from('supplements')
    .insert({
      user_id: user.id,
      household_id: (membership as any)?.household_id ?? null,
      name: parsed.data.name,
      dose: parsed.data.dose,
      emoji: parsed.data.emoji ?? null,
      color: parsed.data.color,
      slots: dedupedSlots,
      schedule_days: dedupedDays,
      xp_reward: parsed.data.xp_reward,
      token_reward: parsed.data.token_reward,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
