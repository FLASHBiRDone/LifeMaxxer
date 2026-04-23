'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Coins, Gift, Loader2, Store, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type OpenTask = {
  id: string;
  title: string;
  bounty_xp: number;
  bounty_tokens: number;
  bounty_reward_label: string | null;
  posted_by_user_id: string;
  assignee_user_id: string | null;
  assignee_label: string | null;
};

/**
 * Compact marketplace preview on /today. Lists up to 3 open tasks with
 * inline Fullfør buttons so a household member can pick one up without
 * leaving the home screen.
 */
export function TodayOpenTasks({
  initial,
  currentUserId,
}: {
  initial: OpenTask[];
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState<OpenTask[]>(initial);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  async function complete(task: OpenTask) {
    if (completingId) return;
    setCompletingId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/household/tasks/${task.id}/complete`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke fullføre');
      }
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Åpne oppgaver</h2>
        </div>
        <Link
          href="/marked"
          className="text-[10px] font-semibold text-primary inline-flex items-center gap-1 hover:opacity-80"
        >
          Se alle <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="space-y-2">
        {tasks.slice(0, 3).map((t) => {
          const isMine = t.posted_by_user_id === currentUserId;
          const assignedToOther =
            t.assignee_user_id !== null && t.assignee_user_id !== currentUserId;
          const disabled =
            isMine || assignedToOther || completingId === t.id;
          return (
            <li
              key={t.id}
              className="rounded-2xl border bg-card p-3 soft-shadow flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {t.assignee_label && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                      → {t.assignee_label}
                    </span>
                  )}
                  {t.bounty_xp > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <Trophy className="h-3 w-3" /> {t.bounty_xp} XP
                    </span>
                  )}
                  {t.bounty_tokens > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-foreground bg-accent/20 px-1.5 rounded">
                      <Coins className="h-3 w-3" /> {t.bounty_tokens}
                    </span>
                  )}
                  {t.bounty_reward_label && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary max-w-[10rem] truncate">
                      <Gift className="h-3 w-3" /> {t.bounty_reward_label}
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => complete(t)}
                disabled={disabled}
                title={
                  isMine
                    ? 'Du la ut denne selv'
                    : assignedToOther
                      ? `Kun for ${t.assignee_label}`
                      : undefined
                }
                className={cn(
                  'border-transparent',
                  disabled
                    ? 'bg-muted text-muted-foreground'
                    : 'grad-primary text-primary-foreground',
                )}
              >
                {completingId === t.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isMine ? (
                  'Din'
                ) : assignedToOther ? (
                  `→ ${t.assignee_label}`
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Fullfør
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
    </section>
  );
}
