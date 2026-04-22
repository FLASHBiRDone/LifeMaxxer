import { z } from 'zod';
import { getClaude, MODELS, estimateCostUsd } from '@/lib/claude';
import { MORNING_BRIEFING_V1 } from '@/lib/prompts';
import type { MorningContext, MorningBriefingOutput } from '@/lib/prompts';

const briefingSchema = z.object({
  intro: z.string().min(1).max(300),
  summary: z.string().max(600).optional().default(''),
  clothing: z.string().max(300).optional().default(''),
  quests: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        why: z.string().min(1).max(200),
      }),
    )
    .max(3)
    .default([]),
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
  const isNb = ctx.locale === 'nb';
  const weatherLine = ctx.weather
    ? isNb
      ? `Været: ${ctx.weather.conditionLabel}, ${ctx.weather.tempMin}–${ctx.weather.tempMax}°C.`
      : `Weather: ${ctx.weather.conditionLabel}, ${ctx.weather.tempMin}–${ctx.weather.tempMax}°C.`
    : '';
  const clothing = ctx.weather
    ? suggestClothing(ctx.weather, isNb)
    : '';
  if (ctx.events.length === 0) {
    return {
      intro: isNb ? 'Kalenderen er åpen. Det er en gave.' : "Your calendar is clear. That's a gift.",
      summary: weatherLine,
      clothing,
      quests: [],
    };
  }
  return {
    intro: isNb ? 'Her er det som ligger i dag.' : "Here's what's on today.",
    summary: weatherLine,
    clothing,
    quests: ctx.events.slice(0, 3).map((e) => ({
      title: e.title,
      why: isNb ? 'fra kalenderen din' : 'from your calendar',
    })),
  };
}

/** Very rough clothing hint used when the model call is skipped/fails. */
function suggestClothing(
  w: NonNullable<MorningContext['weather']>,
  isNb: boolean,
): string {
  const cold = w.tempMax <= 5;
  const cool = w.tempMax > 5 && w.tempMax <= 15;
  const warm = w.tempMax > 15 && w.tempMax <= 22;
  const hot = w.tempMax > 22;
  const wet = w.precipitationMm >= 1;
  const windy = w.windMaxKmh >= 30;

  const parts: string[] = [];
  if (cold) parts.push(isNb ? 'varm jakke' : 'warm coat');
  else if (cool) parts.push(isNb ? 'jakke og genser' : 'jacket and sweater');
  else if (warm) parts.push(isNb ? 'genser eller cardigan' : 'sweater or cardigan');
  else if (hot) parts.push(isNb ? 'lette klær' : 'light clothes');
  if (wet) parts.push(isNb ? 'regnsikker sko' : 'rain-ready shoes');
  if (windy) parts.push(isNb ? 'vindtett lag' : 'windproof layer');
  if (parts.length === 0) return '';
  const joined = parts.join(isNb ? ', ' : ', ');
  return isNb ? `Ta på: ${joined}.` : `Wear: ${joined}.`;
}
