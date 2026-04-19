import { cn } from '@/lib/cn';

export type HeatmapDay = { dateString: string; count: number };

export function Heatmap({
  days,
  maxCount,
  todayString,
}: {
  days: HeatmapDay[]; // oldest to newest, length = 30
  maxCount: number;
  todayString: string;
}) {
  function intensity(count: number): number {
    if (count === 0) return 0;
    if (maxCount <= 1) return 4;
    const r = count / maxCount;
    if (r >= 0.75) return 4;
    if (r >= 0.5) return 3;
    if (r >= 0.25) return 2;
    return 1;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        Siste 30 dager
      </h2>
      <div className="rounded-3xl border bg-card p-4 soft-shadow">
        <div className="grid grid-cols-10 gap-1.5">
          {days.map((d) => {
            const lvl = intensity(d.count);
            const isToday = d.dateString === todayString;
            return (
              <div
                key={d.dateString}
                title={`${d.dateString}: ${d.count}`}
                className={cn(
                  'aspect-square rounded-md transition-colors',
                  lvl === 0 && 'bg-muted',
                  lvl === 1 && 'bg-primary/25',
                  lvl === 2 && 'bg-primary/50',
                  lvl === 3 && 'bg-primary/75',
                  lvl === 4 && 'bg-primary',
                  isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                )}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] text-muted-foreground">
          <span>Mindre</span>
          <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/75" />
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span>Mer</span>
        </div>
      </div>
    </section>
  );
}
