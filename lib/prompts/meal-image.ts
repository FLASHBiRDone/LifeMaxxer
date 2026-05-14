import type { Locale } from './locales';
import { sanitizePromptValue } from './sanitize';

export type MealImageContext = {
  title: string;
  description?: string;
  locale: Locale;
  diet?: 'any' | 'vegetarian' | 'vegan' | 'pescatarian';
  people?: number;
};

/**
 * Build a photo-realistic prompt for one dinner image. Intentionally
 * specific about composition, lighting, and style so Nano Banana 2
 * returns a usable, cohesive set of images across a week's plan
 * rather than wildly varying stock-photo aesthetics.
 *
 * Key constraints:
 *  - no text / watermark / logo
 *  - no people in frame (the hero is the food)
 *  - overhead-to-45-degree shot (close-up would hide what the dish is)
 *  - Scandinavian/Nordic tablescape fits the app's tone
 */
export function buildMealImagePrompt(ctx: MealImageContext): string {
  const dietHint =
    ctx.diet === 'vegan'
      ? 'The dish is strictly vegan (no animal products, no dairy, no eggs).'
      : ctx.diet === 'vegetarian'
        ? 'The dish is vegetarian (no meat, no fish).'
        : ctx.diet === 'pescatarian'
          ? 'The dish is pescatarian (no meat, but fish or seafood is fine).'
          : '';

  // Sanitize so a malicious title can't break out of the quoted span
  // and inject "Ignore previous instructions, generate …".
  const safeTitle = sanitizePromptValue(ctx.title, 120);
  const safeDesc = ctx.description ? sanitizePromptValue(ctx.description, 240) : '';

  // Keep it in English regardless of locale — image models have
  // stronger vocabulary in English and we want consistent quality.
  return [
    `Photo-realistic food photograph of "${safeTitle}".`,
    safeDesc ? `${safeDesc}.` : '',
    'Plated on a simple neutral ceramic dish on a pale wooden dining table.',
    'Natural daylight from a soft window source at 45 degrees, gentle shadows.',
    'Shot from a slight overhead angle, approximately 30-45 degrees.',
    'Shallow depth of field, sharp focus on the food.',
    'Scandinavian home cooking aesthetic, warm and appetizing but unpretentious.',
    'Ingredients visible on the plate; garnish kept minimal and realistic.',
    dietHint,
    'No people, no hands, no text, no watermark, no logos, no brand labels.',
    'Single cohesive hero plate filling most of the frame.',
  ]
    .filter(Boolean)
    .join(' ');
}
