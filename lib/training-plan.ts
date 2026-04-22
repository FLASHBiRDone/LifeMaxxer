import { z } from 'zod';
import { getClaude, PRICING, estimateCostUsd } from '@/lib/claude';
import { TRAINING_PLAN_V1 } from '@/lib/prompts';
import type {
  TrainingPlanParams,
  TrainingPlanOutput,
} from '@/lib/prompts';

const exerciseSchema = z.object({
  name: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1).max(40),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().max(200).optional(),
});

const daySchema = z.object({
  day: z.string().min(1).max(40),
  type: z.enum(['strength', 'cardio', 'conditioning', 'mobility', 'rest']),
  title: z.string().min(1).max(120),
  duration: z.number().int().min(0).max(240),
  focus: z.string().min(1).max(200),
  warmup: z.array(z.string().min(1).max(200)).max(10),
  exercises: z.array(exerciseSchema).max(20),
  cooldown: z.array(z.string().min(1).max(200)).max(10),
});

const planSchema = z.object({
  summary: z.string().min(1).max(400),
  weeksSuggested: z.number().int().min(1).max(16),
  progressionTips: z.array(z.string().min(1).max(300)).min(1).max(10),
  safetyNotes: z.array(z.string().min(1).max(300)).min(0).max(10),
  days: z.array(daySchema).length(7),
});

export type TrainingPlanResult = {
  output: TrainingPlanOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export async function generateTrainingPlan(
  params: TrainingPlanParams,
): Promise<TrainingPlanResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: TRAINING_PLAN_V1.model,
    max_tokens: 6000,
    system: TRAINING_PLAN_V1.system,
    messages: [{ role: 'user', content: TRAINING_PLAN_V1.buildUser(params) }],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('training plan response did not contain JSON');
  const output = planSchema.parse(JSON.parse(jsonMatch[0]));

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
