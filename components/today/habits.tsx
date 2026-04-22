'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Flame, Settings2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Habit = { id: string; name: string; color: string | null };

/**
 * Simple today-only habit list. Shows each active habit with a big
 * round checkbox — tap to toggle for today via /api/habits/:id/log.
 * No week grid, no multi-day view — that lives on /stats now.
 */
export function TodayHabits({
  habits,
  loggedToday,
}: {
  habits: Habit[];
  loggedToday: string[];
}) {
  const [local, setLocal] = useState<Set<string>>(() => new Set(loggedToday));
  const [, startTransition] = useTransition();

  if (habits.length === 0) return null;

  function toggle(habit: Habit) {
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(habit.id)) next.delete(habit.id);
      else next.add(habit.id);
      return next;
    });
    startTransition(async () => {
      await fetch(`/api/habits/${habit.id}/log`, { method: 'POST' });
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Vaner i dag</h2>
        </div>
        <Link
          href="/habits"
          className="text-[10px] font-semibold text-primary inline-flex items-center gap-1 hover:opacity-80"
        >
          <Settings2 className="h-3 w-3" /> Administrer
        </Link>
      </div>
      <ul className="space-y-2">
        {habits.map((h) => {
          const done = local.has(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => toggle(h)}
                className={cn(
                  'w-full text-left flex items-center gap-3 rounded-2xl border p-4 transition-all card-hover soft-shadow',
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
                  aria-hidden
                >
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'flex-1 text-sm font-medium',
                    done && 'line-through text-muted-foreground',
                  )}
                >
                  {h.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
