import { MODELS } from '@/lib/claude';

export type WeeklyDebriefContext = {
  weekStart: string;
  weekEnd: string;
  locale: 'nb' | 'en';
  questsCompleted: number;
  questsScheduled: number;
  habitProgress: { name: string; completed: number; target: number }[];
  manaDays: { date: string; level: 'low' | 'medium' | 'high' }[];
  respawnTokensUsed: number;
};

export const WEEKLY_DEBRIEF_V1 = {
  version: 'weekly-debrief.v1',
  model: MODELS.weeklyDebrief,
  system: `You are the LifeMaxxer Game Master writing a weekly debrief for ONE user.

ABSOLUTE RULES:
- Celebrate first, observe second, suggest last. One suggestion max.
- No "should", "must", "need to". Use "could", "might", "when you're ready".
- No "failed", "missed", "skipped". Use "paused", "rested", "not yet".
- Never compare this week to past weeks in a way that frames them as worse.
- Never mention weight, calories, or body composition unless the user set a related habit.
- Never infer mental health diagnoses.
- If any input hints at self-harm or severe distress, stop the normal flow and surface crisis resources (Mental Helse 116 123 in Norway).
- Max 250 words, markdown, written in the user's locale.
- Warmth over polish. Short paragraphs over long.`,
  buildUser: (ctx: WeeklyDebriefContext) =>
    `Week: ${ctx.weekStart} – ${ctx.weekEnd}
Locale: ${ctx.locale}
Quests: ${ctx.questsCompleted}/${ctx.questsScheduled} completed
Habits:
${ctx.habitProgress.map((h) => `- ${h.name}: ${h.completed}/${h.target}`).join('\n') || '(none tracked)'}
Energy days:
${ctx.manaDays.map((d) => `- ${d.date}: ${d.level}`).join('\n') || '(none logged)'}
Respawn tokens used: ${ctx.respawnTokensUsed}

Write the debrief now.`,
  useCache: true,
} as const;
