'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { resolveDeviceLocation } from '@/lib/geo-client';

/**
 * Small action that re-detects the user's current device location and
 * saves it. Useful when traveling or when the saved city is stale —
 * mobile users can tap once to make weather follow them. We do NOT
 * auto-detect on every page load; that would be privacy-noisy and
 * surprising. The user opts in each time.
 */
export function WeatherRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
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
      if (res.ok) router.refresh();
    } catch {
      /* user denied or offline — leave the widget as-is */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      className="h-8 w-8 rounded-lg border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-50"
      aria-label="Oppdater posisjon"
      title="Oppdater posisjon fra enheten"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
