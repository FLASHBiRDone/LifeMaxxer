/**
 * Thin wrappers around Open-Meteo's free geocoding + forecast APIs.
 * No API key required.
 *  - Geocoding: https://open-meteo.com/en/docs/geocoding-api
 *  - Forecast:  https://open-meteo.com/en/docs
 */

export type GeocodedPlace = {
  city: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

export type DailyForecast = {
  date: string; // YYYY-MM-DD in user's timezone
  tempMin: number;
  tempMax: number;
  precipitationMm: number;
  windMaxKmh: number;
  conditionCode: number; // WMO weather code
  conditionLabel: string; // Norwegian label derived from the code
};

/**
 * Resolve a free-form city/place name to coordinates. Returns null when
 * nothing matches (bad spelling, empty, etc.) so callers can surface a
 * validation message.
 */
export async function geocodePlace(query: string): Promise<GeocodedPlace | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'nb');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    results?: Array<{
      name: string;
      country?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };
  const hit = body.results?.[0];
  if (!hit) return null;
  return {
    city: hit.name,
    country: hit.country ?? null,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone ?? null,
  };
}

/**
 * Norwegian labels for the WMO weather codes Open-Meteo returns. Kept
 * short so they drop cleanly into a briefing line.
 */
const CONDITION_NB: Record<number, string> = {
  0: 'klart',
  1: 'overveiende klart',
  2: 'delvis skyet',
  3: 'skyet',
  45: 'tåke',
  48: 'rimtåke',
  51: 'lett yr',
  53: 'yr',
  55: 'kraftig yr',
  56: 'lett underkjølt yr',
  57: 'kraftig underkjølt yr',
  61: 'lett regn',
  63: 'regn',
  65: 'kraftig regn',
  66: 'lett underkjølt regn',
  67: 'kraftig underkjølt regn',
  71: 'lett snø',
  73: 'snø',
  75: 'kraftig snø',
  77: 'snøkorn',
  80: 'lette regnbyger',
  81: 'regnbyger',
  82: 'kraftige regnbyger',
  85: 'lette snøbyger',
  86: 'kraftige snøbyger',
  95: 'tordenvær',
  96: 'tordenvær med lett hagl',
  99: 'tordenvær med kraftig hagl',
};

/**
 * Fetch today's daily forecast for a given location. Timezone is
 * important: Open-Meteo returns one row per "day" in the timezone we
 * pass. We always pass Europe/Oslo so the window matches the Oslo day
 * bounds the rest of the app uses.
 */
export async function fetchTodayForecast(
  latitude: number,
  longitude: number,
  timezone: string = 'Europe/Oslo',
): Promise<DailyForecast | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
  );
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', '1');

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      wind_speed_10m_max: number[];
      weather_code: number[];
    };
  };
  const d = body.daily;
  if (!d || !d.time?.length) return null;
  const code = d.weather_code[0] ?? 0;
  return {
    date: d.time[0],
    tempMin: Math.round((d.temperature_2m_min[0] ?? 0) * 10) / 10,
    tempMax: Math.round((d.temperature_2m_max[0] ?? 0) * 10) / 10,
    precipitationMm: d.precipitation_sum[0] ?? 0,
    windMaxKmh: Math.round(d.wind_speed_10m_max[0] ?? 0),
    conditionCode: code,
    conditionLabel: CONDITION_NB[code] ?? 'ukjent',
  };
}
