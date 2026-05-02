import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Megaphone,
  Plane,
  Radio,
  Train,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type DisruptionType =
  | 'transit'
  | 'road'
  | 'event'
  | 'broadcast'
  | 'weather'
  | 'utility'
  | 'aviation'
  | 'other';

type Disruption = {
  title: string;
  type?: DisruptionType;
  time?: string | null;
  source?: string | null;
};

type TomorrowEvent = { time: string; title: string };

const ICONS: Record<DisruptionType, LucideIcon> = {
  transit: Train,
  road: Workflow,
  event: Megaphone,
  broadcast: Radio,
  weather: AlertTriangle,
  utility: Zap,
  aviation: Plane,
  other: AlertTriangle,
};

/**
 * Pulls verified disruptions + tomorrow-lookahead from the
 * `local_disruptions` ai_messages row stored by the morning briefing
 * job. Renders nothing if there's no actionable content — empty
 * silence is the design intent.
 */
export function LocalEventsCard({
  city,
  disruptions,
  tomorrowDisruptions,
  tomorrowEvents,
}: {
  city: string | null;
  disruptions: Disruption[];
  tomorrowDisruptions: Disruption[];
  tomorrowEvents: TomorrowEvent[];
}) {
  const hasToday = disruptions.length > 0;
  const hasTomorrow =
    tomorrowDisruptions.length > 0 || tomorrowEvents.length > 0;
  if (!hasToday && !hasTomorrow) return null;

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Hva skjer rundt deg</h2>
          <p className="text-[11px] text-muted-foreground">
            {city ? `${city} · verifisert fra websøk` : 'Verifisert fra websøk'}
          </p>
        </div>
      </div>

      {hasToday && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            I dag
          </p>
          <ul className="space-y-2">
            {disruptions.map((d, i) => (
              <DisruptionRow key={`today-${i}`} d={d} />
            ))}
          </ul>
        </div>
      )}

      {hasTomorrow && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            I morgen
          </p>
          <ul className="space-y-2">
            {tomorrowEvents.map((e, i) => (
              <li key={`tev-${i}`} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {e.time}{' · '}{e.title}
                  </p>
                </div>
              </li>
            ))}
            {tomorrowDisruptions.map((d, i) => (
              <DisruptionRow key={`tdis-${i}`} d={d} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DisruptionRow({ d }: { d: Disruption }) {
  const Icon = ICONS[d.type ?? 'other'] ?? AlertTriangle;
  return (
    <li className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{d.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          {d.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {d.time}
            </span>
          )}
          {d.source && <span className="truncate">{d.source}</span>}
        </div>
      </div>
    </li>
  );
}
