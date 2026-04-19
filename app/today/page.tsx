import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { TodayQuests } from '@/components/today/quests';
import { EnergyCheckIn } from '@/components/today/energy';
import { RunBriefingButton } from '@/components/today/run-briefing';
import { TodayHabits } from '@/components/today/today-habits';
import { CalendarStrip } from '@/components/today/calendar-strip';
import { authorizedClient, listEvents } from '@/lib/google';

export const dynamic = 'force-dynamic';

type BriefingOutput = {
  intro: string;
  quests: { title: string; why: string }[];
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'God natt';
  if (h < 12) return 'God morgen';
  if (h < 17) return 'God ettermiddag';
  return 'God kveld';
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString, start, end } = osloDayBounds();

  const [
    { data: briefingRow },
    { data: quests },
    { data: mana },
    { data: habits },
    { data: habitLogs },
    { data: gtok },
  ] = await Promise.all([
    supabase
      .from('ai_messages')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('context_type', 'morning_briefing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('quests')
      .select('id, title, completed_at, is_main')
      .eq('user_id', user.id)
      .eq('scheduled_for', dateString)
      .order('is_main', { ascending: false }),
    supabase
      .from('mana_logs')
      .select('level')
      .eq('user_id', user.id)
      .eq('logged_for', dateString)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, title, cue, frequency, days_of_week')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('logged_for', dateString),
    supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  let briefing: BriefingOutput | null = null;
  if (briefingRow?.content) {
    try { briefing = JSON.parse(briefingRow.content) as BriefingOutput; } catch { /* */ }
  }

  let calEvents: { id: string; title: string; start: string; end: string }[] = [];
  if (gtok) {
    try {
      const { client, rotated } = await authorizedClient({
        access_token: gtok.access_token,
        refresh_token: gtok.refresh_token,
        expires_at: gtok.expires_at,
      });
      if (rotated) {
        await supabase
          .from('google_tokens')
          .update({ access_token: rotated.access_token, expires_at: rotated.expires_at })
          .eq('user_id', user.id);
      }
      calEvents = await listEvents(client, start, end);
    } catch { /* Calendar fetch failing shouldn't break the page */ }
  }

  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d; })();
  const dueHabits = (habits ?? []).filter((h: any) => {
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekly') return true;
    return (h.days_of_week ?? []).includes(todayDow);
  });
  const loggedSet = new Set((habitLogs ?? []).map((l: any) => l.habit_id));

  return (
    <main className="container max-w-xl py-8 space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{dateString}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
        {briefing?.intro ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{briefing.intro}</p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ingen brief enda — trykk under for å lage en.
          </p>
        )}
      </header>

      <EnergyCheckIn initialLevel={(mana as any)?.level ?? null} />

      {calEvents.length > 0 && <CalendarStrip events={calEvents} />}

      <TodayQuests quests={(quests as any[]) ?? []} />

      {dueHabits.length > 0 && (
        <TodayHabits
          habits={dueHabits as any[]}
          loggedIds={[...loggedSet]}
        />
      )}

      <div className="pt-2 border-t">
        <RunBriefingButton hasBriefing={Boolean(briefing)} />
      </div>
    </main>
  );
}
