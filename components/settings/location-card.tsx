'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, LocateFixed, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveDeviceLocation } from '@/lib/geo-client';

/**
 * Lets the user pick a home city. Two paths:
 *  - Type a name → server geocodes via Open-Meteo
 *  - Tap "Bruk min posisjon" → browser geolocation + reverse geocode
 *    via BigDataCloud (client-side), submit lat/lon directly so the
 *    server skips the lookup
 */
export function LocationCard({ initialCity }: { initialCity: string | null }) {
  const router = useRouter();
  const [city, setCity] = useState(initialCity ?? '');
  const [saving, setSaving] = useState(false);
  const [usingDevice, setUsingDevice] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveByName() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lagre stedet.');
      }
      const { geocode } = (await res.json()) as {
        geocode: { city: string; country: string | null } | null;
      };
      if (geocode) {
        setCity(geocode.city);
        setSaved(`${geocode.city}${geocode.country ? `, ${geocode.country}` : ''}`);
      } else {
        setSaved('Fjernet');
      }
      // Re-fetch the server component so the new value persists on
      // reload — without this the client state has the new city but
      // the next render still reads the stale prop.
      router.refresh();
      setTimeout(() => setSaved(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  }

  async function useDevice() {
    setUsingDevice(true);
    setSaved(null);
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
        throw new Error(body.error ?? 'Kunne ikke lagre posisjon.');
      }
      setCity(loc.city);
      setSaved(`${loc.city}${loc.country ? `, ${loc.country}` : ''}`);
      router.refresh();
      setTimeout(() => setSaved(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setUsingDevice(false);
    }
  }

  async function clearCity() {
    setCity('');
    setSaving(true);
    setError(null);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: null }),
      });
      setSaved('Fjernet');
      router.refresh();
      setTimeout(() => setSaved(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || usingDevice;

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Hjemsted</h2>
          <p className="text-[11px] text-muted-foreground">
            Brukes til værmelding i morgen-briefen
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value.slice(0, 120))}
          placeholder="F.eks. Oslo"
          maxLength={120}
        />
        <Button
          type="button"
          variant="outline"
          onClick={saveByName}
          disabled={busy || !city.trim()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved && !usingDevice ? (
            <Check className="h-4 w-4" />
          ) : (
            'Lagre'
          )}
        </Button>
        {initialCity && (
          <Button
            type="button"
            variant="outline"
            onClick={clearCity}
            disabled={busy}
            className="text-muted-foreground"
            aria-label="Fjern sted"
            title="Fjern sted"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={useDevice}
        disabled={busy}
        className="w-full"
      >
        {usingDevice ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Henter posisjon…</>
        ) : (
          <><LocateFixed className="h-4 w-4 mr-2" /> Bruk min posisjon</>
        )}
      </Button>

      {saved && <p className="text-[11px] text-primary">✓ Lagret {saved}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </section>
  );
}
