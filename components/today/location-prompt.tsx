'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2, MapPin, X } from 'lucide-react';
import { resolveDeviceLocation } from '@/lib/geo-client';
import { cn } from '@/lib/cn';

const DISMISS_KEY = 'lm_location_prompt_dismissed_at';

/**
 * One-time banner that asks the user to share their device location
 * so the morning brief can include weather + clothing advice. Hides
 * itself once the user accepts, dismisses, or has previously
 * dismissed (tracked in localStorage so we don't nag).
 */
export function LocationPrompt({ alreadyHasCity }: { alreadyHasCity: boolean }) {
  const [hidden, setHidden] = useState(true); // default hidden until effect runs
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (alreadyHasCity) return;
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      if (!dismissed) setHidden(false);
    } catch {
      setHidden(false);
    }
  }, [alreadyHasCity]);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch { /* ignore */ }
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const loc = await resolveDeviceLocation();
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: loc.city,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lagre posisjonen.');
      }
      setDone(loc.city);
      window.setTimeout(() => setHidden(true), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setBusy(false);
    }
  }

  if (hidden || alreadyHasCity) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-4 soft-shadow flex items-start gap-3',
        'border-primary/30 bg-primary/5',
      )}
    >
      <div className="h-9 w-9 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="text-sm font-semibold">Få vær i morgenbriefen</p>
          <p className="text-[11px] text-muted-foreground">
            Del posisjonen din én gang så foreslår vi hva du skal ha på.
          </p>
        </div>
        {done ? (
          <p className="text-xs text-primary inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Lagret {done}
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl grad-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 disabled:opacity-70"
            >
              {busy ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Henter…</>
              ) : (
                'Bruk min posisjon'
              )}
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              Sett manuelt <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        disabled={busy}
        className="text-muted-foreground/70 hover:text-foreground flex-shrink-0"
        aria-label="Lukk"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
