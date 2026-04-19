import type { SupabaseClient } from '@supabase/supabase-js';

export const SHOPPING_EVENT_TITLE_PREFIX = '🛒 Handleliste';

export function buildShoppingDescription(items: { freeform_text: string | null }[]): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const lines = items
    .map((i) => (i.freeform_text ?? '').trim())
    .filter((t) => t.length > 0)
    .map((t) => `☐ ${t}`);

  const body = lines.length === 0 ? '(listen er tom)' : lines.join('\n');
  const footer = appUrl
    ? `\n\n— Oppdater listen: ${appUrl}/shopping`
    : '\n\n— Oppdater listen i LifeMaxxer';
  return `${body}${footer}`;
}

export async function findPendingShoppingEvent(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { id: string; google_event_id: string; start_at: string; end_at: string }
  | null
> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('calendar_events')
    .select('id, google_event_id, start_at, end_at')
    .eq('user_id', userId)
    .like('title', `${SHOPPING_EVENT_TITLE_PREFIX}%`)
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}
