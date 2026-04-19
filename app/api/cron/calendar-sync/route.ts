import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { syncCalendarDay } from '@/lib/calendar-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: tokenRows } = await admin
    .from('google_tokens')
    .select('user_id, access_token, refresh_token, expires_at');

  const results: Array<{ user_id: string; ok: boolean; error?: string; upserted?: number }> = [];
  for (const row of (tokenRows ?? []) as Array<{
    user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
  }>) {
    try {
      const r = await syncCalendarDay(admin, row.user_id, row);
      results.push({ user_id: row.user_id, ok: true, upserted: r.upserted });
    } catch (err) {
      results.push({
        user_id: row.user_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
