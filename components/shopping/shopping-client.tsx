'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBasket, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

type Item = {
  id: string;
  freeform_text: string | null;
  checked: boolean;
  created_at: string;
};

export function ShoppingClient({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [, startTransition] = useTransition();

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { item } = await res.json();
        setItems((prev) => [...prev, item]);
        setDraft('');
      }
    } finally {
      setAdding(false);
    }
  }

  function toggle(item: Item) {
    const next = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    startTransition(async () => {
      await fetch(`/api/shopping/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: next }),
      });
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
    });
  }

  async function clearChecked() {
    if (checked.length === 0) return;
    setClearing(true);
    setItems((prev) => prev.filter((i) => !i.checked));
    try {
      await fetch('/api/shopping/clear-checked', { method: 'POST' });
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <ShoppingBasket className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Handleliste
          </p>
          <h1 className="text-2xl font-bold">
            {unchecked.length} {unchecked.length === 1 ? 'vare' : 'varer'}
          </h1>
          {checked.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {checked.length} allerede plukket
            </p>
          )}
        </div>
      </header>

      <form onSubmit={addItem} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Legg til vare..."
          maxLength={200}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={adding || !draft.trim()}
          className="grad-primary text-primary-foreground border-transparent"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-2 soft-shadow">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Listen er tom</p>
          <p className="text-xs text-muted-foreground">Skriv inn en vare for å starte.</p>
        </div>
      ) : (
        <>
          {unchecked.length > 0 && (
            <ul className="rounded-3xl border bg-card overflow-hidden soft-shadow divide-y divide-border/50">
              {unchecked.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    className="h-6 w-6 rounded-full border-2 border-muted-foreground/40 flex-shrink-0 hover:border-primary transition-colors"
                    aria-label={`Hake av ${item.freeform_text}`}
                  />
                  <span className="flex-1 text-sm font-medium break-words">
                    {item.freeform_text}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="text-muted-foreground/60 hover:text-destructive transition-colors flex-shrink-0"
                    aria-label="Slett"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {checked.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Plukket ({checked.length})
                </h2>
                <button
                  type="button"
                  onClick={clearChecked}
                  disabled={clearing}
                  className="text-[10px] font-semibold text-destructive inline-flex items-center gap-1 hover:opacity-80 disabled:opacity-50"
                >
                  {clearing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Tøm
                </button>
              </div>
              <ul className="rounded-3xl border bg-card/60 overflow-hidden divide-y divide-border/40">
                {checked.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className="h-6 w-6 rounded-full grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0"
                      aria-label={`Angre ${item.freeform_text}`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm break-words line-through text-muted-foreground',
                      )}
                    >
                      {item.freeform_text}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="text-muted-foreground/60 hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="Slett"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
