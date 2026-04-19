'use client';

import { useState, useTransition } from 'react';
import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/cn';

type Habit = {
  id: string;
  title: string;
  cue: string | null;
};

export function TodayHabits({
  habits,
  loggedIds,
}: {
  habits: Habit[];
  loggedIds: string[];
}) {
  const [logged, setLogged] = useState<Set<string>>(new Set(loggedIds));
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setLogged((prev) => {
      const next = new Set(prev);
      prev.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    startTransition(async () => {
      await fetch(`/api/habits/${id}/log`, { method: 'POST' });
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Vaner i dag</h2>
      </div>
      <ul className="space-y-2">
        {habits.map((h) => {
          const done = logged.has(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => toggle(h.id)}
                disabled={isPending}
                className={cn(
                  'w-full text-left flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all card-hover soft-shadow',
                  done ? 'bg-muted/60 border-border/50' : 'bg-card',
                )}
              >
                <span
                  className={cn(
                    'h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                    done
                      ? 'grad-primary border-transparent text-primary-foreground'
                      : 'border-muted-foreground/40',
                  )}
                >
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                    {h.title}
                  </div>
                  {h.cue && (
                    <div className="text-xs text-muted-foreground mt-0.5">{h.cue}</div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
