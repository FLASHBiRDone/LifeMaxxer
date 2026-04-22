import type { SupabaseClient } from '@supabase/supabase-js';
import { createEvent } from '@/lib/google';
import { mealPlanWeek, osloDateAt } from '@/lib/time';
import { withLifemaxxingCalendar } from '@/lib/lifemaxxing-calendar';
import type { TrainingPlanOutput, TrainingDay } from '@/lib/prompts';

export type TrainingCalendarResult =
  | { status: 'skipped'; reason: 'no_tokens' | 'no_days' | 'all_rest' }
  | {
      status: 'added';
      created: number;
      googleEventIds: string[];
      byDay: Record<number, string>;
      calendarId: string;
    }
  | { status: 'error'; message: string };

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseHHMM(time: string): { h: number; m: number } {
  const [h, m] = time.split(':').map(Number);
  return { h: h ?? 17, m: m ?? 0 };
}

function describe(day: TrainingDay): string {
  const lines: string[] = [];
  lines.push(day.focus);
  if (day.warmup.length) {
    lines.push('');
    lines.push('Oppvarming:');
    for (const w of day.warmup) lines.push(`• ${w}`);
  }
  if (day.exercises.length) {
    lines.push('');
    lines.push('Øvelser:');
    for (const ex of day.exercises) {
      const notes = ex.notes ? ` – ${ex.notes}` : '';
      const rest =
        ex.restSeconds > 0
          ? `, pause ${
              ex.restSeconds >= 60
                ? `${Math.round(ex.restSeconds / 60)} min`
                : `${ex.restSeconds}s`
            }`
          : '';
      lines.push(`• ${ex.name}: ${ex.sets} × ${ex.reps}${rest}${notes}`);
    }
  }
  if (day.cooldown.length) {
    lines.push('');
    lines.push('Nedkjøling:');
    for (const c of day.cooldown) lines.push(`• ${c}`);
  }
  return lines.join('\n').slice(0, 7000);
}

export async function addTrainingPlanToCalendar(
  supabase: SupabaseClient,
  userId: string,
  plan: TrainingPlanOutput,
  time: string,
): Promise<TrainingCalendarResult> {
  if (!plan?.days?.length) return { status: 'skipped', reason: 'no_days' };
  const activeDays = plan.days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.type !== 'rest');
  if (activeDays.length === 0) return { status: 'skipped', reason: 'all_rest' };

  const ctx = await withLifemaxxingCalendar(supabase, userId);
  if (!ctx.ok) return { status: 'skipped', reason: ctx.reason };

  try {
    const dates = mealPlanWeek();
    const { h, m } = parseHHMM(time);
    const eventIds: string[] = [];
    const byDay: Record<number, string> = {};

    for (const { d: day, i } of activeDays) {
      const dateStr = dates[i];
      const start = osloDateAt(dateStr, h, m);
      const end = addMinutes(start, Math.max(15, day.duration || 45));

      try {
        const id = await createEvent(
          ctx.client,
          {
            summary: `🏋️ ${day.title}`,
            description: describe(day),
            start,
            end,
          },
          ctx.calendarId,
        );
        eventIds.push(id);
        byDay[i] = id;
      } catch (err) {
        console.error('[training-calendar] createEvent failed', dateStr, err);
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
