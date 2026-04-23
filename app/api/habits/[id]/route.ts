import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowed = [
    'name',
    'kind',
    'target_frequency',
    'target_value',
    'color',
    'archived',
    'schedule_days',
    'grace_days',
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if ('schedule_days' in patch) {
    const arr = (Array.isArray(patch.schedule_days) ? (patch.schedule_days as unknown[]) : [])
      .filter(
        (n: unknown): n is number =>
          typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6,
      );
    patch.schedule_days = Array.from(new Set(arr));
  }
  if ('grace_days' in patch) {
    const g = patch.grace_days;
    patch.grace_days =
      typeof g === 'number' && Number.isInteger(g)
        ? Math.max(0, Math.min(14, g))
        : 0;
  }

  const { data, error } = await supabase
    .from('habits')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('habits')
    .update({ archived: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
