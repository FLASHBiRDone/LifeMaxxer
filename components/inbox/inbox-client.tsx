'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Sparkles, Target, Flame, Trash2, Loader2, Send, Check, CalendarPlus, CalendarClock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VoiceButton } from './voice-button';
import { cn } from '@/lib/cn';

function defaultScheduleStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60, 0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutesToLocal(local: string, mins: number): string {
  const d = new Date(local);
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DURATIONS = [
  { min: 15, label: '15m' },
  { min: 30, label: '30m' },
  { min: 60, label: '1t' },
  { min: 90, label: '1,5t' },
];

type Item = {
  id: string;
  content: string;
  created_at: string;
};

type Suggestion = {
  id: string;
  type: 'quest' | 'habit' | 'discard';
  title: string;
  reason: string;
};

export function InboxClient({
  initialItems,
  googleConnected,
}: {
  initialItems: Item[];
  googleConnected: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [sortError, setSortError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(defaultScheduleStart());
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [, startTransition] = useTransition();

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    setScheduleError(null);
    try {
      if (scheduleOpen) {
        const endLocal = addMinutesToLocal(scheduleStart, scheduleDuration);
        const res = await fetch('/api/inbox/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            startAt: new Date(scheduleStart).toISOString(),
            endAt: new Date(endLocal).toISOString(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Kunne ikke planlegge');
        }
        setDraft('');
        setScheduleOpen(false);
        setScheduleStart(defaultScheduleStart());
        setScheduleDuration(30);
        router.refresh();
      } else {
        const res = await fetch('/api/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const { item } = await res.json();
          setItems((prev) => [item, ...prev]);
          setDraft('');
        }
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSaving(false);
    }
  }

  async function sortAll() {
    if (items.length === 0) return;
    setSorting(true);
    setSortError(null);
    try {
      const res = await fetch('/api/inbox/sort', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Kunne ikke sortere');
      }
      const { suggestions: list } = (await res.json()) as { suggestions: Suggestion[] };
      const map: Record<string, Suggestion> = {};
      for (const s of list) map[s.id] = s;
      setSuggestions(map);
    } catch (err) {
      setSortError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setSorting(false);
    }
  }

  async function convert(id: string, type: 'quest' | 'habit' | 'discarded', title?: string) {
    // optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    startTransition(async () => {
      await fetch(`/api/inbox/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title }),
      });
      router.refresh();
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await fetch(`/api/inbox/${id}`, { method: 'DELETE' });
    });
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl grad-hero border p-5 flex items-start gap-4 soft-shadow">
        <div className="h-12 w-12 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center flex-shrink-0 soft-shadow">
          <Brain className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            Tankedump
          </p>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'ting' : 'ting'} å sortere
          </p>
        </div>
      </header>

      <form onSubmit={addItem} className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dump hva som helst... Huske, idé, tanke, ting å gjøre."
          rows={3}
          maxLength={2000}
          className="resize-none"
        />

        <div className="flex gap-2">
          <VoiceButton
            disabled={saving}
            onTranscribed={(text) => {
              setVoiceError(null);
              setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
            }}
            onError={(msg) => setVoiceError(msg)}
          />
          <button
            type="button"
            onClick={() => {
              setScheduleOpen((v) => !v);
              setScheduleError(null);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              scheduleOpen
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
            )}
            aria-pressed={scheduleOpen}
          >
            {scheduleOpen ? <X className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            {scheduleOpen ? 'Avbryt tid' : 'Sett tid'}
          </button>
          <Button
            type="submit"
            disabled={saving || !draft.trim()}
            className="flex-1 grad-primary text-primary-foreground border-transparent"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : scheduleOpen ? (
              <><CalendarClock className="h-4 w-4 mr-1.5" /> Planlegg</>
            ) : (
              <><Send className="h-4 w-4 mr-1.5" /> Legg til</>
            )}
          </Button>
        </div>

        {scheduleOpen && (
          <div className="rounded-2xl border bg-muted/40 p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Tidspunkt
              </label>
              <Input
                type="datetime-local"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Varighet
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d.min}
                    type="button"
                    onClick={() => setScheduleDuration(d.min)}
                    className={cn(
                      'rounded-xl border py-2 text-xs font-medium transition-colors',
                      scheduleDuration === d.min
                        ? 'grad-primary text-primary-foreground border-transparent'
                        : 'bg-background hover:border-primary/40',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {googleConnected
                ? 'Legges i Google Kalender og som dagens oppdrag.'
                : 'Legges som oppdrag. Koble Google Kalender i Innstillinger for kalenderhendelse.'}
            </p>
          </div>
        )}

        {voiceError && <p className="text-xs text-destructive">{voiceError}</p>}
        {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
      </form>

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {Object.keys(suggestions).length > 0
              ? 'AI-forslag klare – trykk for å godta'
              : 'La AI sortere alt på én gang'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={sortAll}
            disabled={sorting}
          >
            {sorting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Sorterer</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI-sortér</>
            )}
          </Button>
        </div>
      )}

      {sortError && <p className="text-xs text-destructive">{sortError}</p>}

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-2 soft-shadow">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <Check className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Inbox er tom</p>
          <p className="text-xs text-muted-foreground">
            Dump gjerne en tanke når den dukker opp.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const sugg = suggestions[item.id];
            return (
              <li
                key={item.id}
                className="rounded-2xl border bg-card p-4 space-y-3 soft-shadow"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {item.content}
                </p>

                {sugg && (
                  <div className="rounded-xl bg-muted/50 border border-border/50 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-xs">
                        <span className="font-semibold capitalize text-primary">
                          {sugg.type === 'quest' ? 'Oppdrag' : sugg.type === 'habit' ? 'Vane' : 'Forkast'}
                        </span>
                        <span className="text-muted-foreground"> · {sugg.reason}</span>
                        {sugg.type !== 'discard' && (
                          <p className="font-medium text-foreground mt-0.5 truncate">{sugg.title}</p>
                        )}
                      </div>
                    </div>
                    {sugg.type !== 'discard' && (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full grad-primary text-primary-foreground border-transparent"
                        onClick={() =>
                          convert(item.id, sugg.type === 'quest' ? 'quest' : 'habit', sugg.title)
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Godta forslag
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <ActionButton onClick={() => convert(item.id, 'quest')} icon={<Target className="h-3.5 w-3.5" />}>
                    Oppdrag
                  </ActionButton>
                  <ActionButton onClick={() => convert(item.id, 'habit')} icon={<Flame className="h-3.5 w-3.5" />}>
                    Vane
                  </ActionButton>
                  <ActionButton onClick={() => remove(item.id)} icon={<Trash2 className="h-3.5 w-3.5" />} danger>
                    Slett
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
        danger
          ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
          : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
