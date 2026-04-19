'use client';

import { cn } from '@/lib/cn';

type Level = 'low' | 'medium' | 'high' | null;
type WeekDay = { dateString: string; dayShort: string; dayNum: number };

function ProgressRing({
  percent,
  size = 80,
  stroke = 7,
  id = 'ring-grad',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  id?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--grad-a))" />
          <stop offset="100%" stopColor="hsl(var(--grad-b))" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke={`url(#${id})`}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}

function greeting(): { greet: string } {
  const h = new Date().getHours();
  if (h < 5) return { greet: 'God natt' };
  if (h < 12) return { greet: 'God morgen' };
  if (h < 17) return { greet: 'God ettermiddag' };
  if (h < 22) return { greet: 'God kveld' };
  return { greet: 'God natt' };
}

function longDate(): string {
  return new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function TodayHero({
  intro,
  habitsDone,
  habitsTotal,
  questsDone,
  questsTotal,
  energyLevel,
  weekDays,
  todayString,
  weekHabitsDone,
  weekHabitsTotal,
}: {
  name?: string | null;
  intro: string | null;
  habitsDone: number;
  habitsTotal: number;
  questsDone: number;
  questsTotal: number;
  energyLevel: Level;
  weekDays: WeekDay[];
  todayString: string;
  weekHabitsDone: number;
  weekHabitsTotal: number;
}) {
  const { greet } = greeting();
  const todayTotal = habitsTotal + questsTotal;
  const todayDone = habitsDone + questsDone;
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);
  const weekPct = weekHabitsTotal === 0 ? 0 : Math.round((weekHabitsDone / weekHabitsTotal) * 100);

  const energyLabel =
    energyLevel === 'low' ? 'Lav' : energyLevel === 'medium' ? 'Ok' : energyLevel === 'high' ? 'Høy' : '—';

  return (
    <section className="space-y-3">
      {/* main hero card */}
      <div className="relative overflow-hidden rounded-3xl grad-hero border p-5 soft-shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium capitalize">
              {longDate()}
            </p>
            <h1 className="text-2xl font-bold">{greet}</h1>
            {intro && (
              <p className="text-xs leading-relaxed text-muted-foreground pt-1 line-clamp-2">
                {intro}
              </p>
            )}
          </div>

          {/* today ring */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="relative">
              <ProgressRing percent={todayPct} size={72} stroke={6} id="today-ring" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tabular-nums leading-none">{todayPct}%</span>
                <span className="text-[9px] text-muted-foreground font-medium">i dag</span>
              </div>
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/50">
          <StatCell label="Oppdrag" value={`${questsDone}/${questsTotal}`} />
          <StatCell label="Vaner" value={`${habitsDone}/${habitsTotal}`} />
          <StatCell label="Uke" value={`${weekPct}%`} accent />
          <StatCell label="Energi" value={energyLabel} />
        </div>
      </div>

      {/* week day strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {weekDays.map((d) => {
          const isToday = d.dateString === todayString;
          const isPast = d.dateString < todayString;
          return (
            <div
              key={d.dateString}
              className={cn(
                'flex-shrink-0 flex flex-col items-center rounded-2xl px-3 py-2 min-w-[2.75rem] border transition-colors',
                isToday
                  ? 'grad-primary text-primary-foreground border-transparent soft-shadow'
                  : isPast
                  ? 'bg-card border-border/50'
                  : 'bg-muted/30 border-border/30',
              )}
            >
              <span className={cn('text-[9px] font-bold uppercase tracking-wider', isToday ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {d.dayShort.slice(0, 2)}
              </span>
              <span className={cn('text-sm font-bold tabular-nums mt-0.5', !isToday && 'text-foreground')}>
                {d.dayNum}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('text-base font-bold tabular-nums', accent && 'text-grad')}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
    </div>
  );
}
