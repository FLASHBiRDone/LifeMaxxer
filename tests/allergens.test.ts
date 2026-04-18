import { describe, it, expect } from 'vitest';
import { isSafeForUser, intersect, ALLERGENS } from '@/lib/allergens';

describe('allergens', () => {
  it('flags recipes containing any user allergen', () => {
    expect(isSafeForUser(['gluten'], ['gluten'])).toBe(false);
    expect(isSafeForUser(['gluten', 'dairy'], ['peanut'])).toBe(true);
    expect(isSafeForUser([], ['peanut'])).toBe(true);
    expect(isSafeForUser(['peanut'], [])).toBe(true);
  });

  it('intersect returns the overlapping allergens', () => {
    expect(intersect(['gluten', 'dairy'], ['dairy', 'egg'])).toEqual(['dairy']);
    expect(intersect(['gluten'], ['peanut'])).toEqual([]);
  });

  it('EU-FIC-14 allergen list includes the core set', () => {
    for (const a of ['gluten', 'peanut', 'shellfish', 'sesame']) {
      expect(ALLERGENS).toContain(a);
    }
  });
});
