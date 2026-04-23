'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/lib/prompts/locales';

/**
 * Lets the user pick the language used for AI-generated content
 * (morning brief today, more flows soon). The choice is stored on
 * user_profiles.locale and read by the briefing/meal/training jobs.
 */
export function LanguageCard({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [saving, setSaving] = useState<Locale | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: Locale) {
    if (next === locale || saving) return;
    setSaving(next);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lagre språk.');
      }
      setLocale(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Globe className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Språk</h2>
          <p className="text-[11px] text-muted-foreground">
            Brukes på AI-tekst som morgen-brief
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_LOCALES.map((l) => {
          const isActive = l === locale;
          const isLoading = saving === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => pick(l)}
              disabled={Boolean(saving)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'bg-card hover:border-primary/40',
              )}
            >
              <span className="text-sm font-semibold truncate">
                {LOCALE_LABELS[l]}
              </span>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
              ) : isActive ? (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </section>
  );
}
