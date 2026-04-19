'use client';

import { Clock } from 'lucide-react';

type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
};

function fmt(iso: string): string {
  if (!iso.includes('T')) return 'Heldagsarrangement';
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function CalendarStrip({ events }: { events: Event[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Kalender i dag
      </h2>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
              {fmt(e.start)}
            </span>
            <span className="text-sm font-medium truncate">{e.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
