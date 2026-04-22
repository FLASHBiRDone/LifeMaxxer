import type { SupabaseClient } from '@supabase/supabase-js';
import { createEvent } from '@/lib/google';
import { mealPlanWeek, osloDateAt } from '@/lib/time';
import { withLifemaxxingCalendar } from '@/lib/lifemaxxing-calendar';

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
  | {
      status: 'added';
      created: number;
      googleEventIds: string[];
      byDay: Record<number, string>;
      calendarId: string;
    }
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

export async function addMealPlanToCalendar(
  supabase: SupabaseClient,
  userId: string,
  plan: MealPlanRecord,
): Promise<MealCalendarResult> {
  if (!plan?.days?.length) {
    return { status: 'skipped', reason: 'no_days' };
  }

  const ctx = await withLifemaxxingCalendar(supabase, userId);
  if (!ctx.ok) return { status: 'skipped', reason: ctx.reason };

  try {
    const dates = mealPlanWeek();
    const eventIds: string[] = [];
    const byDay: Record<number, string> = {};

    for (let i = 0; i < 7 && i < plan.days.length; i++) {
      const date = dates[i];
      const day = plan.days[i];
      const start = osloDateAt(date, 18);
      const end = osloDateAt(date, 19);

      try {
        const id = await createEvent(
          ctx.client,
          {
            summary: `🍳 ${day.title}`,
            description: buildDescription(day),
            start,
            end,
          },
          ctx.calendarId,
        );
        eventIds.push(id);
        byDay[i] = id;
      } catch (err) {
        console.error('[meal-calendar] createEvent failed', date, err);
      }
    }

    return {
      status: 'added',
      created: eventIds.length,
      googleEventIds: eventIds,
      byDay,
      calendarId: ctx.calendarId,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
