'use client';

import { useState } from 'react';
import {
  Pencil,
  Pill,
  Plus,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';

export type Slot = 'morning' | 'noon' | 'evening' | 'night';

export type Supplement = {
  id: string;
  name: string;
  dose: string;
  emoji: string | null;
  color: string;
  slots: Slot[];
  schedule_days: number[];
  xp_reward: number;
  token_reward: number;
  notes: string | null;
};

type Draft = {
  name: string;
  dose: string;
  emoji: string;
  slots: Slot[];
  schedule_days: number[];
  xp_reward: number;
  token_reward: number;
  notes: string;
};

const SLOTS: { key: Slot; label: string; icon: LucideIcon }[] = [
  { key: 'morning', label: 'Morgen', icon: Sunrise },
  { key: 'noon', label: 'Lunsj', icon: Sun },
  { key: 'evening', label: 'Kveld', icon: Sunset },
  { key: 'night', label: 'Natt', icon: Moon },
];

const WEEKDAYS = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Ti' },
  { value: 3, label: 'On' },
  { value: 4, label: 'To' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Lø' },
  { value: 0, label: 'Sø' },
];

const EMPTY_DRAFT: Draft = {
  name: '',
  dose: '1',
  emoji: '💊',
  slots: ['morning'],
  schedule_days: [],
  xp_reward: 1,
  token_reward: 0,
  notes: '',
};

export function SupplementsClient({ initial }: { initial: Supplement[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [creating, setCreating] = useState(false);

  async function save(draft: Draft, id?: string) {
    const body = {
      name: draft.name.trim(),
      dose: draft.dose.trim() || '1',
      emoji: draft.emoji.trim() || null,
      slots: draft.slots,
      schedule_days: draft.schedule_days,
      xp_reward: draft.xp_reward,
      token_reward: draft.token_reward,
      notes: draft.notes.trim() || null,
    };
    if (id) {
      const res = await fetch(`/api/supplements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } else {
      const res = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setItems((prev) => [...prev, created]);
    }
  }

  async function archive(id: string) {
    if (!confirm('Arkivere dette tilskuddet? Loggene beholdes.')) return;
    const res = await fetch(`/api/supplements/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <Pill className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Daglig rytme
          </p>
          <h1 className="text-2xl font-bold">Tilskudd og vitaminer</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'oppskrift' : 'oppskrifter'}
          </p>
        </div>
      </header>

      <Button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" /> Nytt tilskudd
      </Button>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Ingen tilskudd registrert ennå. Legg til ditt første over.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border bg-card p-4 soft-shadow flex items-start gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-lg">
                {s.emoji ?? '💊'}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <span className="text-[11px] text-muted-foreground">{s.dose}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {SLOTS.filter((sl) => s.slots?.includes(sl.key)).map((sl) => {
                    const Icon = sl.icon;
                    return (
                      <span
                        key={sl.key}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                      >
                        <Icon className="h-3 w-3" />
                        {sl.label}
                      </span>
                    );
                  })}
                  {s.schedule_days?.length > 0 && s.schedule_days.length < 7 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      · {s.schedule_days.length} dager/uke
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  +{s.xp_reward} XP{s.token_reward > 0 ? ` · +${s.token_reward} ⚡` : ''}
                </p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="h-8 w-8 rounded-lg border bg-card hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Rediger"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => archive(s.id)}
                  className="h-8 w-8 rounded-lg border bg-card hover:border-destructive/40 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  aria-label="Arkiver"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <SupplementForm
          initial={editing ? draftFromSupplement(editing) : EMPTY_DRAFT}
          editingId={editing?.id ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function draftFromSupplement(s: Supplement): Draft {
  return {
    name: s.name,
    dose: s.dose,
    emoji: s.emoji ?? '💊',
    slots: s.slots ?? ['morning'],
    schedule_days: s.schedule_days ?? [],
    xp_reward: s.xp_reward ?? 1,
    token_reward: s.token_reward ?? 0,
    notes: s.notes ?? '',
  };
}

function SupplementForm({
  initial,
  editingId,
  onClose,
  onSave,
}: {
  initial: Draft;
  editingId: string | null;
  onClose: () => void;
  onSave: (draft: Draft, id?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSlot(slot: Slot) {
    setDraft((d) => {
      const has = d.slots.includes(slot);
      if (has && d.slots.length === 1) return d; // must keep at least one
      return {
        ...d,
        slots: has ? d.slots.filter((s) => s !== slot) : [...d.slots, slot],
      };
    });
  }

  function toggleDay(value: number) {
    setDraft((d) => {
      const has = d.schedule_days.includes(value);
      return {
        ...d,
        schedule_days: has
          ? d.schedule_days.filter((v) => v !== value)
          : [...d.schedule_days, value],
      };
    });
  }

  async function submit() {
    if (!draft.name.trim()) {
      setError('Navn må fylles ut.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft, editingId ?? undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border bg-card soft-shadow p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {editingId ? 'Rediger tilskudd' : 'Nytt tilskudd'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <div className="space-y-1">
              <Label htmlFor="emoji">Ikon</Label>
              <Input
                id="emoji"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 2) })}
                className="text-center text-xl"
                maxLength={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Navn</Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 80) })}
                placeholder="F.eks. Vitamin D"
                maxLength={80}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="dose">Dose</Label>
            <Input
              id="dose"
              value={draft.dose}
              onChange={(e) => setDraft({ ...draft, dose: e.target.value.slice(0, 40) })}
              placeholder="F.eks. 1 kapsel, 1000 IU"
              maxLength={40}
            />
          </div>

          <div className="space-y-1">
            <Label>Når på dagen?</Label>
            <div className="grid grid-cols-4 gap-2">
              {SLOTS.map((s) => {
                const Icon = s.icon;
                const active = draft.slots.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSlot(s.key)}
                    className={cn(
                      'rounded-xl border px-2 py-3 flex flex-col items-center gap-1 transition-all',
                      active
                        ? 'grad-primary text-primary-foreground border-transparent'
                        : 'bg-card hover:border-primary/40',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-semibold">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Hvilke dager? (tomt = hver dag)</Label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => {
                const active = draft.schedule_days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      'rounded-lg border py-2 text-xs font-semibold transition-all',
                      active
                        ? 'grad-primary text-primary-foreground border-transparent'
                        : 'bg-card hover:border-primary/40',
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="xp">XP per dose</Label>
              <Input
                id="xp"
                type="number"
                min={0}
                max={50}
                value={draft.xp_reward}
                onChange={(e) =>
                  setDraft({ ...draft, xp_reward: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tokens">Tokens per dose</Label>
              <Input
                id="tokens"
                type="number"
                min={0}
                max={20}
                value={draft.token_reward}
                onChange={(e) =>
                  setDraft({ ...draft, token_reward: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notat (valgfritt)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value.slice(0, 500) })}
              placeholder="Ta gjerne med mat, etc."
              maxLength={500}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Avbryt
          </Button>
          <Button type="button" onClick={submit} disabled={saving} className="flex-1">
            {saving ? 'Lagrer …' : editingId ? 'Lagre endringer' : 'Legg til'}
          </Button>
        </div>
      </div>
    </div>
  );
}
