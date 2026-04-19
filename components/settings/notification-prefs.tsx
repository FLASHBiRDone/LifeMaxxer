'use client';

import { useState } from 'react';
import { ChefHat, Sunrise, Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';

type Prefs = {
  morning_briefing_enabled: boolean;
  dinner_panic_enabled: boolean;
  weekly_debrief_enabled: boolean;
};

type Key = keyof Prefs;

const ROWS: Array<{
  key: Key;
  icon: React.ReactNode;
  label: string;
  hint: string;
}> = [
  {
    key: 'morning_briefing_enabled',
    icon: <Sunrise className="h-4 w-4" />,
    label: 'Morgen-briefing',
    hint: '07:30 · dagens oppdrag',
  },
  {
    key: 'dinner_panic_enabled',
    icon: <ChefHat className="h-4 w-4" />,
    label: 'Middagsminner',
    hint: '16:30 · dagens meny',
  },
  {
    key: 'weekly_debrief_enabled',
    icon: <Trophy className="h-4 w-4" />,
    label: 'Ukesoppsummering',
    hint: 'Søndag 18:00 · XP & streaks',
  },
];

export function NotificationPreferences({
  pushEnabled,
  initial,
}: {
  pushEnabled: boolean;
  initial: Prefs;
}) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [pending, setPending] = useState<Key | null>(null);

  async function toggle(key: Key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPending(key);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) setPrefs(prefs);
    } catch {
      setPrefs(prefs);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Hvilke varsler</h2>
        {!pushEnabled && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Slå på «Morgenvarsel» over for å motta disse.
          </p>
        )}
      </div>
      <div className="divide-y divide-border/50 -mx-1">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-1 py-3">
            <div
              className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
                prefs[r.key] && pushEnabled
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-[11px] text-muted-foreground">{r.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[r.key]}
              onClick={() => toggle(r.key)}
              disabled={pending === r.key}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors flex-shrink-0',
                prefs[r.key] ? 'grad-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  prefs[r.key] ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
