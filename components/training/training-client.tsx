'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Clock,
  Coffee,
  Dumbbell,
  Heart,
  Loader2,
  Move,
  RefreshCw,
  Settings2,
  Sparkles,
  Check,
  ShieldAlert,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type {
  TrainingDay,
  TrainingExercise,
  TrainingPlanOutput,
} from '@/lib/prompts';
import { TrainingSetup, type TrainingPreferences } from './training-setup';

type Log = {
  day_index: number;
  completed_at: string;
};

const TYPE_ICON: Record<TrainingDay['type'], React.ComponentType<{ className?: string }>> = {
  strength: Dumbbell,
  cardio: Heart,
  conditioning: Zap,
  mobility: Move,
  rest: Coffee,
};

const TYPE_LABEL: Record<TrainingDay['type'], string> = {
  strength: 'Styrke',
  cardio: 'Kondis',
  conditioning: 'Intervall',
  mobility: 'Mobility',
  rest: 'Hvile',
};

function restLabel(seconds: number): string {
  if (seconds <= 0) return '–';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

export function TrainingClient({
  initialPreferences,
  initialPlan,
  initialPlanId,
  initialPlanCreatedAt,
  initialLogs,
}: {
  initialPreferences: TrainingPreferences | null;
  initialPlan: TrainingPlanOutput | null;
  initialPlanId: string | null;
  initialPlanCreatedAt: string | null;
  initialLogs: Log[];
}) {
  const [preferences, setPreferences] = useState<TrainingPreferences | null>(initialPreferences);
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(initialPlan);
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [planCreatedAt, setPlanCreatedAt] = useState<string | null>(initialPlanCreatedAt);
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [showSetup, setShowSetup] = useState(!initialPreferences);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [logging, setLogging] = useState<number | null>(null);

  // Keyed "YYYY-MM-DD" → doneTodayDayIndexSet (so we highlight done-today)
  const doneToday = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const set = new Set<number>();
    for (const l of logs) {
      if (l.completed_at.slice(0, 10) === todayStr) set.add(l.day_index);
    }
    return set;
  }, [logs]);

  const weeklyCount = useMemo(() => {
    // Completed in last 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return logs.filter((l) => new Date(l.completed_at).getTime() >= cutoff).length;
  }, [logs]);

  async function savePreferences(prefs: TrainingPreferences) {
    setSavingPrefs(true);
    setError(null);
    try {
      const res = await fetch('/api/training/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lagre');
      }
      setPreferences(prefs);
      setShowSetup(false);
      // Auto-generate first plan right after saving preferences
      await generatePlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function generatePlan() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/training/plan', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lage programmet');
      }
      const { plan: p, messageId, createdAt } = await res.json();
      setPlan(p);
      setPlanId(messageId);
      setPlanCreatedAt(createdAt);
      setOpenDay(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setGenerating(false);
    }
  }

  async function logSession(dayIndex: number) {
    if (logging !== null) return;
    setLogging(dayIndex);
    try {
      const res = await fetch('/api/training/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planMessageId: planId,
          dayIndex,
          notes: null,
        }),
      });
      if (res.ok) {
        setLogs((prev) => [
          { day_index: dayIndex, completed_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    } finally {
      setLogging(null);
    }
  }

  if (showSetup) {
    return (
      <div className="space-y-5">
        <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
          <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
              Trening
            </p>
            <h1 className="text-2xl font-bold">Sett opp programmet</h1>
            <p className="text-xs text-muted-foreground mt-1">
              5 korte spørsmål – vi lager en plan tilpasset deg
            </p>
          </div>
        </header>
        <TrainingSetup
          initial={preferences}
          onSubmit={savePreferences}
          onCancel={preferences ? () => setShowSetup(false) : undefined}
          saving={savingPrefs || generating}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <Dumbbell className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Trening
          </p>
          <h1 className="text-2xl font-bold">Ukens program</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {plan
              ? `${plan.days.filter((d) => d.type !== 'rest').length} treningsøkter`
              : 'Ingen plan ennå'}
          </p>
          {plan && (
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular">
              {weeklyCount} fullført denne uken
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="h-9 w-9 rounded-xl border bg-card hover:border-primary/40 transition-colors flex items-center justify-center flex-shrink-0"
          aria-label="Endre preferanser"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </header>

      {!plan && (
        <div className="rounded-3xl border bg-card p-8 text-center space-y-3 soft-shadow">
          <div className="mx-auto h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold">Klar for første plan?</p>
          <p className="text-xs text-muted-foreground">
            AI lager et program ut fra preferansene du nettopp satte.
          </p>
          <Button
            type="button"
            onClick={generatePlan}
            disabled={generating}
            className="grad-primary text-primary-foreground border-transparent"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Lager…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Lag plan</>
            )}
          </Button>
        </div>
      )}

      {plan && (
        <>
          <section className="rounded-2xl border bg-card p-4 space-y-2 soft-shadow">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Oversikt
            </p>
            <p className="text-sm leading-relaxed">{plan.summary}</p>
            <p className="text-[11px] text-muted-foreground">
              Anbefalt varighet: {plan.weeksSuggested} uker
            </p>
          </section>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={generatePlan}
              disabled={generating}
              className="flex-1"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Lager…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Ny plan</>
              )}
            </Button>
          </div>

          {error && <p className="text-xs text-destructive px-1">{error}</p>}

          <ul className="space-y-2.5">
            {plan.days.map((d, idx) => {
              const isOpen = openDay === idx;
              const Icon = TYPE_ICON[d.type];
              const isRest = d.type === 'rest';
              const completedToday = doneToday.has(idx);
              return (
                <li
                  key={idx}
                  className={cn(
                    'rounded-2xl border overflow-hidden soft-shadow transition-colors',
                    isRest ? 'bg-muted/40 border-border/60' : 'bg-card',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : idx)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/5 transition-colors"
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        isRest
                          ? 'bg-muted text-muted-foreground'
                          : 'grad-primary text-primary-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">
                          {d.day}
                          <span className="text-muted-foreground font-normal">
                            {' · '}
                            {d.title}
                          </span>
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {d.focus}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold text-primary/80">
                          {TYPE_LABEL[d.type]}
                        </span>
                        {!isRest && d.duration > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {d.duration} min
                          </span>
                        )}
                        {completedToday && (
                          <span className="inline-flex items-center gap-1 text-primary font-semibold">
                            <Check className="h-3 w-3" /> Fullført
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground flex-shrink-0 mt-2 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {isOpen && !isRest && (
                    <div className="border-t border-border/60 px-4 py-4 space-y-4 bg-muted/20">
                      {d.warmup.length > 0 && (
                        <ExpandSection label="Oppvarming">
                          <ul className="space-y-1">
                            {d.warmup.map((w, i) => (
                              <li key={i} className="text-sm">
                                • {w}
                              </li>
                            ))}
                          </ul>
                        </ExpandSection>
                      )}

                      {d.exercises.length > 0 && (
                        <ExpandSection label="Øvelser">
                          <ul className="space-y-2">
                            {d.exercises.map((ex, i) => (
                              <ExerciseRow key={i} exercise={ex} />
                            ))}
                          </ul>
                        </ExpandSection>
                      )}

                      {d.cooldown.length > 0 && (
                        <ExpandSection label="Nedkjøling">
                          <ul className="space-y-1">
                            {d.cooldown.map((c, i) => (
                              <li key={i} className="text-sm">
                                • {c}
                              </li>
                            ))}
                          </ul>
                        </ExpandSection>
                      )}

                      <Button
                        type="button"
                        onClick={() => logSession(idx)}
                        disabled={logging === idx || completedToday}
                        className={cn(
                          'w-full border-transparent',
                          completedToday
                            ? 'bg-muted text-muted-foreground'
                            : 'grad-primary text-primary-foreground',
                        )}
                      >
                        {logging === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : completedToday ? (
                          <><Check className="h-4 w-4 mr-1.5" /> Fullført i dag</>
                        ) : (
                          <><Check className="h-4 w-4 mr-1.5" /> Marker som fullført</>
                        )}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {plan.progressionTips.length > 0 && (
            <section className="rounded-2xl border bg-card p-4 space-y-2 soft-shadow">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Progresjon
              </p>
              <ul className="space-y-1 text-sm">
                {plan.progressionTips.map((t, i) => (
                  <li key={i} className="leading-relaxed">
                    • {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.safetyNotes.length > 0 && (
            <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-destructive inline-flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Sikkerhet
              </p>
              <ul className="space-y-1 text-sm">
                {plan.safetyNotes.map((t, i) => (
                  <li key={i} className="leading-relaxed">
                    • {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {planCreatedAt && (
            <p className="text-[10px] text-muted-foreground text-center pt-2">
              Program laget{' '}
              {new Date(planCreatedAt).toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ExpandSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function ExerciseRow({ exercise }: { exercise: TrainingExercise }) {
  return (
    <li className="rounded-xl border bg-background px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{exercise.name}</p>
          {exercise.notes && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {exercise.notes}
            </p>
          )}
        </div>
        <div className="text-right tabular flex-shrink-0">
          <p className="text-sm font-semibold">
            {exercise.sets} × {exercise.reps}
          </p>
          <p className="text-[10px] text-muted-foreground">
            pause {restLabel(exercise.restSeconds)}
          </p>
        </div>
      </div>
    </li>
  );
}
