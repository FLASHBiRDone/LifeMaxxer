import { Pill } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SupplementIntakePoint = {
  date: string; // YYYY-MM-DD
  taken: number;
  scheduled: number;
};

/**
 * 14-day adherence bar chart for supplement intake. Each day shows
 * `taken / scheduled` as a fill — full bar = all doses taken, empty
 * outline = scheduled doses missed, no bar at all = nothing scheduled
 * that day. Mirrors the CheckinTrends visual language so the stats
 * page reads as a coherent set of mini-charts rather than mixed
 * styles per metric.
 */
export function SupplementTrends({ days }: { days: SupplementIntakePoint[] }) {
  if (days.length === 0) return null;

  const totalTaken = days.reduce((acc, d) => acc + d.taken, 0);
  const totalScheduled = days.reduce((acc, d) => acc + d.scheduled, 0);
  const adherence =
    totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : null;

  // Cap bar height by max dose count seen, so a household with one
  // multivitamin doesn't get tiny bars while a 6-supplement user gets
  // overflowing ones. Min ceiling of 1 keeps the math safe.
  const maxScheduled = Math.max(1, ...days.map((d) => d.scheduled));

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Pill className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">Tilskudd</h2>
          <p className="text-[11px] text-muted-foreground">
            Siste 14 dager
            {adherence !== null && (
              <>
                {' · '}
                <span className="text-primary font-semibold">
                  {adherence}%
                </span>{' '}
                tatt
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums">{totalTaken}</p>
          <p className="text-[10px] text-muted-foreground">doser tatt</p>
        </div>
      </div>

      <div className="flex items-end gap-0.5 h-12">
        {days.map((d) => {
          const fillPct =
            d.scheduled > 0 ? (d.taken / d.scheduled) * 100 : 0;
          const heightPct = (d.scheduled / maxScheduled) * 100;
          if (d.scheduled === 0) {
            return (
              <div
                key={d.date}
                title={`${d.date}: ingen planlagt`}
                className="flex-1 h-1 rounded-sm bg-muted/40 self-center"
              />
            );
          }
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.taken} av ${d.scheduled}`}
              className="flex-1 rounded-sm bg-muted relative overflow-hidden"
              style={{ height: `${heightPct}%` }}
            >
              <div
                className={cn(
                  'absolute bottom-0 inset-x-0 rounded-sm',
                  fillPct === 100
                    ? 'bg-primary'
                    : fillPct > 0
                      ? 'bg-primary/70'
                      : 'bg-transparent',
                )}
                style={{ height: `${fillPct}%` }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
