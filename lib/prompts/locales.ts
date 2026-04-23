/**
 * Single source of truth for which locales the app supports for AI
 * prompts + UI copy. Each prompt module imports SUPPORTED_LOCALES /
 * type Locale and exports per-locale strings keyed against this list.
 *
 * Add a new language by extending this array and adding the matching
 * blocks in every prompt module that opts into per-locale variants.
 */
export const SUPPORTED_LOCALES = ['nb', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  nb: 'Norsk (bokmål)',
  en: 'English',
};

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/** Coerce any input to a known locale, falling back to nb. */
export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : 'nb';
}
