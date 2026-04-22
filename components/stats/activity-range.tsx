'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type ActivityDay = { dateString: string; count: number };

type Range = 'week' | 'month' | 'year';

const RANGE_LABEL: Record<Range, string> = {
  week: 'Uke',
  month: 'Måned',
  year: 'År',
};

const RANGE_DAYS: Record<Range, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export function ActivityRange({
  days,
  todayString,
}: {
  days: ActivityDay[]; // oldest → newest, length = 365
  todayString: string;
}) {
  const [range, setRange] = useState<Range>('month');

  const visible = useMemo(() => {
    const n = RANGE_DAYS[range];
    return days.slice(-n);
  }, [days, range]);

  const maxCount = useMemo(
    () => Math.max(1, ...visible.map((d) => d.count)),
    [visible],
  );

  const totalDone = visible.reduce((s, d) => s + d.count, 0);
  const activeDays = visible.filter((d) => d.count > 0).length;

  function intensity(count: number): number {
    if (count === 0) return 0;
    if (maxCount <= 1) return 4;
    const r = count / maxCount;
    if (r >= 0.75) return 4;
    if (r >= 0.5) return 3;
    if (r >= 0.25) return 2;
    return 1;
  }

  // Column count scales so year view is dense without horizontal scroll.
  const cols = range === 'week' ? 7 : range === 'month' ? 10 : 26;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Aktivitet
        </h2>
        <div className="flex rounded-xl border bg-muted/40 p-0.5 text-[11px] font-semibold">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-colors',
                range === r
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-4 soft-shadow space-y-3">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {visible.map((d) => {
            const lvl = intensity(d.count);
            const isToday = d.dateString === todayString;
            return (
              <div
                key={d.dateString}
                title={`${d.dateString}: ${d.count}`}
                className={cn(
                  'aspect-square rounded-sm transition-colors',
                  lvl === 0 && 'bg-muted',
                  lvl === 1 && 'bg-primary/25',
                  lvl === 2 && 'bg-primary/50',
                  lvl === 3 && 'bg-primary/75',
                  lvl === 4 && 'bg-primary',
                  isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                )}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <span className="font-semibold text-foreground tabular">
                {totalDone}
              </span>{' '}
              totalt
            </span>
            <span>
              <span className="font-semibold text-foreground tabular">
                {activeDays}
              </span>{' '}
              aktive dager
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Mindre</span>
            <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/75" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            <span>Mer</span>
          </div>
        </div>
      </div>
    </section>
  );
}
