import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

type ConvertBody = {
  type: 'quest' | 'habit' | 'discarded';
  title?: string;
  frequency?: 'daily' | 'weekly';
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as ConvertBody;
  if (!body.type || !['quest', 'habit', 'discarded'].includes(body.type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }

  const { data: item } = await supabase
    .from('brain_dump')
    .select('id, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const title = (body.title ?? item.content).trim().slice(0, 200);

  if (body.type === 'quest') {
    const { dateString } = osloDayBounds();
    const { error } = await supabase.from('quests').insert({
      user_id: user.id,
      title,
      scheduled_for: dateString,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (body.type === 'habit') {
    const { error } = await supabase.from('habits').insert({
      user_id: user.id,
      name: title,
      kind: 'do',
      target_frequency: body.frequency ?? 'daily',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('brain_dump')
    .update({ processed: true, converted_to: body.type === 'discarded' ? 'discarded' : body.type })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
