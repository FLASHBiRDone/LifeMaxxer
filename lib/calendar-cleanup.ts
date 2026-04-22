import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizedClient, deleteEvent, type StoredTokens } from '@/lib/google';

type ContextType = 'meal_plan' | 'training_plan';

/**
 * Delete all Google Calendar events stored on previous plan rows for
 * this user + context_type, optionally excluding one plan id. Clears
 * the metadata.byDay map on each row so we don't re-delete next time.
 * No-op when the user has no Google tokens — we never orphan a row
 * with a stale event pointer.
 */
export async function deletePlanEvents(
  supabase: SupabaseClient,
  userId: string,
  contextType: ContextType,
  exceptPlanId: string | null,
): Promise<{ deleted: number; skipped?: 'no_tokens' | 'nothing_to_delete' }> {
  let q = supabase
    .from('ai_messages')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('context_type', contextType);
  if (exceptPlanId) q = q.neq('id', exceptPlanId);

  const { data: rows } = await q;
  const candidates = ((rows as any[]) ?? []).filter((r) => {
    const meta = r.metadata ?? {};
    return (
      typeof meta.calendarId === 'string' &&
      meta.byDay &&
      Object.keys(meta.byDay).length > 0
    );
  });
  if (candidates.length === 0) {
    return { deleted: 0, skipped: 'nothing_to_delete' };
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!tokens) return { deleted: 0, skipped: 'no_tokens' };

  const stored: StoredTokens = {
    access_token: (tokens as any).access_token,
    refresh_token: (tokens as any).refresh_token,
    expires_at: (tokens as any).expires_at,
  };
  const { client, rotated } = await authorizedClient(stored);
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

  let deleted = 0;
  for (const row of candidates) {
    const meta = (row as any).metadata ?? {};
    const calendarId = meta.calendarId as string;
    const byDay = meta.byDay as Record<string, string>;
    for (const eventId of Object.values(byDay)) {
      try {
        await deleteEvent(client, eventId, calendarId);
        deleted++;
      } catch (err) {
        console.error(
          '[calendar-cleanup] delete failed',
          (row as any).id,
          eventId,
          err,
        );
      }
    }
    // Zero out the map so re-runs don't attempt the same deletes.
    await supabase
      .from('ai_messages')
      .update({
        metadata: { ...meta, byDay: {}, clearedAt: new Date().toISOString() },
      })
      .eq('id', (row as any).id);
  }
  return { deleted };
}

/**
 * Same as above but for a single, specific plan row — used by the
 * manual "add to calendar" flow so a re-sync wipes its own existing
 * events before creating fresh ones.
 */
export async function clearPlanEvents(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
): Promise<{ deleted: number }> {
  const { data: row } = await supabase
    .from('ai_messages')
    .select('metadata')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  const meta = ((row as any)?.metadata ?? {}) as {
    calendarId?: string;
    byDay?: Record<string, string>;
  };
  if (!meta.calendarId || !meta.byDay || Object.keys(meta.byDay).length === 0) {
    return { deleted: 0 };
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!tokens) return { deleted: 0 };

  const stored: StoredTokens = {
    access_token: (tokens as any).access_token,
    refresh_token: (tokens as any).refresh_token,
    expires_at: (tokens as any).expires_at,
  };
  const { client, rotated } = await authorizedClient(stored);
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

  let deleted = 0;
  for (const eventId of Object.values(meta.byDay)) {
    try {
      await deleteEvent(client, eventId, meta.calendarId);
      deleted++;
    } catch (err) {
      console.error('[calendar-cleanup] single-plan delete failed', eventId, err);
    }
  }
  await supabase
    .from('ai_messages')
    .update({
      metadata: { ...meta, byDay: {}, clearedAt: new Date().toISOString() },
    })
    .eq('id', planId);
  return { deleted };
}
