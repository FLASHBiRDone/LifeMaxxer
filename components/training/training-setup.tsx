'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Flame,
  Gauge,
  Heart,
  Home,
  Loader2,
  Move,
  Scale,
  Sparkles,
  Target,
  Timer,
  Trees,
  Warehouse,
  Weight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { TrainingGoal, TrainingEquipment } from '@/lib/prompts';

export type TrainingPreferences = {
  goals: TrainingGoal[];
  experience: 'beginner' | 'intermediate' | 'advanced';
  days_per_week: number;
  minutes_per_session: number;
  equipment: TrainingEquipment[];
  location: 'home' | 'gym' | 'outdoor' | 'mixed';
  injuries: string | null;
  notes: string | null;
};

type GoalOption = {
  value: TrainingGoal;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  { value: 'lose_weight', label: 'Gå ned i vekt', hint: 'Høyere volum, kortere pauser', icon: Scale },
  { value: 'gain_strength', label: 'Bli sterkere', hint: 'Tunge lifts, 3–6 reps', icon: Weight },
  { value: 'gain_muscle', label: 'Bygge muskler', hint: '8–12 reps, 60–90s pause', icon: Dumbbell },
  { value: 'tone', label: 'Forme kroppen', hint: '10–15 reps, mix styrke + kondis', icon: Sparkles },
  { value: 'conditioning', label: 'Bedre kondis', hint: 'Intervaller, sirkeltrening', icon: Heart },
  { value: 'mobility', label: 'Mer bevegelighet', hint: 'Yoga, stretching, mobility', icon: Move },
];

type EquipmentOption = {
  value: TrainingEquipment;
  label: string;
};

const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  { value: 'bodyweight', label: 'Bare kroppen' },
  { value: 'dumbbells', label: 'Manualer' },
  { value: 'barbell', label: 'Stang + vekter' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bands', label: 'Strikk' },
  { value: 'pullup_bar', label: 'Pull-up stang' },
  { value: 'bench', label: 'Benk' },
  { value: 'cardio_machine', label: 'Kondisapparat' },
  { value: 'full_gym', label: 'Helt treningssenter' },
];

