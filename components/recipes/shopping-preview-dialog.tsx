'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  mergeIngredients,
  type RawIngredient,
  type MergedIngredient,
} from '@/lib/ingredient-merge';
import { HOUSEHOLD_ESSENTIALS, type Essential } from '@/lib/household-essentials';

type State = 'idle' | 'submitting' | 'done' | 'error';

export function ShoppingPreviewDialog({
  open,
  onClose,
  ingredients,
  people,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  ingredients: RawIngredient[];
  people: number;
  onConfirmed: (added: number) => void;
}) {
  const merged = useMemo(() => mergeIngredients(ingredients), [ingredients]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [essentials, setEssentials] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  // Reset selections each time the dialog opens with a new plan
  useEffect(() => {
    if (open) {
      setExcluded(new Set());
      setEssentials(new Set());
      setState('idle');
      setError(null);
    }
  }, [open, ingredients]);

  if (!open) return null;

  const includedCount = merged.length - excluded.size + essentials.size;

  function toggleIngredient(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleEssential(id: string) {
    setEssentials((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    const ingredientLines = merged
      .filter((m) => !excluded.has(m.name))
      .map((m) => (m.display ? `${m.display} ${m.name}` : m.name).trim());
    const essentialLines = HOUSEHOLD_ESSENTIALS.filter((e) => essentials.has(e.id)).map(
      (e) => e.label,
    );
    const items = [...ingredientLines, ...essentialLines];
    if (items.length === 0) {
      onClose();
      return;
    }
    setState('submitting');
    setError(null);
    try {
      const res = await fetch('/api/recipes/plan/add-to-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke lagre');
      }
      const { added } = await res.json();
      setState('done');
      setTimeout(() => {
        onConfirmed(added ?? items.length);
        onClose();
      }, 500);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== 'submitting') onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-card border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-5 py-4 border-b flex items-start gap-3 flex-shrink-0">
          <div className="h-10 w-10 rounded-xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <ShoppingBasket className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">Gjennomgå handleliste</h2>
            <p className="text-[11px] text-muted-foreground">
              Mengder skalert for {people} {people === 1 ? 'person' : 'personer'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state === 'submitting'}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Ingredients */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Ingredienser ({merged.length})
              </h3>
              <div className="flex gap-1 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setExcluded(new Set())}
                  className="px-2 py-0.5 rounded-md hover:bg-muted text-muted-foreground"
                >
                  alle
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExcluded(new Set(merged.map((m) => m.name)))
                  }
                  className="px-2 py-0.5 rounded-md hover:bg-muted text-muted-foreground"
                >
                  ingen
                </button>
              </div>
            </div>
            <ul className="space-y-1">
              {merged.map((m) => (
                <IngredientRow
                  key={m.name}
                  ingredient={m}
                  included={!excluded.has(m.name)}
                  onToggle={() => toggleIngredient(m.name)}
                />
              ))}
            </ul>
          </section>

          {/* Household essentials */}
          <section>
            <div className="mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Hverdagsprodukter
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Trenger du noe av dette også? Kryss av det du mangler.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {HOUSEHOLD_ESSENTIALS.map((e) => (
                <EssentialPill
                  key={e.id}
                  essential={e}
                  on={essentials.has(e.id)}
                  onToggle={() => toggleEssential(e.id)}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t bg-card flex-shrink-0 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="button"
            onClick={confirm}
            disabled={state === 'submitting' || includedCount === 0}
            className="w-full grad-primary text-primary-foreground border-transparent"
          >
            {state === 'submitting' ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Legger til…</>
            ) : state === 'done' ? (
              <><Check className="h-4 w-4 mr-2" /> Lagt til</>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Legg til {includedCount} {includedCount === 1 ? 'vare' : 'varer'}
              </>
            )}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function IngredientRow({
  ingredient,
  included,
  onToggle,
}: {
  ingredient: MergedIngredient;
  included: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
          included ? 'bg-background border-border' : 'bg-muted/40 border-border/60',
        )}
      >
        <span
          className={cn(
            'h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
            included ? 'grad-primary border-transparent text-primary-foreground' : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {included && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span className="flex-1 min-w-0">
          <span
            className={cn(
              'block text-sm font-medium',
              !included && 'line-through text-muted-foreground',
            )}
          >
            {ingredient.name}
          </span>
          {ingredient.display && (
            <span className="block text-[11px] text-muted-foreground tabular">
              {ingredient.display}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function EssentialPill({
  essential,
  on,
  onToggle,
}: {
  essential: Essential;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
        on ? 'border-primary bg-primary/10' : 'bg-card hover:border-primary/40',
      )}
    >
      <span className="text-base">{essential.emoji}</span>
      <span className="flex-1 text-xs font-medium truncate">{essential.label}</span>
      <span
        className={cn(
          'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
          on ? 'grad-primary border-transparent text-primary-foreground' : 'border-muted-foreground/40',
        )}
        aria-hidden
      >
        {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
    </button>
  );
}
