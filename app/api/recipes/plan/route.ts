import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateMealPlan } from '@/lib/meal-plan';
import { addMealPlanToCalendar } from '@/lib/meal-calendar';
import { deletePlanEvents } from '@/lib/calendar-cleanup';
import { ALLERGENS } from '@/lib/allergens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  people: z.number().int().min(1).max(12),
  days: z.number().int().min(1).max(7).default(7),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diet: z.enum(['any', 'vegetarian', 'vegan', 'pescatarian']).default('any'),
  notes: z.string().max(500).default(''),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid request' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('locale')
    .eq('id', user.id)
    .maybeSingle();
  const locale = ((profile as any)?.locale ?? 'nb') as 'nb' | 'en';

  try {
    const result = await generateMealPlan({
      locale,
      people: parsed.data.people,
      days: parsed.data.days,
      allergens: parsed.data.allergens,
      diet: parsed.data.diet,
      notes: parsed.data.notes,
    });

    const record = {
      params: { ...parsed.data, locale },
      days: result.output.days,
    };

    const { data: msg, error: insertError } = await supabase
      .from('ai_messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: JSON.stringify(record),
        context_type: 'meal_plan',
        prompt_version: result.promptVersion,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: result.costUsd,
      })
      .select('id, created_at')
      .single();
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const messageId = (msg as any).id as string;

    // Wipe events from previous meal plans so we don't pile duplicates
    // onto the same day(s) on the LifeMaxxing calendar.
    try {
      await deletePlanEvents(supabase, user.id, 'meal_plan', messageId);
    } catch (err) {
      console.error('[meal-plan] cleanup of previous events failed', err);
    }

    const calendar = await addMealPlanToCalendar(supabase, user.id, record);

    // Persist calendar mapping so later day-swaps can patch/delete events
    if (calendar.status === 'added') {
      await supabase
        .from('ai_messages')
        .update({
          metadata: {
            calendarId: calendar.calendarId,
            byDay: calendar.byDay,
          },
        })
        .eq('id', messageId);
    }

    return NextResponse.json({
      plan: record,
      messageId,
      createdAt: (msg as any).created_at,
      calendar,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
