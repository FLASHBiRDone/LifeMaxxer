'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Toggle for the time/weather/moon-aware dynamic theme. Defaults on.
 * Flipping it off triggers a refresh so the theme attributes on
 * <body> update in place — much nicer than waiting for the next nav.
 */
export function ThemeCard({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_dynamic: next }),
      });
      if (!res.ok) {
        setEnabled(!next);
      } else {
        router.refresh();
      }
    } catch {
      setEnabled(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Palette className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Levende tema</h2>
          <p className="text-[11px] text-muted-foreground">
            Fargene følger tid på døgnet, været og månefasen.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={pending}
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
    </section>
  );
}
