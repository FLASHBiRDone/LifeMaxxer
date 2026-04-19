'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Check, Calendar, Flame, Trash2 } from 'lucide-react';
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
  const dow = new Date().getDay();
  const iso = dow === 0 ? 7 : dow;
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
  const doneCount = dueToday.filter((h) => loggedToday.has(h.id)).length;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Rutiner du bygger
          </p>
          <h1 className="text-3xl font-bold">Vaner</h1>
        </div>

        {dueToday.length > 0 && (
          <div className="rounded-2xl grad-hero border p-4 flex items-center gap-4">
            <div className="flex-shrink-0 h-12 w-12 rounded-2xl grad-primary flex items-center justify-center text-primary-foreground">
              <Flame className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {doneCount} av {dueToday.length} vaner gjort i dag
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full grad-primary transition-all duration-500"
                  style={{ width: `${(doneCount / Math.max(1, dueToday.length)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {habits.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/50 p-12 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full grad-hero flex items-center justify-center">
            <Flame className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Ingen vaner enda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start med én liten rutine. Mindre er mer.
            </p>
          </div>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Legg til din første
          </Button>
        </div>
      ) : (
        <>
          {dueToday.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Andre dager
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

      <button
        type="button"
        onClick={() => { setEditing(null); setFormOpen(true); }}
        aria-label="Ny vane"
        className="fixed bottom-28 right-6 z-30 h-14 w-14 rounded-full grad-primary text-primary-foreground shadow-lg soft-shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
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
  return (
    <li className="group rounded-2xl border bg-card overflow-hidden soft-shadow card-hover">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={logged ? 'Merk som ikke gjort' : 'Merk som gjort'}
          className={cn(
            'mt-0.5 h-7 w-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
            logged
              ? 'grad-primary border-transparent text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary',
            logged && 'animate-pop',
          )}
        >
          {logged && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0 pt-0.5">
          <p className={cn('text-sm font-semibold leading-snug', logged && 'line-through text-muted-foreground')}>
            {habit.title}
          </p>
          {habit.cue && (
            <p className="text-xs text-muted-foreground mt-1">{habit.cue}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge variant="secondary">{FREQ_LABEL[habit.frequency] ?? habit.frequency}</Badge>
            {logged && <Badge variant="success">✓ Gjort</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onAddToCalendar}
            disabled={addingCalendar}
            title="Legg til i Google Calendar"
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Rediger"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Arkiver"
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
