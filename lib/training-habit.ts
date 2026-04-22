import type { SupabaseClient } from '@supabase/supabase-js';
import { osloDayBounds } from '@/lib/time';

/**
 * Ensure the user has a habit linked in their training_preferences. If
 * training_habit_id is set and the habit is still un-archived, return it.
 * Otherwise create a new "Trening" habit and persist the id.
 */
export async function ensureTrainingHabit(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: prefs } = await supabase
    .from('training_preferences')
    .select('training_habit_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!prefs) return null;

  const existingId = (prefs as any).training_habit_id as string | null;

  if (existingId) {
    const { data: habit } = await supabase
      .from('habits')
      .select('id, archived')
      .eq('id', existingId)
      .maybeSingle();
    if (habit && !(habit as any).archived) return existingId;
  }

  const { data: created, error } = await supabase
    .from('habits')
    .insert({
      user_id: userId,
      name: 'Trening',
      kind: 'do',
      target_frequency: 'daily',
      color: 'teal',
    })
    .select('id')
    .single();
  if (error || !created) return null;

  const newId = (created as any).id as string;
  await supabase
    .from('training_preferences')
    .update({ training_habit_id: newId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return newId;
}

/**
 * Map a JS getDay()-style weekday (0=Sunday..6=Saturday) onto a plan.days
 * index (0=Monday..6=Sunday).
 */
export function todayDayIndex(): number {
  const { dayOfWeek } = osloDayBounds();
  // dayOfWeek is "Monday", "Tuesday", etc. from date-fns-tz
  const map: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  return map[dayOfWeek] ?? new Date().getDay();
}
