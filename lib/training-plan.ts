import { z } from 'zod';
import { getClaude, PRICING, estimateCostUsd } from '@/lib/claude';
import { TRAINING_PLAN_V1 } from '@/lib/prompts';
import type {
  TrainingPlanParams,
  TrainingPlanOutput,
} from '@/lib/prompts';

const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  sets: z.number().int().min(0).max(30),
  reps: z.string().min(1).max(200),
  restSeconds: z.number().int().min(0).max(900),
  notes: z.string().max(500).optional(),
});

const daySchema = z.object({
  day: z.string().min(1).max(60),
  type: z.enum(['strength', 'cardio', 'conditioning', 'mobility', 'rest']),
  title: z.string().min(1).max(200),
  duration: z.number().int().min(0).max(300),
  focus: z.string().min(1).max(400),
  warmup: z.array(z.string().min(1).max(400)).max(15).default([]),
  exercises: z.array(exerciseSchema).max(25).default([]),
  cooldown: z.array(z.string().min(1).max(400)).max(15).default([]),
});

const planSchema = z.object({
  summary: z.string().min(1).max(1000),
  weeksSuggested: z.number().int().min(1).max(52).default(6),
  progressionTips: z.array(z.string().min(1).max(600)).max(20).default([]),
  safetyNotes: z.array(z.string().min(1).max(600)).max(20).default([]),
  days: z.array(daySchema).min(5).max(9),
});

export type TrainingPlanResult = {
  output: TrainingPlanOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export type TrainingDayResult = {
  day: z.infer<typeof daySchema>;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export async function swapTrainingDay(
  params: TrainingPlanParams,
  targetDayName: string,
  otherDays: { day: string; title: string; type: string; focus: string }[],
): Promise<TrainingDayResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: TRAINING_PLAN_V1.model,
    max_tokens: 2000,
    system: TRAINING_PLAN_V1.systemFor(params.locale),
    messages: [
      {
        role: 'user',
        content: TRAINING_PLAN_V1.buildSwapUserFor(params, targetDayName, otherDays),
      },
    ],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('training day swap response did not contain JSON');
  const day = daySchema.parse(JSON.parse(jsonMatch[0]));

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    day,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(
      TRAINING_PLAN_V1.model as keyof typeof PRICING,
      tokensIn,
      tokensOut,
    ),
    promptVersion: TRAINING_PLAN_V1.version,
  };
}

export async function generateTrainingPlan(
  params: TrainingPlanParams,
): Promise<TrainingPlanResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: TRAINING_PLAN_V1.model,
    max_tokens: 6000,
    system: TRAINING_PLAN_V1.systemFor(params.locale),
    messages: [{ role: 'user', content: TRAINING_PLAN_V1.buildUserFor(params) }],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[training-plan] no JSON in response:', text.slice(0, 600));
    throw new Error('training plan response did not contain JSON');
  }

  let parsed: z.infer<typeof planSchema>;
  try {
    parsed = planSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(
      '[training-plan] zod rejected response:',
      err instanceof Error ? err.message : String(err),
    );
    console.error('[training-plan] raw JSON:', jsonMatch[0].slice(0, 1200));
    throw new Error(
      `training plan response failed validation: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Normalize to exactly 7 days so the rest of the system (UI indices,
  // calendar week mapping, habit sync) stays consistent.
  const DAY_NAMES_NB = [
    'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag',
  ];
  const DAY_NAMES_EN = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ];
  const names = params.locale === 'nb' ? DAY_NAMES_NB : DAY_NAMES_EN;
  while (parsed.days.length < 7) {
    parsed.days.push({
      day: names[parsed.days.length],
      type: 'rest',
      title: params.locale === 'nb' ? 'Hvile' : 'Rest',
      duration: 0,
      focus: params.locale === 'nb' ? 'Fullstendig hvile' : 'Complete rest',
      warmup: [],
      exercises: [],
      cooldown: [],
    });
  }
  if (parsed.days.length > 7) parsed.days = parsed.days.slice(0, 7);

  const output = parsed as TrainingPlanOutput;

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    output,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(
      TRAINING_PLAN_V1.model as keyof typeof PRICING,
      tokensIn,
      tokensOut,
    ),
    promptVersion: TRAINING_PLAN_V1.version,
  };
}
