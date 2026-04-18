'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RunBriefingButton({ hasBriefing }: { hasBriefing: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/briefing/run', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Noe gikk galt');
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground disabled:opacity-60"
      >
        {pending
          ? 'Henter…'
          : hasBriefing
            ? 'Oppdater dagens brief'
            : 'Lag brief for i dag'}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
