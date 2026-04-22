import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addMealPlanToCalendar } from '@/lib/meal-calendar';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('content')
    .eq('user_id', user.id)
    .eq('context_type', 'meal_plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planRow?.content) {
    return NextResponse.json({ error: 'Ingen plan funnet' }, { status: 404 });
  }

  let plan: any;
  try {
    plan = JSON.parse(planRow.content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }

  const result = await addMealPlanToCalendar(supabase, user.id, plan);
  return NextResponse.json({ calendar: result });
}
