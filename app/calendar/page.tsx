import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { syncCalendarDay } from '@/lib/calendar-sync';
import { CalendarDay } from '@/components/calendar/calendar-day';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveReference(rawDate: string | undefined): Date {
  if (rawDate && DATE_RE.test(rawDate)) {
    // Noon UTC is safely inside any Oslo day (UTC+1/+2)
    const ref = new Date(`${rawDate}T12:00:00Z`);
    if (!isNaN(ref.getTime())) return ref;
  }
  return new Date();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const rawDate = typeof params.date === 'string' ? params.date : undefined;
  const reference = resolveReference(rawDate);
  const { dateString, start, end } = osloDayBounds(reference);
  const { dateString: todayString } = osloDayBounds();

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  let lastSyncError: string | null = null;
  if (tokens) {
    try {
      await syncCalendarDay(supabase, user.id, tokens, reference);
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
        todayString={todayString}
        connected={Boolean(tokens)}
        events={(events as any[]) ?? []}
        quests={(quests as any[]) ?? []}
        syncError={lastSyncError}
      />
    </main>
  );
}
