import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizedClient, createEvent } from '@/lib/google';
import { mealPlanWeek, osloDateAt } from '@/lib/time';

type MealPlanDay = {
  day: string;
  title: string;
  description?: string;
  ingredients?: { name: string; amount: string }[];
  instructions?: string[];
};

type MealPlanRecord = {
  days: MealPlanDay[];
};

export type MealCalendarResult =
  | { status: 'skipped'; reason: 'no_tokens' | 'no_days' | 'disabled' }
  | { status: 'added'; created: number; googleEventIds: string[] }
  | { status: 'error'; message: string };

function buildDescription(day: MealPlanDay): string {
  const lines: string[] = [];
  if (day.description) lines.push(day.description);
  if (day.ingredients?.length) {
    lines.push('');
    lines.push('Ingredienser:');
    for (const ing of day.ingredients) {
      lines.push(`• ${ing.amount} ${ing.name}`.trim());
    }
  }
  if (day.instructions?.length) {
    lines.push('');
    lines.push('Slik gjør du:');
    day.instructions.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  }
  return lines.join('\n').slice(0, 7000);
}

/**
 * Create 7 Google Calendar events at 18:00 Oslo time for a meal plan.
 * Silently skips if the user hasn't connected Google Calendar.
 */
export async function addMealPlanToCalendar(
  supabase: SupabaseClient,
  userId: string,
  plan: MealPlanRecord,
): Promise<MealCalendarResult> {
  if (!plan?.days?.length) {
    return { status: 'skipped', reason: 'no_days' };
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!tokens) return { status: 'skipped', reason: 'no_tokens' };

  try {
    const { client, rotated } = await authorizedClient(tokens as any);
    if (rotated) {
      await supabase
        .from('google_tokens')
        .update({
          access_token: rotated.access_token,
          expires_at: rotated.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    const dates = mealPlanWeek();
    const eventIds: string[] = [];

    for (let i = 0; i < 7 && i < plan.days.length; i++) {
      const date = dates[i];
      const day = plan.days[i];
      const start = osloDateAt(date, 18);
      const end = osloDateAt(date, 19);

      try {
        const id = await createEvent(client, {
          summary: `🍳 ${day.title}`,
          description: buildDescription(day),
          start,
          end,
        });
        eventIds.push(id);
      } catch (err) {
        console.error('[meal-calendar] createEvent failed', date, err);
      }
    }

    return { status: 'added', created: eventIds.length, googleEventIds: eventIds };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
