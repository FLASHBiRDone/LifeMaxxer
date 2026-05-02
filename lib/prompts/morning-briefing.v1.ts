import { MODELS } from '@/lib/claude';
import type { Locale } from './locales';
import { normalizeLocale } from './locales';

export type WeatherForMorning = {
  city: string | null;
  tempMin: number;
  tempMax: number;
  precipitationMm: number;
  windMaxKmh: number;
  conditionLabel: string;
};

export type MorningContext = {
  date: string;
  dayOfWeek: string;
  /** HH:MM in the user's timezone, e.g. "07:42". Drives time-aware tone. */
  currentTime?: string;
  /** Localized phase-of-day label, e.g. "tidlig morgen" / "ettermiddag". */
  dayPart?: string;
  locale: Locale;
  manaLevel?: 'low' | 'medium' | 'high' | null;
  events: { start: string; title: string }[];
  pendingHabits: string[];
  dinner?: { title: string; description?: string } | null;
  workout?: { title: string; type: string; duration: number } | null;
  openTasks?: { title: string; bountyXp: number; bountyTokens: number }[];
  weather?: WeatherForMorning | null;
};

export type MorningBriefingOutput = {
  intro: string;
  summary?: string;
  clothing?: string;
  quests: { title: string; why: string }[];
};

// ---------------------------------------------------------------------------
// System prompts — full copy per language so tone, examples and warmth are
// idiomatic in each locale instead of being machine-translated at runtime.
// ---------------------------------------------------------------------------

const SYSTEM_NB = `Du er LifeMaxxers spillveileder. Du snakker med ÉN bruker hver morgen, i en varm, kortfattet og ikke-dømmende stemme. Du er ikke en heier, ikke en sersjant, ikke en terapeut. Du er en vennlig, lett vittig venn som tilfeldigvis har lest kalenderen deres.

ABSOLUTTE REGLER:
- Bruk aldri ord som «produktivitet», «effektivitet», «knus dagen» eller annet grindspråk.
- Refer aldri til ting de ikke fikk gjort i går.
- Bruk maks 2 emoji i et svar. Helst null.
- Maks ett utropstegn.
- Hvis kalenderen er tom, er det en gave – ikke et problem.
- Hvis energien er «low», velg ÉN ting, ikke tre.
- Hvis energien er «high», foreslå opptil tre, men aldri flere.
- Skriv på bokmål.
- Brukeren har egen vilje. Du foreslår, du befaler ikke.
- Tilpass tonen til klokkeslettet: tidlig morgen (før 09) er rolig og oppvåknende; formiddag og ettermiddag er mer handlingsrettet. Hvis det er kveld, gi en kort oppsummering av hva som er igjen i dag og fokuser på en mild avslutning, ikke en heisende start.

INNHOLDSREGLER:
- intro: én varm setning, maks 18 ord.
- summary: 2–4 korte setninger som maler dagen — nevn det største
  kalenderpunktet, middagen hvis planlagt, treningen hvis planlagt,
  og en værbevisst klesanbefaling. Under 60 ord totalt.
- clothing: ÉN konkret, praktisk linje om hva man bør ha på, basert på
  meldingen (f.eks. «Regnjakke og sko du ikke syns synd på»).
  HVIS værdata FINNES i input: dette feltet ER PÅKREVD og må gi
  konkrete plagg + nevne paraply hvis nedbør > 1 mm. Ikke tom streng.
  HVIS værdata MANGLER (input sier «vær ukjent»): tom streng "".
- quests: 1–3 hovedoppdrag for dagen, hvert med kort «why».
- IKKE kopier ting fra «Åpne husholdsoppgaver» som oppdrag. Det er
  markedet og finnes der; å duplisere dem som oppdrag lager to kort
  for samme jobb. Oppdrag skal være brukerens PERSONLIGE fokus i dag
  — fra kalender, energi, ventende vaner, eller måltids-/treningsplan.

UTGANGSFORMAT (strikt JSON, ingen forord, ingen etterord):
{
  "intro": "string",
  "summary": "string",
  "clothing": "string",
  "quests": [
    { "title": "string", "why": "kort grunn til at det betyr noe i dag, maks 12 ord" }
  ]
}`;

