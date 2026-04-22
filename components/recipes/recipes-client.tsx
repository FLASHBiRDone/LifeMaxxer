'use client';

import { useState } from 'react';
import {
  ChefHat,
  Clock,
  Users,
  Sparkles,
  ShoppingBasket,
  ChevronDown,
  Loader2,
  RefreshCw,
  Check,
  CalendarPlus,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { ALLERGENS, type Allergen } from '@/lib/allergens';

type MealPlan = {
  params: {
    people: number;
    allergens: string[];
    diet: 'any' | 'vegetarian' | 'vegan' | 'pescatarian';
    notes: string;
    locale: string;
  };
  days: Array<{
    day: string;
    title: string;
    description: string;
    prepMinutes: number;
    cookMinutes: number;
    ingredients: { name: string; amount: string }[];
    instructions: string[];
  }>;
};

const ALLERGEN_LABELS_NB: Record<Allergen, string> = {
  gluten: 'Gluten',
  dairy: 'Melk',
  lactose: 'Laktose',
  egg: 'Egg',
  peanut: 'Peanøtter',
  tree_nut: 'Nøtter',
  soy: 'Soya',
  fish: 'Fisk',
  shellfish: 'Skalldyr',
  sesame: 'Sesam',
  celery: 'Selleri',
  mustard: 'Sennep',
  sulfite: 'Sulfitt',
  lupin: 'Lupin',
  mollusc: 'Skjell',
};

const DIETS: { value: MealPlan['params']['diet']; label: string }[] = [
  { value: 'any', label: 'Alt' },
  { value: 'vegetarian', label: 'Vegetar' },
  { value: 'vegan', label: 'Vegansk' },
  { value: 'pescatarian', label: 'Pescatar' },
];

export function RecipesClient({ initialPlan }: { initialPlan: MealPlan | null }) {
  const [plan, setPlan] = useState<MealPlan | null>(initialPlan);
  const [people, setPeople] = useState<number>(initialPlan?.params.people ?? 2);
  const [diet, setDiet] = useState<MealPlan['params']['diet']>(initialPlan?.params.diet ?? 'any');
  const [allergens, setAllergens] = useState<string[]>(initialPlan?.params.allergens ?? []);
  const [notes, setNotes] = useState<string>(initialPlan?.params.notes ?? '');
  const [generating, setGenerating] = useState(false);
  const [addingToShopping, setAddingToShopping] = useState(false);
  const [addedToShopping, setAddedToShopping] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<
    | { kind: 'added'; count: number }
    | { kind: 'no_tokens' }
    | { kind: 'error'; message: string }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  function toggleAllergen(a: string) {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setAddedToShopping(false);
    setCalendarStatus(null);
    try {
      const res = await fetch('/api/recipes/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people, allergens, diet, notes: notes.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lage planen');
      }
      const { plan: p, calendar } = await res.json();
      setPlan(p);
      setOpenDay(0);
      if (calendar?.status === 'added') {
        setCalendarStatus({ kind: 'added', count: calendar.created });
      } else if (calendar?.status === 'skipped' && calendar.reason === 'no_tokens') {
        setCalendarStatus({ kind: 'no_tokens' });
      } else if (calendar?.status === 'error') {
        setCalendarStatus({ kind: 'error', message: calendar.message });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setGenerating(false);
    }
  }

  async function addToCalendar() {
    setAddingToCalendar(true);
    try {
      const res = await fetch('/api/recipes/plan/add-to-calendar', {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      const c = body.calendar;
      if (c?.status === 'added') {
        setCalendarStatus({ kind: 'added', count: c.created });
      } else if (c?.status === 'skipped' && c.reason === 'no_tokens') {
        setCalendarStatus({ kind: 'no_tokens' });
      } else if (c?.status === 'error') {
        setCalendarStatus({ kind: 'error', message: c.message });
      }
    } finally {
      setAddingToCalendar(false);
    }
  }

  async function addAllToShopping() {
    if (!plan) return;
    setAddingToShopping(true);
    setAddedToShopping(false);
    try {
      const ingredients = plan.days.flatMap((d) => d.ingredients);
      const res = await fetch('/api/recipes/plan/add-to-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      if (res.ok) setAddedToShopping(true);
    } finally {
      setAddingToShopping(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <ChefHat className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Middager
          </p>
          <h1 className="text-2xl font-bold">Ukens plan</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {plan ? '7 middager klar' : 'AI lager en plan tilpasset deg'}
          </p>
        </div>
      </header>

      <form onSubmit={generate} className="rounded-3xl border bg-card p-5 space-y-4 soft-shadow">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="people" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Personer
            </Label>
            <Input
              id="people"
              type="number"
              min={1}
              max={12}
              value={people}
              onChange={(e) => setPeople(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Diett</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIETS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDiet(d.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    diet === d.value
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-background border-border hover:border-primary/40',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Allergier og intoleranser</Label>
          <div className="flex flex-wrap gap-1.5">
            {(ALLERGENS as readonly Allergen[]).map((a) => {
              const on = allergens.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    on
                      ? 'bg-destructive/10 border-destructive/40 text-destructive'
                      : 'bg-background border-border hover:border-destructive/30',
                  )}
                >
                  {ALLERGEN_LABELS_NB[a]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">
            Ekstra ønsker (valgfritt)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="F.eks. lite rødt kjøtt, budsjettvennlig, ingen frukt..."
            rows={2}
            maxLength={500}
            className="resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={generating}
          className="w-full grad-primary text-primary-foreground border-transparent"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Lager plan…</>
          ) : plan ? (
            <><RefreshCw className="h-4 w-4 mr-2" /> Ny plan</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Lag 7-dagers plan</>
          )}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {plan && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addAllToShopping}
              disabled={addingToShopping}
            >
              {addingToShopping ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Legger til…</>
              ) : addedToShopping ? (
                <><Check className="h-4 w-4 mr-2" /> Lagt til</>
              ) : (
                <><ShoppingBasket className="h-4 w-4 mr-2" /> Handleliste</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={addToCalendar}
              disabled={addingToCalendar}
            >
              {addingToCalendar ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Legger til…</>
              ) : calendarStatus?.kind === 'added' ? (
                <><CalendarCheck className="h-4 w-4 mr-2" /> I kalender · {calendarStatus.count}</>
              ) : (
                <><CalendarPlus className="h-4 w-4 mr-2" /> Kalender 18:00</>
              )}
            </Button>
          </div>

          {calendarStatus?.kind === 'no_tokens' && (
            <p className="text-xs text-muted-foreground px-1">
              Koble til Google Kalender i{' '}
              <a href="/settings" className="underline text-primary">
                Innstillinger
              </a>{' '}
              for å legge middagene inn automatisk.
            </p>
          )}
          {calendarStatus?.kind === 'error' && (
            <p className="text-xs text-destructive px-1">
              Kalenderfeil: {calendarStatus.message}
            </p>
          )}

          <ul className="space-y-3">
            {plan.days.map((d, idx) => {
              const isOpen = openDay === idx;
              const total = d.prepMinutes + d.cookMinutes;
              return (
                <li
                  key={idx}
                  className="rounded-2xl border bg-card overflow-hidden soft-shadow"
                >
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : idx)}
                    className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-accent/5 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-[10px] font-bold uppercase tracking-wider">
                      {d.day.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {d.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {total} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {plan.params.people}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground flex-shrink-0 mt-2 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/60 px-4 py-4 space-y-4 bg-muted/20">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Ingredienser
                        </p>
                        <ul className="space-y-1">
                          {d.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-baseline gap-2 text-sm">
                              <span className="tabular-nums text-muted-foreground min-w-[4rem] text-xs font-medium">
                                {ing.amount}
                              </span>
                              <span>{ing.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Instruksjoner
                        </p>
                        <ol className="space-y-2">
                          {d.instructions.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-relaxed">
                              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <span className="flex-1">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
