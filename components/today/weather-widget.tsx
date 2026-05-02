import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Moon,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { fetchCurrentWeather } from '@/lib/weather';
import { WeatherRefreshButton } from './weather-refresh-button';

/**
 * Tiny "what's it like outside right now" card on /today. Fetches
 * directly from Open-Meteo's free /current endpoint with a 10-minute
 * Next cache, so hitting the page repeatedly doesn't burn API calls
 * and there's zero AI cost. Only renders when the user has set a
 * location — otherwise the LocationPrompt above already nudges them.
 */
export async function WeatherWidget({
  city,
  latitude,
  longitude,
  timezone,
}: {
  city: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
}) {
  const w = await fetchCurrentWeather(latitude, longitude, timezone ?? 'Europe/Oslo');
  if (!w) return null;

  const Icon = pickIcon(w.conditionCode, w.isDay);

  return (
    <section className="rounded-2xl border bg-card p-4 soft-shadow flex items-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold leading-none">
            {Math.round(w.tempC)}°
          </p>
          <p className="text-xs text-muted-foreground capitalize truncate">
            {w.conditionLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          {city && <span className="truncate">{city}</span>}
          <span className="inline-flex items-center gap-1">
            <Wind className="h-3 w-3" /> {w.windKmh} km/t
          </span>
        </div>
      </div>
      <WeatherRefreshButton />
    </section>
  );
}

function pickIcon(code: number, isDay: boolean): LucideIcon {
  if (code === 0 || code === 1) return isDay ? Sun : Moon;
  if (code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 55) return CloudDrizzle;
  if (code === 56 || code === 57 || code === 66 || code === 67) return CloudHail;
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Droplets;
}
