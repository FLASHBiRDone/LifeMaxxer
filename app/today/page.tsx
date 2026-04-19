import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { TodayQuests } from '@/components/today/quests';
import { EnergyCheckIn } from '@/components/today/energy';
import { RunBriefingButton } from '@/components/today/run-briefing';
import { TodayHabits } from '@/components/today/today-habits';
import { CalendarStrip } from '@/components/today/calendar-strip';
import { TodayHero } from '@/components/today/hero';
import { authorizedClient, listEvents } from '@/lib/google';

export const dynamic = 'force-dynamic';

type BriefingOutput = {
  intro: string;
  quests: { title: string; why: string }[];
};

type Level = 'low' | 'medium' | 'high';

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
      .select('id, name, target_frequency')
      .eq('user_id', user.id)
      .eq('archived', false),
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

  const dueHabits = ((habits as any[]) ?? []).map((h) => ({
    id: h.id,
    title: h.name,
    cue: null as string | null,
  }));
  const loggedSet = new Set((habitLogs ?? []).map((l: any) => l.habit_id));
  const habitsDone = dueHabits.filter((h: any) => loggedSet.has(h.id)).length;
  const questsList = (quests as any[]) ?? [];
  const questsDone = questsList.filter((q) => q.completed_at).length;

  return (
    <main className="container max-w-xl py-6 space-y-6">
      <TodayHero
        name={null}
        intro={briefing?.intro ?? null}
        habitsDone={habitsDone}
        habitsTotal={dueHabits.length}
        questsDone={questsDone}
        questsTotal={questsList.length}
        energyLevel={(mana as any)?.level ?? null}
      />

      <EnergyCheckIn initialLevel={(mana as any)?.level as Level | null ?? null} />

      {calEvents.length > 0 && <CalendarStrip events={calEvents} />}

      <TodayQuests quests={questsList} />

      {dueHabits.length > 0 && (
        <TodayHabits habits={dueHabits as any[]} loggedIds={[...loggedSet] as string[]} />
      )}

      <div className="pt-2">
        <RunBriefingButton hasBriefing={Boolean(briefing)} />
      </div>
    </main>
  );
}
