import type { Locale } from './locales';
import type { TrainingEquipment, TrainingExercise } from './training-plan.v1';
import { sanitizePromptValue } from './sanitize';

export type ExerciseImageContext = {
  exercise: TrainingExercise;
  location: 'home' | 'gym' | 'outdoor' | 'mixed';
  equipment: TrainingEquipment[];
  locale: Locale;
};

/**
 * Photo-realistic prompt for a single-exercise demonstration image.
 * Intentionally tighter framing than the per-day hero so the exercise
 * form is legible at thumbnail size.
 *
 * Output is 1:1 square — it plays well as a small avatar next to each
 * ExerciseRow and keeps Gemini's cost proportional to the smaller
 * aspect.
 */

const SETTING: Record<ExerciseImageContext['location'], string> = {
  home:
    'a tidy Scandinavian home interior with light hardwood floors, neutral walls, and soft natural daylight',
  gym:
    'a clean modern commercial gym with rubber flooring and soft overhead lighting',
  outdoor:
    'an outdoor Norwegian park or paved plaza in soft daylight',
  mixed:
    'a clean functional training space with hardwood floor and daylight',
};

// Short hint per broad equipment class so the model knows what to
// actually show in the athlete's hands / around them.
const EQUIP_HINTS: Record<TrainingEquipment, string> = {
  bodyweight: 'no equipment in frame',
  dumbbells: 'with a pair of dumbbells',
  barbell: 'with a loaded barbell',
  kettlebell: 'with one kettlebell',
  bands: 'with a resistance band',
  pullup_bar: 'under a pull-up bar',
  bench: 'on or beside a flat weight bench',
  cardio_machine: 'near a cardio machine',
  full_gym: 'in a gym with machines softly blurred in the background',
};

function inferEquipmentHint(
  exerciseName: string,
  equipment: TrainingEquipment[],
): string {
  const lower = exerciseName.toLowerCase();
  // Pick the first equipment hint whose keyword appears in the name so
  // "Pull-ups" gets the bar and "Manualbenkpress" gets dumbbells.
  const keywordMap: Array<[RegExp, TrainingEquipment]> = [
    [/pull.?up|hang|stang/, 'pullup_bar'],
    [/manual|dumbbell/, 'dumbbells'],
    [/kettlebell|svingning/, 'kettlebell'],
    [/strikk|band/, 'bands'],
    [/stang|markløft|benkpress|barbell|squat(?!\s+split)/, 'barbell'],
    [/tredemølle|treadmill|sykkel|bike|ro(?:maskin)?|rower/, 'cardio_machine'],
    [/benk|bench/, 'bench'],
  ];
  for (const [re, key] of keywordMap) {
    if (re.test(lower) && equipment.includes(key)) return EQUIP_HINTS[key];
  }
  if (equipment.length === 0 || equipment.includes('bodyweight')) {
    return EQUIP_HINTS.bodyweight;
  }
  // Fallback: use the first available equipment's hint
  const first = equipment[0];
  return EQUIP_HINTS[first] ?? EQUIP_HINTS.bodyweight;
}

export function buildExerciseImagePrompt(
  ctx: ExerciseImageContext,
): string {
  const setting = SETTING[ctx.location] ?? SETTING.mixed;
  const equipHint = inferEquipmentHint(ctx.exercise.name, ctx.equipment);
  const safeName = sanitizePromptValue(ctx.exercise.name, 100);
  return [
    `Photo-realistic side-by-side TWO-FRAME movement demonstration of "${safeName}".`,
    'Single wide image composed as a clean diptych split exactly down the middle:',
    'the LEFT half shows the START position of one repetition,',
    'the RIGHT half shows the END position of the same repetition.',
    'Same person, same camera angle, same setting, same wardrobe, same lighting in both halves — only the body position changes.',
    'A subtle thin vertical seam or small gap separates the two panels (no thick frame).',
    `Setting: ${setting}.`,
    `Equipment: ${equipHint}.`,
    'Subject wears simple athletic clothing appropriate for the setting.',
    'Warm naturalistic lighting, shallow depth of field, subject in sharp focus, clean uncluttered background.',
    'In each panel the subject is framed from roughly mid-thigh to just above the head, centered, with their full silhouette visible at the most readable point of the movement.',
    'Documentary feel, not a catalogue shoot.',
    'Face soft or partially off-angle — do not feature the face prominently.',
    'No text in the image — do NOT write "before", "after", "start", "end", "1", "2" or any captions.',
    'No watermark, no logos, no brand names, no on-screen captions.',
  ].join(' ');
}

/**
 * Stable slug so the same exercise across days / plans lands on the
 * same storage path and gets reused instead of re-generated.
 */
export function exerciseSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (æ/ø/å → ae/o/a below)
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
