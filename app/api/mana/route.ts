import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!['low', 'medium', 'high'].includes(body.level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 });
  }

  const loggedFor =
    typeof body.logged_for === 'string' ? body.logged_for : osloDayBounds().dateString;

  const { error } = await supabase
    .from('mana_logs')
    .upsert({ user_id: user.id, logged_for: loggedFor, level: body.level });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
