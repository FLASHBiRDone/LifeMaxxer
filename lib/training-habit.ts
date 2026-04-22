import type { SupabaseClient } from '@supabase/supabase-js';
import { osloDayBounds } from '@/lib/time';

const TRAINING_HABIT_NAME = 'Trening';

/**
 * Ensure the user has a "Trening" habit linked in their
 * training_preferences. Rules:
 *  - If a linked habit exists and is NOT archived, return its id.
 *  - If a linked habit exists and IS archived, return null. The user
 *    archived it on purpose — don't resurrect it as a duplicate.
 *  - If no linked habit exists (null id or dangling reference), first
 *    look for an existing un-archived "Trening" habit by name and link
 *    to it. Only create a new row when none exists.
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
    if (habit) {
      // If the linked habit is archived, respect the user's choice and
      // do not auto-create a replacement.
      if ((habit as any).archived) return null;
      return existingId;
    }
    // Dangling reference (habit hard-deleted) — fall through to lookup.
  }

  // Try to adopt an existing un-archived habit with the same name so we
  // never create a second one on top of an orphaned first.
  const { data: byName } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)
    .eq('archived', false)
    .ilike('name', TRAINING_HABIT_NAME)
    .limit(1)
    .maybeSingle();
  if (byName) {
    const id = (byName as any).id as string;
    await supabase
      .from('training_preferences')
      .update({ training_habit_id: id, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return id;
  }

  // If we got here via "no linked id" (not via archived-linked), create
  // a fresh habit. Any archived linked id already returned null above.
  if (existingId) return null;

  const { data: created, error } = await supabase
    .from('habits')
    .insert({
      user_id: userId,
      name: TRAINING_HABIT_NAME,
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
