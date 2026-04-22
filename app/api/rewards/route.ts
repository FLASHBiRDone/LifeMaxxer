import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    emoji: z.string().trim().min(1).max(8).optional(),
    costXp: z.number().int().min(0).max(100000).default(0),
    costTokens: z.number().int().min(0).max(100000).default(0),
  })
  .refine((d) => d.costXp > 0 || d.costTokens > 0, {
    message: 'Belønningen må koste enten XP eller tokens.',
  });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
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

  const { data, error } = await supabase
    .from('rewards')
    .insert({
      household_id: householdId,
      title: parsed.data.title,
      emoji: parsed.data.emoji ?? null,
      cost_xp: parsed.data.costXp,
      cost_tokens: parsed.data.costTokens,
      created_by: user.id,
    })
    .select('id, title, emoji, cost_xp, cost_tokens, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reward: data });
}
