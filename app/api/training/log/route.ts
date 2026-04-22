import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planMessageId: z.string().uuid().nullable(),
  dayIndex: z.number().int().min(0).max(6),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { error } = await supabase.from('training_logs').insert({
    user_id: user.id,
    plan_message_id: parsed.data.planMessageId,
    day_index: parsed.data.dayIndex,
    notes: parsed.data.notes ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror the completion onto the linked "Trening" habit so it shows up
  // on the today page / habit grid. Silently skip if nothing to mirror.
  let habitMirrored = false;
  const { data: prefs } = await supabase
    .from('training_preferences')
    .select('training_habit_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const habitId = (prefs as any)?.training_habit_id as string | null;
  if (habitId) {
    const { dateString } = osloDayBounds();
    const { data: existing } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habitId)
      .eq('logged_for', dateString)
      .maybeSingle();
    if (!existing) {
      const { error: habitErr } = await supabase.from('habit_logs').insert({
        user_id: user.id,
        habit_id: habitId,
        logged_for: dateString,
      });
      if (!habitErr) habitMirrored = true;
    } else {
      habitMirrored = true;
    }
  }

  return NextResponse.json({ ok: true, habitMirrored });
}
