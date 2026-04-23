import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateMealPlan } from '@/lib/meal-plan';
import { addMealPlanToCalendar } from '@/lib/meal-calendar';
import { deletePlanEvents } from '@/lib/calendar-cleanup';
import { ALLERGENS } from '@/lib/allergens';
import { normalizeLocale } from '@/lib/prompts/locales';
import { generateImage, isImageGenConfigured } from '@/lib/image-gen';
import { buildMealImagePrompt } from '@/lib/prompts/meal-image';
import { uploadPlanImage, deletePlanImages } from '@/lib/image-storage';

export const runtime = 'nodejs';
// Raised to cover plan generation (~15s) + parallel image generation
// for up to 7 days (~20-30s wall-clock with Promise.all). Needs Vercel
// Pro; on Hobby plan the request will truncate — set a smaller plan
// via the days picker to stay inside Hobby's ~60s.
export const maxDuration = 120;

const requestSchema = z.object({
  people: z.number().int().min(1).max(12),
  days: z.number().int().min(1).max(7).default(7),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diet: z.enum(['any', 'vegetarian', 'vegan', 'pescatarian']).default('any'),
  notes: z.string().max(500).default(''),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid request' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('locale')
    .eq('id', user.id)
    .maybeSingle();
  const locale = normalizeLocale((profile as any)?.locale);

  try {
    const result = await generateMealPlan({
      locale,
      people: parsed.data.people,
      days: parsed.data.days,
      allergens: parsed.data.allergens,
      diet: parsed.data.diet,
      notes: parsed.data.notes,
    });

    const record = {
      params: { ...parsed.data, locale },
      days: result.output.days,
    };

    const { data: msg, error: insertError } = await supabase
      .from('ai_messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: JSON.stringify(record),
        context_type: 'meal_plan',
        prompt_version: result.promptVersion,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: result.costUsd,
      })
      .select('id, created_at')
      .single();
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const messageId = (msg as any).id as string;

    // Wipe events from previous meal plans so we don't pile duplicates
    // onto the same day(s) on the LifeMaxxing calendar.
    try {
      await deletePlanEvents(supabase, user.id, 'meal_plan', messageId);
    } catch (err) {
      console.error('[meal-plan] cleanup of previous events failed', err);
    }

    const calendar = await addMealPlanToCalendar(supabase, user.id, record);

    // Persist calendar mapping so later day-swaps can patch/delete events
    if (calendar.status === 'added') {
      await supabase
        .from('ai_messages')
        .update({
          metadata: {
            calendarId: calendar.calendarId,
            byDay: calendar.byDay,
          },
        })
        .eq('id', messageId);
    }

    // Generate a hero image for every day in parallel. Skips silently
    // when GEMINI_API_KEY is absent. Failures per-day don't poison the
    // whole plan — we set imageUrl to null and move on.
    if (isImageGenConfigured()) {
      const imageUrls = await Promise.all(
        record.days.map(async (day, i) => {
          try {
            const prompt = buildMealImagePrompt({
              title: day.title,
              description: day.description,
              locale,
              diet: parsed.data.diet,
              people: parsed.data.people,
            });
            const img = await generateImage(prompt, { aspectRatio: '4:3' });
            const ext =
              img.mimeType === 'image/png'
                ? 'png'
                : img.mimeType === 'image/webp'
                  ? 'webp'
                  : 'jpg';
            const url = await uploadPlanImage(
              supabase,
              user.id,
              `meal/${messageId}/${i}.${ext}`,
              img,
            );
            return url;
          } catch (err) {
            console.error('[meal-image] failed for day', i, err);
            return null;
          }
        }),
      );
      record.days.forEach((d, i) => {
        (d as any).imageUrl = imageUrls[i] ?? null;
      });
      // Persist the updated content so subsequent reads include the URLs.
      await supabase
        .from('ai_messages')
        .update({ content: JSON.stringify(record) })
        .eq('id', messageId);
    }

    return NextResponse.json({
      plan: record,
      messageId,
      createdAt: (msg as any).created_at,
      calendar,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * Delete the user's current meal plan (latest by created_at) along with
 * all of its Google Calendar events. Use ?id=UUID to target a specific
 * plan instead of the latest.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const targetId = url.searchParams.get('id');

  let planId: string | null = targetId;
  if (!planId) {
    const { data: row } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('user_id', user.id)
      .eq('context_type', 'meal_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    planId = (row as any)?.id ?? null;
  }
  if (!planId) {
    return NextResponse.json({ error: 'Ingen plan å slette' }, { status: 404 });
  }

  const { clearPlanEvents } = await import('@/lib/calendar-cleanup');
  try {
    await clearPlanEvents(supabase, user.id, planId);
  } catch (err) {
    console.error('[meal-plan] delete: event cleanup failed', err);
  }

  // Remove the plan's generated images so we don't orphan storage objects
  try {
    await deletePlanImages(supabase, user.id, `meal/${planId}`);
  } catch (err) {
    console.error('[meal-plan] delete: image cleanup failed', err);
  }

  const { error } = await supabase
    .from('ai_messages')
    .delete()
    .eq('id', planId)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
