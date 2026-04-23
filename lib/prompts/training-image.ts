import type { Locale } from './locales';
import type { TrainingDay, TrainingEquipment } from './training-plan.v1';

export type TrainingImageContext = {
  day: TrainingDay;
  location: 'home' | 'gym' | 'outdoor' | 'mixed';
  equipment: TrainingEquipment[];
  locale: Locale;
};

/**
 * Photo-realistic prompt for a single workout day's hero image.
 * The setting follows the user's chosen training location so they see
 * themselves reflected back. The person's pose and equipment follow
 * the day's primary exercise so the image actually matches the plan.
 *
 * Constraints:
 *  - no text / watermark / logo
 *  - ONE person in frame, unambiguous athletic pose mid-action
 *  - lighting warm and natural, not studio-plastic
 *  - equipment in frame only if listed for the user
 */

const LOCATION_SETTING: Record<TrainingImageContext['location'], string> = {
  home:
    'a bright tidy Scandinavian home interior with light hardwood floors and neutral walls, large window letting in soft natural daylight, minimal clutter',
  gym:
    'a clean modern commercial gym with rubber flooring, racks and dumbbells visible in the soft-focus background, professional overhead lighting with warm tones',
  outdoor:
    'an outdoor Norwegian park or forest trail in soft golden-hour daylight, trees and sky visible, ground surface matches the movement (grass / paved path)',
  mixed:
    'a clean functional training room with neutral decor, hardwood floor, natural daylight through a large window',
};

// Rest-day scenes per location so the rest-day image fits the person's
// life rather than a generic sofa stock photo. Shorter than the active
// LOCATION_SETTING strings because rest images need less direction.
const REST_SETTING: Record<TrainingImageContext['location'], string> = {
  home:
    'a cozy Scandinavian living room with a soft sofa, a warm blanket and a steaming mug on a wooden side table, natural daylight through linen curtains',
  gym:
    'a quiet corner of a modern gym lounge with a cushioned bench, towel and water bottle, soft daylight from a nearby window',
  outdoor:
    'a Norwegian beach or forest clearing on a calm day, a person sitting on a flat rock or a towel watching the view, warm golden-hour light',
  mixed:
    'a calm home setting — either a sofa with a book or an outdoor bench with soft daylight',
};

// Short hint strings so the prompt stays focused and the model doesn't
// hallucinate machines the user doesn't actually have access to.
const EQUIPMENT_HINT: Record<TrainingEquipment, string> = {
  bodyweight: 'bodyweight only, no equipment in frame',
  dumbbells: 'a pair of dumbbells at a realistic weight',
  barbell: 'a loaded barbell with modest plates',
  kettlebell: 'one kettlebell',
  bands: 'a resistance band',
  pullup_bar: 'a pull-up bar mounted overhead',
  bench: 'a flat weight bench',
  cardio_machine: 'a treadmill or exercise bike',
  full_gym: 'gym machines and racks softly blurred in the background',
};

/** Convert a workout type into a short composition hint. */
function typeHint(type: TrainingDay['type']): string {
  switch (type) {
    case 'strength':
      return 'mid-repetition pose with correct form, strong stable stance';
    case 'cardio':
      return 'dynamic motion blur on limbs, clear sense of movement and pace';
    case 'conditioning':
      return 'athletic intensity with visible effort, interval-style work';
    case 'mobility':
      return 'controlled stretch or yoga pose, calm and deliberate';
    default:
      return 'clear athletic pose';
  }
}

export function buildTrainingImagePrompt(ctx: TrainingImageContext): string {
  // Rest day → relaxed scene matching the user's normal training context.
  if (ctx.day.type === 'rest') {
    const setting = REST_SETTING[ctx.location] ?? REST_SETTING.mixed;
    return [
      'Photo-realistic photograph of a relaxed adult resting and recovering.',
      `Setting: ${setting}.`,
      'Composition: the person is the clear subject but unposed — reading, stretching gently, sipping a drink, or quietly looking off-camera.',
      'Subject wears comfortable everyday clothing (soft knit, t-shirt, loose trousers).',
      'Warm naturalistic lighting, shallow depth of field, subject in sharp focus.',
      'Calm unhurried mood. Documentary feel, not posed.',
      'One person only, face soft or off-angle — do not feature the face prominently.',
      'No text, no watermark, no logos, no brand names, no exercise equipment.',
    ].join(' ');
  }

  const setting = LOCATION_SETTING[ctx.location] ?? LOCATION_SETTING.mixed;
  const pose = typeHint(ctx.day.type);
  const topExercise = ctx.day.exercises?.[0]?.name ?? ctx.day.title;

  // Pick at most 2 equipment hints so we don't over-specify.
  const equipHints = ctx.equipment
    .slice(0, 2)
    .map((e) => EQUIPMENT_HINT[e])
    .filter(Boolean);
  const equipLine = equipHints.length
    ? `Equipment visible: ${equipHints.join(', ')}.`
    : '';

  return [
    `Photo-realistic action photograph of an adult athlete performing "${topExercise}".`,
    `Today's session focus: ${ctx.day.focus}.`,
    `Setting: ${setting}.`,
    `Composition: ${pose}. The athlete is the clear subject, filling the central third of the frame.`,
    'Subject wears modern athletic clothing (t-shirt or fitted top plus shorts or leggings) appropriate for the setting.',
    equipLine,
    'Warm naturalistic lighting, moderate contrast, shallow depth of field with the subject in sharp focus.',
    'Unposed documentary feel, not a catalogue shoot.',
    'One person only, face may be off-angle or lightly motion-blurred — do not feature the face prominently.',
    'No text, no watermark, no logos, no brand names, no tattoos of text.',
  ]
    .filter(Boolean)
    .join(' ');
}
