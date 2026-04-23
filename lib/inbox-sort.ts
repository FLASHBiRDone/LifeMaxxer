import { z } from 'zod';
import { getClaude, MODELS, estimateCostUsd } from '@/lib/claude';
import { INBOX_SORT_V1 } from '@/lib/prompts';
import type { InboxItem, InboxSortSuggestion } from '@/lib/prompts';
import type { Locale } from '@/lib/prompts/locales';

const suggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['quest', 'habit', 'discard']),
      title: z.string().min(1).max(200),
      reason: z.string().max(200),
    }),
  ),
});

export type SortResult = {
  suggestions: InboxSortSuggestion[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  promptVersion: string;
};

export async function sortInboxItems(
  items: InboxItem[],
  locale: Locale = 'nb',
): Promise<SortResult> {
  const client = getClaude();
  const res = await client.messages.create({
    model: MODELS.morningBriefing,
    max_tokens: Math.min(2048, 100 + items.length * 80),
    system: INBOX_SORT_V1.systemFor(locale),
    messages: [{ role: 'user', content: INBOX_SORT_V1.buildUserFor(locale, items) }],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('inbox sort response did not contain JSON');
  const parsed = suggestionSchema.parse(JSON.parse(jsonMatch[0]));

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    suggestions: parsed.suggestions,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(MODELS.morningBriefing, tokensIn, tokensOut),
    promptVersion: INBOX_SORT_V1.version,
  };
}
