import {
  Coffee,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from 'lucide-react';

type Kind = 'morning' | 'midday' | 'afternoon' | 'evening' | 'anytime';

const META: Record<Kind, { label: string; icon: LucideIcon }> = {
  morning: { label: 'Morgen', icon: Sunrise },
  midday: { label: 'Dagens fokus', icon: Sun },
  afternoon: { label: 'Ettermiddag', icon: Sunset },
  evening: { label: 'Kveld', icon: Moon },
  anytime: { label: 'Når du har tid', icon: Coffee },
};

/**
 * Small uppercase divider that sits between groups of cards on
 * /today, giving the page a sense of a day unfolding rather than
 * a flat list. Quiet enough to skim past, loud enough to anchor.
 */
export function SectionLabel({ kind }: { kind: Kind }) {
  const { label, icon: Icon } = META[kind];
  return (
    <div className="flex items-center gap-2 px-1 pt-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 h-px bg-border/60" />
    </div>
  );
}
