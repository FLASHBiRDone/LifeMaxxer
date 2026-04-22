import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planMessageId: z.string().uuid().nullable(),
  dayIndex: z.number().int().min(0).max(6),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { error } = await supabase.from('training_logs').insert({
    user_id: user.id,
    plan_message_id: parsed.data.planMessageId,
    day_index: parsed.data.dayIndex,
    notes: parsed.data.notes ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
