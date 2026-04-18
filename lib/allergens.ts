/**
 * Deterministic allergen filtering. The AI never decides what is safe to eat.
 *
 * Allergen list matches the EU FIC regulation 14 major allergens
 * (appropriate for Norwegian users). See BUILD_SPEC §8.
 */
export const ALLERGENS = [
  'gluten',
  'dairy',
  'lactose',
  'egg',
  'peanut',
  'tree_nut',
  'soy',
  'fish',
  'shellfish',
  'sesame',
  'celery',
  'mustard',
  'sulfite',
  'lupin',
  'mollusc',
] as const;

export type Allergen = (typeof ALLERGENS)[number];

export function isSafeForUser(
  recipeAllergens: readonly string[],
  userAllergens: readonly string[],
): boolean {
  const flagged = new Set(userAllergens);
  return !recipeAllergens.some((a) => flagged.has(a));
}

export function intersect(
  recipeAllergens: readonly string[],
  userAllergens: readonly string[],
): string[] {
  const flagged = new Set(userAllergens);
  return recipeAllergens.filter((a) => flagged.has(a));
}
