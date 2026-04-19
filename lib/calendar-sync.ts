import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizedClient, listEvents } from '@/lib/google';
import { osloDayBounds } from '@/lib/time';

export type SyncResult = {
  fetched: number;
  upserted: number;
};

/**
 * Pull Google Calendar events for the day window and upsert them into
 * `calendar_events`. Returns counts for observability. Requires that the
 * caller has already retrieved the user's `google_tokens` row.
 */
export async function syncCalendarDay(
  supabase: SupabaseClient,
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_at: string },
  day: Date = new Date(),
  windowDays = 1,
): Promise<SyncResult> {
  const { start } = osloDayBounds(day);
  const end = new Date(start.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const { client, rotated } = await authorizedClient(tokens);
  if (rotated) {
    await supabase
      .from('google_tokens')
      .update({
        access_token: rotated.access_token,
        expires_at: rotated.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  const events = await listEvents(client, start, end);
  if (events.length === 0) return { fetched: 0, upserted: 0 };

  const rows = events
    .filter((e) => e.start.includes('T') && e.end.includes('T'))
    .map((e) => ({
      user_id: userId,
      google_event_id: e.id,
      title: e.title,
      start_at: new Date(e.start).toISOString(),
      end_at: new Date(e.end).toISOString(),
      description: e.description ?? null,
      last_synced_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { fetched: events.length, upserted: 0 };

  const { error } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'user_id,google_event_id' });
  if (error) throw error;

  return { fetched: events.length, upserted: rows.length };
}
