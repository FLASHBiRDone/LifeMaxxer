import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { authorizedClient, listEvents } from '@/lib/google';
import { GmClient } from '@/components/gm/gm-client';

export const dynamic = 'force-dynamic';

type BriefingOutput = {
  intro: string;
  quests: { title: string; why: string }[];
};

export default async function GmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString, start, end } = osloDayBounds();

  const [
    { data: briefingRow },
    { data: mana },
    { data: habits },
    { data: habitLogs },
    { data: gtok },
  ] = await Promise.all([
    supabase
      .from('ai_messages')
      .select('content')
      .eq('user_id', user.id)
      .eq('context_type', 'morning_briefing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('mana_logs')
      .select('level')
      .eq('user_id', user.id)
      .eq('logged_for', dateString)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, name')
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
    try {
      briefing = JSON.parse(briefingRow.content) as BriefingOutput;
    } catch { /* */ }
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
    } catch { /* */ }
  }

  const loggedSet = new Set((habitLogs ?? []).map((l: any) => l.habit_id));
  const pendingHabits = ((habits as any[]) ?? []).filter((h) => !loggedSet.has(h.id));

  return (
    <main className="container max-w-xl">
      <GmClient
        initialLevel={(mana as any)?.level ?? null}
        briefing={briefing}
        todayEvents={calEvents}
        pendingHabits={pendingHabits}
        todayString={dateString}
      />
    </main>
  );
}
