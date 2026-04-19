import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizedClient, createEvent } from '@/lib/google';
import { decrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }

  const body = await request.json();
  const { summary, description, start, end } = body;

  if (!summary || !start || !end) {
    return NextResponse.json({ error: 'summary, start, and end are required' }, { status: 400 });
  }

  const { client, rotated } = await authorizedClient({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expires_at: tokenRow.expires_at,
  });

  if (rotated) {
    await supabase
      .from('google_tokens')
      .update({ access_token: rotated.access_token, expires_at: rotated.expires_at })
      .eq('user_id', user.id);
  }

  const eventId = await createEvent(client, {
    summary,
    description,
    start: new Date(start),
    end: new Date(end),
    colorId: body.colorId,
  });

  return NextResponse.json({ eventId }, { status: 201 });
}
