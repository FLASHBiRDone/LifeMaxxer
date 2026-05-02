/**
 * Time + weather + moon-phase aware theme resolver. Returns a triple
 * of strings that map directly to data-* attributes on <body>:
 *
 *   <body data-theme="dawn" data-weather="rain" data-moon="full">
 *
 * CSS in globals.css overrides palette tokens (primary/grad-a/mesh-*
 * etc.) for each combination. Foreground/text/border tokens never
 * change — only accents and gradients shift — so contrast is
 * guaranteed in every combo.
 */

export type TimePalette = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
export type WeatherMod = 'clear' | 'rain' | 'snow' | 'fog';
export type MoonPhase = 'new' | 'half' | 'full';

export type Theme = {
  time: TimePalette;
  weather: WeatherMod;
  /** Only set when `time === 'night'`. */
  moon: MoonPhase | null;
};

/**
 * Map an Oslo-local hour (0–23) to a palette. Dawn is short on
 * purpose so the bigger "day" window covers most of the user's
 * waking hours and the app feels like it lives there by default.
 */
export function timePaletteForHour(hour: number): TimePalette {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'golden';
  if (hour >= 20 && hour < 23) return 'dusk';
  return 'night';
}

/**
 * Map a WMO weather code (the same ones Open-Meteo returns) to one
 * of our 4 modifiers. Anything we don't classify falls back to clear
 * — better to under-react than to surprise the user with a "fog"
 * theme on a sunny day because the API picked an obscure code.
 */
export function weatherModForCode(code: number | null | undefined): WeatherMod {
  if (code == null) return 'clear';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    code >= 95
  ) {
    return 'rain';
  }
  return 'clear';
}

/**
 * Approximate moon phase from a known-new-moon reference. Accurate
 * enough for theming — we only bucket into new/half/full so the
 * tens-of-minutes of drift in the synodic-month constant doesn't
 * matter.
 */
export function moonPhase(date: Date = new Date()): MoonPhase {
  // Reference new moon: 2000-01-06 18:14 UTC (close to actual J2000).
  const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMs = 29.530588853 * 86400000;
  const elapsed = date.getTime() - knownNew;
  const phase = (((elapsed % synodicMs) + synodicMs) % synodicMs) / synodicMs;
  // 0 = new, 0.5 = full, 1 = back to new.
  if (phase < 0.06 || phase > 0.94) return 'new';
  if (phase > 0.44 && phase < 0.56) return 'full';
  return 'half';
}

export function resolveTheme(input: {
  now?: Date;
  timezone?: string | null;
  weatherCode?: number | null;
}): Theme {
  const now = input.now ?? new Date();
  const tz = input.timezone || 'Europe/Oslo';
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(now),
  );
  const time = timePaletteForHour(hour);
  const weather = weatherModForCode(input.weatherCode ?? null);
  const moon = time === 'night' ? moonPhase(now) : null;
  return { time, weather, moon };
}

export const DEFAULT_THEME: Theme = { time: 'day', weather: 'clear', moon: null };
