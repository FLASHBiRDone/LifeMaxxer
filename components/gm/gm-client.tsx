'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sunrise,
  ArrowRight,
  Sparkles,
  CalendarDays,
  Flame,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Level = 'low' | 'medium' | 'high';

type Quest = { title: string; why: string };

type CalEvent = { id: string; title: string; start: string };

type Habit = { id: string; name: string };

export function GmClient({
  initialLevel,
  briefing,
  todayEvents,
  pendingHabits,
  todayString,
}: {
  initialLevel: Level | null;
  briefing: { intro: string; quests: Quest[] } | null;
  todayEvents: CalEvent[];
  pendingHabits: Habit[];
  todayString: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level | null>(initialLevel);
  const [savingLevel, setSavingLevel] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [localBriefing, setLocalBriefing] = useState(briefing);
  const [_pending, startTransition] = useTransition();

  const steps = ['hello', 'energy', 'brief', 'today', 'start'] as const;
  const total = steps.length;
  const current = steps[step];

  function next() {
    if (step < total - 1) setStep(step + 1);
    else router.push('/today');
  }

  async function setEnergy(lvl: Level) {
    setLevel(lvl);
    setSavingLevel(true);
    try {
      await fetch('/api/mana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl, logged_for: todayString }),
      });
    } finally {
      setSavingLevel(false);
    }
  }

  async function generateBriefing() {
    setGeneratingBrief(true);
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.briefing) setLocalBriefing(data.briefing);
        else {
          // fallback: refresh page to pick up new briefing
          startTransition(() => router.refresh());
        }
      }
    } finally {
      setGeneratingBrief(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] flex flex-col py-6 px-5 space-y-6">
      {/* progress dots */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i < step && 'w-6 bg-primary/40',
              i === step && 'w-10 grad-primary',
              i > step && 'w-6 bg-muted',
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex items-center">
        <div className="w-full">
          {current === 'hello' && <StepHello />}
          {current === 'energy' && (
            <StepEnergy level={level} savingLevel={savingLevel} onSelect={setEnergy} />
          )}
          {current === 'brief' && (
            <StepBrief
              briefing={localBriefing}
              generating={generatingBrief}
              onGenerate={generateBriefing}
            />
          )}
          {current === 'today' && (
            <StepToday events={todayEvents} habits={pendingHabits} />
          )}
          {current === 'start' && <StepStart />}
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={next}
        disabled={current === 'energy' && !level}
        className="w-full grad-primary text-primary-foreground border-transparent h-14 text-base font-semibold"
      >
        {current === 'start' ? 'Start dagen' : 'Neste'}
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}

function StepHello() {
  const h = new Date().getHours();
  const greeting =
    h < 5
      ? 'God natt'
      : h < 12
      ? 'God morgen'
      : h < 17
      ? 'God ettermiddag'
      : h < 22
      ? 'God kveld'
      : 'God natt';

  return (
    <div className="text-center space-y-5">
      <div className="mx-auto h-24 w-24 rounded-3xl grad-primary text-primary-foreground flex items-center justify-center soft-shadow animate-pop">
        <Sunrise className="h-12 w-12" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-black">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          La oss ta dagen i en rolig start.
        </p>
      </div>
    </div>
  );
}

function StepEnergy({
  level,
  savingLevel,
  onSelect,
}: {
  level: Level | null;
  savingLevel: boolean;
  onSelect: (l: Level) => void;
}) {
  const options: { key: Level; label: string; emoji: string; desc: string }[] = [
    { key: 'low', label: 'Lav', emoji: '🌱', desc: 'En rolig dag' },
    { key: 'medium', label: 'Ok', emoji: '🌤️', desc: 'Helt greit' },
    { key: 'high', label: 'Høy', emoji: '⚡', desc: 'Full fart' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Hvordan er energien?</h2>
        <p className="text-sm text-muted-foreground">Ingen riktig svar. Bare vær ærlig.</p>
      </div>
      <div className="space-y-3">
        {options.map((o) => {
          const selected = level === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onSelect(o.key)}
              disabled={savingLevel}
              className={cn(
                'w-full flex items-center gap-4 rounded-2xl border-2 p-4 transition-all soft-shadow text-left',
                selected
                  ? 'grad-primary text-primary-foreground border-transparent scale-[1.01]'
                  : 'bg-card hover:border-primary/40',
              )}
            >
              <span className={cn('text-4xl', selected && 'animate-pop')}>{o.emoji}</span>
              <div className="flex-1">
                <p className="text-lg font-bold">{o.label}</p>
                <p className={cn('text-xs', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {o.desc}
                </p>
              </div>
              {selected && <Check className="h-5 w-5 flex-shrink-0" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBrief({
  briefing,
  generating,
  onGenerate,
}: {
  briefing: { intro: string; quests: { title: string; why: string }[] } | null;
  generating: boolean;
  onGenerate: () => void;
}) {
  if (!briefing) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Dagens brief</h2>
          <p className="text-sm text-muted-foreground">
            Game Master har ikke laget noe ennå. Vil du ha en brief?
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onGenerate}
          disabled={generating}
          className="w-full"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Henter…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Lag brief</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold">Dagens brief</h2>
      </div>

      <div className="rounded-2xl border bg-card p-5 soft-shadow">
        <p className="text-sm leading-relaxed">{briefing.intro}</p>
      </div>

      {briefing.quests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Foreslåtte oppdrag
          </p>
          <ul className="space-y-2">
            {briefing.quests.map((q, i) => (
              <li key={i} className="rounded-2xl border bg-card p-4 soft-shadow space-y-1">
                <p className="text-sm font-semibold">{q.title}</p>
                <p className="text-xs text-muted-foreground">{q.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepToday({ events, habits }: { events: CalEvent[]; habits: Habit[] }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Det som venter</h2>
        <p className="text-sm text-muted-foreground">En rask titt på dagen.</p>
      </div>

      {events.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Kalender
            </h3>
          </div>
          <ul className="space-y-2">
            {events.slice(0, 3).map((e) => {
              const when = new Date(e.start).toLocaleTimeString('nb-NO', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li key={e.id} className="rounded-2xl border bg-card p-3.5 soft-shadow flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-primary min-w-[3rem]">
                    {when}
                  </span>
                  <span className="flex-1 text-sm truncate">{e.title}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {habits.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Flame className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Vaner i dag
            </h3>
          </div>
          <ul className="space-y-2">
            {habits.slice(0, 3).map((h) => (
              <li
                key={h.id}
                className="rounded-2xl border bg-card p-3.5 soft-shadow text-sm font-medium"
              >
                {h.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 && habits.length === 0 && (
        <div className="rounded-2xl border bg-card p-6 text-center space-y-2 soft-shadow">
          <p className="text-sm font-medium">Helt åpent</p>
          <p className="text-xs text-muted-foreground">
            Ingen møter, ingen ventende vaner. Det er en gave.
          </p>
        </div>
      )}
    </div>
  );
}

function StepStart() {
  return (
    <div className="text-center space-y-6">
      <div className="mx-auto h-28 w-28 rounded-full grad-primary text-primary-foreground flex items-center justify-center soft-shadow">
        <Check className="h-14 w-14" strokeWidth={3} />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black">Klar?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Ta én ting av gangen. Du trenger ikke rekke alt i dag.
        </p>
      </div>
    </div>
  );
}
