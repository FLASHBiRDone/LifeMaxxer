import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
  if (text.length > 200) {
    return NextResponse.json({ error: 'text too long' }, { status: 400 });
  }

  try {
    const householdId = await getOrCreateHouseholdId(supabase, user.id);
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        household_id: householdId,
        added_by: user.id,
        freeform_text: text,
      })
      .select('id, freeform_text, checked, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
