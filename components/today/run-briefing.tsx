'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; questCount: number }
  | { kind: 'error'; message: string };

export function RunBriefingButton({ hasBriefing }: { hasBriefing: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function run() {
    setState({ kind: 'pending' });
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const msg = data.error ?? `HTTP ${res.status}`;
        console.error('[briefing] failed', msg, data);
        setState({ kind: 'error', message: msg });
        return;
      }
      const questCount = data?.result?.questCount ?? 0;
      setState({ kind: 'ok', questCount });
      router.refresh();
      // Return to idle after a moment so the button is re-usable
      setTimeout(() => setState({ kind: 'idle' }), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[briefing] network error', err);
      setState({ kind: 'error', message: msg });
    }
  }

  const pending = state.kind === 'pending';
  const ok = state.kind === 'ok';
  const err = state.kind === 'error';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
          'bg-card hover:border-primary/40',
          ok && 'border-primary/40 text-primary',
          err && 'border-destructive/40 text-destructive',
          pending && 'opacity-70',
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Henter brief…
          </>
        ) : ok ? (
          <>
            <Check className="h-4 w-4" /> Oppdatert · {state.questCount} oppdrag
          </>
        ) : err ? (
          <>
            <AlertTriangle className="h-4 w-4" /> Feil – prøv igjen
          </>
        ) : hasBriefing ? (
          <>
            <RefreshCw className="h-4 w-4" /> Oppdater dagens brief
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Lag brief for i dag
          </>
        )}
      </button>
      {err && (
        <p className="text-xs text-destructive break-words">{state.message}</p>
      )}
    </div>
  );
}
