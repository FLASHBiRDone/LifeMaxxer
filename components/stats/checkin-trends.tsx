import { Bed, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CheckinPoint = {
  date: string; // YYYY-MM-DD
  level: 'low' | 'medium' | 'high' | null;
  rested: 'low' | 'medium' | 'high' | null;
  focus: 'low' | 'medium' | 'high' | null;
};

const LEVEL_HEIGHT: Record<'low' | 'medium' | 'high', string> = {
  low: 'h-1.5',
  medium: 'h-3',
  high: 'h-5',
};

/**
 * 14-day mini bar chart for the morning check-in dimensions (energy,
 * rested, focus). Compact enough to sit alongside streaks; missing
 * days render as faded outlines so gaps in the ritual are visible
 * without judgement.
 */
export function CheckinTrends({ days }: { days: CheckinPoint[] }) {
  if (days.length === 0) return null;

  const rows: { key: 'level' | 'rested' | 'focus'; label: string; icon: typeof Zap }[] = [
    { key: 'level', label: 'Energi', icon: Zap },
    { key: 'rested', label: 'Uthvilt', icon: Bed },
    { key: 'focus', label: 'Fokus', icon: Eye },
  ];

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-4">
      <div>
        <h2 className="text-base font-bold">Morgen-innsjekk</h2>
        <p className="text-[11px] text-muted-foreground">Siste 14 dager</p>
      </div>

      <div className="space-y-3">
        {rows.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-16 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground flex-shrink-0">
              <Icon className="h-3 w-3" /> {label}
            </div>
            <div className="flex-1 flex items-end gap-0.5 h-6">
              {days.map((d) => {
                const v = d[key];
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${v ?? '—'}`}
                    className={cn(
                      'flex-1 rounded-sm',
                      v ? `${LEVEL_HEIGHT[v]} bg-primary/70` : 'h-1 bg-muted',
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
