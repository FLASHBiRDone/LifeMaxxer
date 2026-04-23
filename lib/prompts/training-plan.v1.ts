import { MODELS } from '@/lib/claude';
import type { Locale } from './locales';
import { normalizeLocale } from './locales';

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
  locale: Locale;
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
  reps: string;
  restSeconds: number;
  notes?: string;
};

export type TrainingDay = {
  day: string;
  type: 'strength' | 'cardio' | 'conditioning' | 'mobility' | 'rest';
  title: string;
  duration: number;
  focus: string;
  warmup: string[];
  exercises: TrainingExercise[];
  cooldown: string[];
  imageUrl?: string | null;
};

export type TrainingPlanOutput = {
  summary: string;
  weeksSuggested: number;
  progressionTips: string[];
  safetyNotes: string[];
  days: TrainingDay[];
};

// ---------------------------------------------------------------------------
// Goal + equipment labels per locale
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<Locale, Record<TrainingGoal, string>> = {
  nb: {
    lose_weight: 'vekttap (høyere volum, kortere pauser, kondis-fokus)',
    gain_strength:
      'maksstyrke (basisøvelser, 3–6 reps, 2–5 min pause, lavere frekvens per løft, høy intensitet)',
    gain_muscle:
      'hypertrofi / muskelvekst (8–12 reps, 60–90 s pause, moderat–høyt volum, progressiv overlast)',
    tone:
      'muskeldefinisjon / komposisjon (10–15 reps, 45–75 s pause, miks basis + isolasjon, litt kondis)',
    conditioning:
      'kondisjon (intervaller, sirkler, 30–60 s pause eller ingen, puls i sone 3–5)',
    mobility:
      'bevegelighet + smidighet (dynamiske strekk, yoga-flyt, kontrollerte eksentriske)',
  },
  en: {
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
  },
};

const EQUIPMENT_LABELS: Record<Locale, Record<TrainingEquipment, string>> = {
  nb: {
    bodyweight: 'kun kroppsvekt',
    dumbbells: 'manualer',
    barbell: 'stang + vektskiver',
    kettlebell: 'kettlebell',
    bands: 'strikk',
    pullup_bar: 'pull-up-stang',
    bench: 'benk',
    cardio_machine: 'kondisapparat (tredemølle/sykkel/ro)',
    full_gym: 'fullt treningssenter (apparater + frivekter + kabler)',
  },
  en: {
    bodyweight: 'bodyweight only',
    dumbbells: 'dumbbells',
    barbell: 'barbell + plates',
    kettlebell: 'kettlebell',
    bands: 'resistance bands',
    pullup_bar: 'pull-up bar',
    bench: 'weight bench',
    cardio_machine: 'cardio machine (treadmill/bike/rower)',
    full_gym: 'full commercial gym (machines + free weights + cables)',
  },
};

// ---------------------------------------------------------------------------
// System prompts per locale
// ---------------------------------------------------------------------------

const SYSTEM_NB = `Du er LifeMaxxers treningstrener. Du designer trygge, evidensbaserte ukentlige treningsprogrammer skreddersydd for brukerens mål og rammer.

ABSOLUTTE SIKKERHETSREGLER:
- Forskriv ALDRI øvelser som krever sikring (f.eks. tunge knebøy med stang, benkpress) for nybegynnere som trener alene, eller når brukeren har "home" uten power rack og sikkerhetsbøyler.
- Hvis brukeren nevner skade eller smerte, bytt ut kompromitterte bevegelsesmønstre. Velg det tryggere alternativet i tvil. Anbefal fysioterapeut ved akutt skade.
- Tilpass øvelsens tekniske vanskelighetsgrad til erfaringsnivået. Nybegynnere får enkle, fundamentale bevegelser. Komplekse løft (OL-løft, plyo, avansert apparat) kun for "advanced".
- Inkluder oppvarming (3–8 min) og nedkjøling (3–5 min) for hver ikke-hviledag.
- Inkluder hviledager etter mål: ren styrke → 2+ hviledager/uke; hypertrofi → 1–2; kondis kan kjøres 5–6 aktive dager.
- Hold øktlengden innenfor brukerens minutesPerSession. Heller hopp over en øvelse enn å gå over.

PAUSEREGLER (kritisk — match pause til dominerende mål):
- Styrke (1–6 reps): 2,5–5 min pause (150–300 s)
- Hypertrofi (6–12 reps): 60–90 s pause
- Utholdenhet / definisjon (12–20 reps): 30–60 s pause
- Kondis / metabolsk: 15–45 s pause, eller arbeids/pause-ratio (40:20, EMOM, AMRAP)
- Mobility: minimal eller ingen pause mellom poseringer

FLERE MÅL SAMTIDIG:
- Hvis mål kolliderer (f.eks. "gain strength" + "lose weight"), prioriter styrke på løftedager og legg til korte kondis-finishers. Ikke skriv aggressiv kalori/kondis som undergraver styrkemålet.
- Velger brukeren mobility i tillegg til styrke/kondis: legg inn 1–2 selvstendige mobility-dager ELLER 10-min mobility-blokker.

UTSTYRSREGLER:
- Forskriv ALDRI en øvelse som krever utstyr brukeren ikke har listet. Har de bare kropp + strikk, ikke foreslå manualer.
- "full_gym" låser opp alt. "home" + ingenting annet = kun kropp.

UTGANGSFORMAT (strikt JSON, ingen forord, ingen etterord):
{
  "summary": "2 setninger som beskriver hva programmet vil oppnå",
  "weeksSuggested": 4-8,
  "progressionTips": ["3–5 punkter om uke-til-uke progresjon"],
  "safetyNotes": ["2–4 kritiske sikkerhetspåminnelser spesifikke for dette programmet"],
  "days": [
    {
      "day": "Mandag",
      "type": "strength" | "cardio" | "conditioning" | "mobility" | "rest",
      "title": "kort øktnavn, f.eks. 'Helkropp A' eller 'Hvile'",
      "duration": totale minutter inkl. oppvarming/nedkjøling (0 ved hvile),
      "focus": "én linje med hva dagen treffer",
      "warmup": ["3-5 korte oppvarmingspunkter"] eller [] for hvile,
      "exercises": [
        { "name": "Knebøy", "sets": 4, "reps": "6-8", "restSeconds": 180, "notes": "valgfri cue, utelat hvis åpenbart" }
      ],
      "cooldown": ["2-3 strekk/mobility"] eller [] for hvile
    }
  ]
}

INNHOLDSREGLER:
- Nøyaktig 7 dager, navngitt på norsk (Mandag..Søndag), startende med Mandag.
- Øvelsesnavn på norsk: "Knebøy", "Markløft", "Benkpress", "Pull-ups", "Push-ups", "Utfall", "Planke".
- For hviledager: exercises: [], warmup: [], cooldown: [], duration: 0, focus: "Fullstendig hvile".
- Balanser push/pull, over/under kropp, knee/hip-dominant gjennom uka.
- Ingen identiske økter på rad.`;

