'use client';

import { useState } from 'react';
import { disablePush, enablePush } from '@/lib/push-client';

export function PushToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setMessage(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        const result = await enablePush();
        if (result.ok) {
          setEnabled(true);
        } else if (result.reason === 'denied') {
          setMessage('Varsler er slått av i nettleseren.');
        } else if (result.reason === 'unsupported') {
          setMessage('Denne enheten støtter ikke varsler ennå.');
        } else {
          setMessage('Noe glapp. Prøv igjen senere.');
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Morgenvarsel</h2>
          <p className="text-sm text-muted-foreground">
            Ett varsel klokken 07:30. Kun hvis du vil.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
            enabled
              ? 'bg-primary text-primary-foreground border-primary'
              : 'hover:bg-accent/10'
          }`}
        >
          {enabled ? 'På' : 'Av'}
        </button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
