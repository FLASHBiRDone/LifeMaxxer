import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runMorningBriefingFor } from '@/lib/jobs/morning-briefing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Developer-triggered briefing run for the currently signed-in user.
 * Useful in Phase 1 to test the flow without waiting for 07:30.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runMorningBriefingFor(user.id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
