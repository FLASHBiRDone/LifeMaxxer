import { serverEnv } from '@/lib/env';

/**
 * Guards Vercel Cron endpoints. Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * automatically when a cron path is configured in vercel.json.
 */
export function isAuthorizedCron(request: Request): boolean {
  if (!serverEnv.CRON_SECRET) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${serverEnv.CRON_SECRET}`;
}
