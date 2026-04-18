import Anthropic from '@anthropic-ai/sdk';
import { serverEnv } from '@/lib/env';

/**
 * Server-only Claude client. Never import this from client components.
 *
 * Model IDs are pinned via constants so prompt files don't drift when we
 * roll versions.
 */
export const MODELS = {
  morningBriefing: 'claude-haiku-4-5',
  weeklyDebrief: 'claude-sonnet-4-6',
  chat: 'claude-sonnet-4-6',
} as const;

let cached: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (cached) return cached;
  if (!serverEnv.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  cached = new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  return cached;
}

/**
 * Pricing in USD per million tokens. Keep updated when models change.
 * Used for budget enforcement in ai_messages.cost_usd.
 */
export const PRICING = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheRead: 0.3 },
} as const;

export function estimateCostUsd(
  model: keyof typeof PRICING,
  tokensIn: number,
  tokensOut: number,
): number {
  const p = PRICING[model];
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000;
}
