import { createAdminClient } from '@/lib/supabase/admin';
import { osloWeekDays } from '@/lib/time';
import { sendPush } from '@/lib/push';

type Locale = 'nb' | 'en';

async function runDebriefFor(userId: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin.from('user_profiles').select('locale').eq('id', userId).maybeSingle(),
    admin
      .from('user_settings')
      .select('weekly_debrief_enabled, push_enabled')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (!(settings as any)?.weekly_debrief_enabled) {
    return { userId, skipped: 'disabled' };
  }
  if (!(settings as any)?.push_enabled) return { userId, skipped: 'push_off' };

  const locale = (((profile as any)?.locale ?? 'nb') as Locale);
  const week = osloWeekDays();
  const weekDates = week.map((d) => d.dateString);

  const [{ count: habitsDone }, { data: quests }] = await Promise.all([
    admin
      .from('habit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('logged_for', weekDates),
    admin
      .from('quests')
      .select('is_main, completed_at, scheduled_for')
      .eq('user_id', userId)
      .in('scheduled_for', weekDates)
      .not('completed_at', 'is', null),
  ]);

  const questRows = (quests as any[]) ?? [];
  const questsDone = questRows.length;
  const mainDone = questRows.filter((q) => q.is_main).length;
  const xp = (habitsDone ?? 0) + questsDone * 5 + mainDone * 5;

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);
  if (!subs?.length) return { userId, skipped: 'no_subs' };

  const title = locale === 'nb' ? 'Uken din 🎯' : 'Your week 🎯';
  const body =
    locale === 'nb'
      ? `${habitsDone ?? 0} vaner · ${questsDone} oppdrag · ${xp} XP`
      : `${habitsDone ?? 0} habits · ${questsDone} quests · ${xp} XP`;

  let sent = 0;
  for (const s of subs as any[]) {
    try {
      await sendPush(
        { endpoint: s.endpoint, keys: s.keys },
        { title, body, url: '/stats', tag: 'weekly-debrief' },
      );
      sent++;
    } catch (err) {
      console.error('[weekly-debrief] push failed', s.endpoint, err);
    }
  }

  return { userId, sent, habitsDone: habitsDone ?? 0, questsDone, xp };
}

export async function runWeeklyDebrief() {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('weekly_debrief_enabled', true)
    .eq('push_enabled', true);

  const results = [];
  for (const u of ((users as any[]) ?? [])) {
    try {
      results.push(await runDebriefFor(u.user_id));
    } catch (err) {
      results.push({ userId: u.user_id, error: String(err) });
    }
  }
  return { count: results.length, results };
}
