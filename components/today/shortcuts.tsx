import Link from 'next/link';
import { ChefHat, Dumbbell, Inbox, ShoppingBasket, Store, Trophy } from 'lucide-react';

const SHORTCUTS = [
  { href: '/marked', icon: Store, label: 'Marked' },
  { href: '/training', icon: Dumbbell, label: 'Trening' },
  { href: '/recipes', icon: ChefHat, label: 'Middager' },
  { href: '/shopping', icon: ShoppingBasket, label: 'Handleliste' },
  { href: '/inbox', icon: Inbox, label: 'Huskelister' },
  { href: '/rewards', icon: Trophy, label: 'Belønninger' },
] as const;

export function TodayShortcuts() {
  return (
    <nav aria-label="Snarveier" className="grid grid-cols-3 gap-2">
      {SHORTCUTS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 soft-shadow card-hover"
        >
          <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-[11px] font-medium text-center leading-tight">
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
