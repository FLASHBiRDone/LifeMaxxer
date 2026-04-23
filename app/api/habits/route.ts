import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name,
    kind,
    target_frequency,
    target_value,
    color,
    schedule_days,
    grace_days,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Validate schedule shape: array of weekday numbers 0..6
  let scheduleArr: number[] = [];
  if (Array.isArray(schedule_days)) {
    for (const n of schedule_days) {
      if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6) {
        if (!scheduleArr.includes(n)) scheduleArr.push(n);
      }
    }
  }
  // grace_days: clamp to 0..14
  let grace = 0;
  if (typeof grace_days === 'number' && Number.isInteger(grace_days)) {
    grace = Math.max(0, Math.min(14, grace_days));
  }

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: user.id,
      name: name.trim(),
      kind: kind ?? 'do',
      target_frequency: target_frequency ?? 'daily',
      target_value: target_value ?? null,
      color: color ?? 'emerald',
      archived: false,
      schedule_days: scheduleArr,
      grace_days: grace,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
