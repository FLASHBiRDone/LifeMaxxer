import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { authorizedClient, createEvent } from '@/lib/google';

export const runtime = 'nodejs';

const bodySchema = z.object({
  content: z.string().min(1).max(2000),
  startAt: z.string().min(1),
  endAt: z.string().optional(),
  isMain: z.boolean().optional(),
});

function toDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const start = new Date(parsed.data.startAt);
  const end = parsed.data.endAt
    ? new Date(parsed.data.endAt)
    : new Date(start.getTime() + 30 * 60 * 1000);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'ugyldig tidspunkt' }, { status: 400 });
  }

  const title = parsed.data.content.trim().slice(0, 200);
  const { date, time } = toDateAndTime(parsed.data.startAt);

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  let calendarEventId: string | null = null;

  if (tokens) {
    try {
      const { client, rotated } = await authorizedClient(tokens);
      if (rotated) {
        await supabase
          .from('google_tokens')
          .update({ access_token: rotated.access_token, expires_at: rotated.expires_at })
          .eq('user_id', user.id);
      }
      const googleEventId = await createEvent(client, {
        summary: title,
        start,
        end,
      });

      const { data: ce } = await supabase
        .from('calendar_events')
        .upsert(
          {
            user_id: user.id,
            google_event_id: googleEventId,
            title,
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,google_event_id' },
        )
        .select('id')
        .single();
      calendarEventId = (ce as any)?.id ?? null;
    } catch (err) {
      console.error('[inbox/schedule] calendar create failed', err);
    }
  }

  const { error: questErr } = await supabase.from('quests').insert({
    user_id: user.id,
    title,
    scheduled_for: date,
    scheduled_time: time,
    is_main: Boolean(parsed.data.isMain),
    calendar_event_id: calendarEventId,
  });
  if (questErr) {
    return NextResponse.json({ error: questErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scheduledOnCalendar: Boolean(calendarEventId) });
}
