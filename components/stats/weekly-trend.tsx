import { cn } from '@/lib/cn';

export type WeekPoint = { label: string; pct: number; done: number; total: number };

export function WeeklyTrend({ weeks }: { weeks: WeekPoint[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        Siste 4 uker
      </h2>
      <div className="rounded-3xl border bg-card p-5 soft-shadow">
        <div className="flex items-end justify-between gap-3 h-32">
          {weeks.map((w, i) => {
            const isLast = i === weeks.length - 1;
            return (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                  {w.pct}%
                </span>
                <div className="relative w-full bg-muted rounded-xl overflow-hidden" style={{ height: '90px' }}>
                  <div
                    className={cn(
                      'absolute inset-x-0 bottom-0 rounded-xl transition-all duration-700',
                      isLast ? 'grad-primary' : 'bg-primary/40',
                    )}
                    style={{ height: `${Math.max(w.pct, 2)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {w.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
