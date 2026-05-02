import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { osloDayBounds } from '@/lib/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hardware dispenser entry point. Called by the hopper firmware after
 * the user activates a profile trigger (NFC card, phone NFC, button).
 *
 * Contract
 * --------
 * Request:
 *   POST /api/dispense
 *   Headers: x-dispense-key: <SUPPLEMENT_DISPENSER_API_KEY>
 *   Body:    { token: string, kind: 'nfc_card' | 'phone_nfc' | 'button' }
 *
 *   `token` is the raw NFC UID or button identifier the hardware
 *   read. The server hashes it (sha256 hex) and looks up the matching
 *   row in `dispense_tokens` to find the user.
 *
 * Response:
 *   200 { event_id, items: [{ supplement_id, name, dose, slot }] }
 *     The hopper reads `items` and actuates accordingly. After it's
 *     physically dispensed, it MUST POST /api/dispense/{event_id}/confirm
 *     to mark the event done and award XP. Failure to confirm leaves
 *     the event in `pending` (the user gets no XP — important: never
 *     award credit for pills the firmware didn't physically deliver).
 *   404 { error: 'unknown token' } — token not registered to any user
 *   401 { error: 'unauthorized' } — missing or wrong API key
 *   409 { error: 'no items due' } — user has nothing pending in the
 *     current slot. Hopper should buzz a confirmation tone but not
 *     actuate the motor.
 *
 * Time-of-day → slot mapping is the same one the today card uses:
 *   05:00–10:59 = morning
 *   11:00–14:59 = noon
 *   15:00–20:59 = evening
 *   21:00–04:59 = night
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-dispense-key');
  const expected = process.env.SUPPLEMENT_DISPENSER_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : null;
  const kind = body.kind;
  if (!token || !['nfc_card', 'phone_nfc', 'button'].includes(kind)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from('dispense_tokens')
    .select('user_id, kind')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: 'unknown token' }, { status: 404 });
  }
  const userId = (tokenRow as any).user_id as string;

  const { dateString } = osloDayBounds();
  const slot = currentSlot();

  const { data: supplements } = await admin
    .from('supplements')
    .select('id, name, dose, slots, schedule_days, xp_reward, token_reward')
    .eq('user_id', userId)
    .eq('archived', false);

  const today = new Date();
  const dow = today.getDay(); // 0=Sun..6=Sat
  const due = ((supplements as any[]) ?? []).filter((s) => {
    if (!s.slots?.includes(slot)) return false;
    const days = s.schedule_days ?? [];
    if (Array.isArray(days) && days.length > 0 && !days.includes(dow)) return false;
    return true;
  });

  if (due.length === 0) {
    return NextResponse.json({ error: 'no items due' }, { status: 409 });
  }

  // Filter out items already taken this slot — the hopper shouldn't
  // dispense magnesium twice if the user tapped the manual button
  // first then scanned their NFC card.
  const ids = due.map((s) => s.id);
  const { data: alreadyLogged } = await admin
    .from('supplement_logs')
    .select('supplement_id')
    .eq('user_id', userId)
    .eq('logged_for', dateString)
    .eq('slot', slot)
    .in('supplement_id', ids);
  const taken = new Set(((alreadyLogged as any[]) ?? []).map((r) => r.supplement_id));
  const remaining = due.filter((s) => !taken.has(s.id));

  if (remaining.length === 0) {
    return NextResponse.json({ error: 'no items due' }, { status: 409 });
  }

  const items = remaining.map((s) => ({
    supplement_id: s.id,
    name: s.name,
    dose: s.dose,
    slot,
    xp_reward: s.xp_reward,
    token_reward: s.token_reward,
  }));

  const { data: event, error: eventErr } = await admin
    .from('dispense_events')
    .insert({
      user_id: userId,
      trigger_kind: kind,
      items,
      status: 'pending',
    })
    .select('id')
    .single();
  if (eventErr) {
    return NextResponse.json({ error: eventErr.message }, { status: 500 });
  }

  await admin
    .from('dispense_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  return NextResponse.json({
    event_id: (event as any).id,
    slot,
    items,
  });
}

function currentSlot(): 'morning' | 'noon' | 'evening' | 'night' {
  // Use Oslo wall-clock so the slot matches what the user sees on /today.
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Oslo',
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'noon';
  if (hour >= 15 && hour < 21) return 'evening';
  return 'night';
}