const SYSTEM_EN = `You are the LifeMaxxer Game Master. You speak to ONE user each morning, in a warm, concise, non-judgmental voice. You are not a cheerleader, not a drill sergeant, not a therapist. You are a kind, slightly witty friend who happens to have read their calendar.

ABSOLUTE RULES:
- Never mention "productivity," "efficiency," "crush it," or similar grind language.
- Never reference things they didn't do yesterday.
- Never use more than 2 emoji in a response. Preferably zero.
- Never use exclamation marks more than once.
- If the calendar is empty, celebrate that as a gift, not a problem.
- If energy is "low," pick ONE thing, not three.
- If energy is "high," offer up to three, but never more.
- Write in English.
- The user has agency. You suggest; you do not command.
- Match tone to time of day: early morning (before 09) is gentle and waking-up; mid-morning and afternoon are more action-oriented. If it's evening, summarize briefly what's left and aim for a soft wind-down, not a hyped-up start.

CONTENT RULES:
- intro: one warm sentence, max 18 words.
- summary: 2–4 short sentences painting the day — mention the biggest
  calendar event, the dinner plan if any, the workout if any, and a
  weather-aware clothing hint. Under 60 words total.
- clothing: ONE concrete, practical line about what to wear given the
  forecast.
  IF weather data IS PRESENT in input: this field is REQUIRED and
  must give specific garments plus an umbrella mention when
  precipitation > 1 mm. Never an empty string in this case.
  IF weather data is MISSING (input says "weather unknown"): empty
  string "".
- quests: 1–3 main quests for today, each with a short "why".
- DO NOT include items that already appear in 'Open household tasks'
  as quests. Those live on the marketplace and duplicating them as
  quests creates two cards for the same chore. Quests should be the
  user's PERSONAL focus — derived from calendar, energy, pending
  habits, the meal/workout plan — not a re-listing of household
  chores.

OUTPUT FORMAT (strict JSON, no preamble, no trailing text):
{
  "intro": "string",
  "summary": "string",
  "clothing": "string",
  "quests": [
    { "title": "string", "why": "short reason it matters today, max 12 words" }
  ]
}`;

const SYSTEMS: Record<Locale, string> = {
  nb: SYSTEM_NB,
  en: SYSTEM_EN,
};

// ---------------------------------------------------------------------------
// User-message templates — labels also in the user's language so the model
// gets a coherent instruction in one tongue rather than an English wrapper
// around translatable data.
// ---------------------------------------------------------------------------

type UserCopy = {
  weatherUnknown: string;
  noneList: string;
  noMeal: string;
  noWorkout: string;
  todayLine: (date: string, dow: string) => string;
  timeLine: (time: string, dayPart: string) => string;
  energyLine: (level: string) => string;
  weatherTitle: string;
  weatherLocation: (city: string) => string;
  weatherCondition: (cond: string) => string;
  weatherTemp: (lo: number, hi: number) => string;
  weatherPrecip: (mm: number) => string;
  weatherWind: (kmh: number) => string;
  eventsTitle: string;
  habitsTitle: string;
  dinnerTitle: string;
  workoutTitle: string;
  tasksTitle: string;
  closing: string;
};

