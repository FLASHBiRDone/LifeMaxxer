'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; questCount: number; at: number }
  | { kind: 'error'; message: string };

export function RunBriefingButton({ hasBriefing }: { hasBriefing: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function run() {
    setStatus({ kind: 'pending' });
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const msg = data.error ?? `HTTP ${res.status}`;
        console.error('[briefing] failed', msg, data);
        setStatus({ kind: 'error', message: msg });
        return;
      }
      const questCount = data?.result?.questCount ?? 0;
      // Set the toast FIRST so it's queued before we kick the router to
      // re-fetch server data. The toast persists until the user dismisses
      // it or clicks the button again — no auto-clear, so no race with
      // the server refresh remounting parts of the tree.
      setStatus({ kind: 'ok', questCount, at: Date.now() });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[briefing] network error', err);
      setStatus({ kind: 'error', message: msg });
    }
  }

  const pending = status.kind === 'pending';
  const ok = status.kind === 'ok';
  const err = status.kind === 'error';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
          'bg-card hover:border-primary/40',
          pending && 'opacity-70',
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Henter brief…
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

      {ok && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary animate-fade-up"
        >
          <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">
            Brief oppdatert
            {status.questCount > 0 && (
              <>
                {' '}
                · {status.questCount}{' '}
                {status.questCount === 1 ? 'nytt oppdrag' : 'nye oppdrag'}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setStatus({ kind: 'idle' })}
            className="text-primary/70 hover:text-primary flex-shrink-0"
            aria-label="Lukk"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
    </div>
  );
}
