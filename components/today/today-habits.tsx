'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
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
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vaner i dag
      </h2>
      <ul className="space-y-2">
        {habits.map((h) => {
          const done = logged.has(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => toggle(h.id)}
                disabled={isPending}
                className="w-full text-left flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:bg-accent/10 transition-colors"
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                    done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                    {h.title}
                  </span>
                  {h.cue && (
                    <span className="block text-xs text-muted-foreground">{h.cue}</span>
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
