import { createAdminClient } from '@/lib/supabase/admin';
import { authorizedClient, listEvents } from '@/lib/google';
import { osloDayBounds, todayPlanIndex } from '@/lib/time';
import { generateMorningBriefing, fallbackBriefing } from '@/lib/briefing';
import { sendPush } from '@/lib/push';
import { fetchTodayForecast } from '@/lib/weather';
import { fetchLocalDisruptions, type Disruption } from '@/lib/local-events';
import type { MorningContext } from '@/lib/prompts';
import { normalizeLocale } from '@/lib/prompts/locales';
import type { Locale } from '@/lib/prompts/locales';

/** Add N calendar days to a YYYY-MM-DD string. */
function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const PREP_KEYWORDS_NB = [
  'frisør', 'frisor', 'lege', 'tannlege', 'fysio', 'eksamen',
  'intervju', 'flytur', 'fly ', 'flight', 'tog', 'middag med',
  'fest', 'bursdag', 'presentasjon', 'foreldremøte', 'samtale',
  'møte', 'time', 'avtale', 'sjekk', 'undersøkelse',
];
const PREP_KEYWORDS_EN = [
  'hairdresser', 'doctor', 'dentist', 'physio', 'exam',
  'interview', 'flight', 'train', 'dinner with', 'party',
  'birthday', 'presentation', 'parent meeting', 'appointment',
  'meeting', 'check-up', 'visit',
];

/**
 * Pick out tomorrow's prep-worthy calendar events. Threshold:
 * - any event before 11:00 (the early heads-up rule)
 * - any title containing prep-related keywords (haircut, doctor, etc.)
 * Returns a compact list with HH:MM in the user's timezone so the UI
 * and the brief prompt can display them without re-parsing dates.
 */
function filterTomorrowEvents(
  events: { start: string; title: string }[],
  locale: Locale,
  tz: string,
): { time: string; title: string }[] {
  const keywords = locale === 'en' ? PREP_KEYWORDS_EN : PREP_KEYWORDS_NB;
  const out: { time: string; title: string }[] = [];
  for (const e of events) {
    let date: Date;
    try {
      date = new Date(e.start);
      if (Number.isNaN(date.getTime())) continue;
    } catch {
      continue;
    }
    const hourStr = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(date);
    const hour = Number(hourStr);
    const titleLower = e.title.toLowerCase();
    const earlyHeadsUp = hour < 11;
    const prepMatch = keywords.some((kw) => titleLower.includes(kw));
    if (!earlyHeadsUp && !prepMatch) continue;
    const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(date);
    out.push({ time, title: e.title });
  }
  return out.slice(0, 5);
}

/**
 * Localised "phase of day" label so the model can match tone to the
 * clock — early-morning is softer, late-evening is wind-down. Splits at
 * the same boundaries the user-facing greeting uses.
 */
