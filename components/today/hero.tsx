'use client';

import { cn } from '@/lib/cn';

type Level = 'low' | 'medium' | 'high' | null;

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
}: {
  name?: string | null;
  intro: string | null;
  habitsDone: number;
  habitsTotal: number;
  questsDone: number;
  questsTotal: number;
  energyLevel: Level;
}) {
  const { greet } = greeting();
  const todayTotal = habitsTotal + questsTotal;
  const todayDone = habitsDone + questsDone;
  const todayPct = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);

  const energyLabel =
    energyLevel === 'low' ? 'Lav' : energyLevel === 'medium' ? 'Ok' : energyLevel === 'high' ? 'Høy' : '—';

  return (
    <section className="relative overflow-hidden rounded-3xl grad-hero border p-5 soft-shadow">
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

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
        <StatCell label="Oppdrag" value={`${questsDone}/${questsTotal}`} />
        <StatCell label="Vaner" value={`${habitsDone}/${habitsTotal}`} />
        <StatCell label="Energi" value={energyLabel} />
      </div>
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
    </div>
  );
}
