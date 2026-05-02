import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SLOTS = ['morning', 'noon', 'evening', 'night'] as const;

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  dose: z.string().trim().max(40).optional(),
  emoji: z.string().trim().max(8).optional().nullable(),
  color: z.string().trim().max(20).optional(),
  slots: z.array(z.enum(SLOTS)).min(1).optional(),
  schedule_days: z.array(z.number().int().min(0).max(6)).optional(),
  xp_reward: z.number().int().min(0).max(50).optional(),
  token_reward: z.number().int().min(0).max(20).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  archived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid request' },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      // De-duplicate while preserving the original element type.
      patch[k] = Array.from(new Set(v as readonly unknown[]));
    } else {
      patch[k] = v;
    }
  }

  const { data, error } = await supabase
    .from('supplements')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

/**
 * Soft-delete via archive flag. Logs are kept so XP history stays
 * intact and the stats trends don't suddenly drop.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('supplements')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
