import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, completed')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('calendar_events')
    .update({ completed: !event.completed })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, completed: !event.completed });
}
