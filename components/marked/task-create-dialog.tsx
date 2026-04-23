'use client';

import { useEffect, useState } from 'react';
import { Check, Coins, Gift, Loader2, Plus, Sparkles, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { AssignableMember, Category, RewardLite, Task } from './marked-client';

export function TaskCreateDialog({
  open,
  onClose,
  categories,
  rewards,
  members,
  currentUserId,
  xpBalance,
  tokenBalance,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  rewards: RewardLite[];
  members: AssignableMember[];
  currentUserId: string;
  xpBalance: number;
  tokenBalance: number;
  onCreated: (task: Task, debit: { xp: number; tokens: number }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [bountyXp, setBountyXp] = useState<number>(0);
  const [bountyTokens, setBountyTokens] = useState<number>(0);
  const [bountyRewardId, setBountyRewardId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setCategoryId(categories[0]?.id ?? null);
      setAssigneeUserId(null);
      setBountyXp(0);
      setBountyTokens(0);
      setBountyRewardId(null);
      setDueAt('');
      setSubmitting(false);
      setError(null);
    }
  }, [open, categories]);

  if (!open) return null;

  const hasBounty = bountyXp > 0 || bountyTokens > 0 || !!bountyRewardId;
  const canSubmit = title.trim().length > 0 && hasBounty && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/household/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          categoryId,
          assigneeUserId,
          bountyXp,
          bountyTokens,
          bountyRewardId,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lage oppgave');
      }
      const { task } = await res.json();
      onCreated(task, { xp: bountyXp, tokens: bountyTokens });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-card border shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="px-5 py-4 border-b flex items-start gap-3 flex-shrink-0">
          <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <Plus className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">Ny oppgave</h2>
            <p className="text-[11px] text-muted-foreground">
              Sett en belønning som reserveres fra saldoen din
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Hva skal gjøres
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder="F.eks. Tøm oppvaskmaskinen"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Detaljer (valgfritt)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="F.eks. ikke glem å lukke døra"
              rows={2}
              maxLength={1000}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Kategori
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1',
                    categoryId === c.id
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-background hover:border-primary/40',
                  )}
                >
                  <span>{c.emoji ?? '📌'}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          {members.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Tildel til (valgfritt)
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAssigneeUserId(null)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    assigneeUserId === null
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-background hover:border-primary/40',
                  )}
                >
                  Åpen for alle
                </button>
                {members.map((m) => {
                  const on = assigneeUserId === m.id;
                  const selfSuffix = m.id === currentUserId ? ' (meg)' : '';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setAssigneeUserId(on ? null : m.id)
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5',
                        on
                          ? 'grad-primary text-primary-foreground border-transparent'
                          : 'bg-background hover:border-primary/40',
                      )}
                    >
                      <span
                        className={cn(
                          'h-4 w-4 rounded-full text-[9px] font-bold inline-flex items-center justify-center',
                          on
                            ? 'bg-primary-foreground/25 text-primary-foreground'
                            : 'grad-primary text-primary-foreground',
                        )}
                      >
                        {m.initial}
                      </span>
                      {m.label}
                      {selfSuffix}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tildelte oppgaver kan kun fullføres av den valgte personen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Belønning
            </label>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="XP"
                icon={<Trophy className="h-3.5 w-3.5" />}
                value={bountyXp}
                max={xpBalance}
                onChange={setBountyXp}
                hint={`Saldo ${xpBalance}`}
              />
              <NumberField
                label="Tokens"
                icon={<Coins className="h-3.5 w-3.5" />}
                value={bountyTokens}
                max={tokenBalance}
                onChange={setBountyTokens}
                hint={`Saldo ${tokenBalance}`}
              />
            </div>

            {rewards.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  Eller lås til en bestemt belønning:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBountyRewardId(null)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      bountyRewardId === null
                        ? 'bg-muted border-border'
                        : 'bg-background hover:border-primary/40',
                    )}
                  >
                    Ingen
                  </button>
                  {rewards.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setBountyRewardId(bountyRewardId === r.id ? null : r.id)
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1',
                        bountyRewardId === r.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'bg-background hover:border-primary/40',
                      )}
                    >
                      <span>{r.emoji ?? '🎁'}</span>
                      <span className="truncate max-w-[10rem]">{r.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Frist (valgfritt)
            </label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>

        <footer className="px-5 py-4 border-t bg-card flex-shrink-0 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full grad-primary text-primary-foreground border-transparent"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Lagrer…</>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Legg ut oppgaven
              </>
            )}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function NumberField({
  label,
  icon,
  value,
  max,
  onChange,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 font-medium text-muted-foreground uppercase tracking-wider">
          {icon} {label}
        </span>
        <span className="text-muted-foreground tabular">{hint}</span>
      </div>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (isNaN(n)) onChange(0);
          else onChange(Math.max(0, Math.min(max, n)));
        }}
      />
    </div>
  );
}
