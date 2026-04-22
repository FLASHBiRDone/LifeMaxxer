import type { SupabaseClient } from '@supabase/supabase-js';
import {
  authorizedClient,
  getOrCreateLifemaxxingCalendar,
  type StoredTokens,
} from '@/lib/google';

/**
 * Return an authorized Google client plus the "LifeMaxxing" calendar id,
 * persisting the calendar id and any token rotation.
 */
export async function withLifemaxxingCalendar(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; client: Awaited<ReturnType<typeof authorizedClient>>['client']; calendarId: string }
  | { ok: false; reason: 'no_tokens' }
> {
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at, lifemaxxing_calendar_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!tokens) return { ok: false, reason: 'no_tokens' };

  const stored: StoredTokens = {
    access_token: (tokens as any).access_token,
    refresh_token: (tokens as any).refresh_token,
    expires_at: (tokens as any).expires_at,
  };
  const { client, rotated } = await authorizedClient(stored);

  const cached = ((tokens as any).lifemaxxing_calendar_id as string | null) ?? null;
  const { id: calendarId, rotated: calRotated } = await getOrCreateLifemaxxingCalendar(
    client,
    cached,
  );

  if (rotated || calRotated) {
    const patch: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (rotated) {
      patch.access_token = rotated.access_token;
      patch.expires_at = rotated.expires_at;
    }
    if (calRotated) {
      patch.lifemaxxing_calendar_id = calendarId;
    }
    await supabase.from('google_tokens').update(patch).eq('user_id', userId);
  }

  return { ok: true, client, calendarId };
}
