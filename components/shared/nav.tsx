'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Brain, CalendarDays, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const tabs = [
  { href: '/today', icon: Sparkles, label: 'I dag' },
  { href: '/inbox', icon: Brain, label: 'Inbox' },
  { href: '/calendar', icon: CalendarDays, label: 'Kalender' },
  { href: '/stats', icon: BarChart3, label: 'Statistikk' },
  { href: '/settings', icon: Settings, label: 'Meg' },
];

const HIDE_ON = ['/login', '/auth', '/onboarding'];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-sm px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="rounded-[2rem] border bg-card/90 backdrop-blur-xl soft-shadow">
          <ul className="flex items-stretch px-1">
            {tabs.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/today' && pathname.startsWith(href));
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full grad-primary" />
                    )}
                    <Icon className={cn('h-5 w-5 mt-1', active && 'stroke-[2.5]')} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
