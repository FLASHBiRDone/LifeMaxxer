import { Flame } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StreakRow = {
  id: string;
  name: string;
  current: number;
  best: number;
};

export function StreaksList({ streaks }: { streaks: StreakRow[] }) {
  if (streaks.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Streaks
        </h2>
        <div className="rounded-2xl border bg-card p-6 text-center text-xs text-muted-foreground">
          Ingen vaner ennå. Legg til en for å starte en streak.
        </div>
      </section>
    );
  }

  const sorted = [...streaks].sort((a, b) => b.current - a.current);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        Streaks
      </h2>
      <ul className="space-y-2">
        {sorted.map((s) => {
          const hot = s.current >= 7;
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 soft-shadow"
            >
              <div
                className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  hot ? 'grad-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <Flame className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  Beste: {s.best} {s.best === 1 ? 'dag' : 'dager'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold tabular-nums leading-none">{s.current}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                  {s.current === 1 ? 'dag' : 'dager'}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
