import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);

  const ids = ((membership as { household_id: string }[] | null) ?? []).map((m) => m.household_id);
  if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const { error, count } = await supabase
    .from('shopping_list_items')
    .delete({ count: 'exact' })
    .in('household_id', ids)
    .eq('checked', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
