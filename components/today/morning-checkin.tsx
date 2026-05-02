'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bed,
  CalendarPlus,
  Check,
  Eye,
  Loader2,
  Moon,
  PencilLine,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { LoadingMessage } from '@/components/ui/loading-message';

type Level = 'low' | 'medium' | 'high';
type Step = 'energy' | 'rested' | 'focus' | 'extra' | 'generating' | 'error';
type ExtraKind = 'calendar' | 'dream' | 'note';

const LEVEL_OPTIONS: { key: Level; label: string; emoji: string }[] = [
  { key: 'low', label: 'Lavt', emoji: '🌱' },
  { key: 'medium', label: 'Middels', emoji: '🌤️' },
  { key: 'high', label: 'Høyt', emoji: '⚡' },
];

const PROMPTS: Record<
  'energy' | 'rested' | 'focus',
  { icon: LucideIcon; title: string; sub: string }
> = {
  energy: {
    icon: Zap,
    title: 'Hvordan er energien?',
    sub: 'Et raskt magefølelse-svar holder.',
  },
  rested: {
    icon: Bed,
    title: 'Føler du deg uthvilt?',
    sub: 'Hvordan sov du, og hvor opplagt er du nå?',
  },
  focus: {
    icon: Eye,
    title: 'Klarer du å fokusere?',
    sub: 'Hodet klart eller litt grumsete i dag?',
  },
};

/**
 * The morning ritual on /today. Walks the user through energy →
 * rested → focus, then offers an optional one-off (calendar item,
 * dream journal entry, or quick note) before generating the brief.
 *
 * Each step saves immediately so a half-finished ritual still leaves
 * useful data behind for the briefing job + stats. When the brief is
 * generated the parent re-renders and BriefCard takes over — this
 * component goes away until tomorrow.
 */
export function MorningCheckin({
  initialEnergy,
  initialRested,
  initialFocus,
}: {
  initialEnergy: Level | null;
  initialRested: Level | null;
  initialFocus: Level | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => {
    if (!initialEnergy) return 'energy';
    if (!initialRested) return 'rested';
    if (!initialFocus) return 'focus';
    return 'extra';
  });
  const [energy, setEnergy] = useState<Level | null>(initialEnergy);
  const [rested, setRested] = useState<Level | null>(initialRested);
  const [focus, setFocus] = useState<Level | null>(initialFocus);
  const [extraKind, setExtraKind] = useState<ExtraKind | null>(null);
  const [extraText, setExtraText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pickLevel(field: 'level' | 'rested' | 'focus', value: Level) {
    if (field === 'level') setEnergy(value);
    if (field === 'rested') setRested(value);
    if (field === 'focus') setFocus(value);
    startTransition(async () => {
      try {
        const res = await fetch('/api/mana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Kunne ikke lagre svaret.');
        }
        if (field === 'level') setStep('rested');
        else if (field === 'rested') setStep('focus');
        else setStep('extra');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Noe gikk galt');
      }
    });
  }

  async function submitExtra() {
    setErrorMessage(null);
    const text = extraText.trim();

    if (extraKind && text) {
      try {
        if (extraKind === 'calendar') {
          // No quick-add endpoint exists yet; for now we stash it in
          // the inbox with a "📅" prefix so the user can sweep it into
          // the calendar with one tap from /inbox.
          const r = await fetch('/api/inbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `📅 ${text}` }),
          });
          if (!r.ok) throw new Error('Klarte ikke å lagre i kalender-listen.');
        } else if (extraKind === 'dream') {
          // Dreams go straight to the inbox tagged with 🌙 so they
          // show up grouped on /huskelister and the morning brief can
          // reference recurring patterns later.
          const r = await fetch('/api/inbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `🌙 ${text}` }),
          });
          if (!r.ok) throw new Error('Klarte ikke å lagre drømmenotat.');
        } else {
          // "Notér noe" stays on the mana_logs row as an extra_note —
          // the briefing prompt picks it up so today's plan can react
          // to whatever the user mentioned.
          const r = await fetch('/api/mana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extra_note: text }),
          });
          if (!r.ok) throw new Error('Klarte ikke å lagre notatet.');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Noe gikk galt');
        return;
      }
    }

    setStep('generating');
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Noe gikk galt');
      setStep('error');
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 soft-shadow space-y-4">
      <Header step={step} />

      {step === 'energy' && (
        <LevelPicker
          field="level"
          selected={energy}
          onPick={pickLevel}
          disabled={isPending}
        />
      )}

      {step === 'rested' && (
        <>
          <BackBar onBack={() => setStep('energy')} />
          <LevelPicker
            field="rested"
            selected={rested}
            onPick={pickLevel}
            disabled={isPending}
          />
        </>
      )}

      {step === 'focus' && (
        <>
          <BackBar onBack={() => setStep('rested')} />
          <LevelPicker
            field="focus"
            selected={focus}
            onPick={pickLevel}
            disabled={isPending}
          />
        </>
      )}

      {step === 'extra' && (
        <>
          <BackBar onBack={() => setStep('focus')} />
          <ExtraStep
            kind={extraKind}
            text={extraText}
            onPickKind={setExtraKind}
            onChangeText={setExtraText}
            onSubmit={submitExtra}
            disabled={isPending}
          />
        </>
      )}

      {step === 'generating' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <LoadingMessage context="briefing" />
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <button
            type="button"
            onClick={submitExtra}
            className="inline-flex items-center gap-1 rounded-xl grad-primary text-primary-foreground text-sm font-semibold px-3 py-2"
          >
            Prøv igjen
          </button>
        </div>
      )}

      {errorMessage && step !== 'error' && (
        <p className="text-[11px] text-destructive">{errorMessage}</p>
      )}
    </section>
  );
}

