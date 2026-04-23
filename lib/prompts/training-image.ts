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
