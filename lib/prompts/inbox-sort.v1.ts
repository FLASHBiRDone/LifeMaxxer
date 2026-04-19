import { MODELS } from '@/lib/claude';

export type InboxItem = {
  id: string;
  content: string;
};

export type InboxSortSuggestion = {
  id: string;
  type: 'quest' | 'habit' | 'discard';
  title: string;
  reason: string;
};

export const INBOX_SORT_V1 = {
  version: 'inbox-sort.v1',
  model: MODELS.morningBriefing, // cheap + fast
  system: `You are the LifeMaxxer inbox sorter. The user has dumped thoughts, tasks, and ideas into an inbox. Your job is to classify each item into exactly one bucket.

BUCKETS:
- "quest": a concrete one-off task (call someone, buy X, finish Y)
- "habit": a recurring behavior the user wants to build (daily/weekly)
- "discard": venting, already-done notes, too vague, or not actionable

RULES:
- Output one suggestion per input item. Same order. Never skip.
- "title" must be short (max 60 chars) and action-oriented — verb first when possible.
- "reason" is a very short phrase (max 10 words) explaining your choice.
- Be decisive. Prefer "quest" over "habit" unless the user explicitly phrased it as recurring.
- If unclear or not actionable, pick "discard".
- Write in the same language as the item (Norwegian or English).

OUTPUT FORMAT (strict JSON, no preamble):
{
  "suggestions": [
    { "id": "<uuid>", "type": "quest|habit|discard", "title": "...", "reason": "..." }
  ]
}`,
  buildUser: (items: InboxItem[]) =>
    `Classify each item below.\n\n${items
      .map((i, idx) => `${idx + 1}. [id=${i.id}] ${i.content}`)
      .join('\n')}`,
} as const;
