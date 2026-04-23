import Link from 'next/link';
import { ChefHat, Clock, Coffee, Dumbbell, Flame, Heart, Move, Users, Zap } from 'lucide-react';

type MealDay = {
  day: string;
  title: string;
  description: string;
  prepMinutes: number;
  cookMinutes: number;
  imageUrl?: string | null;
};

type TrainingDay = {
  day: string;
  type: 'strength' | 'cardio' | 'conditioning' | 'mobility' | 'rest';
  title: string;
  focus: string;
  duration: number;
  imageUrl?: string | null;
};

const TRAINING_ICON: Record<TrainingDay['type'], React.ComponentType<{ className?: string }>> = {
  strength: Dumbbell,
  cardio: Heart,
  conditioning: Zap,
  mobility: Move,
  rest: Coffee,
};

const TRAINING_LABEL: Record<TrainingDay['type'], string> = {
  strength: 'Styrke',
  cardio: 'Kondis',
  conditioning: 'Intervall',
  mobility: 'Mobility',
  rest: 'Hvile',
};

export function TodayPlansPreview({
  dinner,
  workout,
  people,
}: {
  dinner: MealDay | null;
  workout: TrainingDay | null;
  people: number | null;
}) {
  if (!dinner && !workout) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {dinner && (
        <Link
          href="/recipes"
          className="group rounded-2xl border bg-card soft-shadow card-hover flex flex-col relative overflow-hidden"
        >
          {dinner.imageUrl && (
            <div className="aspect-[4/3] bg-muted">
              <img
                src={dinner.imageUrl}
                alt={dinner.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ChefHat className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Middag i dag
            </p>
          </div>
          <p className="text-sm font-bold leading-tight line-clamp-2">
            {dinner.title}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {dinner.description}
          </p>
          <div className="flex items-center gap-3 mt-auto pt-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {dinner.prepMinutes + dinner.cookMinutes} min
            </span>
            {people && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {people}
              </span>
            )}
          </div>
          </div>
        </Link>
      )}

      {workout && (
        <Link
          href="/training"
          className="group rounded-2xl border bg-card soft-shadow card-hover flex flex-col relative overflow-hidden"
        >
          {workout.imageUrl && (
            <div className="aspect-video bg-muted">
              <img
                src={workout.imageUrl}
                alt={workout.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className={
                'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ' +
                (workout.type === 'rest'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary')
              }
            >
              {(() => {
                const Icon = TRAINING_ICON[workout.type];
                return <Icon className="h-4 w-4" />;
              })()}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Trening i dag
            </p>
          </div>
          <p className="text-sm font-bold leading-tight line-clamp-2">
            {workout.type === 'rest' ? 'Hviledag' : workout.title}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {workout.focus}
          </p>
          <div className="flex items-center gap-3 mt-auto pt-1 text-[10px] text-muted-foreground">
            <span className="uppercase tracking-wider font-semibold text-primary/80">
              {TRAINING_LABEL[workout.type]}
            </span>
            {workout.type !== 'rest' && workout.duration > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3" /> {workout.duration} min
              </span>
            )}
          </div>
          </div>
        </Link>
      )}
    </section>
  );
}
