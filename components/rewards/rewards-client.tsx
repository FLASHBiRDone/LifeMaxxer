'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Coins,
  Gift,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

type Reward = {
  id: string;
  title: string;
  emoji: string | null;
  cost_xp: number;
  cost_tokens: number;
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

type Voucher = {
  id: string;
  reward_id: string;
  earned_at: string;
  redeemed_at: string | null;
  from_task_id: string | null;
};

const PRESETS = ['🎮', '📱', '🍿', '💰', '🍦', '🎬', '⏱️', '🎁'];

export function RewardsClient({
  initialRewards,
  initialRecent,
  initialVouchers,
  initialXp,
  initialTokens,
  currentUserId,
}: {
  initialRewards: Reward[];
  initialRecent: Redemption[];
  initialVouchers: Voucher[];
  initialXp: number;
  initialTokens: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [recent, setRecent] = useState<Redemption[]>(initialRecent);
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);
  const [xp, setXp] = useState(initialXp);
  const [tokens, setTokens] = useState(initialTokens);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎁');
  const [costXp, setCostXp] = useState<number | ''>(0);
  const [costTokens, setCostTokens] = useState<number | ''>(10);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemingVoucher, setRedeemingVoucher] = useState<string | null>(null);

  const unredeemedVouchers = vouchers.filter((v) => !v.redeemed_at);

  async function createReward(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const xpNum = typeof costXp === 'number' ? costXp : parseInt(String(costXp), 10) || 0;
    const tokNum =
      typeof costTokens === 'number' ? costTokens : parseInt(String(costTokens), 10) || 0;
    if (!title.trim()) {
      setError('Fyll ut navn.');
      return;
    }
    if (xpNum <= 0 && tokNum <= 0) {
      setError('Sett en pris i XP, tokens eller begge.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          emoji,
          costXp: xpNum,
          costTokens: tokNum,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke opprette');
      }
      const { reward } = (await res.json()) as { reward: Reward };
      setRewards((prev) =>
        [...prev, reward].sort((a, b) => (a.cost_xp || 0) - (b.cost_xp || 0)),
      );
      setTitle('');
      setCostXp(0);
      setCostTokens(10);
      setEmoji('🎁');
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setCreating(false);
    }
  }

  async function redeem(reward: Reward, currency: 'xp' | 'tokens') {
    setRedeeming(reward.id);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${reward.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Kunne ikke løse inn');
        return;
      }
      const { balance: newBal } = (await res.json()) as { balance: number };
      if (currency === 'xp') setXp(newBal);
      else setTokens(newBal);
      if (currency === 'xp') {
        setRecent((prev) =>
          [
            {
              id: crypto.randomUUID(),
              reward_id: reward.id,
              user_id: currentUserId,
              xp_spent: reward.cost_xp,
              redeemed_at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 10),
        );
      }
      router.refresh();
    } finally {
      setRedeeming(null);
    }
  }

  async function redeemVoucher(voucher: Voucher) {
    if (redeemingVoucher) return;
    setRedeemingVoucher(voucher.id);
    try {
      const res = await fetch(`/api/vouchers/${voucher.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setVouchers((prev) =>
          prev.map((v) =>
            v.id === voucher.id ? { ...v, redeemed_at: new Date().toISOString() } : v,
          ),
        );
      }
    } finally {
      setRedeemingVoucher(null);
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
      <header className="rounded-3xl grad-hero border p-5 soft-shadow">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
              Dine saldoer
            </p>
            <h1 className="text-xl font-bold leading-tight">Belønninger</h1>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-card/60 border px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1">
              <Trophy className="h-3 w-3" /> XP
            </p>
            <p className="text-2xl font-bold tabular">{xp}</p>
          </div>
          <div className="rounded-xl bg-card/60 border px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1">
              <Coins className="h-3 w-3" /> Tokens
            </p>
            <p className="text-2xl font-bold tabular">{tokens}</p>
          </div>
        </div>
      </header>

      {unredeemedVouchers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Din beholdning · {unredeemedVouchers.length}
          </h2>
          <ul className="space-y-2">
            {unredeemedVouchers.map((v) => {
              const r = rewardMap.get(v.reward_id);
              return (
                <li
                  key={v.id}
                  className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 soft-shadow"
                >
                  <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center text-xl flex-shrink-0">
                    {r?.emoji ?? '🎁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {r?.title ?? 'Belønning'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Tjent {new Date(v.earned_at).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => redeemVoucher(v)}
                    disabled={redeemingVoucher === v.id}
                    className="grad-primary text-primary-foreground border-transparent"
                  >
                    {redeemingVoucher === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" /> Bruk
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
              formOpen
                ? 'bg-muted border-border'
                : 'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
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
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> XP-pris
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={costXp === '' ? '' : costXp}
                  onChange={(e) =>
                    setCostXp(
                      e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                    )
                  }
                  min={0}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
                  <Coins className="h-3 w-3" /> Token-pris
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={costTokens === '' ? '' : costTokens}
                  onChange={(e) =>
                    setCostTokens(
                      e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                    )
                  }
                  min={0}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Sett minst én pris. Hvis begge er satt, kan man betale med valgfri valuta.
            </p>
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
              Lag en – f.eks. «30 min TikTok» for 50 tokens.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const canXp = r.cost_xp > 0 && xp >= r.cost_xp;
              const canTokens = r.cost_tokens > 0 && tokens >= r.cost_tokens;
              const anyAffordable = canXp || canTokens;
              return (
                <li
                  key={r.id}
                  className={cn(
                    'rounded-2xl border bg-card p-4 space-y-2 soft-shadow',
                    !anyAffordable && 'opacity-70',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'h-11 w-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0',
                        anyAffordable ? 'bg-primary/15' : 'bg-muted',
                      )}
                    >
                      {r.emoji ?? '🎁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        {r.cost_xp > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="h-3 w-3" /> {r.cost_xp}
                          </span>
                        )}
                        {r.cost_tokens > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3 w-3" /> {r.cost_tokens}
                          </span>
                        )}
                      </div>
                    </div>
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
                  </div>
                  <div className="flex gap-2">
                    {r.cost_xp > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canXp || redeeming === r.id}
                        onClick={() => redeem(r, 'xp')}
                        className={cn(
                          'flex-1 border-transparent',
                          canXp
                            ? 'grad-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {redeeming === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : canXp ? (
                          <>
                            <Trophy className="h-3.5 w-3.5 mr-1" /> {r.cost_xp} XP
                          </>
                        ) : (
                          `-${r.cost_xp - xp} XP`
                        )}
                      </Button>
                    )}
                    {r.cost_tokens > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canTokens || redeeming === r.id}
                        onClick={() => redeem(r, 'tokens')}
                        className={cn(
                          'flex-1 border-transparent',
                          canTokens
                            ? 'grad-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {redeeming === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : canTokens ? (
                          <>
                            <Coins className="h-3.5 w-3.5 mr-1" /> {r.cost_tokens}
                          </>
                        ) : (
                          `-${r.cost_tokens - tokens} tokens`
                        )}
                      </Button>
                    )}
                  </div>
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
