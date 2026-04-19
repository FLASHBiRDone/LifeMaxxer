'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { osloDayBounds } from '@/lib/time';
import { cn } from '@/lib/cn';

type Level = 'low' | 'medium' | 'high';

const OPTIONS: { key: Level; labelKey: string; emoji: string }[] = [
  { key: 'low', labelKey: 'today.energy_low', emoji: '🌱' },
  { key: 'medium', labelKey: 'today.energy_medium', emoji: '🌤️' },
  { key: 'high', labelKey: 'today.energy_high', emoji: '⚡' },
];

export function EnergyCheckIn({ initialLevel }: { initialLevel: Level | null }) {
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

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground font-medium">
        {t('today.energy_prompt')}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const selected = level === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => set(o.key)}
              disabled={isPending}
              className={cn(
                'rounded-2xl border px-3 py-4 text-center transition-all soft-shadow',
                selected
                  ? 'grad-primary text-primary-foreground border-transparent scale-[1.02]'
                  : 'bg-card hover:scale-[1.02] hover:border-primary/40',
              )}
            >
              <div className={cn('text-2xl mb-1', selected && 'animate-pop')}>{o.emoji}</div>
              <div className="text-xs font-semibold">{t(o.labelKey)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
