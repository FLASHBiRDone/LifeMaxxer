import { createAdminClient } from '@/lib/supabase/admin';
import { osloDayBounds } from '@/lib/time';
import { sendPush } from '@/lib/push';

type DayPlan = { day: string; title: string; description?: string };
type Plan = { days: DayPlan[] };

const NB_DAYS = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];

function todaysMealTitle(plan: Plan, locale: 'nb' | 'en'): string | null {
  const now = new Date();
  const dow = now.getDay();
  const candidates =
    locale === 'nb'
      ? [NB_DAYS[dow]]
      : [
          now.toLocaleDateString('en-US', { weekday: 'long' }),
        ];
  const match = plan.days.find((d) =>
    candidates.some((c) => d.day.toLowerCase().startsWith(c.toLowerCase())),
  );
  return match?.title ?? null;
}

async function runDinnerPanicFor(userId: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: settings }, { data: planRow }] =
    await Promise.all([
      admin
        .from('user_profiles')
        .select('locale')
        .eq('id', userId)
        .maybeSingle(),
      admin
        .from('user_settings')
        .select('dinner_panic_enabled, push_enabled')
        .eq('user_id', userId)
        .maybeSingle(),
      admin
        .from('ai_messages')
        .select('content')
        .eq('user_id', userId)
        .eq('context_type', 'meal_plan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!(settings as any)?.dinner_panic_enabled) return { userId, skipped: 'disabled' };
  if (!(settings as any)?.push_enabled) return { userId, skipped: 'push_off' };

  const locale = ((profile as any)?.locale ?? 'nb') as 'nb' | 'en';

  let mealTitle: string | null = null;
  if (planRow?.content) {
    try {
      const plan = JSON.parse(planRow.content) as Plan;
      if (plan?.days?.length) mealTitle = todaysMealTitle(plan, locale);
    } catch {
      /* ignore */
    }
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);
  if (!subs?.length) return { userId, skipped: 'no_subs' };

  const title =
    locale === 'nb' ? 'Snart middag 🍳' : 'Dinner time soon 🍳';
  const body = mealTitle
    ? locale === 'nb'
      ? `I dag: ${mealTitle}`
      : `Today: ${mealTitle}`
    : locale === 'nb'
      ? 'Ingen plan i dag — se forslag'
      : 'No plan today — pick one';

  let sent = 0;
  for (const s of subs as any[]) {
    try {
      await sendPush(
        { endpoint: s.endpoint, keys: s.keys },
        { title, body, url: '/recipes', tag: 'dinner-panic' },
      );
      sent++;
    } catch (err) {
      console.error('[dinner-panic] push failed', s.endpoint, err);
    }
  }
  return { userId, sent, mealTitle };
}

export async function runDinnerPanic() {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('dinner_panic_enabled', true)
    .eq('push_enabled', true);

  const results = [];
  for (const u of ((users as any[]) ?? [])) {
    try {
      results.push(await runDinnerPanicFor(u.user_id));
    } catch (err) {
      results.push({ userId: u.user_id, error: String(err) });
    }
  }
  return { count: results.length, results };
}
