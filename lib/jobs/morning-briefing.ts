import { createAdminClient } from '@/lib/supabase/admin';
import { authorizedClient, listEvents } from '@/lib/google';
import { osloDayBounds } from '@/lib/time';
import { generateMorningBriefing, fallbackBriefing } from '@/lib/briefing';
import { sendPush } from '@/lib/push';
import type { MorningContext } from '@/lib/prompts';

/**
 * Per-user morning briefing generator. Run for every eligible user each
 * morning via Vercel Cron, or manually for a single user via the
 * dev-trigger endpoint.
 */
export async function runMorningBriefingFor(userId: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: settings }, { data: tokenRow }] =
    await Promise.all([
      admin
        .from('user_profiles')
        .select('locale, timezone')
        .eq('id', userId)
        .maybeSingle(),
      admin
        .from('user_settings')
        .select('morning_briefing_enabled, push_enabled')
        .eq('user_id', userId)
        .maybeSingle(),
      admin
        .from('google_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  const locale = ((profile as any)?.locale ?? 'nb') as 'nb' | 'en';
  const tz = ((profile as any)?.timezone ?? 'Europe/Oslo') as string;
  const { start, end, dateString, dayOfWeek } = osloDayBounds(new Date(), tz);

  let events: { start: string; title: string; id: string }[] = [];
  if (tokenRow) {
    try {
      const { client, rotated } = await authorizedClient(tokenRow as any);
      if (rotated) {
        await admin
          .from('google_tokens')
          .update({
            access_token: rotated.access_token,
            expires_at: rotated.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
      events = (await listEvents(client, start, end)).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
      }));
    } catch (err) {
      console.error('[morning-briefing] calendar fetch failed', userId, err);
    }
  }

  // Pending habits: any active habit without a log for today.
  const { data: habits } = await admin
    .from('habits')
    .select('id, name')
    .eq('user_id', userId)
    .eq('archived', false);
  const habitIds = (habits as any[] | null)?.map((h) => h.id) ?? [];
  let completedIds = new Set<string>();
  if (habitIds.length) {
    const { data: logs } = await admin
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('logged_for', dateString)
      .in('habit_id', habitIds);
    completedIds = new Set((logs as any[] | null)?.map((l) => l.habit_id) ?? []);
  }
  const pendingHabits = ((habits as any[] | null) ?? [])
    .filter((h) => !completedIds.has(h.id))
    .map((h) => h.name);

  // Latest mana log (today's, if any)
  const { data: manaRow } = await admin
    .from('mana_logs')
    .select('level')
    .eq('user_id', userId)
    .eq('logged_for', dateString)
    .maybeSingle();
  const manaLevel = (manaRow as any)?.level ?? null;

  const ctx: MorningContext = {
    date: dateString,
    dayOfWeek,
    locale,
    manaLevel,
    events: events.map((e) => ({ start: e.start, title: e.title })),
    pendingHabits,
  };

  let output;
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  let promptVersion = 'morning-briefing.fallback';

  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: monthCost } = await admin
      .from('ai_messages')
      .select('cost_usd')
      .gte('created_at', monthStart.toISOString());
    const spent = (monthCost as any[] | null)?.reduce(
      (a: number, r: any) => a + Number(r.cost_usd ?? 0),
      0,
    ) ?? 0;
    const budget = Number(process.env.ANTHROPIC_MONTHLY_BUDGET_USD ?? 10);
    if (spent >= budget) {
      output = fallbackBriefing(ctx);
    } else {
      const result = await generateMorningBriefing(ctx);
      output = result.output;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      costUsd = result.costUsd;
      promptVersion = result.promptVersion;
    }
  } catch (err) {
    console.error('[morning-briefing] generation failed', userId, err);
    output = fallbackBriefing(ctx);
  }

  await admin.from('ai_messages').insert({
    user_id: userId,
    role: 'assistant',
    content: JSON.stringify(output),
    context_type: 'morning_briefing',
    prompt_version: promptVersion,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
  });

  // Insert quests (main quests from the briefing).
  if (output.quests.length) {
    const rows = output.quests.map((q) => ({
      user_id: userId,
      title: q.title,
      scheduled_for: dateString,
      is_main: true,
    }));
    await admin.from('quests').insert(rows);
  }

  // Push notification (only if user opted in and has subscriptions)
  if ((settings as any)?.push_enabled) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', userId);
    for (const s of (subs as any[] | null) ?? []) {
      try {
        await sendPush(
          { endpoint: s.endpoint, keys: s.keys },
          {
            title: locale === 'nb' ? 'God morgen' : 'Good morning',
            body: output.intro,
            url: '/today',
            tag: 'morning-briefing',
          },
        );
      } catch (err) {
        console.error('[morning-briefing] push failed', s.endpoint, err);
      }
    }
  }

  return { userId, questCount: output.quests.length, costUsd };
}

export async function runMorningBriefing() {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('morning_briefing_enabled', true);

  const results = [];
  for (const u of (users as any[] | null) ?? []) {
    try {
      results.push(await runMorningBriefingFor(u.user_id));
    } catch (err) {
      console.error('[morning-briefing] user failed', u.user_id, err);
      results.push({ userId: u.user_id, error: String(err) });
    }
  }
  return { count: results.length, results };
}
