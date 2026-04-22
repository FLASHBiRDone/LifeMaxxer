'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Gift,
  Loader2,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { TaskCreateDialog } from './task-create-dialog';

export type Category = {
  id: string;
  label: string;
  emoji: string | null;
  is_system: boolean;
  sort_order: number;
};

export type RewardLite = {
  id: string;
  title: string;
  emoji: string | null;
  cost_xp: number;
  cost_tokens: number;
};

export type Task = {
  id: string;
  household_id: string;
  posted_by_user_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  bounty_xp: number;
  bounty_tokens: number;
  bounty_reward_id: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};

export type DoneTask = {
  id: string;
  title: string;
  bounty_xp: number;
  bounty_tokens: number;
  bounty_reward_id: string | null;
  completed_by_user_id: string | null;
  completed_at: string | null;
};

export function MarkedClient({
  currentUserId,
  xpBalance: initialXp,
  tokenBalance: initialTokens,
  initialOpenTasks,
  initialRecentDone,
  categories,
  rewards,
  memberMap,
}: {
  currentUserId: string;
  xpBalance: number;
  tokenBalance: number;
  initialOpenTasks: Task[];
  initialRecentDone: DoneTask[];
  categories: Category[];
  rewards: RewardLite[];
  memberMap: Record<string, { label: string; initial: string }>;
}) {
  const [openTasks, setOpenTasks] = useState<Task[]>(initialOpenTasks);
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>(initialRecentDone);
  const [xpBalance, setXpBalance] = useState(initialXp);
  const [tokenBalance, setTokenBalance] = useState(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rewardMap = useMemo(
    () => new Map(rewards.map((r) => [r.id, r])),
    [rewards],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  async function completeTask(task: Task) {
    if (workingId) return;
    setWorkingId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/household/tasks/${task.id}/complete`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke fullføre');
      }
      // Move task into done list, update balances
      setOpenTasks((prev) => prev.filter((t) => t.id !== task.id));
      setDoneTasks((prev) =>
        [
          {
            id: task.id,
            title: task.title,
            bounty_xp: task.bounty_xp,
            bounty_tokens: task.bounty_tokens,
            bounty_reward_id: task.bounty_reward_id,
            completed_by_user_id: currentUserId,
            completed_at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 10),
      );
      if (task.bounty_xp) setXpBalance((b) => b + task.bounty_xp);
      if (task.bounty_tokens) setTokenBalance((b) => b + task.bounty_tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setWorkingId(null);
    }
  }

  async function cancelTask(task: Task) {
    if (workingId) return;
    const confirmed = window.confirm(
      'Avlys oppgaven? Belønningen går tilbake til deg.',
    );
    if (!confirmed) return;
    setWorkingId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/household/tasks/${task.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke avlyse');
      }
      setOpenTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (task.bounty_xp) setXpBalance((b) => b + task.bounty_xp);
      if (task.bounty_tokens) setTokenBalance((b) => b + task.bounty_tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setWorkingId(null);
    }
  }

  function onCreated(task: Task, debit: { xp: number; tokens: number }) {
    setOpenTasks((prev) => [task, ...prev]);
    if (debit.xp) setXpBalance((b) => Math.max(0, b - debit.xp));
    if (debit.tokens) setTokenBalance((b) => Math.max(0, b - debit.tokens));
    setCreateOpen(false);
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <Store className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Marked
          </p>
          <h1 className="text-2xl font-bold">Oppgaver og belønninger</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {openTasks.length} åpne oppgaver
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4 soft-shadow">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Din XP
          </p>
          <p className="text-2xl font-bold tabular mt-1">{xpBalance}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 soft-shadow">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1">
            <Coins className="h-3 w-3" /> Tokens
          </p>
          <p className="text-2xl font-bold tabular mt-1">{tokenBalance}</p>
        </div>
      </section>

      <Button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="w-full grad-primary text-primary-foreground border-transparent"
      >
        <Plus className="h-4 w-4 mr-2" /> Legg ut ny oppgave
      </Button>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Åpne oppgaver
        </h2>
        {openTasks.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-2 soft-shadow">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Ingen oppgaver ennå</p>
            <p className="text-xs text-muted-foreground">
              Legg ut en oppgave og sett en belønning for å komme i gang.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={t.category_id ? categoryMap.get(t.category_id) ?? null : null}
                reward={t.bounty_reward_id ? rewardMap.get(t.bounty_reward_id) ?? null : null}
                poster={memberMap[t.posted_by_user_id] ?? null}
                isMine={t.posted_by_user_id === currentUserId}
                working={workingId === t.id}
                onComplete={() => completeTask(t)}
                onCancel={() => cancelTask(t)}
              />
            ))}
          </ul>
        )}
      </section>

      {doneTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Fullført nylig
          </h2>
          <ul className="rounded-2xl border bg-card/60 divide-y divide-border/40 overflow-hidden">
            {doneTasks.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 px-4 py-2.5 text-xs"
              >
                <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground line-clamp-1">
                    {d.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {d.completed_by_user_id && memberMap[d.completed_by_user_id]
                      ? memberMap[d.completed_by_user_id].label
                      : 'Noen'}
                    {' · '}
                    {d.completed_at &&
                      new Date(d.completed_at).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </p>
                </div>
                <BountyTag
                  xp={d.bounty_xp}
                  tokens={d.bounty_tokens}
                  reward={
                    d.bounty_reward_id ? rewardMap.get(d.bounty_reward_id) ?? null : null
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories}
        rewards={rewards}
        xpBalance={xpBalance}
        tokenBalance={tokenBalance}
        onCreated={onCreated}
      />
    </div>
  );
}

function TaskCard({
  task,
  category,
  reward,
  poster,
  isMine,
  working,
  onComplete,
  onCancel,
}: {
  task: Task;
  category: Category | null;
  reward: RewardLite | null;
  poster: { label: string; initial: string } | null;
  isMine: boolean;
  working: boolean;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const due = task.due_at ? new Date(task.due_at) : null;
  const isOverdue = due && due.getTime() < Date.now();
  return (
    <li className="rounded-2xl border bg-card p-4 soft-shadow space-y-2.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
            'bg-primary/10',
          )}
        >
          {category?.emoji ?? '📌'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-1.5 text-[10px] text-muted-foreground">
            {category && (
              <span className="uppercase tracking-wider font-semibold text-primary/80">
                {category.label}
              </span>
            )}
            {poster && (
              <span className="inline-flex items-center gap-1">
                <span className="h-4 w-4 rounded-full grad-primary text-primary-foreground inline-flex items-center justify-center text-[8px] font-bold">
                  {poster.initial}
                </span>
                {poster.label}
              </span>
            )}
            {due && (
              <span className={cn(isOverdue && 'text-destructive font-semibold')}>
                Frist{' '}
                {due.toLocaleDateString('nb-NO', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
        {isMine && (
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="text-muted-foreground/60 hover:text-destructive flex-shrink-0 mt-1"
            aria-label="Avlys"
            title="Avlys oppgaven"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <BountyTag xp={task.bounty_xp} tokens={task.bounty_tokens} reward={reward} />
        <Button
          type="button"
          size="sm"
          onClick={onComplete}
          disabled={working || isMine}
          title={isMine ? 'Du la ut denne selv' : undefined}
          className={cn(
            'border-transparent',
            isMine
              ? 'bg-muted text-muted-foreground'
              : 'grad-primary text-primary-foreground',
          )}
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isMine ? (
            'Din'
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Fullfør
            </>
          )}
        </Button>
      </div>
    </li>
  );
}

function BountyTag({
  xp,
  tokens,
  reward,
}: {
  xp: number;
  tokens: number;
  reward: RewardLite | null;
}) {
  const parts: React.ReactNode[] = [];
  if (xp > 0) {
    parts.push(
      <span
        key="xp"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
      >
        <Trophy className="h-3 w-3" /> {xp} XP
      </span>,
    );
  }
  if (tokens > 0) {
    parts.push(
      <span
        key="tk"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-foreground bg-accent/20 px-1.5 rounded"
      >
        <Coins className="h-3 w-3" /> {tokens}
      </span>,
    );
  }
  if (reward) {
    parts.push(
      <span
        key="rw"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
      >
        <Gift className="h-3 w-3" />
        <span className="truncate max-w-[10rem]">
          {reward.emoji ?? '🎁'} {reward.title}
        </span>
      </span>,
    );
  }
  if (parts.length === 0) {
    return <span className="text-[11px] text-muted-foreground">Ingen belønning</span>;
  }
  return <div className="flex items-center gap-2 flex-wrap">{parts}</div>;
}
