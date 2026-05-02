import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { osloDayBounds } from '@/lib/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hardware confirmation callback. The hopper calls this AFTER the
 * physical dispense completes — successfully or not. Awards XP +
 * tokens for confirmed items only; no credit for failed actuations.
 *
 * Contract
 * --------
 * Request:
 *   POST /api/dispense/{event_id}/confirm
 *   Headers: x-dispense-key: <SUPPLEMENT_DISPENSER_API_KEY>
 *   Body:
 *     {
 *       success: boolean,
 *       dispensed_supplement_ids?: string[]   // partial-success aware
 *       failure_reason?: string
 *     }
 *
 * Response:
 *   200 { ok: true, logged: number }  // count of supplement_logs inserted
 *   404 { error: 'event not found' }
 *   401 { error: 'unauthorized' }
 *   409 { error: 'event already confirmed' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;

  const apiKey = request.headers.get('x-dispense-key');
  const expected = process.env.SUPPLEMENT_DISPENSER_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const success = Boolean(body.success);
  const failureReason =
    typeof body.failure_reason === 'string'
      ? body.failure_reason.slice(0, 200)
      : null;
  const dispensedIds: string[] = Array.isArray(body.dispensed_supplement_ids)
    ? body.dispensed_supplement_ids.filter((x: unknown) => typeof x === 'string')
    : [];

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('dispense_events')
    .select('id, user_id, status, items')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'event not found' }, { status: 404 });
  if ((event as any).status !== 'pending') {
    return NextResponse.json(
      { error: 'event already confirmed' },
      { status: 409 },
    );
  }

  const userId = (event as any).user_id as string;
  const items = ((event as any).items as any[]) ?? [];

  if (!success) {
    await admin
      .from('dispense_events')
      .update({
        status: 'failed',
        failure_reason: failureReason,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    return NextResponse.json({ ok: true, logged: 0 });
  }

  // Filter to actually-dispensed items if the firmware reports a
  // partial dispense; default to all items if it didn't say.
  const toLog = dispensedIds.length > 0
    ? items.filter((it) => dispensedIds.includes(it.supplement_id))
    : items;

  const { dateString } = osloDayBounds();

  let logged = 0;
  for (const it of toLog) {
    // Skip duplicates — the unique index on (supplement_id, logged_for, slot)
    // would also catch this, but probing first avoids a 23505 error log.
    const { data: existing } = await admin
      .from('supplement_logs')
      .select('id')
      .eq('supplement_id', it.supplement_id)
      .eq('logged_for', dateString)
      .eq('slot', it.slot)
      .maybeSingle();
    if (existing) continue;

    const { error: logErr } = await admin
      .from('supplement_logs')
      .insert({
        supplement_id: it.supplement_id,
        user_id: userId,
        logged_for: dateString,
        slot: it.slot,
        source: 'dispenser',
        taken_at: new Date().toISOString(),
        xp_awarded: it.xp_reward ?? 0,
        tokens_awarded: it.token_reward ?? 0,
        dispense_event_id: eventId,
      });
    if (logErr) continue;
    logged++;

    const { data: supp } = await admin
      .from('supplements')
      .select('name, household_id')
      .eq('id', it.supplement_id)
      .maybeSingle();
    if (supp && (supp as any).household_id) {
      const note = `Tilskudd (dispenser): ${(supp as any).name} (${it.slot})`;
      if ((it.xp_reward ?? 0) > 0) {
        await admin.from('xp_adjustments').insert({
          user_id: userId,
          household_id: (supp as any).household_id,
          delta: it.xp_reward,
          source: 'supplement',
          note,
        });
      }
      if ((it.token_reward ?? 0) > 0) {
        await admin.from('token_transactions').insert({
          user_id: userId,
          household_id: (supp as any).household_id,
          delta: it.token_reward,
          source: 'supplement',
          note,
        });
      }
    }
  }

  await admin
    .from('dispense_events')
    .update({
      status: 'dispensed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  return NextResponse.json({ ok: true, logged });
}
