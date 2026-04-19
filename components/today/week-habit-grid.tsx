'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type WeekDay = { dateString: string; dayShort: string; dayNum: number };

type Habit = { id: string; name: string; color: string | null };

export function WeekHabitGrid({
  habits,
  weekDays,
  todayString,
  weekLogs,
}: {
  habits: Habit[];
  weekDays: WeekDay[];
  todayString: string;
  weekLogs: Record<string, string[]>; // habit_id → dateString[]
}) {
  const [localLogs, setLocalLogs] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const h of habits) m[h.id] = new Set(weekLogs[h.id] ?? []);
    return m;
  });
  const [, startTransition] = useTransition();

  function toggleToday(habitId: string) {
    setLocalLogs((prev) => {
      const next = { ...prev };
      const s = new Set(prev[habitId] ?? []);
      s.has(todayString) ? s.delete(todayString) : s.add(todayString);
      next[habitId] = s;
      return next;
    });
    startTransition(async () => {
      await fetch(`/api/habits/${habitId}/log`, { method: 'POST' });
    });
  }

  if (habits.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        Vaner denne uken
      </h2>

      <div className="rounded-3xl border bg-card soft-shadow overflow-hidden">
        {/* header row */}
        <div className="grid border-b border-border/60" style={{ gridTemplateColumns: '1fr repeat(7, 2rem)' }}>
          <div className="py-2 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Vane
          </div>
          {weekDays.map((d) => (
            <div
              key={d.dateString}
              className={cn(
                'py-2 text-center text-[10px] font-bold uppercase tracking-wider',
                d.dateString === todayString ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {d.dayShort.slice(0, 1)}
            </div>
          ))}
        </div>

        {/* habit rows */}
        {habits.map((h, ri) => {
          const logs = localLogs[h.id] ?? new Set<string>();
          const doneCount = logs.size;
          const pct = Math.round((doneCount / 7) * 100);

          return (
            <div
              key={h.id}
              className={cn(
                'grid items-center',
                ri < habits.length - 1 && 'border-b border-border/40',
              )}
              style={{ gridTemplateColumns: '1fr repeat(7, 2rem)' }}
            >
              {/* habit name + progress bar */}
              <div className="px-4 py-2.5 min-w-0">
                <p className="text-xs font-medium truncate">{h.name}</p>
                <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full grad-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* day cells */}
              {weekDays.map((d) => {
                const done = logs.has(d.dateString);
                const isToday = d.dateString === todayString;
                const isFuture = d.dateString > todayString;

                return (
                  <button
                    key={d.dateString}
                    type="button"
                    disabled={!isToday}
                    onClick={isToday ? () => toggleToday(h.id) : undefined}
                    className={cn(
                      'h-full flex items-center justify-center py-2.5',
                      isToday && 'cursor-pointer',
                      !isToday && 'cursor-default',
                    )}
                    aria-label={isToday ? `Toggle ${h.name}` : undefined}
                  >
                    <span
                      className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center text-[10px] transition-all',
                        done && 'grad-primary text-primary-foreground',
                        !done && isToday && 'border-2 border-primary/50',
                        !done && !isToday && isFuture && 'border border-border/30 opacity-30',
                        !done && !isToday && !isFuture && 'border border-border/50 opacity-50',
                      )}
                    >
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