function Header({ step }: { step: Step }) {
  if (step === 'generating' || step === 'error') {
    return (
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">Lager dagens brief</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bruker svarene dine til å skreddersy dagen.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'extra') {
    return (
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <PencilLine className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">Noe du vil notere?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valgfritt — hopp over hvis du heller vil gå rett til briefen.
          </p>
        </div>
        <Pill step="4 / 4" />
      </div>
    );
  }

  const config = PROMPTS[step];
  const Icon = config.icon;
  const num = step === 'energy' ? '1 / 4' : step === 'rested' ? '2 / 4' : '3 / 4';
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-bold">{config.title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{config.sub}</p>
      </div>
      <Pill step={num} />
    </div>
  );
}

function Pill({ step }: { step: string }) {
  return (
    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground bg-card border rounded-full px-2 py-0.5 flex-shrink-0">
      {step}
    </span>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-[11px] text-muted-foreground hover:text-foreground"
    >
      ← Forrige
    </button>
  );
}

function LevelPicker({
  field,
  selected,
  onPick,
  disabled,
}: {
  field: 'level' | 'rested' | 'focus';
  selected: Level | null;
  onPick: (field: 'level' | 'rested' | 'focus', value: Level) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LEVEL_OPTIONS.map((o) => {
        const isSelected = selected === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(field, o.key)}
            disabled={disabled}
            className={cn(
              'rounded-2xl border px-3 py-4 text-center transition-all soft-shadow',
              isSelected
                ? 'grad-primary text-primary-foreground border-transparent scale-[1.02]'
                : 'bg-card hover:scale-[1.02] hover:border-primary/40',
              disabled && 'opacity-70',
            )}
          >
            <div className="text-2xl mb-1">{o.emoji}</div>
            <div className="text-xs font-semibold">{o.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function ExtraStep({
  kind,
  text,
  onPickKind,
  onChangeText,
  onSubmit,
  disabled,
}: {
  kind: ExtraKind | null;
  text: string;
  onPickKind: (k: ExtraKind | null) => void;
  onChangeText: (s: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const KINDS: { key: ExtraKind; label: string; icon: LucideIcon; placeholder: string }[] = [
    {
      key: 'calendar',
      label: 'Kalender',
      icon: CalendarPlus,
      placeholder: 'Hva må du huske å gjøre i dag?',
    },
    {
      key: 'dream',
      label: 'Drømmejournal',
      icon: Moon,
      placeholder: 'Hva drømte du i natt?',
    },
    {
      key: 'note',
      label: 'Notér noe',
      icon: PencilLine,
      placeholder: 'En tanke, et humør, noe på hjertet …',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = kind === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => onPickKind(active ? null : k.key)}
              disabled={disabled}
              className={cn(
                'rounded-2xl border px-2 py-3 text-center transition-all flex flex-col items-center gap-1.5',
                active
                  ? 'grad-primary text-primary-foreground border-transparent'
                  : 'bg-card hover:border-primary/40',
                disabled && 'opacity-70',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px] font-semibold">{k.label}</span>
            </button>
          );
        })}
      </div>

      {kind && (
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value.slice(0, 1000))}
          placeholder={KINDS.find((k) => k.key === kind)!.placeholder}
          rows={3}
          maxLength={1000}
          className="w-full rounded-xl border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            onPickKind(null);
            onChangeText('');
            onSubmit();
          }}
          disabled={disabled}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Hopp over
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || (kind !== null && !text.trim())}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl grad-primary text-primary-foreground text-sm font-semibold px-4 py-2',
            'disabled:opacity-50',
          )}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {kind ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Lag dagens brief
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
