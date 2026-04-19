'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Flame, Inbox, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const tabs = [
  { href: '/today', icon: Sparkles, label: 'I dag' },
  { href: '/habits', icon: Flame, label: 'Vaner' },
  { href: '/inbox', icon: Inbox, label: 'Innboks' },
  { href: '/stats', icon: CalendarDays, label: 'Statistikk' },
  { href: '/settings', icon: Settings, label: 'Innstillinger' },
];

const HIDE_ON = ['/login', '/auth', '/onboarding'];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/90 backdrop-blur-md pb-safe">
      <div className="container max-w-xl mx-auto px-0">
        <ul className="flex items-stretch">
          {tabs.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/today' && pathname.startsWith(href));
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
