import { MODELS } from '@/lib/claude';
import type { Locale } from './locales';
import { normalizeLocale } from './locales';

export type WeeklyDebriefContext = {
  weekStart: string;
  weekEnd: string;
  locale: Locale;
  questsCompleted: number;
  questsScheduled: number;
  habitProgress: { name: string; completed: number; target: number }[];
  manaDays: { date: string; level: 'low' | 'medium' | 'high' }[];
  respawnTokensUsed: number;
};

const SYSTEM_NB = `Du er LifeMaxxers spillveileder som skriver en ukesoppsummering for ÉN bruker.

ABSOLUTTE REGLER:
- Feir først, observer dernest, foreslå sist. Maks ett forslag.
- Bruk ikke «bør», «må», «trenger å». Bruk «kan», «kanskje», «når du er klar».
- Bruk ikke «mislyktes», «glemte», «hoppet over». Bruk «pauset», «hvilte», «ikke ennå».
- Sammenlign aldri denne uken med tidligere uker på en måte som rammer dem inn som verre.
- Nevn aldri vekt, kalorier eller kroppskomposisjon, med mindre brukeren har satt en relatert vane.
- Diagnostiser aldri psykisk helse.
- Hvis noe input tyder på selvskading eller alvorlig nød, hopp normal flyt og pek på kriseressurser (Mental Helse 116 123 i Norge).
- Maks 250 ord, markdown, skrevet på norsk bokmål.
- Varme over glans. Korte avsnitt over lange.`;

const SYSTEM_EN = `You are the LifeMaxxer Game Master writing a weekly debrief for ONE user.

ABSOLUTE RULES:
- Celebrate first, observe second, suggest last. One suggestion max.
- No "should", "must", "need to". Use "could", "might", "when you're ready".
- No "failed", "missed", "skipped". Use "paused", "rested", "not yet".
- Never compare this week to past weeks in a way that frames them as worse.
- Never mention weight, calories, or body composition unless the user set a related habit.
- Never infer mental health diagnoses.
- If any input hints at self-harm or severe distress, stop the normal flow and surface crisis resources (in the US: 988; in the UK: Samaritans 116 123; in Norway: Mental Helse 116 123).
- Max 250 words, markdown, written in English.
- Warmth over polish. Short paragraphs over long.`;

const SYSTEMS: Record<Locale, string> = { nb: SYSTEM_NB, en: SYSTEM_EN };

type Copy = {
  weekHeader: (start: string, end: string) => string;
  questsLine: (done: number, total: number) => string;
  habitsHeader: string;
  habitsNone: string;
  energyHeader: string;
  energyNone: string;
  respawnLine: (n: number) => string;
  closing: string;
};

const COPY: Record<Locale, Copy> = {
  nb: {
    weekHeader: (s, e) => `Uke: ${s} – ${e}`,
    questsLine: (done, total) => `Oppdrag: ${done}/${total} fullført`,
    habitsHeader: 'Vaner:',
    habitsNone: '(ingen sporet)',
    energyHeader: 'Energidager:',
    energyNone: '(ingen logget)',
    respawnLine: (n) => `Respawn-tokens brukt: ${n}`,
    closing: 'Skriv ukesoppsummeringen nå.',
  },
  en: {
    weekHeader: (s, e) => `Week: ${s} – ${e}`,
    questsLine: (done, total) => `Quests: ${done}/${total} completed`,
    habitsHeader: 'Habits:',
    habitsNone: '(none tracked)',
    energyHeader: 'Energy days:',
    energyNone: '(none logged)',
    respawnLine: (n) => `Respawn tokens used: ${n}`,
    closing: 'Write the debrief now.',
  },
};

export const WEEKLY_DEBRIEF_V1 = {
  version: 'weekly-debrief.v1',
  model: MODELS.weeklyDebrief,
  useCache: true,

  systemFor(locale: Locale): string {
    return SYSTEMS[normalizeLocale(locale)];
  },

  buildUserFor(ctx: WeeklyDebriefContext): string {
    const loc = normalizeLocale(ctx.locale);
    const c = COPY[loc];
    const habits = ctx.habitProgress.length
      ? ctx.habitProgress
          .map((h) => `- ${h.name}: ${h.completed}/${h.target}`)
          .join('\n')
      : c.habitsNone;
    const energy = ctx.manaDays.length
      ? ctx.manaDays.map((d) => `- ${d.date}: ${d.level}`).join('\n')
      : c.energyNone;
    return `${c.weekHeader(ctx.weekStart, ctx.weekEnd)}
${c.questsLine(ctx.questsCompleted, ctx.questsScheduled)}
${c.habitsHeader}
${habits}
${c.energyHeader}
${energy}
${c.respawnLine(ctx.respawnTokensUsed)}

${c.closing}`;
  },
} as const;
