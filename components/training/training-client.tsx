'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Coffee,
  Dumbbell,
  Heart,
  Loader2,
  Move,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Shuffle,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingMessage } from '@/components/ui/loading-message';
import { cn } from '@/lib/cn';
import type {
  TrainingDay,
  TrainingExercise,
  TrainingPlanOutput,
} from '@/lib/prompts';
import { TrainingSetup, type TrainingPreferences } from './training-setup';

type ExerciseKey = `${number}-${number}`; // dayIndex-exerciseIndex

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
  initialIsCommitted,
  initialExerciseLogs,
}: {
  initialPreferences: TrainingPreferences | null;
  initialPlan: TrainingPlanOutput | null;
  initialPlanId: string | null;
  initialPlanCreatedAt: string | null;
  initialIsCommitted: boolean;
  initialExerciseLogs: Array<{ day_index: number; exercise_index: number }>;
}) {
  const [preferences, setPreferences] = useState<TrainingPreferences | null>(initialPreferences);
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(initialPlan);
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [planCreatedAt, setPlanCreatedAt] = useState<string | null>(initialPlanCreatedAt);
  const [isCommitted, setIsCommitted] = useState(initialIsCommitted);
  const [completedMap, setCompletedMap] = useState<Set<ExerciseKey>>(
    () => new Set(initialExerciseLogs.map((l) => `${l.day_index}-${l.exercise_index}` as ExerciseKey)),
  );
  const [showSetup, setShowSetup] = useState(!initialPreferences);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [togglingKey, setTogglingKey] = useState<ExerciseKey | null>(null);
  const [swappingDay, setSwappingDay] = useState<number | null>(null);
  const [deletingDay, setDeletingDay] = useState<number | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<
    | { kind: 'added'; count: number }
    | { kind: 'no_tokens' }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const todayIndex = useMemo(() => {
    const d = new Date().getDay(); // 0=Sun..6=Sat
    return d === 0 ? 6 : d - 1;
  }, []);

  const weeklyStats = useMemo(() => {
    if (!plan) return { done: 0, total: 0, percent: 0 };
    const total = plan.days
      .map((d) => d.exercises.length)
      .reduce((a, b) => a + b, 0);
    const done = completedMap.size;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [plan, completedMap]);

  function dayStats(dayIndex: number, dayExercises: TrainingExercise[]) {
    const total = dayExercises.length;
    const done = dayExercises.reduce(
      (acc, _, exIdx) =>
        acc + (completedMap.has(`${dayIndex}-${exIdx}` as ExerciseKey) ? 1 : 0),
      0,
    );
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }

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
      // Immediately generate the first plan after saving preferences
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
    setCalendarStatus(null);
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
      setIsCommitted(false);
      setCompletedMap(new Set());
      setOpenDay(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setGenerating(false);
    }
  }

  async function commitPlan() {
    if (!planId) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch('/api/training/plan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planMessageId: planId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke forplikte plan');
      }
      const { calendar } = await res.json();
      setIsCommitted(true);
      if (calendar?.status === 'added') {
        setCalendarStatus({ kind: 'added', count: calendar.created });
      } else if (calendar?.status === 'skipped' && calendar.reason === 'no_tokens') {
        setCalendarStatus({ kind: 'no_tokens' });
      } else if (calendar?.status === 'error') {
        setCalendarStatus({ kind: 'error', message: calendar.message });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setCommitting(false);
    }
  }

  async function toggleExercise(dayIndex: number, exerciseIndex: number) {
    if (!planId) return;
    const key = `${dayIndex}-${exerciseIndex}` as ExerciseKey;
    if (togglingKey === key) return;

    // Optimistic update
    const wasDone = completedMap.has(key);
    setCompletedMap((prev) => {
      const next = new Set(prev);
      if (wasDone) next.delete(key);
      else next.add(key);
      return next;
    });
    setTogglingKey(key);

    try {
      const res = await fetch('/api/training/exercise-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planMessageId: planId,
          dayIndex,
          exerciseIndex,
        }),
      });
      if (!res.ok) {
        // Roll back
        setCompletedMap((prev) => {
          const next = new Set(prev);
          if (wasDone) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    } finally {
      setTogglingKey(null);
    }
  }

  async function swapDay(dayIndex: number) {
    if (!planId || swappingDay !== null) return;
    setSwappingDay(dayIndex);
    setError(null);
    try {
      const res = await fetch('/api/training/plan/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planMessageId: planId, dayIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke bytte dag');
      }
      const { day: newDay } = await res.json();
      setPlan((p) => {
        if (!p) return p;
        const nextDays = [...p.days];
        nextDays[dayIndex] = newDay;
        return { ...p, days: nextDays };
      });
      // Clear any ticked exercises for that day (exercise indices may shift)
      setCompletedMap((prev) => {
        const next = new Set(prev);
        for (const k of prev) {
          if (k.startsWith(`${dayIndex}-`)) next.delete(k);
        }
        return next;
      });
      setOpenDay(dayIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSwappingDay(null);
    }
  }

  async function deleteDay(dayIndex: number) {
    if (!planId || deletingDay !== null) return;
    setDeletingDay(dayIndex);
    setError(null);
    try {
      const res = await fetch('/api/training/plan/day', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planMessageId: planId, dayIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke slette dag');
      }
      const { day: newDay } = await res.json();
      setPlan((p) => {
        if (!p) return p;
        const nextDays = [...p.days];
        nextDays[dayIndex] = newDay;
        return { ...p, days: nextDays };
      });
      setCompletedMap((prev) => {
        const next = new Set(prev);
        for (const k of prev) {
          if (k.startsWith(`${dayIndex}-`)) next.delete(k);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setDeletingDay(null);
    }
  }

  async function deletePlan() {
    if (!planId || deletingPlan) return;
    const confirmed = window.confirm(
      'Er du sikker på at du vil slette treningsprogrammet? Kalender-hendelsene fjernes også.',
    );
    if (!confirmed) return;
    setDeletingPlan(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/plan?id=${planId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke slette plan');
      }
      setPlan(null);
      setPlanId(null);
      setPlanCreatedAt(null);
      setIsCommitted(false);
      setCompletedMap(new Set());
      setOpenDay(null);
      setCalendarStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setDeletingPlan(false);
    }
  }

  if (showSetup) {
    return (
      <div className="space-y-5">
        <Header subtitle="5 korte spørsmål – vi lager en plan tilpasset deg" />
        <TrainingSetup
          initial={preferences}
          onSubmit={savePreferences}
          onCancel={preferences ? () => setShowSetup(false) : undefined}
          saving={savingPrefs || generating}
        />
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive break-words"
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        subtitle={
          plan
            ? isCommitted
              ? `Aktiv plan · ${weeklyStats.done}/${weeklyStats.total} øvelser (${weeklyStats.percent}%)`
              : 'Forhåndsvisning – ikke forpliktet ennå'
            : 'Ingen plan ennå'
        }
        onEditSettings={() => setShowSetup(true)}
      />

      {plan && (
        <>
          {/* Weekly progress ring + meta */}
          {isCommitted && weeklyStats.total > 0 && (
            <WeeklyProgress
              done={weeklyStats.done}
              total={weeklyStats.total}
              percent={weeklyStats.percent}
            />
          )}

          <section className="rounded-2xl border bg-card p-4 space-y-2 soft-shadow">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Oversikt
            </p>
            <p className="text-sm leading-relaxed">{plan.summary}</p>
            <p className="text-[11px] text-muted-foreground">
              Anbefalt varighet: {plan.weeksSuggested} uker
            </p>
          </section>

          {!isCommitted && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Klar til å forplikte seg?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Forplikt deg for å legge øktene i LifeMaxxing-kalenderen
                    og koble vanen «Trening» til øvelsene.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={commitPlan}
                disabled={committing}
                className="w-full grad-primary text-primary-foreground border-transparent"
              >
                {committing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Forplikter…</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" /> Forplikt meg til denne planen</>
                )}
              </Button>
            </div>
          )}

          {isCommitted && calendarStatus?.kind === 'added' && (
            <div className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground inline-flex items-center gap-2 soft-shadow">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Lagt til {calendarStatus.count} økter i LifeMaxxing-kalenderen
            </div>
          )}
          {isCommitted && calendarStatus?.kind === 'no_tokens' && (
            <p className="text-xs text-muted-foreground px-1">
              Koble til Google Kalender i{' '}
              <a href="/settings" className="underline text-primary">
                Innstillinger
              </a>{' '}
              for å se øktene på LifeMaxxing-kalenderen.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={generatePlan}
              disabled={generating}
              className="flex-1"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /><LoadingMessage context="training_plan" /></>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Ny plan</>
              )}
            </Button>
            {planId && (
              <Button
                type="button"
                variant="outline"
                onClick={deletePlan}
                disabled={deletingPlan}
                className="text-destructive border-destructive/40 hover:bg-destructive/5"
                aria-label="Slett plan"
              >
                {deletingPlan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive break-words"
            >
              {error}
            </div>
          )}

          <ul className="space-y-2.5">
            {plan.days.map((d, idx) => {
              const isOpen = openDay === idx;
              const Icon = TYPE_ICON[d.type];
              const isRest = d.type === 'rest';
              const isToday = idx === todayIndex;
              const stats = dayStats(idx, d.exercises);
              return (
                <li
                  key={idx}
                  className={cn(
                    'rounded-2xl border overflow-hidden soft-shadow transition-colors',
                    isRest ? 'bg-muted/40 border-border/60' : 'bg-card',
                    isToday && 'ring-1 ring-primary/40',
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
                      <p className="text-sm font-semibold truncate">
                        {d.day}
                        {isToday && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-primary font-bold">
                            i dag
                          </span>
                        )}
                        <span className="text-muted-foreground font-normal">
                          {' · '}
                          {d.title}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {d.focus}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold text-primary/80">
                          {TYPE_LABEL[d.type]}
                        </span>
                        {!isRest && d.duration > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {d.duration} min
                          </span>
                        )}
                        {!isRest && stats.total > 0 && isCommitted && (
                          <span
                            className={cn(
                              'font-semibold tabular',
                              stats.percent === 100 ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {stats.done}/{stats.total} · {stats.percent}%
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
                      {d.imageUrl && (
                        <div className="-mx-4 -mt-4 aspect-video w-[calc(100%+2rem)] overflow-hidden bg-muted">
                          <img
                            src={d.imageUrl}
                            alt={d.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
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
                          {isCommitted && stats.total > 0 && (
                            <ProgressBar percent={stats.percent} />
                          )}
                          <ul className="space-y-2 mt-3">
                            {d.exercises.map((ex, i) => {
                              const key = `${idx}-${i}` as ExerciseKey;
                              const done = completedMap.has(key);
                              return (
                                <ExerciseRow
                                  key={i}
                                  exercise={ex}
                                  done={done}
                                  toggling={togglingKey === key}
                                  onToggle={
                                    isCommitted
                                      ? () => toggleExercise(idx, i)
                                      : undefined
                                  }
                                />
                              );
                            })}
                          </ul>
                          {!isCommitted && (
                            <p className="text-[11px] text-muted-foreground mt-3">
                              Forplikt deg til planen for å kunne krysse av øvelser.
                            </p>
                          )}
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

                      {planId && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => swapDay(idx)}
                            disabled={swappingDay !== null || deletingDay !== null}
                            className="flex-1"
                          >
                            {swappingDay === idx ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Bytter…
                              </>
                            ) : (
                              <>
                                <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Bytt økt
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteDay(idx)}
                            disabled={deletingDay !== null || swappingDay !== null}
                            className="text-destructive border-destructive/40 hover:bg-destructive/5"
                            aria-label="Gjør til hviledag"
                          >
                            {deletingDay === idx ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isOpen && isRest && (
                    <div className="border-t border-border/60 bg-muted/20 overflow-hidden">
                      {d.imageUrl && (
                        <div className="aspect-video bg-muted">
                          <img
                            src={d.imageUrl}
                            alt={d.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="px-4 py-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Hviledag – gi kroppen en pause.
                        </p>
                        {planId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => swapDay(idx)}
                            disabled={swappingDay !== null || deletingDay !== null}
                            className="w-full"
                          >
                            {swappingDay === idx ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Bytter…
                              </>
                            ) : (
                              <>
                                <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Gjør om til økt
                              </>
                            )}
                          </Button>
                        )}
                      </div>
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
                  <li key={i} className="leading-relaxed">• {t}</li>
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
                  <li key={i} className="leading-relaxed">• {t}</li>
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

      {!plan && (
        <div className="rounded-3xl border bg-card p-8 text-center space-y-3 soft-shadow">
          <div className="mx-auto h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold">Klar for første plan?</p>
          <Button
            type="button"
            onClick={generatePlan}
            disabled={generating}
            className="grad-primary text-primary-foreground border-transparent"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /><LoadingMessage context="training_plan" /></>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Lag plan</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function Header({
  subtitle,
  onEditSettings,
}: {
  subtitle: string;
  onEditSettings?: () => void;
}) {
  return (
    <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
      <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
        <Dumbbell className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          Trening
        </p>
        <h1 className="text-2xl font-bold">Ukens program</h1>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {onEditSettings && (
        <button
          type="button"
          onClick={onEditSettings}
          className="h-9 w-9 rounded-xl border bg-card hover:border-primary/40 transition-colors flex items-center justify-center flex-shrink-0"
          aria-label="Endre preferanser"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}

function WeeklyProgress({
  done,
  total,
  percent,
}: {
  done: number;
  total: number;
  percent: number;
}) {
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference * (1 - percent / 100);
  return (
    <section className="rounded-2xl border bg-card p-5 flex items-center gap-4 soft-shadow">
      <div className="relative h-16 w-16 flex-shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="url(#gradRing)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 240ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
          />
          <defs>
            <linearGradient id="gradRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--grad-a))" />
              <stop offset="100%" stopColor="hsl(var(--grad-b))" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold tabular">{percent}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ukens fremgang
        </p>
        <p className="text-sm mt-0.5">
          <span className="font-bold tabular">{done}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="font-semibold tabular">{total}</span>
          <span className="text-muted-foreground"> øvelser</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          Synkes med vanen «Trening»
        </p>
      </div>
    </section>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full grad-primary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
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

function ExerciseRow({
  exercise,
  done,
  toggling,
  onToggle,
}: {
  exercise: TrainingExercise;
  done: boolean;
  toggling: boolean;
  onToggle?: () => void;
}) {
  const interactive = Boolean(onToggle);
  const Element = (interactive ? 'button' : 'div') as React.ElementType;
  return (
    <li>
      <Element
        type={interactive ? 'button' : undefined}
        onClick={onToggle}
        disabled={toggling}
        className={cn(
          'w-full rounded-xl border bg-background px-3 py-2.5 flex items-center gap-3 text-left transition-colors',
          interactive && 'hover:border-primary/40 card-hover',
          done && 'bg-primary/5 border-primary/30',
        )}
      >
        <span
          className={cn(
            'h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
            done
              ? 'grad-primary border-transparent text-primary-foreground'
              : 'border-muted-foreground/40',
            !interactive && 'opacity-40',
          )}
          aria-hidden
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : done ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : null}
        </span>
        {exercise.imageUrl && (
          <span
            className={cn(
              'h-11 w-11 rounded-lg overflow-hidden bg-muted flex-shrink-0',
              done && 'opacity-60',
            )}
            aria-hidden
          >
            <img
              src={exercise.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-semibold truncate',
              done && 'line-through text-muted-foreground',
            )}
          >
            {exercise.name}
          </p>
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
      </Element>
    </li>
  );
}
