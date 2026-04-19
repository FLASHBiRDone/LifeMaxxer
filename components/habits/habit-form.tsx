'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

const DAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];

export type HabitDraft = {
  title: string;
  description: string;
  cue: string;
  frequency: 'daily' | 'weekly' | 'custom';
  days_of_week: number[];
  target_count: number;
};

const empty: HabitDraft = {
  title: '',
  description: '',
  cue: '',
  frequency: 'daily',
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  target_count: 1,
};

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

  function set<K extends keyof HabitDraft>(key: K, val: HabitDraft[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function toggleDay(day: number) {
    setDraft((d) => {
      const has = d.days_of_week.includes(day);
      return {
        ...d,
        days_of_week: has
          ? d.days_of_week.filter((x) => x !== day)
          : [...d.days_of_week, day].sort(),
      };
    });
  }

  async function handleSave() {
    if (!draft.title.trim()) { setError('Gi vanen et navn'); return; }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Rediger vane' : 'Legg til vane'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-title">Navn</Label>
            <Input
              id="habit-title"
              placeholder="Mediter 10 minutter"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-cue">Trigger / når</Label>
            <Input
              id="habit-cue"
              placeholder="Etter frokost"
              value={draft.cue}
              onChange={(e) => set('cue', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-desc">Notat (valgfritt)</Label>
            <Textarea
              id="habit-desc"
              placeholder="Hva er poenget med denne vanen?"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Frekvens</Label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'custom'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set('frequency', f)}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-xs font-medium transition-colors',
                    draft.frequency === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent/10',
                  )}
                >
                  {f === 'daily' ? 'Daglig' : f === 'weekly' ? 'Ukentlig' : 'Tilpasset'}
                </button>
              ))}
            </div>
          </div>

          {draft.frequency === 'custom' && (
            <div className="space-y-2">
              <Label>Dager</Label>
              <div className="flex gap-1.5">
                {DAYS.map((name, i) => {
                  const day = i + 1;
                  const active = draft.days_of_week.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-xs font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'border hover:bg-accent/10',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
