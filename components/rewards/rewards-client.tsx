'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Plus, Loader2, Trash2, Sparkles, Trophy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

type Reward = {
  id: string;
  title: string;
  emoji: string | null;
  cost_xp: number;
  created_by: string | null;
  created_at: string;
};

type Redemption = {
  id: string;
  reward_id: string;
  user_id: string;
  xp_spent: number;
  redeemed_at: string;
};

const PRESETS = ['🎮', '📱', '🍿', '💰', '🍦', '🎬', '⏱️', '🎁'];

export function RewardsClient({
  initialRewards,
  initialRecent,
  initialBalance,
  currentUserId,
}: {
  initialRewards: Reward[];
  initialRecent: Redemption[];
  initialBalance: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [recent, setRecent] = useState<Redemption[]>(initialRecent);
  const [balance, setBalance] = useState(initialBalance);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎁');
  const [cost, setCost] = useState<number | ''>(50);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  async function createReward(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const costNum = typeof cost === 'number' ? cost : parseInt(String(cost), 10);
    if (!title.trim() || !costNum || costNum <= 0) {
      setError('Fyll ut navn og gyldig XP-pris.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), emoji, costXp: costNum }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke opprette');
      }
      const { reward } = (await res.json()) as { reward: Reward };
      setRewards((prev) => [...prev, reward].sort((a, b) => a.cost_xp - b.cost_xp));
      setTitle('');
      setCost(50);
      setEmoji('🎁');
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setCreating(false);
    }
  }

  async function redeem(reward: Reward) {
    if (balance < reward.cost_xp) return;
    setRedeeming(reward.id);
    try {
      const res = await fetch(`/api/rewards/${reward.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Kunne ikke løse inn');
        return;
      }
      const { balance: newBal } = (await res.json()) as { balance: number };
      setBalance(newBal);
      setRecent((prev) => [
        {
          id: crypto.randomUUID(),
          reward_id: reward.id,
          user_id: currentUserId,
          xp_spent: reward.cost_xp,
          redeemed_at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 10));
      router.refresh();
    } finally {
      setRedeeming(null);
    }
  }

  async function remove(id: string) {
    setRewards((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/rewards/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  const rewardMap = new Map(rewards.map((r) => [r.id, r]));

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-center gap-4 soft-shadow">
        <div className="h-14 w-14 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <Trophy className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Din XP-saldo
          </p>
          <h1 className="text-3xl font-bold leading-tight">
            {balance} <span className="text-base font-semibold text-muted-foreground">XP</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tjen ved å fullføre vaner og oppdrag
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Belønninger
          </h2>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
              formOpen ? 'bg-muted border-border' : 'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
            )}
          >
            {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {formOpen ? 'Lukk' : 'Ny'}
          </button>
        </div>

        {formOpen && (
          <form
            onSubmit={createReward}
            className="rounded-2xl border bg-card p-4 space-y-3 soft-shadow"
          >
            <div className="flex gap-2">
              <div className="w-20">
                <label className="text-[11px] font-medium text-muted-foreground">Emoji</label>
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                  maxLength={4}
                  className="text-center"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-medium text-muted-foreground">Tittel</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="30 min TikTok"
                  maxLength={120}
                />
              </div>
              <div className="w-24">
                <label className="text-[11px] font-medium text-muted-foreground">XP</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cost === '' ? '' : cost}
                  onChange={(e) =>
                    setCost(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 0))
                  }
                  min={1}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setEmoji(p)}
                  className={cn(
                    'h-8 w-8 rounded-lg border text-base transition-colors',
                    emoji === p ? 'border-primary bg-primary/10' : 'hover:border-primary/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={creating}
              className="w-full grad-primary text-primary-foreground border-transparent"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Opprett'}
            </Button>
          </form>
        )}

        {rewards.length === 0 ? (
          <div className="rounded-3xl border bg-card p-10 text-center space-y-2 soft-shadow">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Gift className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Ingen belønninger ennå</p>
            <p className="text-xs text-muted-foreground">
              Lag en – f.eks. «30 min TikTok» for 100 XP.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const affordable = balance >= r.cost_xp;
              return (
                <li
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border bg-card p-4 soft-shadow',
                    !affordable && 'opacity-70',
                  )}
                >
                  <div
                    className={cn(
                      'h-11 w-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0',
                      affordable ? 'bg-primary/15' : 'bg-muted',
                    )}
                  >
                    {r.emoji ?? '🎁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.cost_xp} XP
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!affordable || redeeming === r.id}
                    onClick={() => redeem(r)}
                    className={cn(
                      'border-transparent',
                      affordable ? 'grad-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {redeeming === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : affordable ? (
                      <><Sparkles className="h-3.5 w-3.5 mr-1" /> Løs inn</>
                    ) : (
                      `-${r.cost_xp - balance}`
                    )}
                  </Button>
                  {r.created_by === currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="text-muted-foreground/60 hover:text-destructive flex-shrink-0"
                      aria-label="Slett"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Siste innløsninger
          </h2>
          <ul className="rounded-2xl border bg-card/60 divide-y divide-border/40 overflow-hidden">
            {recent.map((r) => {
              const reward = rewardMap.get(r.reward_id);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-base flex-shrink-0">
                    {reward?.emoji ?? '🎁'}
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-medium truncate">{reward?.title ?? 'Belønning'}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {new Date(r.redeemed_at).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 flex-shrink-0">
                    <Check className="h-3 w-3" />
                    -{r.xp_spent} XP
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
