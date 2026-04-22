'use client';

import { useState, useTransition } from 'react';
import { Check, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

type Quest = {
  id: string;
  title: string;
  completed_at: string | null;
  is_main: boolean;
  is_family: boolean;
  completer_initial: string | null;
  completer_label: string | null;
};

export function TodayQuests({ quests }: { quests: Quest[] }) {
  const [items, setItems] = useState(quests);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function toggle(quest: Quest) {
    const nextCompleted = quest.completed_at ? null : new Date().toISOString();
    setItems((prev) =>
      prev.map((q) =>
        q.id === quest.id
          ? {
              ...q,
              completed_at: nextCompleted,
              completer_initial: nextCompleted ? 'Du' : null,
              completer_label: nextCompleted ? 'Du' : null,
            }
          : q,
      ),
    );
    startTransition(async () => {
      await fetch(`/api/quests/${quest.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Dagens oppdrag</h2>
      </div>
      <ul className="space-y-2">
        {items.map((q) => {
          const done = Boolean(q.completed_at);
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => toggle(q)}
                disabled={isPending}
                className={cn(
                  'w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition-all card-hover soft-shadow',
                  done ? 'bg-muted/60 border-border/50' : 'bg-card',
                  q.is_main && !done && 'border-primary/30',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                    done
                      ? 'grad-primary border-transparent text-primary-foreground'
                      : 'border-muted-foreground/40',
                  )}
                  aria-hidden
                >
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'block text-sm leading-snug font-medium',
                      done && 'line-through text-muted-foreground',
                    )}
                  >
                    {q.title}
                  </span>
                  {q.is_family && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      <Users className="h-3 w-3" /> Familie
                      {done && q.completer_label && (
                        <span className="text-muted-foreground/80 normal-case tracking-normal">
                          · {q.completer_label}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {done && q.is_family && q.completer_initial && (
                  <span
                    className="h-6 w-6 rounded-full grad-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    aria-label={q.completer_label ?? undefined}
                    title={q.completer_label ?? undefined}
                  >
                    {q.completer_initial.slice(0, 2)}
                  </span>
                )}
                {q.is_main && !done && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary flex-shrink-0 mt-1">
                    hoved
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
