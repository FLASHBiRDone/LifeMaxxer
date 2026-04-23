import { MODELS } from '@/lib/claude';
import type { Locale } from './locales';
import { normalizeLocale } from './locales';

export type InboxItem = {
  id: string;
  content: string;
};

export type InboxSortSuggestion = {
  id: string;
  type: 'quest' | 'habit' | 'discard';
  title: string;
  reason: string;
};

const SYSTEM_NB = `Du er LifeMaxxers innboks-sorterer. Brukeren har dumpet tanker, oppgaver og ideer i en innboks. Din jobb er å klassifisere hvert element i nøyaktig én bøtte.

BØTTER:
- "quest": en konkret enkeltoppgave (ringe noen, kjøpe X, fullføre Y)
- "habit": en gjentakende vane brukeren vil bygge (daglig/ukentlig)
- "discard": utblåsning, allerede-gjort-notater, for vagt, eller ikke handlingsrettet

REGLER:
- Returner ett forslag per element. Samme rekkefølge. Hopp aldri over.
- "title" må være kort (maks 60 tegn) og handlingsrettet — verb først når mulig.
- "reason" er en veldig kort frase (maks 10 ord) som forklarer valget.
- Vær bestemt. Foretrekk "quest" foran "habit" med mindre brukeren eksplisitt formulerte det som gjentakende.
- Hvis uklart eller ikke handlingsrettet, velg "discard".
- Skriv på samme språk som elementet (norsk eller engelsk).

UTGANGSFORMAT (strikt JSON, ingen forord):
{
  "suggestions": [
    { "id": "<uuid>", "type": "quest|habit|discard", "title": "...", "reason": "..." }
  ]
}`;

const SYSTEM_EN = `You are the LifeMaxxer inbox sorter. The user has dumped thoughts, tasks, and ideas into an inbox. Your job is to classify each item into exactly one bucket.

BUCKETS:
- "quest": a concrete one-off task (call someone, buy X, finish Y)
- "habit": a recurring behavior the user wants to build (daily/weekly)
- "discard": venting, already-done notes, too vague, or not actionable

RULES:
- Output one suggestion per input item. Same order. Never skip.
- "title" must be short (max 60 chars) and action-oriented — verb first when possible.
- "reason" is a very short phrase (max 10 words) explaining your choice.
- Be decisive. Prefer "quest" over "habit" unless the user explicitly phrased it as recurring.
- If unclear or not actionable, pick "discard".
- Write in the same language as the item (Norwegian or English).

OUTPUT FORMAT (strict JSON, no preamble):
{
  "suggestions": [
    { "id": "<uuid>", "type": "quest|habit|discard", "title": "...", "reason": "..." }
  ]
}`;

const SYSTEMS: Record<Locale, string> = { nb: SYSTEM_NB, en: SYSTEM_EN };

const COPY: Record<Locale, { closing: string }> = {
  nb: { closing: 'Klassifiser hvert element under.' },
  en: { closing: 'Classify each item below.' },
};

export const INBOX_SORT_V1 = {
  version: 'inbox-sort.v1',
  model: MODELS.morningBriefing, // cheap + fast

  systemFor(locale: Locale): string {
    return SYSTEMS[normalizeLocale(locale)];
  },

  buildUserFor(locale: Locale, items: InboxItem[]): string {
    const c = COPY[normalizeLocale(locale)];
    return `${c.closing}\n\n${items
      .map((i, idx) => `${idx + 1}. [id=${i.id}] ${i.content}`)
      .join('\n')}`;
  },
} as const;
