import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

type Ingredient = { name: string; amount: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ingredients: Ingredient[] = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'ingredients required' }, { status: 400 });
  }

  try {
    const householdId = await getOrCreateHouseholdId(supabase, user.id);

    // Merge duplicates by normalized name — summing would need unit parsing;
    // simpler: take the larger mention by appearing once per unique name.
    const seen = new Map<string, string>();
    for (const ing of ingredients) {
      const key = ing.name.trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.set(key, `${ing.amount} ${ing.name}`.trim());
      }
    }

    const rows = [...seen.values()].map((text) => ({
      household_id: householdId,
      added_by: user.id,
      freeform_text: text.slice(0, 200),
    }));

    const { error, count } = await supabase
      .from('shopping_list_items')
      .insert(rows, { count: 'exact' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, added: count ?? rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
