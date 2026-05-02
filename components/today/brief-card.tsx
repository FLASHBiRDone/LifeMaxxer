'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LoadingMessage } from '@/components/ui/loading-message';

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; questCount: number }
  | { kind: 'error'; message: string };

/**
 * The morning-brief centerpiece on /today. Two states:
 *  - empty: a big primary CTA that generates the brief
 *  - filled: shows intro + summary + clothing line, with a small
 *    refresh action in the footer. When location is missing, we
 *    surface a quick hint so the user knows why there's no clothing
 *    line instead of staring at an empty briefing.
 *
 * Replaces the old run-briefing button at the bottom of the page —
 * the brief is now the first thing the user reads after the hero.
 */
export function BriefCard({
  intro,
  summary,
  clothing,
  onGeneratedAt,
  hasLocation,
}: {
  intro: string | null;
  summary: string | null;
  clothing: string | null;
  onGeneratedAt: string | null;
  hasLocation: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const hasBrief = Boolean(intro);

  async function run() {
    setStatus({ kind: 'pending' });
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const msg = data.error ?? `HTTP ${res.status}`;
        console.error('[brief-card] failed', msg, data);
        setStatus({ kind: 'error', message: msg });
        return;
      }
      const questCount = data?.result?.questCount ?? 0;
      setStatus({ kind: 'ok', questCount });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[brief-card] network error', err);
      setStatus({ kind: 'error', message: msg });
    }
  }

  const pending = status.kind === 'pending';
  const ok = status.kind === 'ok';
  const err = status.kind === 'error';

  if (!hasBrief) {
    // Empty state — primary CTA
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 soft-shadow">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">Start dagen</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lag dagens brief – en kort oversikt og dagens hovedoppdrag.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
            'grad-primary text-primary-foreground border border-transparent disabled:opacity-70',
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <LoadingMessage context="briefing" />
            </>
          ) : err ? (
            <>
              <AlertTriangle className="h-4 w-4" /> Prøv igjen
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Lag dagens brief
            </>
          )}
        </button>
        {err && (
          <p className="text-xs text-destructive mt-2 break-words">
            {status.message}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Dagens brief
        </p>
        <p className="text-base font-semibold leading-snug">{intro}</p>
        {summary && (
          <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
        )}
        {clothing && (
          <p className="text-xs text-muted-foreground pt-1">👕 {clothing}</p>
        )}
        {!clothing && !hasLocation && (
          <p className="text-[11px] text-muted-foreground pt-1">
            👕{' '}
            <a
              href="/settings"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              Sett hjemsted
            </a>{' '}
            for værbasert klesråd.
          </p>
        )}
        {!clothing && hasLocation && (
          <p className="text-[11px] text-muted-foreground pt-1">
            Værråd kommer på neste oppdatering — trykk Oppdater under.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
        {onGeneratedAt && (
          <p className="text-[10px] text-muted-foreground">
            Oppdatert{' '}
            {new Date(onGeneratedAt).toLocaleTimeString('nb-NO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            'bg-card hover:border-primary/40',
            ok && 'border-primary/40 text-primary',
            err && 'border-destructive/40 text-destructive',
            pending && 'opacity-70',
            'ml-auto',
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <LoadingMessage context="briefing" />
            </>
          ) : ok ? (
            <>
              <Check className="h-3 w-3" /> Oppdatert
            </>
          ) : err ? (
            <>
              <AlertTriangle className="h-3 w-3" /> Feil
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" /> Oppdater
            </>
          )}
        </button>
      </div>

      {err && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1 break-words">{status.message}</p>
          <button
            type="button"
            onClick={() => setStatus({ kind: 'idle' })}
            className="text-destructive/70 hover:text-destructive flex-shrink-0"
            aria-label="Lukk"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
