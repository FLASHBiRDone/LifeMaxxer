import { z } from 'zod';
import { getClaude, MODELS, estimateCostUsd } from '@/lib/claude';
import { MORNING_BRIEFING_V1 } from '@/lib/prompts';
import type { MorningContext, MorningBriefingOutput } from '@/lib/prompts';

const briefingSchema = z.object({
  intro: z.string().min(1).max(300),
  quests: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        why: z.string().min(1).max(200),
      }),
    )
    .max(3),
});

export type BriefingResult = {
  output: MorningBriefingOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export async function generateMorningBriefing(
  ctx: MorningContext,
): Promise<BriefingResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: MODELS.morningBriefing,
    max_tokens: 400,
    system: MORNING_BRIEFING_V1.system,
    messages: [
      {
        role: 'user',
        content: MORNING_BRIEFING_V1.buildUser(ctx),
      },
    ],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('briefing response did not contain JSON');
  }
  const output = briefingSchema.parse(JSON.parse(jsonMatch[0]));

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    output,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(MODELS.morningBriefing, tokensIn, tokensOut),
    promptVersion: MORNING_BRIEFING_V1.version,
  };
}

export function fallbackBriefing(ctx: MorningContext): MorningBriefingOutput {
  if (ctx.events.length === 0) {
    return {
      intro:
        ctx.locale === 'nb'
          ? 'Kalenderen er åpen. Det er en gave.'
          : "Your calendar is clear. That's a gift.",
      quests: [],
    };
  }
  return {
    intro:
      ctx.locale === 'nb'
        ? 'Her er det som ligger i dag.'
        : "Here's what's on today.",
    quests: ctx.events.slice(0, 3).map((e) => ({
      title: e.title,
      why: ctx.locale === 'nb' ? 'fra kalenderen din' : 'from your calendar',
    })),
  };
}
