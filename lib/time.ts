import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

export const OSLO = 'Europe/Oslo';

export function osloDayBounds(reference: Date = new Date(), tz = OSLO) {
  const zoned = toZonedTime(reference, tz);
  const y = zoned.getFullYear();
  const m = zoned.getMonth();
  const d = zoned.getDate();
  const startLocal = new Date(y, m, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m, d + 1, 0, 0, 0, 0);
  return {
    start: fromZonedTime(startLocal, tz),
    end: fromZonedTime(endLocal, tz),
    dateString: format(zoned, 'yyyy-MM-dd'),
    dayOfWeek: format(zoned, 'EEEE', { timeZone: tz }),
  };
}

export function osloWeekDays(reference: Date = new Date(), tz = OSLO) {
  const zoned = toZonedTime(reference, tz);
  const dow = zoned.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const shifted = new Date(zoned);
    shifted.setDate(zoned.getDate() - daysFromMonday + i);
    const y = shifted.getFullYear();
    const mo = shifted.getMonth();
    const d = shifted.getDate();
    return {
      dateString: format(shifted, 'yyyy-MM-dd'),
      dayShort: format(shifted, 'EEE', { timeZone: tz }),
      dayNum: d,
      start: fromZonedTime(new Date(y, mo, d, 0, 0, 0, 0), tz),
      end: fromZonedTime(new Date(y, mo, d + 1, 0, 0, 0, 0), tz),
    };
  });
}

/**
 * Build a UTC Date for a specific Oslo wall-clock time on a yyyy-MM-dd date.
 * DST-safe via date-fns-tz.
 */
export function osloDateAt(
  dateString: string,
  hour: number,
  minute = 0,
  tz = OSLO,
): Date {
  const [y, mo, d] = dateString.split('-').map(Number);
  return fromZonedTime(new Date(y, mo - 1, d, hour, minute, 0, 0), tz);
}

/**
 * The 7-day window a newly-generated meal plan should be scheduled over.
 * Mon–Wed: use this week's Mon–Sun. Thu–Sun: use next week's Mon–Sun.
 * Always returns 7 consecutive days starting on a Monday.
 */
export function mealPlanWeek(reference: Date = new Date(), tz = OSLO) {
  const zoned = toZonedTime(reference, tz);
  const dow = zoned.getDay(); // 0=Sun, 1=Mon..6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const useNextWeek = dow === 0 || dow >= 4;
  const startOffset = useNextWeek ? 7 - daysFromMonday : -daysFromMonday;
  return Array.from({ length: 7 }, (_, i) => {
    const shifted = new Date(zoned);
    shifted.setDate(zoned.getDate() + startOffset + i);
    return format(shifted, 'yyyy-MM-dd');
  });
}

/**
 * Given the date a plan was generated, return today's index within the
 * 7-day window the plan was scheduled over. Returns null if today falls
 * outside the plan window (plan not started yet, or window has passed).
 */
export function todayPlanIndex(
  planCreatedAt: Date | string,
  planLength: number,
  tz = OSLO,
): number | null {
  const ref = typeof planCreatedAt === 'string' ? new Date(planCreatedAt) : planCreatedAt;
  const window = mealPlanWeek(ref, tz);
  const { dateString } = osloDayBounds(new Date(), tz);
  const idx = window.indexOf(dateString);
  if (idx < 0 || idx >= planLength) return null;
  return idx;
}
