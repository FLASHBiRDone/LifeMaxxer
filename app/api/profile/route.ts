import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { geocodePlace } from '@/lib/weather';

export const runtime = 'nodejs';

const bodySchema = z.object({
  display_name: z.string().trim().min(1).max(40).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ('display_name' in parsed.data) {
    patch.display_name = parsed.data.display_name ?? null;
  }

  // City change triggers a geocoding lookup so we can store lat/lon for
  // the weather API. Null clears both fields.
  let geocode: {
    city: string;
    latitude: number;
    longitude: number;
    country: string | null;
  } | null = null;
  if ('city' in parsed.data) {
    if (!parsed.data.city) {
      patch.city = null;
      patch.latitude = null;
      patch.longitude = null;
    } else {
      try {
        const place = await geocodePlace(parsed.data.city);
        if (!place) {
          return NextResponse.json(
            { error: 'Fant ikke stedet. Prøv et annet navn (f.eks. "Oslo").' },
            { status: 400 },
          );
        }
        patch.city = place.city;
        patch.latitude = place.latitude;
        patch.longitude = place.longitude;
        geocode = place;
      } catch (err) {
        console.error('[profile] geocode failed', err);
        return NextResponse.json(
          { error: 'Kunne ikke slå opp stedet akkurat nå.' },
          { status: 502 },
        );
      }
    }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, geocode });
}
