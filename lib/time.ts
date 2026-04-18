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
