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
  Navigation2,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { fetchCurrentWeather } from '@/lib/weather';
import { WeatherRefreshButton } from './weather-refresh-button';

/**
 * yr.no-style "Været nå" panel: condition + temperature on the left,
 * a stacked detail column on the right (feels-like, precipitation,
 * wind with direction + gust + Norwegian Beaufort label). Pulls
 * directly from Open-Meteo's free /current endpoint with a 10-minute
 * cache so it costs nothing per page load.
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
  const showGust = w.windGustMs - w.windMs >= 1;

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            Været nå{city ? ` · ${city}` : ''}
          </p>
          <p className="text-sm capitalize text-foreground/80 mt-0.5">
            {w.conditionLabel}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <p className="text-3xl font-bold tabular-nums leading-none">
              {Math.round(w.tempC)}°
            </p>
            <p className="text-[11px] text-muted-foreground">
              Føles som {Math.round(w.apparentC)}°
            </p>
          </div>
        </div>

        <WeatherRefreshButton />
      </div>

      <dl className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-3 text-[11px]">
        <DetailCell
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="Nedbør"
          value={`${w.precipitationMm} mm`}
        />
        <DetailCell
          icon={
            <Navigation2
              className="h-3.5 w-3.5"
              style={{ transform: `rotate(${w.windFromDeg + 180}deg)` }}
              aria-hidden
            />
          }
          label={`fra ${w.windFromLabel}`}
          value={`${w.windMs.toFixed(1)} m/s`}
          hint={showGust ? `kast ${w.windGustMs.toFixed(0)}` : undefined}
        />
        <DetailCell
          icon={<Wind className="h-3.5 w-3.5" />}
          label="Styrke"
          value={w.windScaleLabel}
        />
      </dl>
    </section>
  );
}

function DetailCell({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon} {label}
      </dt>
      <dd className="font-semibold text-sm capitalize">
        {value}
        {hint && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </dd>
    </div>
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
