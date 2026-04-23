import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { addTrainingPlanToCalendar } from '@/lib/training-calendar';
import { clearPlanEvents, deletePlanEvents } from '@/lib/calendar-cleanup';
import { ensureTrainingHabit } from '@/lib/training-habit';
import { generateImage, isImageGenConfigured } from '@/lib/image-gen';
import { buildTrainingImagePrompt } from '@/lib/prompts/training-image';
import { uploadPlanImage } from '@/lib/image-storage';
import { normalizeLocale } from '@/lib/prompts/locales';
import type { TrainingEquipment } from '@/lib/prompts';

export const runtime = 'nodejs';
// Training plans have up to ~5 non-rest days → ~5 parallel image
// generations. Bumped to 120s to fit cleanly within Vercel's ceiling.
export const maxDuration = 120;

const bodySchema = z.object({
  planMessageId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: planRow } = await supabase
    .from('ai_messages')
    .select('id, content')
    .eq('id', parsed.data.planMessageId)
    .eq('user_id', user.id)
    .eq('context_type', 'training_plan')
    .maybeSingle();
  if (!planRow?.content) {
    return NextResponse.json({ error: 'Plan ikke funnet' }, { status: 404 });
  }

  let plan: any;
  try {
    plan = JSON.parse(planRow.content);
  } catch {
    return NextResponse.json({ error: 'Plan er ugyldig' }, { status: 400 });
  }

  // Mark as the active plan and create/link the Trening habit.
  await supabase
    .from('training_preferences')
    .update({
      active_plan_id: planRow.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  const habitId = await ensureTrainingHabit(supabase, user.id);

  // Before creating fresh calendar events, delete any stale events:
  //  - clearPlanEvents wipes this plan's OWN existing events (re-commit)
  //  - deletePlanEvents wipes events from any previous training plan rows
  try {
    await clearPlanEvents(supabase, user.id, planRow.id);
    await deletePlanEvents(supabase, user.id, 'training_plan', planRow.id);
  } catch (err) {
    console.error('[training-commit] calendar cleanup failed', err);
  }

  // Create calendar events on the LifeMaxxing calendar.
  const { data: prefs } = await supabase
    .from('training_preferences')
    .select('training_time, location, equipment')
    .eq('user_id', user.id)
    .maybeSingle();
  const time = ((prefs as any)?.training_time as string) ?? '17:00';
  const location = ((prefs as any)?.location as
    | 'home'
    | 'gym'
    | 'outdoor'
    | 'mixed'
    | undefined) ?? 'mixed';
  const equipment = (((prefs as any)?.equipment ?? []) as TrainingEquipment[]) ?? [];
  const calendar = await addTrainingPlanToCalendar(supabase, user.id, plan, time);

  if (calendar.status === 'added') {
    await supabase
      .from('ai_messages')
      .update({
        metadata: {
          calendarId: calendar.calendarId,
          byDay: calendar.byDay,
          trainingTime: time,
        },
      })
      .eq('id', planRow.id);
  }

  // Generate a hero image per non-rest day using the user's location
  // + equipment so the scene matches what they actually train in.
  if (isImageGenConfigured()) {
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('locale')
      .eq('id', user.id)
      .maybeSingle();
    const locale = normalizeLocale((profileRow as any)?.locale);

    const urls = await Promise.all(
      plan.days.map(async (day: any, i: number) => {
        try {
          const prompt = buildTrainingImagePrompt({
            day,
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
          return await uploadPlanImage(
            supabase,
            user.id,
            `training/${planRow.id}/${i}.${ext}`,
            img,
          );
        } catch (err) {
          console.error('[training-image] failed for day', i, err);
          return null;
        }
      }),
    );
    plan.days.forEach((d: any, i: number) => {
      d.imageUrl = urls[i] ?? null;
    });
    await supabase
      .from('ai_messages')
      .update({ content: JSON.stringify(plan) })
      .eq('id', planRow.id);
  }

  return NextResponse.json({
    committed: true,
    habitId,
    calendar,
  });
}
