import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Phase 1 wires up Google Calendar incremental sync.
  return NextResponse.json({ ok: true, phase: 0 });
}
