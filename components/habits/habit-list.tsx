'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Check, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HabitForm, type HabitDraft } from './habit-form';
import { cn } from '@/lib/cn';

export type Habit = {
  id: string;
  title: string;
  description: string | null;
  cue: string | null;
  frequency: string;
  days_of_week: number[];
  target_count: number;
  active: boolean;
};

type LoggedSet = Set<string>;

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daglig',
  weekly: 'Ukentlig',
  custom: 'Tilpasset',
};

function isDueToday(habit: Habit): boolean {
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekly') return true;
  const dow = new Date().getDay(); // 0=Sun, 1=Mon...
  const iso = dow === 0 ? 7 : dow; // convert to ISO 1=Mon, 7=Sun
  return (habit.days_of_week ?? []).includes(iso);
}

export function HabitList({
  habits: initialHabits,
  loggedToday: initialLogged,
}: {
  habits: Habit[];
  loggedToday: string[];
}) {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [loggedToday, setLoggedToday] = useState<LoggedSet>(new Set(initialLogged));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [isPending, startTransition] = useTransition();
  const [addingCalendar, setAddingCalendar] = useState<string | null>(null);

  async function handleSave(draft: HabitDraft, id?: string) {
    if (id) {
      const res = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } else {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setHabits((prev) => [...prev, created]);
    }
  }

  function toggleLog(habit: Habit) {
    const wasLogged = loggedToday.has(habit.id);
    setLoggedToday((prev) => {
      const next = new Set(prev);
      wasLogged ? next.delete(habit.id) : next.add(habit.id);
      return next;
    });
    startTransition(async () => {
      await fetch(`/api/habits/${habit.id}/log`, { method: 'POST' });
    });
  }

  async function addToCalendar(habit: Habit) {
    setAddingCalendar(habit.id);
    try {
      const now = new Date();
      const start = new Date(now);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const res = await fetch('/api/google/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: habit.title,
          description: habit.cue ? `Trigger: ${habit.cue}` : undefined,
          start: start.toISOString(),
          end: end.toISOString(),
          colorId: '2',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Kunne ikke legge til i kalender');
      }
    } finally {
      setAddingCalendar(null);
    }
  }

  async function deleteHabit(id: string) {
    if (!confirm('Arkiver denne vanen?')) return;
    await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  const dueToday = habits.filter(isDueToday);
  const notDueToday = habits.filter((h) => !isDueToday(h));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Vaner</h1>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          Ny vane
        </Button>
      </div>

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">Ingen vaner enda.</p>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Legg til din første vane
          </Button>
        </div>
      ) : (
        <>
          {dueToday.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                I dag
              </h2>
              <ul className="space-y-2">
                {dueToday.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    logged={loggedToday.has(habit.id)}
                    onToggle={() => toggleLog(habit)}
                    onEdit={() => { setEditing(habit); setFormOpen(true); }}
                    onDelete={() => deleteHabit(habit.id)}
                    onAddToCalendar={() => addToCalendar(habit)}
                    addingCalendar={addingCalendar === habit.id}
                    disabled={isPending}
                  />
                ))}
              </ul>
            </section>
          )}

          {notDueToday.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ikke i dag
              </h2>
              <ul className="space-y-2">
                {notDueToday.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    logged={loggedToday.has(habit.id)}
                    onToggle={() => toggleLog(habit)}
                    onEdit={() => { setEditing(habit); setFormOpen(true); }}
                    onDelete={() => deleteHabit(habit.id)}
                    onAddToCalendar={() => addToCalendar(habit)}
                    addingCalendar={addingCalendar === habit.id}
                    disabled
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <HabitForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        initial={editing ? {
          id: editing.id,
          title: editing.title,
          description: editing.description ?? undefined,
          cue: editing.cue ?? undefined,
          frequency: editing.frequency as 'daily' | 'weekly' | 'custom',
          days_of_week: editing.days_of_week,
          target_count: editing.target_count,
        } : undefined}
        onSave={handleSave}
      />
    </div>
  );
}

function HabitCard({
  habit,
  logged,
  onToggle,
  onEdit,
  onDelete,
  onAddToCalendar,
  addingCalendar,
  disabled,
}: {
  habit: Habit;
  logged: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToCalendar: () => void;
  addingCalendar: boolean;
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={logged ? 'Merk som ikke gjort' : 'Merk som gjort'}
          className={cn(
            'mt-0.5 h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
            logged
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary',
          )}
        >
          {logged && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium leading-snug', logged && 'line-through text-muted-foreground')}>
            {habit.title}
          </p>
          {habit.cue && (
            <p className="text-xs text-muted-foreground mt-0.5">{habit.cue}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="secondary">{FREQ_LABEL[habit.frequency] ?? habit.frequency}</Badge>
            {logged && <Badge variant="success">Gjort i dag</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onAddToCalendar}
            disabled={addingCalendar}
            title="Legg til i kalender"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Rediger"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
