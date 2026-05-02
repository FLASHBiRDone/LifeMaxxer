import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/push';
import { osloDayBounds } from '@/lib/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Slot = 'morning' | 'noon' | 'evening' | 'night';

/**
 * Cron entry: every 30 minutes, look for users who have supplements
 * scheduled in a slot that's *currently late* (past its window end +
 * 30min) and not yet logged. Send one push reminder per (user, slot)
 * per day so users aren't nagged repeatedly.
 *
 * Slot windows match /api/dispense and the today card:
 *   morning 05:00–10:59  → reminds at 11:00
 *   noon    11:00–14:59  → reminds at 15:00
 *   evening 15:00–20:59  → reminds at 21:00
 *   night   21:00–04:59  → reminds at 05:00 (next day, light nag)
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Determine which slot just ended within the last 30 minutes — the
  // cron runs every 30min but slot ends are fixed, so the window is
  // tight. If we're not at a slot boundary, exit early.
  const oslohour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Oslo',
    }).format(new Date()),
  );
  const oslomin = Number(
    new Intl.DateTimeFormat('en-GB', {
      minute: '2-digit',
      timeZone: 'Europe/Oslo',
    }).format(new Date()),
  );
  // Trigger on the first half of the hour the slot ends (11:00–11:29
  // for morning, etc.). This way a 30-min cron always hits exactly
  // once per slot per day.
  const endedSlot = endedSlotFor(oslohour, oslomin);
  if (!endedSlot) return NextResponse.json({ ok: true, skipped: 'no slot ended' });

  const { dateString, dayOfWeek: _dow } = osloDayBounds();
  const dow = new Date(dateString + 'T00:00:00').getDay();

  // Pull all active supplements due in this slot today.
  const { data: supplements } = await admin
    .from('supplements')
    .select('id, user_id, name, slots, schedule_days')
    .eq('archived', false);

  const dueByUser = new Map<string, { id: string; name: string }[]>();
  for (const s of (supplements as any[]) ?? []) {
    if (!s.slots?.includes(endedSlot)) continue;
    const days = s.schedule_days ?? [];
    if (Array.isArray(days) && days.length > 0 && !days.includes(dow)) continue;
    const arr = dueByUser.get(s.user_id) ?? [];
    arr.push({ id: s.id, name: s.name });
    dueByUser.set(s.user_id, arr);
  }
  if (dueByUser.size === 0) {
    return NextResponse.json({ ok: true, slot: endedSlot, reminded: 0 });
  }

  // Pull all logs for this slot today across these users.
  const userIds = [...dueByUser.keys()];
  const { data: logs } = await admin
    .from('supplement_logs')
    .select('user_id, supplement_id')
    .eq('logged_for', dateString)
    .eq('slot', endedSlot)
    .in('user_id', userIds);
  const takenByUser = new Map<string, Set<string>>();
  for (const l of (logs as any[]) ?? []) {
    const s = takenByUser.get(l.user_id) ?? new Set<string>();
    s.add(l.supplement_id);
    takenByUser.set(l.user_id, s);
  }

  let reminded = 0;
  for (const [userId, items] of dueByUser) {
    const taken = takenByUser.get(userId) ?? new Set();
    const missed = items.filter((it) => !taken.has(it.id));
    if (missed.length === 0) continue;

    const { data: settings } = await admin
      .from('user_settings')
      .select('push_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (!(settings as any)?.push_enabled) continue;

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', userId);

    const slotLabel = NB_SLOT_LABEL[endedSlot];
    const title =
      missed.length === 1
        ? `${missed[0].name} venter`
        : `${missed.length} tilskudd venter`;
    const body =
      missed.length <= 3
        ? `${slotLabel}: ${missed.map((m) => m.name).join(', ')}`
        : `${slotLabel}: ${missed.slice(0, 2).map((m) => m.name).join(', ')} + ${missed.length - 2} til`;

    for (const s of (subs as any[]) ?? []) {
      try {
        await sendPush(
          { endpoint: s.endpoint, keys: s.keys },
          { title, body, url: '/today', tag: `supplement-${endedSlot}` },
        );
      } catch (err) {
        console.error('[supplement-reminders] push failed', s.endpoint, err);
      }
    }
    reminded++;
  }

  return NextResponse.json({ ok: true, slot: endedSlot, reminded });
}

const NB_SLOT_LABEL: Record<Slot, string> = {
  morning: 'Morgen',
  noon: 'Lunsj',
  evening: 'Kveld',
  night: 'Natt',
};

function endedSlotFor(hour: number, minute: number): Slot | null {
  // The cron fires on the half hour. We want exactly ONE trigger per
  // slot per day: at the top of the hour the slot ends.
  if (minute >= 30) return null;
  if (hour === 11) return 'morning';
  if (hour === 15) return 'noon';
  if (hour === 21) return 'evening';
  if (hour === 5) return 'night';
  return null;
}
