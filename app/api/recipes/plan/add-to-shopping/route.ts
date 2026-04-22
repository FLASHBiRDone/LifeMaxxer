import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

const bodySchema = z.object({
  items: z.array(z.string().trim().min(1).max(200)).min(1).max(200),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'items required' }, { status: 400 });
  }

  try {
    const householdId = await getOrCreateHouseholdId(supabase, user.id);

    // De-dupe identical lines the caller might have sent
    const seen = new Set<string>();
    const rows = parsed.data.items
      .map((t) => t.trim())
      .filter((t) => {
        const key = t.toLowerCase();
        if (!t || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((text) => ({
        household_id: householdId,
        added_by: user.id,
        freeform_text: text.slice(0, 200),
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, added: 0 });
    }

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
