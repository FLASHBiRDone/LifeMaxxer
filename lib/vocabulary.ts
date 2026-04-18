/**
 * Custom vocabulary substitution. Users can rename Quest -> Task,
 * Mana -> Spoons, etc. Stored on users.custom_vocabulary (jsonb).
 *
 * Fall back to locale defaults if the key is not set.
 */
export type VocabKey =
  | 'quest'
  | 'quests'
  | 'side_quest'
  | 'main_quest'
  | 'mana'
  | 'dopabar'
  | 'boss_battle'
  | 'respawn_token';

export type Vocabulary = Partial<Record<VocabKey, string>>;

export function vocab(
  key: VocabKey,
  custom: Vocabulary | null | undefined,
  fallback: string,
): string {
  return custom?.[key] ?? fallback;
}
