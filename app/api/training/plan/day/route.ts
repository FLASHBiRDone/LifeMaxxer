import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { swapTrainingDay } from '@/lib/training-plan';
import { authorizedClient, patchEvent, deleteEvent, createEvent } from '@/lib/google';
import { mealPlanWeek, osloDateAt } from '@/lib/time';
import type { TrainingGoal, TrainingEquipment } from '@/lib/prompts';
import { normalizeLocale } from '@/lib/prompts/locales';
import { generateImage, isImageGenConfigured } from '@/lib/image-gen';
import { buildTrainingImagePrompt } from '@/lib/prompts/training-image';
import {
  buildExerciseImagePrompt,
  exerciseSlug,
} from '@/lib/prompts/exercise-image';
import { uploadPlanImage } from '@/lib/image-storage';

export const runtime = 'nodejs';
export const maxDuration = 45;

const bodySchema = z.object({
  planMessageId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
});

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseHHMM(time: string): { h: number; m: number } {
  const [h, m] = time.split(':').map(Number);
  return { h: h ?? 17, m: m ?? 0 };
}

function describe(day: any): string {
  const lines: string[] = [];
  if (day.focus) lines.push(day.focus);
  if (day.warmup?.length) {
    lines.push('');
    lines.push('Oppvarming:');
    for (const w of day.warmup) lines.push(`• ${w}`);
  }
  if (day.exercises?.length) {
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
  if (day.cooldown?.length) {
    lines.push('');
    lines.push('Nedkjøling:');
    for (const c of day.cooldown) lines.push(`• ${c}`);
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

  const [{ data: row }, { data: prefs }] = await Promise.all([
    supabase
      .from('ai_messages')
      .select('id, content, metadata')
      .eq('id', planMessageId)
      .eq('user_id', user.id)
      .eq('context_type', 'training_plan')
      .maybeSingle(),
    supabase
      .from('training_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!row?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }
  if (!prefs) {
    return NextResponse.json(
      { error: 'Treningspreferanser mangler.' },
      { status: 400 },
    );
  }

  let plan: any;
  try {
    plan = JSON.parse((row as any).content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }
  const target = plan.days?.[dayIndex];
  if (!target) {
    return NextResponse.json({ error: 'Dag finnes ikke' }, { status: 400 });
  }

  const others = plan.days
    .map((d: any, i: number) => ({ ...d, i }))
    .filter((d: any) => d.i !== dayIndex)
    .map((d: any) => ({
      day: d.day,
      title: d.title,
      type: d.type,
      focus: d.focus,
    }));

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('locale')
    .eq('id', user.id)
    .maybeSingle();
  const locale = normalizeLocale((profile as any)?.locale);

  try {
    const swap = await swapTrainingDay(
      {
        locale,
        goals: ((prefs as any).goals ?? []) as TrainingGoal[],
        experience: (prefs as any).experience,
        daysPerWeek: (prefs as any).days_per_week,
        minutesPerSession: (prefs as any).minutes_per_session,
        equipment: (((prefs as any).equipment ?? []) as TrainingEquipment[]),
        location: (prefs as any).location,
        injuries: (prefs as any).injuries ?? null,
        notes: (prefs as any).notes ?? null,
      },
      target.day,
      others,
    );

    const newDay = swap.day as any;
    const wasRest = target.type === 'rest';
    const nowRest = newDay.type === 'rest';

    plan.days[dayIndex] = newDay;

    // Regenerate the image for the swapped day. Rest days now get a
    // relaxed-scene image too so the UI stays visually consistent.
    if (isImageGenConfigured()) {
      try {
        const location = ((prefs as any)?.location as
          | 'home'
          | 'gym'
          | 'outdoor'
          | 'mixed'
          | undefined) ?? 'mixed';
        const equipment =
          (((prefs as any)?.equipment ?? []) as TrainingEquipment[]) ?? [];
        const prompt = buildTrainingImagePrompt({
          day: newDay,
          location,
          equipment,
          locale,
        });
        const img = await generateImage(prompt, { aspectRatio: '16:9' });
        const ext =
          img.mimeType === 'image/png'
            ? 'png'
            : img.mimeType === 'image/webp'
              ? 'webp'
              : 'jpg';
        const url = await uploadPlanImage(
          supabase,
          user.id,
          `training/${planMessageId}/${dayIndex}.${ext}`,
          img,
        );
        (plan.days[dayIndex] as any).imageUrl = url;
      } catch (err) {
        console.error('[training-image] swap regen failed', err);
      }

      // Per-exercise images for the swapped day. Reuse slugs that
      // already have a URL elsewhere in the plan so a repeated
      // 'Knebøy' doesn't cost another image.
      try {
        const existingBySlug = new Map<string, string>();
        for (const d of plan.days as any[]) {
          for (const ex of d.exercises ?? []) {
            const s = exerciseSlug(ex.name);
            if (s && ex.imageUrl && !existingBySlug.has(s)) {
              existingBySlug.set(s, ex.imageUrl);
            }
          }
        }
        const location = ((prefs as any)?.location as
          | 'home'
          | 'gym'
          | 'outdoor'
          | 'mixed'
          | undefined) ?? 'mixed';
        const equipment =
          (((prefs as any)?.equipment ?? []) as TrainingEquipment[]) ?? [];
        const exercises = (newDay.exercises ?? []) as any[];
        const slugs = Array.from(
          new Set(
            exercises.map((ex) => exerciseSlug(ex.name)).filter(Boolean),
          ),
        );
        await Promise.all(
          slugs.map(async (slug) => {
            if (existingBySlug.has(slug)) return;
            const sample = exercises.find(
              (ex) => exerciseSlug(ex.name) === slug,
            );
            if (!sample) return;
            try {
              const prompt = buildExerciseImagePrompt({
                exercise: sample,
                location,
                equipment,
                locale,
              });
              const img = await generateImage(prompt, { aspectRatio: '16:9' });
              const ext =
                img.mimeType === 'image/png'
                  ? 'png'
                  : img.mimeType === 'image/webp'
                    ? 'webp'
                    : 'jpg';
              const url = await uploadPlanImage(
                supabase,
                user.id,
                `training/${planMessageId}/ex/${slug}.${ext}`,
                img,
              );
              existingBySlug.set(slug, url);
            } catch (err) {
              console.error('[exercise-image] swap regen failed', slug, err);
            }
          }),
        );
        for (const ex of exercises) {
          const s = exerciseSlug(ex.name);
          if (s && existingBySlug.has(s)) {
            (ex as any).imageUrl = existingBySlug.get(s)!;
          }
        }
      } catch (err) {
        console.error('[exercise-image] swap bulk regen failed', err);
      }
    }

    const { error: updateErr } = await supabase
      .from('ai_messages')
      .update({ content: JSON.stringify(plan) })
      .eq('id', planMessageId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Calendar reconciliation for this one day
    const metadata = ((row as any).metadata ?? {}) as {
      calendarId?: string;
      byDay?: Record<number, string>;
      trainingTime?: string;
    };
    const byDay = { ...(metadata.byDay ?? {}) };
    const calendarId = metadata.calendarId;
    const trainingTime = metadata.trainingTime ?? (prefs as any).training_time ?? '17:00';

    let calendarAction: 'patched' | 'created' | 'deleted' | 'skipped' = 'skipped';
    if (calendarId) {
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
          const { h, m } = parseHHMM(trainingTime);
          const start = osloDateAt(dateStr, h, m);
          const end = addMinutes(start, Math.max(15, newDay.duration || 45));

          const existingEventId = byDay[dayIndex];

          if (wasRest && !nowRest) {
            // No event existed, create one
            const id = await createEvent(
              client,
              {
                summary: `🏋️ ${newDay.title}`,
                description: describe(newDay),
                start,
                end,
              },
              calendarId,
            );
            byDay[dayIndex] = id;
            calendarAction = 'created';
          } else if (!wasRest && nowRest) {
            // Was an active day, now rest — delete the event
            if (existingEventId) {
              await deleteEvent(client, existingEventId, calendarId);
              delete byDay[dayIndex];
              calendarAction = 'deleted';
            }
          } else if (!wasRest && !nowRest) {
            // Active → active, patch
            if (existingEventId) {
              await patchEvent(
                client,
                existingEventId,
                {
                  summary: `🏋️ ${newDay.title}`,
                  description: describe(newDay),
                  start,
                  end,
                },
                calendarId,
              );
              calendarAction = 'patched';
            } else {
              const id = await createEvent(
                client,
                {
                  summary: `🏋️ ${newDay.title}`,
                  description: describe(newDay),
                  start,
                  end,
                },
                calendarId,
              );
              byDay[dayIndex] = id;
              calendarAction = 'created';
            }
          }

          if (calendarAction !== 'skipped') {
            await supabase
              .from('ai_messages')
              .update({
                metadata: { ...metadata, byDay },
              })
              .eq('id', planMessageId);
          }
        }
      } catch (err) {
        console.error('[training-swap] calendar sync failed', err);
      }
    }

    return NextResponse.json({
      day: newDay,
      dayIndex,
      calendarAction,
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
 * Turn a training day into a rest day and delete its Google Calendar
 * event if one exists. Used when the user decides to skip a workout
 * without regenerating a new one.
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
    .eq('context_type', 'training_plan')
    .maybeSingle();
  if (!row?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }

  let plan: any;
  try {
    plan = JSON.parse((row as any).content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }
  const target = plan.days?.[dayIndex];
  if (!target) {
    return NextResponse.json({ error: 'Dag finnes ikke' }, { status: 400 });
  }

  plan.days[dayIndex] = {
    day: target.day,
    type: 'rest',
    title: 'Hvile',
    duration: 0,
    focus: 'Fullstendig hvile',
    warmup: [],
    exercises: [],
    cooldown: [],
  };

  // Generate a rest-scene image so the card still has a visual instead
  // of going blank after the user converts a workout to a rest day.
  if (isImageGenConfigured()) {
    try {
      const { data: prefsForImg } = await supabase
        .from('training_preferences')
        .select('location, equipment')
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('locale')
        .eq('id', user.id)
        .maybeSingle();
      const location = ((prefsForImg as any)?.location as
        | 'home'
        | 'gym'
        | 'outdoor'
        | 'mixed'
        | undefined) ?? 'mixed';
      const equipment =
        (((prefsForImg as any)?.equipment ?? []) as TrainingEquipment[]) ?? [];
      const prompt = buildTrainingImagePrompt({
        day: plan.days[dayIndex],
        location,
        equipment,
        locale: normalizeLocale((profileRow as any)?.locale),
      });
      const img = await generateImage(prompt, { aspectRatio: '16:9' });
      const ext =
        img.mimeType === 'image/png'
          ? 'png'
          : img.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';
      const url = await uploadPlanImage(
        supabase,
        user.id,
        `training/${planMessageId}/${dayIndex}.${ext}`,
        img,
      );
      (plan.days[dayIndex] as any).imageUrl = url;
    } catch (err) {
      console.error('[training-image] rest-day regen failed', err);
    }
  }

  const { error: updateErr } = await supabase
    .from('ai_messages')
    .update({ content: JSON.stringify(plan) })
    .eq('id', planMessageId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Delete this day's calendar event (if it was an active day before)
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
      console.error('[training-day-delete] calendar cleanup failed', err);
    }
  }

  // Also clear any exercise logs for that day since the workout is gone
  await supabase
    .from('training_exercise_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('plan_message_id', planMessageId)
    .eq('day_index', dayIndex);

  return NextResponse.json({
    ok: true,
    day: plan.days[dayIndex],
    dayIndex,
    calendarDeleted,
  });
}
