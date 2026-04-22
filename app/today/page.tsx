import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sunrise, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds, osloWeekDays, todayPlanIndex } from '@/lib/time';
import { TodayQuests } from '@/components/today/quests';
import { EnergyCheckIn } from '@/components/today/energy';
import { RunBriefingButton } from '@/components/today/run-briefing';
import { WeekHabitGrid } from '@/components/today/week-habit-grid';
import { TodayHero } from '@/components/today/hero';
import { TodayShortcuts } from '@/components/today/shortcuts';
import { TodayPlansPreview } from '@/components/today/plans-preview';

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

  const { dateString } = osloDayBounds();
  const weekDays = osloWeekDays();
  const weekStart = weekDays[0].start.toISOString();
  const weekEnd = weekDays[6].end.toISOString();

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
    { data: habitLogs },
    { data: weekHabitLogs },
    { data: mealPlanRow },
    { data: trainingPlanRow },
    { data: trainingPrefs },
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
      .select('level')
      .eq('user_id', user.id)
      .eq('logged_for', dateString)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, name, color')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('logged_for', dateString),
    supabase
      .from('habit_logs')
      .select('habit_id, logged_for')
      .eq('user_id', user.id)
      .gte('logged_for', weekDays[0].dateString)
      .lte('logged_for', weekDays[6].dateString),
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
  ]);

  let briefing: BriefingOutput | null = null;
  if (briefingRow?.content) {
    try { briefing = JSON.parse(briefingRow.content) as BriefingOutput; } catch { /* */ }
  }

  const habitsList = (habits as any[]) ?? [];
  const loggedSet = new Set((habitLogs ?? []).map((l: any) => l.habit_id));

  // Build weekLogs: habit_id → dateString[]
  const weekLogs: Record<string, string[]> = {};
  for (const log of (weekHabitLogs as any[]) ?? []) {
    if (!weekLogs[log.habit_id]) weekLogs[log.habit_id] = [];
    weekLogs[log.habit_id].push(log.logged_for);
  }

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

  // Count unique habit×day pairs logged this week (past + today only)
  const todayIdx = weekDays.findIndex((d) => d.dateString === dateString);
  const daysElapsed = todayIdx + 1;
  const weekHabitsTotal = habitsList.length * daysElapsed;
  const weekHabitsDone = Object.values(weekLogs).reduce(
    (sum, dates) => sum + dates.filter((d) => d <= dateString).length,
    0,
  );

  const hour = new Date().getHours();
  const showMorningRitual = !mana && hour < 12;

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
      {showMorningRitual && (
        <Link
          href="/gm"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors soft-shadow"
        >
          <div className="h-9 w-9 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <Sunrise className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Start dagen rolig</p>
            <p className="text-[11px] text-muted-foreground">Morgen-ritual · 30 sekunder</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
        </Link>
      )}

      <TodayHero
        intro={briefing?.intro ?? null}
        habitsDone={habitsDone}
        habitsTotal={habitsList.length}
        questsDone={questsDone}
        questsTotal={questsList.length}
        energyLevel={(mana as any)?.level as Level | null ?? null}
        weekDays={weekDays}
        todayString={dateString}
        weekHabitsDone={weekHabitsDone}
        weekHabitsTotal={weekHabitsTotal}
      />

      <TodayShortcuts />

      <TodayPlansPreview
        dinner={todayDinner}
        workout={todayWorkout}
        people={dinnerPeople}
      />

      <TodayQuests quests={questsList} />

      <WeekHabitGrid
        habits={habitsList}
        weekDays={weekDays}
        todayString={dateString}
        weekLogs={weekLogs}
      />

      <EnergyCheckIn initialLevel={(mana as any)?.level as Level | null ?? null} />

      <div className="pt-1">
        <RunBriefingButton hasBriefing={Boolean(briefing)} />
      </div>
    </main>
  );
}
