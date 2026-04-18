import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Phase 4 wires this up.
  return NextResponse.json({ ok: true, phase: 0 });
}