type LocationOption = {
  value: TrainingPreferences['location'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const LOCATION_OPTIONS: LocationOption[] = [
  { value: 'home', label: 'Hjemme', icon: Home },
  { value: 'gym', label: 'Treningssenter', icon: Warehouse },
  { value: 'outdoor', label: 'Utendørs', icon: Trees },
  { value: 'mixed', label: 'Blanding', icon: Move },
];

type ExperienceOption = {
  value: TrainingPreferences['experience'];
  label: string;
  hint: string;
};

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  { value: 'beginner', label: 'Nybegynner', hint: 'Under 6 mnd, lærer teknikk' },
  { value: 'intermediate', label: 'Middels', hint: '6 mnd–2 år, komfortabel' },
  { value: 'advanced', label: 'Erfaren', hint: '2+ år, kjenner programmet' },
];

export function TrainingSetup({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: TrainingPreferences | null;
  onSubmit: (prefs: TrainingPreferences) => void | Promise<void>;
  onCancel?: () => void;
  saving: boolean;
}) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<TrainingPreferences>(
    initial ?? {
      goals: [],
      experience: 'beginner',
      days_per_week: 3,
      minutes_per_session: 45,
      equipment: [],
      location: 'home',
      injuries: null,
      notes: null,
    },
  );

  function toggleGoal(g: TrainingGoal) {
    setPrefs((p) => ({
      ...p,
      goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g],
    }));
  }

  function toggleEquipment(e: TrainingEquipment) {
    setPrefs((p) => ({
      ...p,
      equipment: p.equipment.includes(e)
        ? p.equipment.filter((x) => x !== e)
        : [...p.equipment, e],
    }));
  }

  const steps = [
    {
      title: 'Hva vil du oppnå?',
      hint: 'Velg en eller flere – første har høyest prioritet',
      canAdvance: prefs.goals.length > 0,
      body: (
        <div className="grid grid-cols-1 gap-2">
          {GOAL_OPTIONS.map((g) => {
            const on = prefs.goals.includes(g.value);
            const idx = prefs.goals.indexOf(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGoal(g.value)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3 text-left transition-all',
                  on
                    ? 'border-primary bg-primary/5'
                    : 'bg-card hover:border-primary/40',
                )}
              >
                <span
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    on ? 'grad-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <g.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{g.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{g.hint}</span>
                </span>
                {on && (
                  <span className="h-6 w-6 rounded-full grad-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Hvor trent er du?',
      hint: 'Styrer volum og øvelsesvalg',
      canAdvance: true,
      body: (
        <div className="space-y-2">
          {EXPERIENCE_OPTIONS.map((e) => {
            const on = prefs.experience === e.value;
            return (
              <button
                key={e.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, experience: e.value }))}
                className={cn(
                  'w-full text-left rounded-2xl border p-3 transition-all',
                  on ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/40',
                )}
              >
                <p className="text-sm font-semibold">{e.label}</p>
                <p className="text-[11px] text-muted-foreground">{e.hint}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Hvor ofte og hvor lenge?',
      hint: 'Vi sørger for nok hvile mellom øktene',
      canAdvance: true,
      body: (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium inline-flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" /> Dager per uke
              </span>
              <span className="text-lg font-bold tabular">{prefs.days_per_week}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, days_per_week: n }))}
                  className={cn(
                    'h-10 rounded-lg text-sm font-semibold border transition-colors',
                    prefs.days_per_week === n
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-card hover:border-primary/40',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium inline-flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" /> Minutter per økt
              </span>
              <span className="text-lg font-bold tabular">{prefs.minutes_per_session}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[20, 30, 45, 60, 90].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, minutes_per_session: n }))}
                  className={cn(
                    'h-10 rounded-lg text-sm font-semibold border transition-colors',
                    prefs.minutes_per_session === n
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-card hover:border-primary/40',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Hvor trener du?',
      hint: 'Velg utstyr du faktisk har',
      canAdvance: true,
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {LOCATION_OPTIONS.map((l) => {
              const on = prefs.location === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, location: l.value }))}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border py-3 transition-all',
                    on ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center',
                      on ? 'grad-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <l.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-medium">{l.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Utstyr</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((e) => {
                const on = prefs.equipment.includes(e.value);
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => toggleEquipment(e.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      on
                        ? 'grad-primary text-primary-foreground border-transparent'
                        : 'bg-card hover:border-primary/40',
                    )}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Skader eller ting vi bør vite?',
      hint: 'Valgfritt – hjelper oss unngå risikable øvelser',
      canAdvance: true,
      body: (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Skader / begrensninger
            </label>
            <Textarea
              rows={2}
              maxLength={500}
              placeholder="F.eks. vondt i nedre rygg, dårlig skulder…"
              value={prefs.injuries ?? ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, injuries: e.target.value || null }))
              }
              className="resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Andre ønsker
            </label>
            <Textarea
              rows={2}
              maxLength={500}
              placeholder="F.eks. vil holde meg unna knebøy, liker yoga…"
              value={prefs.notes ?? ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, notes: e.target.value || null }))
              }
              className="resize-none"
            />
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  async function next() {
    if (isLast) {
      await onSubmit(prefs);
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step === 0) {
      onCancel?.();
    } else {
      setStep((s) => s - 1);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {steps.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'grad-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold">{current.title}</h2>
        <p className="text-xs text-muted-foreground">{current.hint}</p>
      </div>

      <div>{current.body}</div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={back} disabled={saving}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 0 ? 'Avbryt' : 'Tilbake'}
        </Button>
        <Button
          type="button"
          onClick={next}
          disabled={!current.canAdvance || saving}
          className="flex-1 grad-primary text-primary-foreground border-transparent"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLast ? (
            <>
              <Sparkles className="h-4 w-4 mr-1" /> Lag programmet
            </>
          ) : (
            <>
              Neste <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
