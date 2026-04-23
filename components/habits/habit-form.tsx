'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

export type HabitDraft = {
  name: string;
  kind: 'do' | 'avoid' | 'measure';
  target_frequency: 'daily' | 'weekly';
  color: string;
  schedule_days: number[]; // 0=Sun..6=Sat. Empty = daily.
  grace_days: number;
};

const empty: HabitDraft = {
  name: '',
  kind: 'do',
  target_frequency: 'daily',
  color: 'emerald',
  schedule_days: [],
  grace_days: 0,
};

// Mon-first display order for the schedule picker
const WEEKDAY_PILLS: { num: number; short: string }[] = [
  { num: 1, short: 'Man' },
  { num: 2, short: 'Tir' },
  { num: 3, short: 'Ons' },
  { num: 4, short: 'Tor' },
  { num: 5, short: 'Fre' },
  { num: 6, short: 'Lør' },
  { num: 0, short: 'Søn' },
];

interface HabitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<HabitDraft> & { id?: string };
  onSave: (draft: HabitDraft, id?: string) => Promise<void>;
}

export function HabitForm({ open, onOpenChange, initial, onSave }: HabitFormProps) {
  const [draft, setDraft] = useState<HabitDraft>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft({ ...empty, ...initial });
  }, [open, initial]);

  function set<K extends keyof HabitDraft>(key: K, val: HabitDraft[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  async function handleSave() {
    if (!draft.name.trim()) { setError('Gi vanen et navn'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft, initial?.id);
      onOpenChange(false);
      setDraft({ ...empty });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  }

  const KINDS: { k: HabitDraft['kind']; label: string; emoji: string }[] = [
    { k: 'do', label: 'Gjør', emoji: '✨' },
    { k: 'avoid', label: 'Unngå', emoji: '🛑' },
    { k: 'measure', label: 'Mål', emoji: '📊' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Rediger vane' : 'Legg til vane'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Navn</Label>
            <Input
              id="habit-name"
              placeholder="Mediter 10 minutter"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(({ k, label, emoji }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set('kind', k)}
                  className={cn(
                    'rounded-xl border py-3 text-xs font-medium transition-colors flex flex-col items-center gap-1',
                    draft.kind === k
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent/10',
                  )}
                >
                  <span className="text-lg">{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frekvens</Label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set('target_frequency', f)}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-xs font-medium transition-colors',
                    draft.target_frequency === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent/10',
                  )}
                >
                  {f === 'daily' ? 'Daglig' : 'Ukentlig'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Hvilke dager</Label>
              <button
                type="button"
                onClick={() => set('schedule_days', [])}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                hver dag
              </button>
            </div>
            <div className="flex gap-1">
              {WEEKDAY_PILLS.map(({ num, short }) => {
                const on = draft.schedule_days.includes(num);
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      set(
                        'schedule_days',
                        on
                          ? draft.schedule_days.filter((n) => n !== num)
                          : [...draft.schedule_days, num].sort(),
                      )
                    }
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors',
                      on
                        ? 'grad-primary text-primary-foreground border-transparent'
                        : 'bg-card hover:border-primary/40',
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {draft.schedule_days.length === 0
                ? 'Vises på Hjem hver eneste dag.'
                : `Vises på Hjem ${draft.schedule_days.length} dager i uka.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Hvis du glemmer</Label>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 7].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set('grace_days', g)}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors',
                    draft.grace_days === g
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-card hover:border-primary/40',
                  )}
                >
                  {g === 0 ? 'Forsvinn' : `+${g} ${g === 1 ? 'dag' : 'dager'}`}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {draft.grace_days === 0
                ? 'Forsvinner fra Hjem ved midnatt hvis ikke gjort.'
                : `Står på Hjem opptil ${draft.grace_days} ${draft.grace_days === 1 ? 'dag' : 'dager'} ekstra.`}
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-destructive mt-3">{error}</p>}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Avbryt</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
