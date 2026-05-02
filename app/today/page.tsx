import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds, todayPlanIndex } from '@/lib/time';
import { filterHabitsForToday } from '@/lib/habit-schedule';
import { TodayQuests } from '@/components/today/quests';
import { TodayHabits } from '@/components/today/habits';
import { TodayHero } from '@/components/today/hero';
import { TodayShortcuts } from '@/components/today/shortcuts';
import {
  TodayWorkoutCard,
  TodayDinnerCard,
} from '@/components/today/plans-preview';
import { TodayOpenTasks, type OpenTask } from '@/components/today/open-tasks';
import { LocationPrompt } from '@/components/today/location-prompt';
import { BriefCard } from '@/components/today/brief-card';
import { MorningCheckin } from '@/components/today/morning-checkin';
import { WeatherWidget } from '@/components/today/weather-widget';
import {
  SupplementsCard,
  type Slot as SupplementSlot,
  type TodaySupplement,
} from '@/components/today/supplements-card';

export const dynamic = 'force-dynamic';

type BriefingOutput = {
  intro: string;
  summary?: string;
  clothing?: string;
  quests: { title: string; why: string }[];
};

type Level = 'low' | 'medium' | 'high';

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString } = osloDayBounds();
  // Used by the habit grace-period filter — fetch the last 14 days of
  // logs (max grace_days = 14) so we can decide which scheduled days
  // are still pending and should carry over to today.
  const fromDate = addDaysIso(dateString, -14);

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const householdId = (membership as any)?.household_id as string | undefined;

  let questFilter = supabase
    .from('quests')
    .select(
      'id, title, completed_at, is_main, user_id, household_id, completed_by_user_id',
    )
    .eq('scheduled_for', dateString);
  questFilter = householdId
    ? questFilter.or(`user_id.eq.${user.id},household_id.eq.${householdId}`)
    : questFilter.eq('user_id', user.id);

  const [
    { data: briefingRow },
    { data: quests },
    { data: mana },
    { data: habits },
    { data: recentHabitLogs },
    { data: mealPlanRow },
    { data: trainingPlanRow },
    { data: trainingPrefs },
    { data: openTasksRaw },
    { data: locationProfile },
    { data: supplementsRaw },
    { data: supplementLogsRaw },
  ] = await Promise.all([
    supabase
      .from('ai_messages')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('context_type', 'morning_briefing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    questFilter.order('is_main', { ascending: false }),
    supabase
      .from('mana_logs')
      .select('level, rested, focus')
      .eq('user_id', user.id)
      .eq('logged_for', dateString)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, name, color, schedule_days, grace_days, created_at')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('habit_logs')
      .select('habit_id, logged_for')
      .eq('user_id', user.id)
      .gte('logged_for', fromDate),
    supabase
      .from('ai_messages')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .eq('context_type', 'meal_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ai_messages')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .eq('context_type', 'training_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_preferences')
      .select('active_plan_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    householdId
      ? supabase
          .from('household_tasks')
          .select(
            'id, title, bounty_xp, bounty_tokens, bounty_reward_id, posted_by_user_id, assignee_user_id',
          )
          .eq('household_id', householdId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('user_profiles')
      .select('city, latitude, longitude, timezone')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('supplements')
      .select('id, name, dose, emoji, slots, schedule_days, xp_reward, token_reward')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('supplement_logs')
      .select('supplement_id, slot')
      .eq('user_id', user.id)
      .eq('logged_for', dateString),
  ]);

  const userCity = (locationProfile as any)?.city as string | null | undefined;
  const userLat = (locationProfile as any)?.latitude;
  const userLon = (locationProfile as any)?.longitude;
  const userTz = (locationProfile as any)?.timezone as string | null | undefined;
  // Numeric columns can come back as strings from PostgREST.
  const latNum = userLat == null ? null : Number(userLat);
  const lonNum = userLon == null ? null : Number(userLon);
  const hasCoords =
    latNum != null && lonNum != null && !Number.isNaN(latNum) && !Number.isNaN(lonNum);

  let briefing: BriefingOutput | null = null;
  if (briefingRow?.content) {
    try { briefing = JSON.parse(briefingRow.content) as BriefingOutput; } catch { /* */ }
  }

  // Apply schedule + grace filter so habits scheduled for prior days
  // disappear from /today unless they fall inside their grace window.
  const allHabits = (habits as any[]) ?? [];
  const recentLogs = ((recentHabitLogs as any[]) ?? []).map((l) => ({
    habit_id: l.habit_id as string,
    logged_for: l.logged_for as string,
  }));
  const habitsList = filterHabitsForToday(allHabits, recentLogs);
  const todaysLogs = recentLogs.filter((l) => l.logged_for === dateString);
  const loggedSet = new Set(todaysLogs.map((l) => l.habit_id));
  const habitsDone = habitsList.filter((h: any) => loggedSet.has(h.id)).length;

  const rawQuests = (quests as any[]) ?? [];

  const completerIds = Array.from(
    new Set(
      rawQuests
        .map((q) => q.completed_by_user_id)
        .filter((id): id is string => Boolean(id) && id !== user.id),
    ),
  );
  let completerMap = new Map<string, { display_name: string | null; email: string | null }>();
  if (completerIds.length > 0) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, email, display_name')
      .in('id', completerIds);
    completerMap = new Map(
      ((profs as any[]) ?? []).map((p) => [
        p.id,
        { display_name: p.display_name ?? null, email: p.email ?? null },
      ]),
    );
  }

  const questsList = rawQuests.map((q) => {
    const isFamily = Boolean(q.household_id);
    let completerInitial: string | null = null;
    let completerLabel: string | null = null;
    if (q.completed_by_user_id) {
      if (q.completed_by_user_id === user.id) {
        completerInitial = 'Du';
        completerLabel = 'Du';
      } else {
        const p = completerMap.get(q.completed_by_user_id);
        const src = p?.display_name ?? p?.email ?? '?';
        completerInitial = src.charAt(0).toUpperCase();
        completerLabel = p?.display_name ?? p?.email ?? 'Medlem';
      }
    }
    return {
      id: q.id,
      title: q.title,
      completed_at: q.completed_at,
      is_main: q.is_main,
      is_family: isFamily,
      completer_initial: completerInitial,
      completer_label: completerLabel,
    };
  });
  const questsDone = questsList.filter((q) => q.completed_at).length;

  // Resolve reward titles for any bounty_reward_id refs in open tasks
  const openTasksList = ((openTasksRaw as any[]) ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    bounty_xp: (t.bounty_xp ?? 0) as number,
    bounty_tokens: (t.bounty_tokens ?? 0) as number,
    bounty_reward_id: (t.bounty_reward_id ?? null) as string | null,
    posted_by_user_id: t.posted_by_user_id as string,
    assignee_user_id: (t.assignee_user_id ?? null) as string | null,
  }));
  let rewardLabelById: Record<string, string> = {};
  const rewardIds = openTasksList
    .map((t) => t.bounty_reward_id)
    .filter((x): x is string => Boolean(x));
  if (rewardIds.length > 0) {
    const { data: rewardRows } = await supabase
      .from('rewards')
      .select('id, title, emoji')
      .in('id', rewardIds);
    for (const r of ((rewardRows as any[]) ?? [])) {
      rewardLabelById[r.id] = `${r.emoji ?? '🎁'} ${r.title}`;
    }
  }
  // Resolve member labels for any assignee refs so the open-tasks card
  // can show a "→ Emma" badge.
  let assigneeLabelById: Record<string, string> = {};
  const assigneeIds = Array.from(
    new Set(
      openTasksList
        .map((t) => t.assignee_user_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  if (assigneeIds.length > 0) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, display_name, email')
      .in('id', assigneeIds);
    for (const p of ((profs as any[]) ?? [])) {
      assigneeLabelById[p.id] = p.display_name ?? p.email ?? 'Medlem';
    }
  }
  const openTasks: OpenTask[] = openTasksList.map((t) => ({
    id: t.id,
    title: t.title,
    bounty_xp: t.bounty_xp,
    bounty_tokens: t.bounty_tokens,
    bounty_reward_label: t.bounty_reward_id
      ? rewardLabelById[t.bounty_reward_id] ?? 'Belønning'
      : null,
    posted_by_user_id: t.posted_by_user_id,
    assignee_user_id: t.assignee_user_id,
    assignee_label: t.assignee_user_id
      ? assigneeLabelById[t.assignee_user_id] ?? 'Medlem'
      : null,
  }));

  // Today's supplements: filter to weekday-due items, attach which
  // slots have already been logged today so the card can gate the
  // "Tatt" buttons. Slot mapping for "current" matches /api/dispense.
  const dowToday = new Date(dateString + 'T00:00:00').getDay();
  const oslohour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Oslo',
    }).format(new Date()),
  );
  const currentSlot: SupplementSlot =
    oslohour >= 5 && oslohour < 11
      ? 'morning'
      : oslohour >= 11 && oslohour < 15
        ? 'noon'
        : oslohour >= 15 && oslohour < 21
          ? 'evening'
          : 'night';

  const supplementLogs = (supplementLogsRaw as any[]) ?? [];
  const takenBySupplement = new Map<string, SupplementSlot[]>();
  for (const l of supplementLogs) {
    const arr = takenBySupplement.get(l.supplement_id) ?? [];
    arr.push(l.slot as SupplementSlot);
    takenBySupplement.set(l.supplement_id, arr);
  }
  const supplementsToday: TodaySupplement[] = ((supplementsRaw as any[]) ?? [])
    .filter((s) => {
      const days = s.schedule_days ?? [];
      if (Array.isArray(days) && days.length > 0 && !days.includes(dowToday)) {
        return false;
      }
      return true;
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      dose: s.dose,
      emoji: s.emoji,
      slots: s.slots ?? [],
      xp_reward: s.xp_reward ?? 0,
      token_reward: s.token_reward ?? 0,
      taken_slots: takenBySupplement.get(s.id) ?? [],
    }));

  // Today's dinner + workout pulled from the latest stored plans.
  let todayDinner: any = null;
  let dinnerPeople: number | null = null;
  if ((mealPlanRow as any)?.content) {
    try {
      const meal = JSON.parse((mealPlanRow as any).content);
      const idx = todayPlanIndex(
        (mealPlanRow as any).created_at,
        meal.days?.length ?? 0,
      );
      if (idx !== null) {
        todayDinner = meal.days[idx];
        dinnerPeople = meal.params?.people ?? null;
      }
    } catch { /* ignore */ }
  }

  let todayWorkout: any = null;
  const activePlanId = (trainingPrefs as any)?.active_plan_id as string | null;
  if (
    (trainingPlanRow as any)?.content &&
    activePlanId &&
    (trainingPlanRow as any).id === activePlanId
  ) {
    try {
      const training = JSON.parse((trainingPlanRow as any).content);
      const idx = todayPlanIndex(
        (trainingPlanRow as any).created_at,
        training.days?.length ?? 0,
      );
      if (idx !== null) {
        todayWorkout = training.days[idx];
      }
    } catch { /* ignore */ }
  }

  return (
    <main className="container max-w-xl py-6 space-y-5">
      <LocationPrompt alreadyHasCity={Boolean(userCity)} />

      {hasCoords && (
        <WeatherWidget
          city={userCity ?? null}
          latitude={latNum!}
          longitude={lonNum!}
          timezone={userTz ?? null}
        />
      )}

      {/* HERO — at-a-glance numbers */}
      <TodayHero
        intro={briefing?.intro ?? null}
        habitsDone={habitsDone}
        habitsTotal={habitsList.length}
        questsDone={questsDone}
        questsTotal={questsList.length}
        energyLevel={(mana as any)?.level as Level | null ?? null}
      />

      {/* THE BRIEF — primary morning action.
          When no brief exists yet, walk the user through the morning
          ritual (energy → rested → focus → optional note) and the
          last step kicks off the briefing run. Once it's generated
          BriefCard takes over with the result. */}
      {briefing ? (
        <BriefCard
          intro={briefing.intro ?? null}
          summary={briefing.summary ?? null}
          clothing={briefing.clothing ?? null}
          onGeneratedAt={(briefingRow as any)?.created_at ?? null}
          hasLocation={Boolean(userCity)}
        />
      ) : (
        <MorningCheckin
          initialEnergy={(mana as any)?.level as Level | null ?? null}
          initialRested={(mana as any)?.rested as Level | null ?? null}
          initialFocus={(mana as any)?.focus as Level | null ?? null}
        />
      )}

      {/* TODAY'S ASSIGNMENTS */}
      <TodayQuests quests={questsList} />

      <TodayHabits
        habits={habitsList}
        loggedToday={[...loggedSet] as string[]}
      />

      {/* SUPPLEMENTS — daily dose log (already slot-ordered inside) */}
      <SupplementsCard items={supplementsToday} currentSlot={currentSlot} />

      {/* AFTERNOON — training */}
      <TodayWorkoutCard workout={todayWorkout} />

      {/* EVENING — dinner */}
      <TodayDinnerCard dinner={todayDinner} people={dinnerPeople} />

      {/* ANYTIME — marketplace tasks (no time anchor) */}
      <TodayOpenTasks initial={openTasks} currentUserId={user.id} />

      {/* NAV — moved to bottom; shortcuts are navigation, not the focus */}
      <TodayShortcuts />
    </main>
  );
}
