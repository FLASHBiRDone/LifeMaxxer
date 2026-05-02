'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Loader2,
  Moon,
  Pill,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type Slot = 'morning' | 'noon' | 'evening' | 'night';

export type TodaySupplement = {
  id: string;
  name: string;
  dose: string;
  emoji: string | null;
  slots: Slot[];
  xp_reward: number;
  token_reward: number;
  /** Slots already taken today, used to gate the log buttons. */
  taken_slots: Slot[];
};

const SLOT_META: { key: Slot; label: string; icon: LucideIcon }[] = [
  { key: 'morning', label: 'Morgen', icon: Sunrise },
  { key: 'noon', label: 'Lunsj', icon: Sun },
  { key: 'evening', label: 'Kveld', icon: Sunset },
  { key: 'night', label: 'Natt', icon: Moon },
];

/**
 * Today's supplement intake panel. Groups items by time-of-day slot
 * and lets the user log each in one tap. Empty state links to the
 * settings page so they can add their first vitamin/supplement.
 *
 * The card hides itself entirely when no supplements are scheduled
 * for the current weekday — the goal is calm space, not nagging UI.
 */
export function SupplementsCard({
  items,
  currentSlot,
}: {
  items: TodaySupplement[];
  currentSlot: Slot;
}) {
  const router = useRouter();
  const [taken, setTaken] = useState<Map<string, Set<Slot>>>(() => {
    const m = new Map<string, Set<Slot>>();
    for (const it of items) m.set(it.id, new Set(it.taken_slots));
    return m;
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <Link
        href="/supplements"
        className="rounded-2xl border border-dashed bg-card/50 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
      >
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Pill className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Sett opp tilskudd</p>
          <p className="text-[11px] text-muted-foreground">
            Vitaminer og kosttilskudd med daglig påminnelse + XP.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  }

  function tapLog(item: TodaySupplement, slot: Slot) {
    const slotsForItem = taken.get(item.id) ?? new Set<Slot>();
    if (slotsForItem.has(slot)) return; // already taken
    setTaken((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(item.id) ?? []);
      s.add(slot);
      next.set(item.id, s);
      return next;
    });
    setPendingId(`${item.id}:${slot}`);
    startTransition(async () => {
      const res = await fetch(`/api/supplements/${item.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      if (!res.ok) {
        // Roll back on failure so the UI doesn't lie about the state.
        setTaken((prev) => {
          const next = new Map(prev);
          const s = new Set(next.get(item.id) ?? []);
          s.delete(slot);
          next.set(item.id, s);
          return next;
        });
      } else {
        // Refresh so the XP indicator on the hero updates.
        router.refresh();
      }
      setPendingId(null);
    });
  }

  // Bucket by slot so the user sees their morning row, then noon, etc.
  const bySlot: Record<Slot, TodaySupplement[]> = {
    morning: [],
    noon: [],
    evening: [],
    night: [],
  };
  for (const it of items) {
    for (const sl of it.slots) bySlot[sl].push(it);
  }

  const orderedSlots: Slot[] = ['morning', 'noon', 'evening', 'night'];
  const visibleSlots = orderedSlots.filter((s) => bySlot[s].length > 0);

  const totalDue = items.reduce((acc, it) => acc + it.slots.length, 0);
  const totalTaken = items.reduce(
    (acc, it) => acc + (taken.get(it.id)?.size ?? 0),
    0,
  );

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Pill className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Tilskudd i dag</h2>
          <p className="text-[11px] text-muted-foreground">
            {totalTaken} av {totalDue} tatt
          </p>
        </div>
        <Link
          href="/supplements"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Endre
        </Link>
      </div>

      <div className="space-y-3">
        {visibleSlots.map((slot) => {
          const meta = SLOT_META.find((m) => m.key === slot)!;
          const Icon = meta.icon;
          const isCurrent = slot === currentSlot;
          return (
            <div
              key={slot}
              className={cn(
                'rounded-xl border p-3 space-y-2',
                isCurrent ? 'border-primary/40 bg-primary/5' : 'bg-card',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {meta.label}
                </p>
                {isCurrent && (
                  <span className="text-[10px] font-semibold text-primary">
                    nå
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {bySlot[slot].map((it) => {
                  const isTaken = (taken.get(it.id) ?? new Set()).has(slot);
                  const isPendingThis =
                    pendingId === `${it.id}:${slot}` && isPending;
                  return (
                    <li
                      key={`${it.id}:${slot}`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-base flex-shrink-0">
                        {it.emoji ?? '💊'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isTaken && 'text-muted-foreground line-through',
                          )}
                        >
                          {it.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {it.dose}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => tapLog(it, slot)}
                        disabled={isTaken || isPendingThis}
                        className={cn(
                          'h-8 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0',
                          isTaken
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-card hover:border-primary/40 text-foreground',
                          isPendingThis && 'opacity-70',
                        )}
                      >
                        {isPendingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isTaken ? (
                          <>
                            <Check className="h-3 w-3" /> Tatt
                          </>
                        ) : (
                          <>Tatt</>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
