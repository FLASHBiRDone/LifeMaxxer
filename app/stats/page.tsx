import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { LevelCard } from '@/components/stats/level-card';
import { StreaksList, type StreakRow } from '@/components/stats/streaks';
import { Heatmap, type HeatmapDay } from '@/components/stats/heatmap';
import { WeeklyTrend, type WeekPoint } from '@/components/stats/weekly-trend';

export const dynamic = 'force-dynamic';

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeStreak(logged: Set<string>, today: string): { current: number; best: number } {
  let current = 0;
  let cursor = today;
  if (!logged.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!logged.has(cursor)) {
      return { current: 0, best: bestStreak(logged) };
    }
  }
  while (logged.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best: Math.max(current, bestStreak(logged)) };
}

function bestStreak(logged: Set<string>): number {
  const sorted = [...logged].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev && addDays(prev, 1) === d) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString: today } = osloDayBounds();
  const from90 = addDays(today, -89);
  const from30 = addDays(today, -29);

  const [
    { data: habits },
    { data: habitLogs },
    { data: quests },
  ] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('habit_logs')
      .select('habit_id, logged_for')
      .eq('user_id', user.id)
      .gte('logged_for', from90),
    supabase
      .from('quests')
      .select('id, scheduled_for, completed_at, is_main')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('scheduled_for', from90),
  ]);

  const habitsList = (habits as any[]) ?? [];
  const logsList = (habitLogs as any[]) ?? [];
  const questsList = (quests as any[]) ?? [];

  // ── XP / Level
  const totalHabits = logsList.length;
  const totalQuests = questsList.length;
  const mainQuests = questsList.filter((q) => q.is_main).length;
  const xp = totalHabits * 1 + totalQuests * 5 + mainQuests * 5; // main already counted as 5, +5 bonus = 10

  // ── Streaks per habit
  const logsByHabit = new Map<string, Set<string>>();
  for (const l of logsList) {
    if (!logsByHabit.has(l.habit_id)) logsByHabit.set(l.habit_id, new Set());
    logsByHabit.get(l.habit_id)!.add(l.logged_for);
  }
  const streaks: StreakRow[] = habitsList.map((h) => {
    const { current, best } = computeStreak(logsByHabit.get(h.id) ?? new Set(), today);
    return { id: h.id, name: h.name, current, best };
  });

  // ── 30-day heatmap (habit logs + completed quests per day)
  const activityByDay = new Map<string, number>();
  for (const l of logsList) {
    if (l.logged_for >= from30) {
      activityByDay.set(l.logged_for, (activityByDay.get(l.logged_for) ?? 0) + 1);
    }
  }
  for (const q of questsList) {
    if (q.scheduled_for && q.scheduled_for >= from30) {
      activityByDay.set(q.scheduled_for, (activityByDay.get(q.scheduled_for) ?? 0) + 1);
    }
  }
  const heatmapDays: HeatmapDay[] = [];
  for (let i = 0; i < 30; i++) {
    const ds = addDays(from30, i);
    heatmapDays.push({ dateString: ds, count: activityByDay.get(ds) ?? 0 });
  }
  const maxCount = Math.max(1, ...heatmapDays.map((d) => d.count));

  // ── Weekly trend: last 4 weeks (Mon-Sun)
  const weeks: WeekPoint[] = [];
  const todayDate = new Date(today + 'T00:00:00');
  const dow = todayDate.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = addDays(today, -daysFromMonday);

  for (let w = 3; w >= 0; w--) {
    const weekStart = addDays(thisMonday, -7 * w);
    const weekEnd = addDays(weekStart, 6);
    let done = 0;
    for (const l of logsList) {
      if (l.logged_for >= weekStart && l.logged_for <= weekEnd) done++;
    }
    // Only count elapsed days in the current week
    const lastDay = w === 0 ? today : weekEnd;
    const daysInWindow = Math.min(7, daysElapsedBetween(weekStart, lastDay));
    const total = Math.max(1, habitsList.length * daysInWindow);
    const pct = Math.min(100, Math.round((done / total) * 100));
    const label = w === 0 ? 'Nå' : `-${w}u`;
    weeks.push({ label, pct, done, total });
  }

  return (
    <main className="container max-w-xl py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Statistikk</h1>
        <p className="text-xs text-muted-foreground mt-1">Dine fremgang og streaks</p>
      </div>

      <LevelCard
        xp={xp}
        totalHabits={totalHabits}
        totalQuests={totalQuests}
        mainQuests={mainQuests}
      />

      <WeeklyTrend weeks={weeks} />

      <Heatmap days={heatmapDays} maxCount={maxCount} todayString={today} />

      <StreaksList streaks={streaks} />
    </main>
  );
}

function daysElapsedBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  return Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}
