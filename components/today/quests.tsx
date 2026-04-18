'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

type Quest = {
  id: string;
  title: string;
  completed_at: string | null;
  is_main: boolean;
};

export function TodayQuests({ quests }: { quests: Quest[] }) {
  const [items, setItems] = useState(quests);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return null;
  }

  function toggle(quest: Quest) {
    const nextCompleted = quest.completed_at ? null : new Date().toISOString();
    setItems((prev) =>
      prev.map((q) => (q.id === quest.id ? { ...q, completed_at: nextCompleted } : q)),
    );
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from('quests')
        .update({ completed_at: nextCompleted })
        .eq('id', quest.id);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Hovedoppdrag
      </h2>
      <ul className="space-y-2">
        {items.map((q) => {
          const done = Boolean(q.completed_at);
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => toggle(q)}
                disabled={isPending}
                className="w-full text-left flex items-start gap-3 rounded-2xl border bg-card p-4 hover:bg-accent/10 transition-colors"
              >
                <span
                  className={`mt-1 h-5 w-5 rounded-full border-2 flex-shrink-0 ${
                    done
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40'
                  }`}
                  aria-hidden
                />
                <span
                  className={`flex-1 text-base leading-snug ${
                    done ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {q.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
