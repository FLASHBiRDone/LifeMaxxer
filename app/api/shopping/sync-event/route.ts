import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizedClient, patchEvent } from '@/lib/google';
import {
  SHOPPING_EVENT_TITLE_PREFIX,
  buildShoppingDescription,
  findPendingShoppingEvent,
} from '@/lib/shopping-event';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pending = await findPendingShoppingEvent(supabase, user.id);
  if (!pending) {
    return NextResponse.json({ error: 'ingen kommende handlehendelse' }, { status: 404 });
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar ikke tilkoblet' }, { status: 400 });
  }

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

  const description = buildShoppingDescription(items);
  const title = `${SHOPPING_EVENT_TITLE_PREFIX} (${items.length})`;

  try {
    const { client, rotated } = await authorizedClient(tokens);
    if (rotated) {
      await supabase
        .from('google_tokens')
        .update({ access_token: rotated.access_token, expires_at: rotated.expires_at })
        .eq('user_id', user.id);
    }

    await patchEvent(client, pending.google_event_id, { description, summary: title });

    await supabase
      .from('calendar_events')
      .update({
        description,
        title,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    return NextResponse.json({ ok: true, itemCount: items.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
