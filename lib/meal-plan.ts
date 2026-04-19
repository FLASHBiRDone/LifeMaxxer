import { z } from 'zod';
import { getClaude, MODELS, estimateCostUsd } from '@/lib/claude';
import { MEAL_PLAN_V1 } from '@/lib/prompts';
import type { MealPlanParams, MealPlanOutput } from '@/lib/prompts';

const dayDetailSchema = z.object({
  day: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(200),
  prepMinutes: z.number().int().min(0).max(240),
  cookMinutes: z.number().int().min(0).max(240),
  ingredients: z.array(
    z.object({ name: z.string().min(1).max(120), amount: z.string().min(1).max(40) }),
  ).min(1).max(30),
  instructions: z.array(z.string().min(1).max(400)).min(1).max(10),
});

const planSchema = z.object({
  days: z.array(dayDetailSchema).length(7),
});

export type MealPlanResult = {
  output: MealPlanOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export async function generateMealPlan(params: MealPlanParams): Promise<MealPlanResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: MODELS.morningBriefing,
    max_tokens: 4000,
    system: MEAL_PLAN_V1.system,
    messages: [{ role: 'user', content: MEAL_PLAN_V1.buildUser(params) }],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('meal plan response did not contain JSON');
  const output = planSchema.parse(JSON.parse(jsonMatch[0]));

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    output,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(MODELS.morningBriefing, tokensIn, tokensOut),
    promptVersion: MEAL_PLAN_V1.version,
  };
}