const SYSTEM_EN = `You are LifeMaxxer's training coach. You design safe, evidence-based weekly workout programs tailored to the user's stated goals and constraints.

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
      "day": "Monday",
      "type": "strength" | "cardio" | "conditioning" | "mobility" | "rest",
      "title": "short session name e.g. 'Full body A' or 'Rest'",
      "duration": total minutes including warm-up/cool-down (0 if rest),
      "focus": "one-line summary of what this day targets",
      "warmup": ["3-5 short warmup items"] or [] for rest,
      "exercises": [
        { "name": "Squat", "sets": 4, "reps": "6-8", "restSeconds": 180, "notes": "optional cueing, leave out if obvious" }
      ],
      "cooldown": ["2-3 stretch/mobility items"] or [] for rest
    }
  ]
}

CONTENT RULES:
- Exactly 7 days, named Monday..Sunday, starting from Monday.
- Use English exercise names.
- For rest days: exercises: [], warmup: [], cooldown: [], duration: 0, focus: "Complete rest".
- Balance push/pull, upper/lower, knee/hip dominant across the week.
- No repeated full sessions on consecutive days.`;

const SYSTEMS: Record<Locale, string> = { nb: SYSTEM_NB, en: SYSTEM_EN };

// ---------------------------------------------------------------------------
// User-message templates per locale
// ---------------------------------------------------------------------------

type Copy = {
  experience: (e: string) => string;
  goalsHeader: string;
  locationLine: (loc: string) => string;
  daysPerWeekLine: (n: number) => string;
  minutesLine: (n: number) => string;
  equipmentHeader: string;
  equipmentNone: string;
  injuriesLine: (s: string) => string;
  notesLine: (s: string) => string;
  notesNone: string;
  closing: string;

  swapHeader: string;
  swapTarget: (day: string) => string;
  swapOthersHeader: string;
  swapClosing: (day: string) => string;
};

