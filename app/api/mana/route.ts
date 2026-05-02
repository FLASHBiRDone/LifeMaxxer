import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';

const LEVELS = ['low', 'medium', 'high'] as const;
const levelSchema = z.enum(LEVELS);

const bodySchema = z.object({
  level: levelSchema.optional(),
  rested: levelSchema.optional(),
  focus: levelSchema.optional(),
  extra_note: z.string().trim().max(1000).optional().nullable(),
  logged_for: z.string().optional(),
});

/**
 * Daily morning check-in. The /today multi-step flow calls this once
 * per question, so the body is partial — only the column being set is
 * sent. Server upserts on (user_id, logged_for) and only updates the
 * provided columns, leaving others untouched. That way step 1 doesn't
 * wipe step 2's answer when the user steps back to change something.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const loggedFor = parsed.data.logged_for ?? osloDayBounds().dateString;

  // Build the row only with provided fields. Postgres upsert needs all
  // PK columns plus whatever is being set — we deliberately skip
  // omitted columns so a "set focus" call doesn't reset the energy
  // value the user picked in step 1.
  const row: Record<string, unknown> = {
    user_id: user.id,
    logged_for: loggedFor,
  };
  if (parsed.data.level !== undefined) row.level = parsed.data.level;
  if (parsed.data.rested !== undefined) row.rested = parsed.data.rested;
  if (parsed.data.focus !== undefined) row.focus = parsed.data.focus;
  if (parsed.data.extra_note !== undefined) {
    row.extra_note = parsed.data.extra_note ?? null;
  }

  // mana_logs requires `level` not null at insert. If this is the
  // first save of the day and the user didn't pick energy yet, the
  // upsert will fail. Default to 'medium' as a placeholder so the
  // step that sets `rested` first still works — they'll overwrite
  // `level` in the next step.
  if (row.level === undefined) {
    const { data: existing } = await supabase
      .from('mana_logs')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('logged_for', loggedFor)
      .maybeSingle();
    if (!existing) row.level = 'medium';
  }

  const { error } = await supabase.from('mana_logs').upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
