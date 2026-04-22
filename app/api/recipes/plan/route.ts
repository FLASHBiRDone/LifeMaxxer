import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateMealPlan } from '@/lib/meal-plan';
import { addMealPlanToCalendar } from '@/lib/meal-calendar';
import { ALLERGENS } from '@/lib/allergens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  people: z.number().int().min(1).max(12),
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
      allergens: parsed.data.allergens,
      diet: parsed.data.diet,
      notes: parsed.data.notes,
    });

    const record = {
      params: { ...parsed.data, locale },
      days: result.output.days,
    };

    await supabase.from('ai_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: JSON.stringify(record),
      context_type: 'meal_plan',
      prompt_version: result.promptVersion,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
    });

    const calendar = await addMealPlanToCalendar(supabase, user.id, record);

    return NextResponse.json({ plan: record, calendar });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
