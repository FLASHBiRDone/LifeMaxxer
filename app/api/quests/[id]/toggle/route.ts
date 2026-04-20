import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: quest } = await supabase
    .from('quests')
    .select('id, completed_at')
    .eq('id', id)
    .maybeSingle();
  if (!quest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const nowIso = new Date().toISOString();
  const toggled = (quest as any).completed_at
    ? { completed_at: null, completed_by_user_id: null }
    : { completed_at: nowIso, completed_by_user_id: user.id };

  const { error } = await supabase.from('quests').update(toggled).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, completed: Boolean(toggled.completed_at) });
}
