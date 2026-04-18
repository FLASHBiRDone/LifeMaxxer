'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { osloDayBounds } from '@/lib/time';

type Level = 'low' | 'medium' | 'high';

export function EnergyCheckIn({
  initialLevel,
}: {
  initialLevel: Level | null;
}) {
  const t = useTranslations();
  const [level, setLevel] = useState<Level | null>(initialLevel);
  const [isPending, startTransition] = useTransition();

  function set(next: Level) {
    setLevel(next);
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { dateString } = osloDayBounds();
      await supabase.from('mana_logs').upsert({
        user_id: user.id,
        logged_for: dateString,
        level: next,
      });
    });
  }

  const options: { key: Level; label: string }[] = [
    { key: 'low', label: t('today.energy_low') },
    { key: 'medium', label: t('today.energy_medium') },
    { key: 'high', label: t('today.energy_high') },
  ];

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('today.energy_prompt')}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const selected = level === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => set(o.key)}
              disabled={isPending}
              className={`rounded-2xl border px-3 py-4 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent/10'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
