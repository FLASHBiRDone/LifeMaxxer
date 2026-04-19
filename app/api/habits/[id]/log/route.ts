import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { dateString } = osloDayBounds();
  const loggedFor = body.logged_for ?? dateString;

  const { data: existing } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('habit_id', id)
    .eq('logged_for', loggedFor)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logged: false });
  }

  const { error } = await supabase.from('habit_logs').insert({
    user_id: user.id,
    habit_id: id,
    logged_for: loggedFor,
    note: body.note ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logged: true }, { status: 201 });
}
