'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, RefreshCw, ExternalLink, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewEventDialog } from './new-event-dialog';
import { DayCarousel } from './day-carousel';
import { cn } from '@/lib/cn';

type CalEvent = {
  id: string;
  google_event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  description: string | null;
  completed: boolean;
};

type Quest = {
  id: string;
  title: string;
  scheduled_time: string | null;
  completed_at: string | null;
  calendar_event_id: string | null;
};

const DAY_START = 6;
const DAY_END = 23;
const HOUR_HEIGHT = 56;

function parseISOToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}–${e.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
}

function longDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function CalendarDay({
  dateString,
  todayString,
  connected,
  events,
  quests,
  syncError,
}: {
  dateString: string;
  todayString: string;
  connected: boolean;
  events: CalEvent[];
  quests: Quest[];
  syncError: string | null;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefillStart, setPrefillStart] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [_isPending, startTransition] = useTransition();

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = DAY_START; h <= DAY_END; h++) arr.push(h);
    return arr;
  }, []);

  const scheduledQuests = quests.filter((q) => q.scheduled_time);
  const unscheduledQuests = quests.filter((q) => !q.scheduled_time);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  function openNewEventAtHour(h: number) {
    const d = new Date(dateString + 'T00:00:00');
    d.setHours(h, 0, 0, 0);
    setPrefillStart(d.toISOString());
    setDialogOpen(true);
  }

  function openNewEventNow() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    setPrefillStart(d.toISOString());
    setDialogOpen(true);
  }

  async function toggleEventComplete(event: CalEvent) {
    // optimistic update
    startTransition(async () => {
      await fetch(`/api/calendar/events/${event.id}/toggle`, { method: 'POST' });
      router.refresh();
    });
  }

  const isToday = dateString === todayString;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Dagsplan
          </p>
          <h1 className="text-2xl font-bold capitalize">{longDate(dateString)}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {events.length} hendelser · {quests.length} oppdrag
          </p>
        </div>
        {!isToday && (
          <Link
            href="/calendar"
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 transition-colors"
            title="Hopp til i dag"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            I dag
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={sync} disabled={syncing || !connected} title="Synk">
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
        </Button>
      </header>

      <DayCarousel dateString={dateString} todayString={todayString} />

      {!connected && (
        <div className="rounded-2xl border bg-card p-4 text-sm space-y-2">
          <p className="font-medium">Koble til Google Calendar</p>
          <p className="text-xs text-muted-foreground">
            Du må koble til kalenderen før dagsplanen kan bygges.
          </p>
          <a href="/api/auth/google" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            Koble til <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {syncError && (
        <p className="text-xs text-destructive">Synkfeil: {syncError}</p>
      )}

      <div className="rounded-3xl border bg-card overflow-hidden soft-shadow">
        <div className="relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
          {/* hour gridlines */}
          {hours.map((h, i) => (
            <button
              key={h}
              type="button"
              onClick={() => openNewEventAtHour(h)}
              className="group absolute inset-x-0 flex items-start text-left border-t border-border/60 hover:bg-accent/5 transition-colors"
              style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
            >
              <span className="w-12 pt-1 pl-3 text-[10px] font-semibold text-muted-foreground tabular-nums">
                {formatHour(h)}
              </span>
              <span className="opacity-0 group-hover:opacity-100 pl-2 pt-1 text-[10px] text-primary transition-opacity">
                + legg til
              </span>
            </button>
          ))}

          {/* events */}
          {events.map((e) => {
            const startMin = parseISOToMinutes(e.start_at);
            const endMin = parseISOToMinutes(e.end_at);
            const top = ((startMin - DAY_START * 60) / 60) * HOUR_HEIGHT;
            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
            if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEventComplete(e)}
                className={cn(
                  'absolute left-14 right-3 rounded-xl border px-3 py-1.5 text-left text-xs soft-shadow transition-transform hover:scale-[1.01]',
                  e.completed
                    ? 'bg-muted/80 border-muted text-muted-foreground line-through'
                    : 'grad-primary text-primary-foreground border-transparent',
                )}
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <div className="font-semibold truncate">{e.title}</div>
                <div className="text-[10px] opacity-80">{formatRange(e.start_at, e.end_at)}</div>
              </button>
            );
          })}

          {/* scheduled quests — small markers on the right edge */}
          {scheduledQuests.map((q) => {
            const startMin = parseTimeToMinutes(q.scheduled_time!);
            const top = ((startMin - DAY_START * 60) / 60) * HOUR_HEIGHT;
            if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
            return (
              <div
                key={q.id}
                className="absolute right-3 flex items-center gap-1.5 pointer-events-none"
                style={{ top: `${top}px` }}
              >
                <Badge variant="secondary">{q.title}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {unscheduledQuests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Uten klokkeslett
          </h2>
          <ul className="space-y-1.5">
            {unscheduledQuests.map((q) => (
              <li key={q.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
                <span className={cn('text-sm', q.completed_at && 'line-through text-muted-foreground')}>
                  {q.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dateString={dateString}
        prefillStart={prefillStart}
        onCreated={() => router.refresh()}
      />

      <button
        type="button"
        onClick={openNewEventNow}
        aria-label="Ny hendelse"
        className="fixed bottom-28 right-6 z-30 h-14 w-14 rounded-full grad-primary text-primary-foreground shadow-lg soft-shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
