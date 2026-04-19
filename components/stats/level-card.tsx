import { Trophy, Sparkles, Target } from 'lucide-react';

function levelFromXp(xp: number): { level: number; progress: number; nextAt: number; currAt: number } {
  // level n requires 50 * n * (n-1) / 2 total XP; simpler: threshold_n = 25 * n * (n+1)
  let level = 1;
  while (25 * (level + 1) * (level + 2) <= xp) level++;
  const currAt = 25 * level * (level + 1);
  const nextAt = 25 * (level + 1) * (level + 2);
  const progress = Math.max(0, Math.min(100, Math.round(((xp - currAt) / (nextAt - currAt)) * 100)));
  return { level, progress, nextAt, currAt };
}

export function LevelCard({
  xp,
  totalHabits,
  totalQuests,
  mainQuests,
}: {
  xp: number;
  totalHabits: number;
  totalQuests: number;
  mainQuests: number;
}) {
  const { level, progress, nextAt, currAt } = levelFromXp(xp);
  const xpInLevel = xp - currAt;
  const xpForLevel = nextAt - currAt;

  return (
    <section className="relative overflow-hidden rounded-3xl grad-hero border p-5 soft-shadow">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl grad-primary text-primary-foreground flex flex-col items-center justify-center flex-shrink-0 soft-shadow">
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Lvl</span>
          <span className="text-2xl font-black leading-none tabular-nums">{level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Erfaring</p>
          <p className="text-2xl font-bold tabular-nums">
            {xp.toLocaleString('nb-NO')} <span className="text-xs font-medium text-muted-foreground">XP</span>
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full grad-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {xpInLevel} / {xpForLevel} til nivå {level + 1}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
        <StatCell icon={<Target className="h-3.5 w-3.5" />} label="Oppdrag" value={totalQuests} />
        <StatCell icon={<Sparkles className="h-3.5 w-3.5" />} label="Vaner" value={totalHabits} />
        <StatCell icon={<Trophy className="h-3.5 w-3.5" />} label="Bosser" value={mainQuests} />
      </div>
    </section>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">{label}</p>
    </div>
  );
}
