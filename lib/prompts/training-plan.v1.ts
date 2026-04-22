import { MODELS } from '@/lib/claude';

export const TRAINING_GOALS = [
  'lose_weight',
  'gain_strength',
  'gain_muscle',
  'tone',
  'conditioning',
  'mobility',
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const TRAINING_EQUIPMENT = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'kettlebell',
  'bands',
  'pullup_bar',
  'bench',
  'cardio_machine',
  'full_gym',
] as const;
export type TrainingEquipment = (typeof TRAINING_EQUIPMENT)[number];

export type TrainingPlanParams = {
  locale: 'nb' | 'en';
  goals: TrainingGoal[];
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  minutesPerSession: number;
  equipment: TrainingEquipment[];
  location: 'home' | 'gym' | 'outdoor' | 'mixed';
  injuries: string | null;
  notes: string | null;
};

export type TrainingExercise = {
  name: string;
  sets: number;
  reps: string; // "8-12", "30 sec", "AMRAP"
  restSeconds: number;
  notes?: string;
};

export type TrainingDay = {
  day: string; // "Mandag" / "Monday"
  type: 'strength' | 'cardio' | 'conditioning' | 'mobility' | 'rest';
  title: string; // "Helkropp A" / "Rest"
  duration: number; // minutes
  focus: string; // short summary
  warmup: string[];
  exercises: TrainingExercise[];
  cooldown: string[];
};

export type TrainingPlanOutput = {
  summary: string;
  weeksSuggested: number;
  progressionTips: string[];
  safetyNotes: string[];
  days: TrainingDay[];
};

const GOAL_LABELS: Record<TrainingGoal, string> = {
  lose_weight: 'weight loss (higher volume, shorter rest, cardio emphasis)',
  gain_strength:
    'maximal strength (compound lifts, 3–6 reps, 2–5 min rest, lower frequency per lift, high intensity)',
  gain_muscle:
    'hypertrophy / muscle gain (8–12 reps, 60–90s rest, moderate-high volume, progressive overload)',
  tone:
    'muscle tone / body recomposition (10–15 reps, 45–75s rest, mix compound + isolation, some cardio)',
  conditioning:
    'cardiovascular conditioning (interval work, circuits, 30–60s rest or none, HR zones 3–5)',
  mobility:
    'mobility + flexibility (dynamic stretches, yoga flows, controlled eccentrics)',
};

const EQUIPMENT_LABELS: Record<TrainingEquipment, string> = {
  bodyweight: 'bodyweight only',
  dumbbells: 'dumbbells',
  barbell: 'barbell + plates',
  kettlebell: 'kettlebell',
  bands: 'resistance bands',
  pullup_bar: 'pull-up bar',
  bench: 'weight bench',
  cardio_machine: 'cardio machine (treadmill/bike/rower)',
  full_gym: 'full commercial gym (machines + free weights + cables)',
};

export const TRAINING_PLAN_V1 = {
  version: 'training-plan.v1',
  model: MODELS.weeklyDebrief, // Sonnet — higher stakes, safety-critical
  system: `You are LifeMaxxer's training coach. You design safe, evidence-based weekly workout programs tailored to the user's stated goals and constraints.

ABSOLUTE SAFETY RULES:
- NEVER prescribe exercises that require a spotter (e.g. heavy barbell back squat, bench press) for beginners training alone, or when the user lists "home" location without a power rack and safety bars.
- If the user mentions injuries or pain, substitute compromised movement patterns. When in doubt, choose the lower-risk alternative. Advise consulting a physio if injury is acute.
- Match exercise technical difficulty to stated experience level. Beginners get simple, foundational movements. Progress to complex lifts (Olympic, plyos, advanced gymnastics) only for "advanced".
- Include warm-up (3–8 min) and cool-down (3–5 min) for every non-rest day.
- Include rest days appropriate to goals: pure strength → 2+ rest days/week; hypertrophy → 1–2; conditioning can run 5–6 active days.
- Cap session duration at the user's stated minutesPerSession. Better to skip an exercise than to overrun.

REST INTERVAL RULES (critical — match rest to the dominant goal):
- Strength (1–6 reps): 2.5–5 min rest (150–300s)
- Hypertrophy (6–12 reps): 60–90s rest
- Endurance / tone (12–20 reps): 30–60s rest
- Conditioning / metabolic: 15–45s rest, or work/rest ratios (e.g. 40:20, EMOM, AMRAP)
- Mobility: minimal/no rest between poses

MULTI-GOAL HANDLING:
- If goals conflict (e.g. "gain strength" + "lose weight"), prioritize strength on lifting days and add short conditioning finishers. Do not prescribe aggressive caloric/cardio that undermines strength goals.
- If user selects mobility alongside strength/conditioning, allocate 1–2 standalone mobility days OR integrate 10-min mobility blocks.

EQUIPMENT RULES:
- NEVER prescribe an exercise requiring equipment the user did not list. If they have only bodyweight + bands, do not suggest dumbbell exercises.
- "full_gym" unlocks all equipment. "home" + nothing else = bodyweight only.

OUTPUT FORMAT (strict JSON, no preamble, no trailing text):
{
  "summary": "2-sentence description of what this program will achieve",
  "weeksSuggested": 4-8,
  "progressionTips": ["3–5 bullets on how to progress week-over-week"],
  "safetyNotes": ["2–4 critical safety reminders specific to this program"],
  "days": [
    {
      "day": "Mandag",
      "type": "strength" | "cardio" | "conditioning" | "mobility" | "rest",
      "title": "short session name e.g. 'Helkropp A' or 'Rest'",
      "duration": total minutes including warm-up/cool-down (0 if rest),
      "focus": "one-line summary of what this day targets",
      "warmup": ["3-5 short warmup items"] or [] for rest,
      "exercises": [
        {
          "name": "Knebøy",
          "sets": 4,
          "reps": "6-8",
          "restSeconds": 180,
          "notes": "optional cueing, leave out if obvious"
        }
      ],
      "cooldown": ["2-3 stretch/mobility items"] or [] for rest
    }
  ]
}

CONTENT RULES:
- Exactly 7 days, named in user's locale (Mandag..Søndag for nb, Monday..Sunday for en), starting from Monday.
- Exercise names in user's locale. For Norwegian use common names: "Knebøy", "Markløft", "Benkpress", "Pull-ups", "Push-ups", "Utfall", "Planke".
- For rest days: exercises: [], warmup: [], cooldown: [], duration: 0, focus: "Fullstendig hvile" / "Complete rest".
- Balance push/pull, upper/lower, knee/hip dominant across the week.
- No repeated full sessions on consecutive days.`,
  buildUser: (p: TrainingPlanParams) => {
    const goalList = p.goals.map((g) => `- ${GOAL_LABELS[g]}`).join('\n');
    const equipList = p.equipment.length
      ? p.equipment.map((e) => `- ${EQUIPMENT_LABELS[e]}`).join('\n')
      : '- (none — bodyweight only)';
    return `Locale: ${p.locale}
Experience: ${p.experience}
Goals (ranked by priority in given order):
${goalList}
Training location: ${p.location}
Days available per week: ${p.daysPerWeek}
Minutes per session: ${p.minutesPerSession}
Available equipment:
${equipList}
Injuries / limitations: ${p.injuries?.trim() || '(none)'}
Extra notes: ${p.notes?.trim() || '(none)'}

Design a weekly training program. It must fit exactly within minutesPerSession per workout day and use ONLY the listed equipment. Include appropriate rest days. Generate the JSON now.`;
  },
} as const;
