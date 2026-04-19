import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncCalendarDay } from '@/lib/calendar-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }

  try {
    const result = await syncCalendarDay(supabase, user.id, tokens);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
