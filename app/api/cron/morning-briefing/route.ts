import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Phase 1 will implement:
  //   - fetch users with morning_briefing_enabled = true
  //   - pull today's calendar events
  //   - call Claude Haiku via MORNING_BRIEFING_V1
  //   - send web push + store ai_messages row
  return NextResponse.json({ ok: true, phase: 0 });
}
