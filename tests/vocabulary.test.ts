import { describe, it, expect } from 'vitest';
import { vocab } from '@/lib/vocabulary';

describe('vocabulary', () => {
  it('returns the custom value when set', () => {
    expect(vocab('quest', { quest: 'task' }, 'quest')).toBe('task');
  });

  it('falls back to the locale default when not set', () => {
    expect(vocab('mana', {}, 'energi')).toBe('energi');
    expect(vocab('mana', null, 'energi')).toBe('energi');
    expect(vocab('mana', undefined, 'energi')).toBe('energi');
  });
});
