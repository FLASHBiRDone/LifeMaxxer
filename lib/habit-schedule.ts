import { osloDayBounds } from '@/lib/time';

export type HabitWithSchedule = {
  id: string;
  name: string;
  color: string | null;
  schedule_days: number[] | null;
  grace_days: number | null;
  created_at?: string;
};

export type HabitLog = { habit_id: string; logged_for: string };

/**
 * Empty/null schedule_days means "daily" (due every day). Otherwise
 * the array lists the weekday numbers (0=Sunday..6=Saturday) the
 * habit is due on.
 */
export function isHabitScheduledOn(
  habit: HabitWithSchedule,
  weekday: number,
): boolean {
  const days = habit.schedule_days;
  if (!days || days.length === 0) return true;
  return days.includes(weekday);
}

/**
 * yyyy-MM-dd in Oslo time for a date offset by `delta` days from today.
 * Negative = past, 0 = today.
 */
function osloDateStringOffset(delta: number): string {
  const ref = new Date();
  ref.setUTCDate(ref.getUTCDate() + delta);
  return osloDayBounds(ref).dateString;
}

function osloWeekday(delta: number): number {
  const ref = new Date();
  ref.setUTCDate(ref.getUTCDate() + delta);
  // Use Oslo timezone via toLocaleString trick — date-fns-tz could too,
  // but for "what day of week is this" the offset rarely matters at
  // midnight UTC vs Oslo. Safe enough for grace-period bookkeeping.
  const oslo = new Date(ref.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  return oslo.getDay();
}

/**
 * Decide whether to show this habit on /today. Show when:
 *  - today is a scheduled weekday, OR
 *  - within the last `grace_days` days, the habit had a scheduled
 *    weekday it was created on/before AND no log for that day.
 */
export function shouldShowHabitToday(
  habit: HabitWithSchedule,
  todayWeekday: number,
  recentLogs: HabitLog[],
): boolean {
  if (isHabitScheduledOn(habit, todayWeekday)) return true;

  const grace = habit.grace_days ?? 0;
  if (grace <= 0) return false;

  const created = habit.created_at ? new Date(habit.created_at) : null;
  for (let d = 1; d <= grace; d++) {
    const dow = osloWeekday(-d);
    if (!isHabitScheduledOn(habit, dow)) continue;
    const dateStr = osloDateStringOffset(-d);
    if (created && new Date(dateStr + 'T23:59:59') < created) continue;
    const logged = recentLogs.some(
      (l) => l.habit_id === habit.id && l.logged_for === dateStr,
    );
    if (!logged) return true;
  }
  return false;
}

/**
 * Filter a list of habits to those visible on today's home page.
 * `recentLogs` should include at least the past max-grace-days.
 */
export function filterHabitsForToday(
  habits: HabitWithSchedule[],
  recentLogs: HabitLog[],
): HabitWithSchedule[] {
  const todayDow = osloWeekday(0);
  return habits.filter((h) => shouldShowHabitToday(h, todayDow, recentLogs));
}
