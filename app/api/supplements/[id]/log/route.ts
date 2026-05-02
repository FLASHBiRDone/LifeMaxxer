import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

const SLOTS = ['morning', 'noon', 'evening', 'night'] as const;

const bodySchema = z.object({
  slot: z.enum(SLOTS),
  taken_at: z.string().datetime().optional(),
});

/**
 * Log one supplement intake. Idempotent on (supplement_id, logged_for, slot)
 * — repeated taps for the same slot return the existing row instead of
 * stacking duplicate XP awards. The dispenser confirm path uses the
 * same endpoint with source='dispenser'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: supplementId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: supplement, error: lookupErr } = await supabase
    .from('supplements')
    .select('id, name, slots, xp_reward, token_reward, household_id')
    .eq('id', supplementId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!supplement) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const supp = supplement as any;
  if (!supp.slots?.includes(parsed.data.slot)) {
    return NextResponse.json(
      { error: 'slot not part of this supplement' },
      { status: 400 },
    );
  }

  const { dateString } = osloDayBounds();
  const xp = supp.xp_reward ?? 0;
  const tokens = supp.token_reward ?? 0;

  // Insert the log; on conflict the unique index returns the existing
  // row so we can detect "already taken" without a separate read.
  const { data: existing } = await supabase
    .from('supplement_logs')
    .select('id')
    .eq('supplement_id', supplementId)
    .eq('logged_for', dateString)
    .eq('slot', parsed.data.slot)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      log: existing,
      already_logged: true,
    });
  }

  const { data: log, error: logErr } = await supabase
    .from('supplement_logs')
    .insert({
      supplement_id: supplementId,
      user_id: user.id,
      logged_for: dateString,
      slot: parsed.data.slot,
      source: 'manual',
      taken_at: parsed.data.taken_at ?? new Date().toISOString(),
      xp_awarded: xp,
      tokens_awarded: tokens,
    })
    .select()
    .single();

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  // Push XP + tokens through the standard ledgers so the balance
  // helper picks them up without a parallel calc. Both ledgers
  // require household_id; if the user isn't in a household yet we
  // skip the ledger writes — the supplement_logs row still records
  // the intake and we can backfill once a household is created.
  if (supp.household_id) {
    const note = `Tilskudd: ${supp.name} (${parsed.data.slot})`;
    if (xp > 0) {
      await supabase.from('xp_adjustments').insert({
        user_id: user.id,
        household_id: supp.household_id,
        delta: xp,
        source: 'supplement',
        note,
      });
    }
    if (tokens > 0) {
      await supabase.from('token_transactions').insert({
        user_id: user.id,
        household_id: supp.household_id,
        delta: tokens,
        source: 'supplement',
        note,
      });
    }
  }

  return NextResponse.json({ ok: true, log, already_logged: false });
}

/**
 * Undo a recent log (within the same calendar day). Removes the log
 * row and the corresponding ledger entries.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: supplementId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const slot = url.searchParams.get('slot');
  if (!slot || !SLOTS.includes(slot as any)) {
    return NextResponse.json({ error: 'slot required' }, { status: 400 });
  }

  const { dateString } = osloDayBounds();

  const { data: log } = await supabase
    .from('supplement_logs')
    .select('id, xp_awarded, tokens_awarded')
    .eq('supplement_id', supplementId)
    .eq('user_id', user.id)
    .eq('logged_for', dateString)
    .eq('slot', slot)
    .maybeSingle();
  if (!log) return NextResponse.json({ ok: true });

  await supabase.from('supplement_logs').delete().eq('id', (log as any).id);

  // Reverse the ledger entries — write a counter-delta rather than
  // deleting so the audit trail stays intact.
  const { data: supp } = await supabase
    .from('supplements')
    .select('name, household_id')
    .eq('id', supplementId)
    .maybeSingle();
  if (supp && (supp as any).household_id) {
    const note = `Angret tilskudd: ${(supp as any).name} (${slot})`;
    const xp = (log as any).xp_awarded ?? 0;
    const tokens = (log as any).tokens_awarded ?? 0;
    if (xp > 0) {
      await supabase.from('xp_adjustments').insert({
        user_id: user.id,
        household_id: (supp as any).household_id,
        delta: -xp,
        source: 'supplement',
        note,
      });
    }
    if (tokens > 0) {
      await supabase.from('token_transactions').insert({
        user_id: user.id,
        household_id: (supp as any).household_id,
        delta: -tokens,
        source: 'supplement',
        note,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