const COPY: Record<Locale, Copy> = {
  nb: {
    experience: (e) => `Erfaring: ${e}`,
    goalsHeader: 'Mål (rangert etter prioritet i gitt rekkefølge):',
    locationLine: (loc) => `Treningssted: ${loc}`,
    daysPerWeekLine: (n) => `Dager per uke: ${n}`,
    minutesLine: (n) => `Minutter per økt: ${n}`,
    equipmentHeader: 'Tilgjengelig utstyr:',
    equipmentNone: '- (ingen — kun kroppsvekt)',
    injuriesLine: (s) => `Skader / begrensninger: ${s}`,
    notesLine: (s) => `Ekstra notater: ${s}`,
    notesNone: '(ingen)',
    closing:
      'Lag et ukentlig treningsprogram. Det MÅ holdes innenfor minutesPerSession per økt og bruke KUN det listede utstyret. Inkluder passende hviledager. Returner kun JSON.',

    swapHeader: 'Du genererer ÉN dag på nytt for et eksisterende treningsprogram.',
    swapTarget: (day) => `Måldag: ${day}`,
    swapOthersHeader:
      'Andre dager allerede i programmet (unngå å kollidere med dagen FØR og ETTER målet: ingen identiske bevegelsesmønstre på rad, ingen gjentatte fokus):',
    swapClosing: (day) =>
      `Lag nøyaktig ÉN ny dag. Samme sikkerhets- og pauseregler som hovedprompten. Returner streng JSON for ÉN dag (uten days[] wrapper). Schema:

{
  "day": "${day}",
  "type": "strength" | "cardio" | "conditioning" | "mobility" | "rest",
  "title": "kort øktnavn",
  "duration": totale minutter,
  "focus": "én linje",
  "warmup": [...],
  "exercises": [
    { "name": "string", "sets": N, "reps": "string", "restSeconds": N, "notes": "valgfri" }
  ],
  "cooldown": [...]
}`,
  },
  en: {
    experience: (e) => `Experience: ${e}`,
    goalsHeader: 'Goals (ranked by priority in given order):',
    locationLine: (loc) => `Training location: ${loc}`,
    daysPerWeekLine: (n) => `Days available per week: ${n}`,
    minutesLine: (n) => `Minutes per session: ${n}`,
    equipmentHeader: 'Available equipment:',
    equipmentNone: '- (none — bodyweight only)',
    injuriesLine: (s) => `Injuries / limitations: ${s}`,
    notesLine: (s) => `Extra notes: ${s}`,
    notesNone: '(none)',
    closing:
      'Design a weekly training program. It must fit exactly within minutesPerSession per workout day and use ONLY the listed equipment. Include appropriate rest days. Generate the JSON now.',

    swapHeader: 'You are regenerating ONE day of an existing training plan.',
    swapTarget: (day) => `Target day: ${day}`,
    swapOthersHeader:
      'Other days already in the plan (avoid clashing with the day BEFORE and AFTER your target: no back-to-back identical movement patterns, no repeating focuses):',
    swapClosing: (day) =>
      `Generate exactly ONE new day. Same safety + rest-interval rules as the full-plan prompt. Output strict JSON for a single day object (NOT wrapped in days[]). Schema:

{
  "day": "${day}",
  "type": "strength" | "cardio" | "conditioning" | "mobility" | "rest",
  "title": "short session name",
  "duration": total minutes,
  "focus": "one-line summary",
  "warmup": [...],
  "exercises": [
    { "name": "string", "sets": N, "reps": "string", "restSeconds": N, "notes": "optional" }
  ],
  "cooldown": [...]
}`,
  },
};

function goalsList(p: TrainingPlanParams): string {
  const labels = GOAL_LABELS[normalizeLocale(p.locale)];
  return p.goals.map((g) => `- ${labels[g]}`).join('\n');
}

function equipmentList(p: TrainingPlanParams): string {
  const c = COPY[normalizeLocale(p.locale)];
  if (!p.equipment.length) return c.equipmentNone;
  const labels = EQUIPMENT_LABELS[normalizeLocale(p.locale)];
  return p.equipment.map((e) => `- ${labels[e]}`).join('\n');
}

export const TRAINING_PLAN_V1 = {
  version: 'training-plan.v1',
  model: MODELS.weeklyDebrief, // Sonnet — higher stakes, safety-critical

  systemFor(locale: Locale): string {
    return SYSTEMS[normalizeLocale(locale)];
  },

  buildUserFor(p: TrainingPlanParams): string {
    const loc = normalizeLocale(p.locale);
    const c = COPY[loc];
    return `${c.experience(p.experience)}
${c.goalsHeader}
${goalsList(p)}
${c.locationLine(p.location)}
${c.daysPerWeekLine(p.daysPerWeek)}
${c.minutesLine(p.minutesPerSession)}
${c.equipmentHeader}
${equipmentList(p)}
${c.injuriesLine(p.injuries?.trim() || c.notesNone)}
${c.notesLine(p.notes?.trim() || c.notesNone)}

${c.closing}`;
  },

  buildSwapUserFor(
    p: TrainingPlanParams,
    targetDayName: string,
    otherDays: { day: string; title: string; type: string; focus: string }[],
  ): string {
    const loc = normalizeLocale(p.locale);
    const c = COPY[loc];
    const others = otherDays
      .map((d) => `- ${d.day}: ${d.title} [${d.type}] — ${d.focus}`)
      .join('\n');
    return `${c.swapHeader}
${c.experience(p.experience)}
${c.goalsHeader}
${goalsList(p)}
${c.locationLine(p.location)}
${c.minutesLine(p.minutesPerSession)}
${c.equipmentHeader}
${equipmentList(p)}
${c.injuriesLine(p.injuries?.trim() || c.notesNone)}
${c.notesLine(p.notes?.trim() || c.notesNone)}

${c.swapTarget(targetDayName)}
${c.swapOthersHeader}
${others || '(ingen)'}

${c.swapClosing(targetDayName)}`;
  },
} as const;
