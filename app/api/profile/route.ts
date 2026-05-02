import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { geocodePlace } from '@/lib/weather';
import { SUPPORTED_LOCALES } from '@/lib/prompts/locales';

export const runtime = 'nodejs';

const bodySchema = z.object({
  display_name: z.string().trim().min(1).max(40).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  // When the client already has coordinates (from navigator.geolocation
  // + reverse geocoding) it can submit them directly so we skip the
  // server-side forward-geocoding lookup.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
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
  if ('locale' in parsed.data && parsed.data.locale) {
    patch.locale = parsed.data.locale;
  }

  let geocode: {
    city: string;
    latitude: number;
    longitude: number;
    country: string | null;
  } | null = null;

  const hasCoords =
    typeof parsed.data.latitude === 'number' &&
    typeof parsed.data.longitude === 'number';

  if (hasCoords) {
    // Trust client-provided coordinates; city is optional label.
    patch.latitude = parsed.data.latitude;
    patch.longitude = parsed.data.longitude;
    if ('city' in parsed.data) {
      patch.city = parsed.data.city ?? null;
    }
    geocode = {
      city: (parsed.data.city as string | undefined) ?? 'Min posisjon',
      latitude: parsed.data.latitude as number,
      longitude: parsed.data.longitude as number,
      country: null,
    };
  } else if ('city' in parsed.data) {
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

  // Upsert via admin client so accounts that predate the bootstrap
  // trigger (or had it fail silently) still get a row created on
  // first save instead of an `update` that silently affects 0 rows.
  // We've already authenticated above; this only ever touches the
  // authenticated user's own row.
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_profiles')
    .upsert(
      { id: user.id, email: user.email, ...patch },
      { onConflict: 'id' },
    );
  if (error) {
    console.error('[profile] upsert failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, geocode });
}
