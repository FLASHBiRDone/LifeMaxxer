import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { syncCalendarDay } from '@/lib/calendar-sync';
import { CalendarDay } from '@/components/calendar/calendar-day';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString, start, end } = osloDayBounds();

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  let lastSyncError: string | null = null;
  if (tokens) {
    try {
      await syncCalendarDay(supabase, user.id, tokens);
    } catch (err) {
      lastSyncError = err instanceof Error ? err.message : 'Kunne ikke synkronisere';
    }
  }

  const [{ data: events }, { data: quests }] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id, google_event_id, title, start_at, end_at, description, completed')
      .eq('user_id', user.id)
      .gte('start_at', start.toISOString())
      .lt('start_at', end.toISOString())
      .order('start_at', { ascending: true }),
    supabase
      .from('quests')
      .select('id, title, scheduled_time, completed_at, calendar_event_id')
      .eq('user_id', user.id)
      .eq('scheduled_for', dateString)
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
  ]);

  return (
    <main className="container max-w-xl py-6 space-y-6">
      <CalendarDay
        dateString={dateString}
        connected={Boolean(tokens)}
        events={(events as any[]) ?? []}
        quests={(quests as any[]) ?? []}
        syncError={lastSyncError}
      />
    </main>
  );
}
