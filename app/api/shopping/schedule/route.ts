import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { authorizedClient, createEvent } from '@/lib/google';
import {
  SHOPPING_EVENT_TITLE_PREFIX,
  buildShoppingDescription,
} from '@/lib/shopping-event';

export const runtime = 'nodejs';

const bodySchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  titleSuffix: z.string().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!tokens) {
    return NextResponse.json(
      { error: 'Google Calendar ikke tilkoblet' },
      { status: 400 },
    );
  }

  // Fetch current unchecked shopping items for all households user belongs to
  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  const householdIds = ((memberships as { household_id: string }[] | null) ?? []).map(
    (m) => m.household_id,
  );
  let items: { freeform_text: string | null }[] = [];
  if (householdIds.length > 0) {
    const { data } = await supabase
      .from('shopping_list_items')
      .select('freeform_text')
      .in('household_id', householdIds)
      .eq('checked', false)
      .order('created_at', { ascending: true });
    items = data ?? [];
  }

  const start = new Date(parsed.data.startAt);
  const end = new Date(parsed.data.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'ugyldig tidspunkt' }, { status: 400 });
  }

  const suffix = parsed.data.titleSuffix?.trim();
  const title = suffix
    ? `${SHOPPING_EVENT_TITLE_PREFIX} · ${suffix}`
    : `${SHOPPING_EVENT_TITLE_PREFIX} (${items.length})`;
  const description = buildShoppingDescription(items);

  try {
    const { client, rotated } = await authorizedClient(tokens);
    if (rotated) {
      await supabase
        .from('google_tokens')
        .update({ access_token: rotated.access_token, expires_at: rotated.expires_at })
        .eq('user_id', user.id);
    }

    const eventId = await createEvent(client, {
      summary: title,
      description,
      start,
      end,
    });

    await supabase.from('calendar_events').upsert(
      {
        user_id: user.id,
        google_event_id: eventId,
        title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        description,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,google_event_id' },
    );

    return NextResponse.json({ ok: true, eventId, itemCount: items.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
