import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { osloDayBounds } from '@/lib/time';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const MAX_BODY_BYTES = 4 * 1024;

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

  if (!verifyDispenseKey(request.headers.get('x-dispense-key'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Hard cap on request body. The legitimate payload is well under
  // a kilobyte (a small JSON with up to ~8 UUIDs); anything larger
  // is either a buggy client or a probe.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body too large' }, { status: 413 });
  }
  let body: any;
  try { body = JSON.parse(raw || '{}'); } catch { body = {}; }

  const success = Boolean(body.success);
  const failureReason =
    typeof body.failure_reason === 'string'
      ? body.failure_reason.slice(0, 200)
      : null;
  const dispensedIds: string[] = Array.isArray(body.dispensed_supplement_ids)
    ? body.dispensed_supplement_ids.filter((x: unknown) => typeof x === 'string')
    : [];

  const admin = createAdminClient();

  // Atomic claim: flip status from 'pending' to the terminal state in
  // a single statement so a concurrent retry can't pass the gate
  // twice. If the update returns no row, another caller already
  // confirmed this event — we just acknowledge without re-running
  // the ledger inserts.
  const claimStatus = success ? 'dispensed' : 'failed';
  const { data: claimed } = await admin
    .from('dispense_events')
    .update({
      status: claimStatus,
      confirmed_at: new Date().toISOString(),
      ...(failureReason ? { failure_reason: failureReason } : {}),
    })
    .eq('id', eventId)
    .eq('status', 'pending')
    .select('id, user_id, items')
    .maybeSingle();

  if (!claimed) {
    // Either the event doesn't exist, or it's already in a terminal
    // state. Distinguish via a follow-up read so the hopper gets a
    // sensible status code.
    const { data: row } = await admin
      .from('dispense_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();
    if (!row) {
      return NextResponse.json({ error: 'event not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'event already confirmed' },
      { status: 409 },
    );
  }

  if (!success) {
    return NextResponse.json({ ok: true, logged: 0 });
  }

  const userId = (claimed as any).user_id as string;
  const items = ((claimed as any).items as any[]) ?? [];

  const toLog = dispensedIds.length > 0
    ? items.filter((it) => dispensedIds.includes(it.supplement_id))
    : items;

  const { dateString } = osloDayBounds();

  let logged = 0;
  for (const it of toLog) {
    // The unique index on (supplement_id, logged_for, slot) is the
    // real backstop. Probing first just avoids a 23505 in the logs.
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

  return NextResponse.json({ ok: true, logged });
}

/**
 * Constant-time comparison of the shared API key. `!==` would short-
 * circuit on the first byte mismatch and leak the position via
 * timing — small effect over the public internet but trivially
 * fixable, and the hopper has a stable network path that makes
 * side-channel attacks more practical than usual.
 */
function verifyDispenseKey(provided: string | null): boolean {
  const expected = serverEnv.SUPPLEMENT_DISPENSER_API_KEY;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
