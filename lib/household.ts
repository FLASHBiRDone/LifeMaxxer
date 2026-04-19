import type { SupabaseClient } from '@supabase/supabase-js';

export async function getOrCreateHouseholdId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existing?.household_id) return existing.household_id;

  const { data: hh, error: hhError } = await supabase
    .from('households')
    .insert({ name: 'Mitt hushold', created_by: userId })
    .select('id')
    .single();

  if (hhError || !hh) {
    throw new Error(hhError?.message ?? 'kunne ikke opprette hushold');
  }

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ household_id: hh.id, user_id: userId, role: 'primary' });

  if (memberError) throw new Error(memberError.message);

  return hh.id;
}
