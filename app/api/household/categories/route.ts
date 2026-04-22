import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

export const runtime = 'nodejs';

const postSchema = z.object({
  label: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(8).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let householdId: string;
  try {
    householdId = await getOrCreateHouseholdId(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'household error' },
      { status: 500 },
    );
  }

  // Seed defaults if this household has none yet.
  const { data: existing } = await supabase
    .from('task_categories')
    .select('id')
    .eq('household_id', householdId)
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await supabase.rpc('seed_default_task_categories', { hid: householdId });
  }

  const { data } = await supabase
    .from('task_categories')
    .select('id, label, emoji, is_system, sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
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

  const { data: maxOrder } = await supabase
    .from('task_categories')
    .select('sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxOrder as any)?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('task_categories')
    .insert({
      household_id: householdId,
      label: parsed.data.label,
      emoji: parsed.data.emoji ?? null,
      is_system: false,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}
