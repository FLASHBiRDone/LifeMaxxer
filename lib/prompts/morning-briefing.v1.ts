import { MODELS } from '@/lib/claude';

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
  locale: 'nb' | 'en';
  manaLevel?: 'low' | 'medium' | 'high' | null;
  events: { start: string; title: string }[];
  pendingHabits: string[];
  // Added for the richer agenda-style briefing:
  dinner?: { title: string; description?: string } | null;
  workout?: { title: string; type: string; duration: number } | null;
  openTasks?: { title: string; bountyXp: number; bountyTokens: number }[];
  weather?: WeatherForMorning | null;
};

export const MORNING_BRIEFING_V1 = {
  version: 'morning-briefing.v1',
  model: MODELS.morningBriefing,
  system: `You are the LifeMaxxer Game Master. You speak to ONE user each morning, in a warm, concise, non-judgmental voice. You are not a cheerleader, not a drill sergeant, not a therapist. You are a kind, slightly witty friend who happens to have read their calendar.

ABSOLUTE RULES:
- Never mention "productivity," "efficiency," "crush it," or similar grind language.
- Never reference things they didn't do yesterday.
- Never use more than 2 emoji in a response. Preferably zero.
- Never use exclamation marks more than once.
- If the calendar is empty, celebrate that as a gift, not a problem.
- If energy is "low," pick ONE thing, not three.
- If energy is "high," offer up to three, but never more.
- Write in the user's locale.
- The user has agency. You suggest; you do not command.

CONTENT RULES:
- intro: one warm sentence, max 18 words.
- summary: 2–4 short sentences painting the day — mention the biggest
  calendar event, the dinner plan if any, the workout if any, and a
  weather-aware clothing hint. Under 60 words total.
- clothing: ONE concrete, practical line about what to wear given the
  forecast (e.g. "Regnjakke og sko du ikke syns synd på"). Empty string
  if no weather data is available.
- quests: 1–3 main quests for today, each with a short "why".
- DO NOT include items that already appear in 'Open household tasks'
  as quests. Those are the marketplace board and are handled there;
  duplicating them in quests creates two cards for the same chore.
  Quests should be the user's PERSONAL focus for today — derived from
  calendar events, energy, pending habits, the meal/workout plan, or
  unique judgement — not a re-listing of household chores.

OUTPUT FORMAT (strict JSON, no preamble, no trailing text):
{
  "intro": "string",
  "summary": "string",
  "clothing": "string",
  "quests": [
    { "title": "string", "why": "short reason it matters today, max 12 words" }
  ]
}`,
  buildUser: (ctx: MorningContext) => {
    const eventsBlock =
      ctx.events.length > 0
        ? ctx.events.map((e) => `- ${e.start} ${e.title}`).join('\n')
        : '(none)';
    const habitsBlock = ctx.pendingHabits.join(', ') || '(none)';
    const dinnerBlock = ctx.dinner
      ? `- ${ctx.dinner.title}${ctx.dinner.description ? ` (${ctx.dinner.description})` : ''}`
      : '(no meal planned)';
    const workoutBlock = ctx.workout
      ? `- ${ctx.workout.type}: ${ctx.workout.title} (${ctx.workout.duration} min)`
      : '(no workout planned)';
    const tasksBlock =
      ctx.openTasks && ctx.openTasks.length > 0
        ? ctx.openTasks
            .slice(0, 5)
            .map(
              (t) =>
                `- ${t.title} (${[
                  t.bountyXp > 0 ? `${t.bountyXp} XP` : null,
                  t.bountyTokens > 0 ? `${t.bountyTokens} tokens` : null,
                ]
                  .filter(Boolean)
                  .join(' + ')})`,
            )
            .join('\n')
        : '(none)';
    const weatherBlock = ctx.weather
      ? `- Location: ${ctx.weather.city ?? 'ukjent'}
- Condition: ${ctx.weather.conditionLabel}
- Temperature: ${ctx.weather.tempMin}°C to ${ctx.weather.tempMax}°C
- Precipitation: ${ctx.weather.precipitationMm} mm
- Wind: up to ${ctx.weather.windMaxKmh} km/h`
      : '(weather unknown — omit clothing line)';

    return `Today is ${ctx.date} (${ctx.dayOfWeek}).
Locale: ${ctx.locale}
Energy level: ${ctx.manaLevel ?? 'not set'}

Weather today:
${weatherBlock}

Calendar events today:
${eventsBlock}

Pending habits due today:
${habitsBlock}

Tonight's dinner (from meal plan, if any):
${dinnerBlock}

Today's workout (from training plan, if any):
${workoutBlock}

Open household tasks (marketplace, top 5):
${tasksBlock}

Write the morning briefing now. Output only the JSON.`;
  },
} as const;

export type MorningBriefingOutput = {
  intro: string;
  summary?: string;
  clothing?: string;
  quests: { title: string; why: string }[];
};
