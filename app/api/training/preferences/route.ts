import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { TRAINING_GOALS, TRAINING_EQUIPMENT } from '@/lib/prompts';

export const runtime = 'nodejs';

const bodySchema = z.object({
  goals: z.array(z.enum(TRAINING_GOALS)).min(1).max(6),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  days_per_week: z.number().int().min(1).max(7),
  minutes_per_session: z.number().int().min(15).max(180),
  equipment: z.array(z.enum(TRAINING_EQUIPMENT)).max(12),
  location: z.enum(['home', 'gym', 'outdoor', 'mixed']),
  injuries: z.string().trim().max(500).nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('training_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ preferences: data ?? null });
}

export async function PUT(request: NextRequest) {
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

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('training_preferences')
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ preferences: data });
}
