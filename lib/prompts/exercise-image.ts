import type { Locale } from './locales';
import type { TrainingEquipment, TrainingExercise } from './training-plan.v1';

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
  return [
    `Photo-realistic fitness demonstration of a single exercise: "${ctx.exercise.name}".`,
    'One adult athlete performing the movement with clean technical form,',
    'captured mid-repetition at the most visually recognisable point of the movement.',
    `Setting: ${setting}.`,
    `Equipment: ${equipHint}.`,
    'Subject wears simple athletic clothing appropriate for the setting.',
    'Warm naturalistic lighting, shallow depth of field, subject in sharp focus, clean uncluttered background.',
    'Square 1:1 composition, subject centered, framed from roughly mid-thigh to just above the head.',
    'Unposed documentary feel, not a catalogue shoot.',
    'Face soft or partially off-angle — do not feature the face prominently.',
    'No text, no watermark, no logos, no brand names, no on-screen captions.',
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
