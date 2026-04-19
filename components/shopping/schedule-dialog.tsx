'use client';

import { useState, useEffect } from 'react';
import { Loader2, CalendarPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(local: string, mins: number): string {
  const d = new Date(local);
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DURATIONS = [
  { min: 30, label: '30 min' },
  { min: 45, label: '45 min' },
  { min: 60, label: '1 t' },
  { min: 90, label: '1,5 t' },
];

export function ScheduleShoppingDialog({
  open,
  onOpenChange,
  itemCount,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onScheduled: () => void;
}) {
  const [start, setStart] = useState(defaultStart());
  const [duration, setDuration] = useState(45);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(defaultStart());
      setDuration(45);
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const endLocal = addMinutes(start, duration);
      const res = await fetch('/api/shopping/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(endLocal).toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke opprette hendelsen');
      }
      onOpenChange(false);
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Planlegg handling
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Legger {itemCount} {itemCount === 1 ? 'vare' : 'varer'} som en kalenderhendelse med påminnelse 30 min før.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="shop-start">Starttidspunkt</Label>
            <Input
              id="shop-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Varighet</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d.min}
                  type="button"
                  onClick={() => setDuration(d.min)}
                  className={cn(
                    'rounded-xl border py-2 text-xs font-medium transition-colors',
                    duration === d.min
                      ? 'grad-primary text-primary-foreground border-transparent'
                      : 'bg-background hover:border-primary/40',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 grad-primary text-primary-foreground border-transparent"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Opprett'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
