'use client';

import { Calendar } from 'lucide-react';

type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
};

function fmt(iso: string): string {
  if (!iso.includes('T')) return 'Hele dagen';
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function CalendarStrip({ events }: { events: Event[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Kalender</h2>
      </div>
      <ul className="space-y-1.5">
        {events.slice(0, 5).map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 soft-shadow"
          >
            <div className="flex-shrink-0 text-xs tabular-nums font-semibold text-primary w-14">
              {fmt(e.start)}
            </div>
            <div className="h-8 w-0.5 rounded-full grad-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate flex-1">{e.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
