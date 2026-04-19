'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { disablePush, enablePush } from '@/lib/push-client';
import { cn } from '@/lib/cn';

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
    <section className="rounded-2xl border bg-card p-5 soft-shadow">
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0',
          enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}>
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Morgenvarsel</h2>
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              role="switch"
              aria-checked={enabled}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors flex-shrink-0',
                enabled ? 'grad-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  enabled ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ett varsel klokken 07:30. Kun hvis du vil.
          </p>
          {message && <p className="text-xs text-muted-foreground mt-2">{message}</p>}
        </div>
      </div>
    </section>
  );
}
