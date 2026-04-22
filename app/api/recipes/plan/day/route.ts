import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { swapMealPlanDay } from '@/lib/meal-plan';
import { authorizedClient, patchEvent, deleteEvent } from '@/lib/google';
import { mealPlanWeek, osloDateAt } from '@/lib/time';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  planMessageId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

function buildDescription(day: {
  description?: string;
  ingredients?: { name: string; amount: string }[];
  instructions?: string[];
}): string {
  const lines: string[] = [];
  if (day.description) lines.push(day.description);
  if (day.ingredients?.length) {
    lines.push('');
    lines.push('Ingredienser:');
    for (const ing of day.ingredients) lines.push(`• ${ing.amount} ${ing.name}`.trim());
  }
  if (day.instructions?.length) {
    lines.push('');
    lines.push('Slik gjør du:');
    day.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  return lines.join('\n').slice(0, 7000);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { planMessageId, dayIndex } = parsed.data;

  const { data: row } = await supabase
    .from('ai_messages')
    .select('id, content, metadata')
    .eq('id', planMessageId)
    .eq('user_id', user.id)
    .eq('context_type', 'meal_plan')
    .maybeSingle();
  if (!row?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }

  let record: any;
  try {
    record = JSON.parse((row as any).content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }
  if (!record.days?.[dayIndex]) {
    return NextResponse.json({ error: 'Dag finnes ikke' }, { status: 400 });
  }

  const target = record.days[dayIndex];
  const others = record.days
    .filter((_: any, i: number) => i !== dayIndex)
    .map((d: any) => ({ day: d.day, title: d.title, description: d.description }));

  try {
    const swap = await swapMealPlanDay(
      {
        locale: record.params.locale ?? 'nb',
        people: record.params.people,
        days: record.days.length,
        allergens: record.params.allergens ?? [],
        diet: record.params.diet ?? 'any',
        notes: record.params.notes ?? '',
      },
      target.day,
      others,
    );

    record.days[dayIndex] = swap.day;

    const { error: updateErr } = await supabase
      .from('ai_messages')
      .update({ content: JSON.stringify(record) })
      .eq('id', planMessageId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Patch the corresponding calendar event if we have one tracked
    const metadata = ((row as any).metadata ?? {}) as {
      calendarId?: string;
      byDay?: Record<number, string>;
    };
    const eventId = metadata.byDay?.[dayIndex];
    const calendarId = metadata.calendarId;
    let calendarPatched = false;
    if (eventId && calendarId) {
      try {
        const { data: tokens } = await supabase
          .from('google_tokens')
          .select('access_token, refresh_token, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (tokens) {
          const { client, rotated } = await authorizedClient(tokens as any);
          if (rotated) {
            await supabase
              .from('google_tokens')
              .update({
                access_token: rotated.access_token,
                expires_at: rotated.expires_at,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id);
          }

          const dates = mealPlanWeek();
          const dateStr = dates[dayIndex];
          const start = osloDateAt(dateStr, 18);
          const end = osloDateAt(dateStr, 19);

          await patchEvent(
            client,
            eventId,
            {
              summary: `🍳 ${swap.day.title}`,
              description: buildDescription(swap.day),
              start,
              end,
            },
            calendarId,
          );
          calendarPatched = true;
        }
      } catch (err) {
        console.error('[meal-swap] calendar patch failed', err);
      }
    }

    return NextResponse.json({
      day: swap.day,
      dayIndex,
      calendarPatched,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

const deleteBodySchema = z.object({
  planMessageId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

/**
 * Mark one day of a meal plan as skipped (user doesn't want a dinner
 * that day) and remove its Google Calendar event. Plan JSON stays the
 * same length; the day gets `skipped: true` so today-page logic and
 * calendar sync can detect it.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { planMessageId, dayIndex } = parsed.data;

  const { data: row } = await supabase
    .from('ai_messages')
    .select('id, content, metadata')
    .eq('id', planMessageId)
    .eq('user_id', user.id)
    .eq('context_type', 'meal_plan')
    .maybeSingle();
  if (!row?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }

  let record: any;
  try {
    record = JSON.parse((row as any).content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }
  if (!record.days?.[dayIndex]) {
    return NextResponse.json({ error: 'Dag finnes ikke' }, { status: 400 });
  }

  // Mark the day as skipped but keep the slot so array indices stay stable.
  record.days[dayIndex] = {
    ...record.days[dayIndex],
    skipped: true,
    title: 'Ingen middag',
    description: 'Hoppet over',
    ingredients: [],
    instructions: [],
  };

  const { error: updateErr } = await supabase
    .from('ai_messages')
    .update({ content: JSON.stringify(record) })
    .eq('id', planMessageId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Remove that day's calendar event if we tracked one
  const metadata = ((row as any).metadata ?? {}) as {
    calendarId?: string;
    byDay?: Record<number, string>;
  };
  const eventId = metadata.byDay?.[dayIndex];
  const calendarId = metadata.calendarId;
  let calendarDeleted = false;
  if (eventId && calendarId) {
    try {
      const { data: tokens } = await supabase
        .from('google_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (tokens) {
        const { client, rotated } = await authorizedClient(tokens as any);
        if (rotated) {
          await supabase
            .from('google_tokens')
            .update({
              access_token: rotated.access_token,
              expires_at: rotated.expires_at,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);
        }
        await deleteEvent(client, eventId, calendarId);
        const byDay = { ...(metadata.byDay ?? {}) };
        delete byDay[dayIndex];
        await supabase
          .from('ai_messages')
          .update({ metadata: { ...metadata, byDay } })
          .eq('id', planMessageId);
        calendarDeleted = true;
      }
    } catch (err) {
      console.error('[meal-day-delete] calendar cleanup failed', err);
    }
  }

  return NextResponse.json({
    ok: true,
    day: record.days[dayIndex],
    dayIndex,
    calendarDeleted,
  });
}
