'use client';

type Level = 'low' | 'medium' | 'high' | null;

function ProgressRing({ percent, size = 88 }: { percent: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--grad-a))" />
          <stop offset="100%" stopColor="hsl(var(--grad-b))" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        className="stroke-muted"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke="url(#ring-grad)"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}

function greeting(): { greet: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 5) return { greet: 'God natt', emoji: '🌙' };
  if (h < 12) return { greet: 'God morgen', emoji: '☀️' };
  if (h < 17) return { greet: 'God ettermiddag', emoji: '🌤️' };
  if (h < 22) return { greet: 'God kveld', emoji: '🌆' };
  return { greet: 'God natt', emoji: '🌙' };
}

function longDate(): string {
  return new Date().toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function TodayHero({
  name,
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
  const { greet, emoji } = greeting();
  const total = habitsTotal + questsTotal;
  const done = habitsDone + questsDone;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  const energyLabel = energyLevel === 'low' ? 'Lav' : energyLevel === 'medium' ? 'Ok' : energyLevel === 'high' ? 'Høy' : '—';

  return (
    <section className="relative overflow-hidden rounded-3xl grad-hero border p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            {longDate()}
          </p>
          <h1 className="text-3xl font-bold">
            {greet}
            {name ? `, ${name}` : ''} <span className="inline-block">{emoji}</span>
          </h1>
          {intro && (
            <p className="text-sm leading-relaxed text-muted-foreground pt-2 line-clamp-3">
              {intro}
            </p>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <ProgressRing percent={percent} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums">{percent}%</span>
            <span className="text-[10px] text-muted-foreground font-medium">i dag</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-border/60">
        <Stat label="Oppdrag" value={`${questsDone}/${questsTotal}`} />
        <Stat label="Vaner" value={`${habitsDone}/${habitsTotal}`} />
        <Stat label="Energi" value={energyLabel} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
    </div>
  );
}