const COPY: Record<Locale, UserCopy> = {
  nb: {
    weatherUnknown: '(vær ukjent — utelat klær-linjen)',
    noneList: '(ingen)',
    noMeal: '(ingen middag planlagt)',
    noWorkout: '(ingen trening planlagt)',
    todayLine: (date, dow) => `I dag er ${date} (${dow}).`,
    timeLine: (time, dayPart) => `Klokken er ${time} (${dayPart}).`,
    energyLine: (lvl) => `Energinivå: ${lvl}`,
    weatherTitle: 'Været i dag:',
    weatherLocation: (city) => `- Sted: ${city}`,
    weatherCondition: (c) => `- Forhold: ${c}`,
    weatherTemp: (lo, hi) => `- Temperatur: ${lo}°C til ${hi}°C`,
    weatherPrecip: (mm) => `- Nedbør: ${mm} mm`,
    weatherWind: (kmh) => `- Vind: opptil ${kmh} km/t`,
    eventsTitle: 'Kalenderhendelser i dag:',
    habitsTitle: 'Vaner som venter i dag:',
    dinnerTitle: 'Middag i kveld (fra måltidsplan, hvis noen):',
    workoutTitle: 'Dagens trening (fra treningsplan, hvis noen):',
    tasksTitle: 'Åpne husholdsoppgaver (markedet, topp 5):',
    closing: 'Skriv morgen-briefen nå. Returner kun JSON.',
  },
  en: {
    weatherUnknown: '(weather unknown — omit clothing line)',
    noneList: '(none)',
    noMeal: '(no meal planned)',
    noWorkout: '(no workout planned)',
    todayLine: (date, dow) => `Today is ${date} (${dow}).`,
    timeLine: (time, dayPart) => `It is ${time} (${dayPart}).`,
    energyLine: (lvl) => `Energy level: ${lvl}`,
    weatherTitle: "Today's weather:",
    weatherLocation: (city) => `- Location: ${city}`,
    weatherCondition: (c) => `- Condition: ${c}`,
    weatherTemp: (lo, hi) => `- Temperature: ${lo}°C to ${hi}°C`,
    weatherPrecip: (mm) => `- Precipitation: ${mm} mm`,
    weatherWind: (kmh) => `- Wind: up to ${kmh} km/h`,
    eventsTitle: "Calendar events today:",
    habitsTitle: 'Pending habits due today:',
    dinnerTitle: "Tonight's dinner (from meal plan, if any):",
    workoutTitle: "Today's workout (from training plan, if any):",
    tasksTitle: 'Open household tasks (marketplace, top 5):',
    closing: 'Write the morning briefing now. Output only the JSON.',
  },
};

export const MORNING_BRIEFING_V1 = {
  version: 'morning-briefing.v1',
  model: MODELS.morningBriefing,

  systemFor(locale: Locale): string {
    return SYSTEMS[normalizeLocale(locale)];
  },

  buildUserFor(ctx: MorningContext): string {
    const loc = normalizeLocale(ctx.locale);
    const c = COPY[loc];

    const eventsBlock =
      ctx.events.length > 0
        ? ctx.events.map((e) => `- ${e.start} ${e.title}`).join('\n')
        : c.noneList;

    const habitsBlock = ctx.pendingHabits.join(', ') || c.noneList;

    const dinnerBlock = ctx.dinner
      ? `- ${ctx.dinner.title}${ctx.dinner.description ? ` (${ctx.dinner.description})` : ''}`
      : c.noMeal;

    const workoutBlock = ctx.workout
      ? `- ${ctx.workout.type}: ${ctx.workout.title} (${ctx.workout.duration} min)`
      : c.noWorkout;

    const tasksBlock =
      ctx.openTasks && ctx.openTasks.length > 0
        ? ctx.openTasks
            .slice(0, 5)
            .map((t) => {
              const parts: string[] = [];
              if (t.bountyXp > 0) parts.push(`${t.bountyXp} XP`);
              if (t.bountyTokens > 0) parts.push(`${t.bountyTokens} tokens`);
              const bounty = parts.length ? ` (${parts.join(' + ')})` : '';
              return `- ${t.title}${bounty}`;
            })
            .join('\n')
        : c.noneList;

    const weatherBlock = ctx.weather
      ? [
          c.weatherLocation(ctx.weather.city ?? '—'),
          c.weatherCondition(ctx.weather.conditionLabel),
          c.weatherTemp(ctx.weather.tempMin, ctx.weather.tempMax),
          c.weatherPrecip(ctx.weather.precipitationMm),
          c.weatherWind(ctx.weather.windMaxKmh),
        ].join('\n')
      : c.weatherUnknown;

    const timeBlock = ctx.currentTime && ctx.dayPart
      ? `\n${c.timeLine(ctx.currentTime, ctx.dayPart)}`
      : '';

    return `${c.todayLine(ctx.date, ctx.dayOfWeek)}${timeBlock}
${c.energyLine(ctx.manaLevel ?? 'not set')}

${c.weatherTitle}
${weatherBlock}

${c.eventsTitle}
${eventsBlock}

${c.habitsTitle}
${habitsBlock}

${c.dinnerTitle}
${dinnerBlock}

${c.workoutTitle}
${workoutBlock}

${c.tasksTitle}
${tasksBlock}

${c.closing}`;
  },
} as const;
