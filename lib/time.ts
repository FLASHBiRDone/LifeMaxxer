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
