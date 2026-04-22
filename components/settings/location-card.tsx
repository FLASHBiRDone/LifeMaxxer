'use client';

import { useState } from 'react';
import { Check, Loader2, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Lets the user pick a home city. On save, the PATCH /api/profile
 * endpoint geocodes the name to coordinates so the morning-briefing
 * job can pull weather from the right spot.
 */
export function LocationCard({ initialCity }: { initialCity: string | null }) {
  const [city, setCity] = useState(initialCity ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
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
      setTimeout(() => setSaved(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
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
      setTimeout(() => setSaved(null), 2500);
    } finally {
      setSaving(false);
    }
  }

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
        {initialCity && !city.trim() ? null : (
          <Button
            type="button"
            variant="outline"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              'Lagre'
            )}
          </Button>
        )}
        {initialCity && (
          <Button
            type="button"
            variant="outline"
            onClick={clearCity}
            disabled={saving}
            className="text-muted-foreground"
            aria-label="Fjern sted"
            title="Fjern sted"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {saved && (
        <p className="text-[11px] text-primary">✓ Lagret {saved}</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </section>
  );
}