function dayPartLabel(hour: number, locale: Locale): string {
  if (locale === 'nb') {
    if (hour < 9) return 'tidlig morgen';
    if (hour < 12) return 'formiddag';
    if (hour < 17) return 'ettermiddag';
    if (hour < 22) return 'kveld';
    return 'natt';
  }
  if (hour < 9) return 'early morning';
  if (hour < 12) return 'mid-morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late night';
}

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
        .select('locale, timezone, city, latitude, longitude')
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

  const locale = normalizeLocale((profile as any)?.locale);
  const tz = ((profile as any)?.timezone ?? 'Europe/Oslo') as string;
  const city = (profile as any)?.city as string | null;
  const lat = (profile as any)?.latitude as number | null;
  const lon = (profile as any)?.longitude as number | null;
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

  // Latest mana log (today's, if any). Energy + the new rested/focus
  // dimensions + the optional free-form note from the morning ritual.
  const { data: manaRow } = await admin
    .from('mana_logs')
    .select('level, rested, focus, extra_note')
    .eq('user_id', userId)
    .eq('logged_for', dateString)
    .maybeSingle();
  const manaLevel = (manaRow as any)?.level ?? null;
  const restedLevel = (manaRow as any)?.rested ?? null;
  const focusLevel = (manaRow as any)?.focus ?? null;
  const extraNote = (manaRow as any)?.extra_note ?? null;

  // Today's dinner from the latest meal plan + today's workout from the
  // active training plan. Both are optional — they're inputs to the
  // agenda-style summary in the prompt.
  const [
    { data: mealPlanRow },
    { data: trainingPlanRow },
    { data: trainingPrefs },
    { data: membership },
  ] = await Promise.all([
    admin
      .from('ai_messages')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .eq('context_type', 'meal_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('ai_messages')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .eq('context_type', 'training_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('training_preferences')
      .select('active_plan_id')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  let dinner: { title: string; description?: string } | null = null;
  if ((mealPlanRow as any)?.content) {
    try {
      const meal = JSON.parse((mealPlanRow as any).content);
      const idx = todayPlanIndex(
        (mealPlanRow as any).created_at,
        meal.days?.length ?? 0,
      );
      if (idx !== null) {
        const d = meal.days[idx];
        if (d && !d.skipped) {
          dinner = { title: d.title, description: d.description };
        }
      }
    } catch { /* ignore */ }
  }

  let workout: { title: string; type: string; duration: number } | null = null;
  const activePlanId = (trainingPrefs as any)?.active_plan_id as string | null;
  if (
    (trainingPlanRow as any)?.content &&
    activePlanId &&
    (trainingPlanRow as any).id === activePlanId
  ) {
    try {
      const plan = JSON.parse((trainingPlanRow as any).content);
      const idx = todayPlanIndex(
        (trainingPlanRow as any).created_at,
        plan.days?.length ?? 0,
      );
      if (idx !== null) {
        const d = plan.days[idx];
        if (d && d.type !== 'rest') {
          workout = { title: d.title, type: d.type, duration: d.duration ?? 45 };
        }
      }
    } catch { /* ignore */ }
  }

  // Top 5 open household tasks (any member can claim)
  let openTasks: { title: string; bountyXp: number; bountyTokens: number }[] = [];
  const householdId = (membership as any)?.household_id as string | undefined;
  if (householdId) {
    const { data: tasks } = await admin
      .from('household_tasks')
      .select('title, bounty_xp, bounty_tokens')
      .eq('household_id', householdId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5);
    openTasks = ((tasks as any[]) ?? []).map((t) => ({
      title: t.title,
      bountyXp: t.bounty_xp ?? 0,
      bountyTokens: t.bounty_tokens ?? 0,
    }));
  }

  // Weather — only fetched when the user has set a location.
  // Numeric columns can come back as strings from PostgREST, so coerce
  // before passing to the Open-Meteo URL builder.
  let weather: MorningContext['weather'] = null;
  const latNum = lat == null ? null : Number(lat);
  const lonNum = lon == null ? null : Number(lon);
  if (
    latNum != null &&
    lonNum != null &&
    !Number.isNaN(latNum) &&
    !Number.isNaN(lonNum)
  ) {
    try {
      const w = await fetchTodayForecast(latNum, lonNum, tz);
      if (w) {
        weather = {
          city,
          tempMin: w.tempMin,
          tempMax: w.tempMax,
          precipitationMm: w.precipitationMm,
          windMaxKmh: w.windMaxKmh,
          conditionLabel: w.conditionLabel,
        };
      } else {
        console.warn(
          '[morning-briefing] weather API returned no daily data',
          { userId, latNum, lonNum },
        );
      }
    } catch (err) {
      console.error('[morning-briefing] weather fetch failed', userId, err);
    }
  } else {
    console.info('[morning-briefing] weather skipped — no location set', { userId, city });
  }

  // Time-of-day in the user's timezone — surface to the model so the
  // tone shifts between an early-morning wake-up and a midday recap.
  const nowFmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date());
  const hourNow = Number(nowFmt.slice(0, 2));
  const dayPart = dayPartLabel(hourNow, locale);
  const isEvening = hourNow >= 17;

  // Tomorrow lookahead: only when the brief runs in the evening so
  // the user gets a heads-up about early appointments + disruptions
  // before bed. Compute tomorrow's date string in the user's tz.
  const tomorrowDate = isEvening
    ? addDaysIso(dateString, 1)
    : null;

  // Fetch tomorrow's calendar events too if we have Google access
  // and we're in evening lookahead mode.
  let tomorrowEventsRaw: { start: string; title: string }[] = [];
  if (isEvening && tokenRow) {
    try {
      const { client } = await authorizedClient(tokenRow as any);
      const { start: tStart, end: tEnd } = osloDayBounds(
        new Date(tomorrowDate! + 'T12:00:00Z'),
        tz,
      );
      const evs = await listEvents(client, tStart, tEnd);
      tomorrowEventsRaw = evs.map((e) => ({ start: e.start, title: e.title }));
    } catch (err) {
      console.error('[morning-briefing] tomorrow calendar fetch failed', userId, err);
    }
  }
  const tomorrowEvents = filterTomorrowEvents(tomorrowEventsRaw, locale, tz);

  // Local disruptions via Claude web search. Cached in ai_messages
  // so a re-run of the brief on the same city/date reuses the
  // previous result instead of burning another search call.
  let todayDisruptions: Disruption[] = [];
  let tomorrowDisruptions: Disruption[] = [];
  if (city) {
    const cacheKey = `${city.toLowerCase().trim()}-${dateString}-${locale}-${isEvening ? 'eve' : 'day'}`;
    const { data: cachedRow } = await admin
      .from('ai_messages')
      .select('content, created_at')
      .eq('user_id', userId)
      .eq('context_type', 'local_disruptions')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let cached: any = null;
    try {
      if ((cachedRow as any)?.content) {
        cached = JSON.parse((cachedRow as any).content);
      }
    } catch { /* ignore */ }

    let disruptions: { today: Disruption[]; tomorrow: Disruption[] } | null = null;
    if (cached?.cache_key === cacheKey) {
      disruptions = {
        today: cached.today?.disruptions ?? [],
        tomorrow: cached.tomorrow?.disruptions ?? [],
      };
    } else {
      try {
        const result = await fetchLocalDisruptions({
          city,
          todayDate: dateString,
          tomorrowDate,
          locale,
        });
        disruptions = {
          today: result.today.disruptions,
          tomorrow: result.tomorrow?.disruptions ?? [],
        };
        // Persist the structured result so /today's card and the next
        // brief run can read it without another web search.
        await admin.from('ai_messages').insert({
          user_id: userId,
          role: 'assistant',
          context_type: 'local_disruptions',
          prompt_version: 'local-events.v1',
          content: JSON.stringify({
            cache_key: cacheKey,
            generated_at: new Date().toISOString(),
            city,
            today: { date: dateString, disruptions: result.today.disruptions },
            tomorrow: result.tomorrow
              ? { date: result.tomorrow.date, disruptions: result.tomorrow.disruptions }
              : null,
            tomorrow_events: tomorrowEvents,
          }),
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          cost_usd: result.costUsd,
        });
      } catch (err) {
        console.error('[morning-briefing] local-events fetch failed', userId, err);
      }
    }
    if (disruptions) {
      todayDisruptions = disruptions.today;
      tomorrowDisruptions = disruptions.tomorrow;
    }
  }

  const ctx: MorningContext = {
    date: dateString,
    dayOfWeek,
    currentTime: nowFmt,
    dayPart,
    isEvening,
    locale,
    manaLevel,
    restedLevel,
    focusLevel,
    extraNote,
    events: events.map((e) => ({ start: e.start, title: e.title })),
    pendingHabits,
    dinner,
    workout,
    openTasks,
    weather,
    disruptions: todayDisruptions.map((d) => ({
      title: d.title,
      time: d.time ?? null,
    })),
    tomorrowDisruptions: tomorrowDisruptions.map((d) => ({
      title: d.title,
      time: d.time ?? null,
    })),
    tomorrowEvents,
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

  // Replace any existing briefing-generated main quests for today so
  // re-running the brief doesn't pile duplicates on top. Only deletes
  // is_main rows the user hasn't completed yet — completed quests stay
  // for stats history. User-created (non-main) quests are untouched.
  await admin
    .from('quests')
    .delete()
    .eq('user_id', userId)
    .eq('scheduled_for', dateString)
    .eq('is_main', true)
    .is('completed_at', null);

  // Skip any quest whose title matches an open marketplace task — the
  // model sometimes echoes those back as a "main quest" since we hand
  // it the marketplace context, and that creates two cards for the
  // same chore.
  const openTaskTitles = new Set(
    openTasks.map((t) => t.title.trim().toLowerCase()),
  );
  const dedupedQuests = output.quests.filter(
    (q) => !openTaskTitles.has(q.title.trim().toLowerCase()),
  );
  if (dedupedQuests.length) {
    const rows = dedupedQuests.map((q) => ({
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
