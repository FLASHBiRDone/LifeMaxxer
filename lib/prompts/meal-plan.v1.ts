import { MODELS } from '@/lib/claude';
import type { Locale } from './locales';
import { normalizeLocale } from './locales';

export type MealPlanParams = {
  locale: Locale;
  people: number;
  days: number; // 1..7
  allergens: string[]; // from ALLERGENS
  diet: 'any' | 'vegetarian' | 'vegan' | 'pescatarian';
  notes: string;
};

export type MealPlanDay = {
  day: string;
  title: string;
  description: string;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: { name: string; amount: string }[];
  instructions: string[];
};

export type MealPlanOutput = {
  days: MealPlanDay[];
};

// ---------------------------------------------------------------------------
// Allergen labels — same content per locale, only the wording shifts.
// ---------------------------------------------------------------------------

const ALLERGEN_LABELS_NB: Record<string, string> = {
  gluten: 'gluten (hvete, rug, bygg, spelt)',
  dairy: 'melk og melkeprodukter',
  lactose: 'laktose',
  egg: 'egg',
  peanut: 'peanøtter',
  tree_nut: 'nøtter (mandel, cashew, valnøtt, hasselnøtt, pistasj osv.)',
  soy: 'soya og soyaprodukter',
  fish: 'fisk',
  shellfish: 'skalldyr (reker, krabbe, hummer)',
  sesame: 'sesamfrø',
  celery: 'selleri',
  mustard: 'sennep',
  sulfite: 'sulfitter',
  lupin: 'lupin',
  mollusc: 'bløtdyr (blåskjell, østers, blekksprut)',
};

const ALLERGEN_LABELS_EN: Record<string, string> = {
  gluten: 'gluten (wheat, rye, barley, spelt)',
  dairy: 'dairy and milk products',
  lactose: 'lactose',
  egg: 'eggs',
  peanut: 'peanuts',
  tree_nut: 'tree nuts (almond, cashew, walnut, hazelnut, pistachio, etc)',
  soy: 'soy and soy products',
  fish: 'fish',
  shellfish: 'shellfish (shrimp, crab, lobster)',
  sesame: 'sesame seeds',
  celery: 'celery',
  mustard: 'mustard',
  sulfite: 'sulfites',
  lupin: 'lupin',
  mollusc: 'molluscs (mussels, oysters, squid)',
};

const ALLERGEN_LABELS: Record<Locale, Record<string, string>> = {
  nb: ALLERGEN_LABELS_NB,
  en: ALLERGEN_LABELS_EN,
};

const DAYS_NB = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayNames(count: number, locale: Locale): string[] {
  const src = locale === 'nb' ? DAYS_NB : DAYS_EN;
  return src.slice(0, Math.max(1, Math.min(7, count)));
}

// ---------------------------------------------------------------------------
// System prompts per locale
// ---------------------------------------------------------------------------

const SYSTEM_NB = `Du er LifeMaxxers måltidsplanlegger. Du lager en middagsplan for en husholdning over et brukerspesifisert antall dager (1–7).

ABSOLUTTE SIKKERHETSREGLER:
- Inkluder ALDRI en ingrediens brukeren er allergisk mot. Det gjelder også sauser, marinader, garnityr, skjulte ingredienser og kategorier med kryss-kontaminering. Heller kjedelig enn farlig.
- Hvis en klassisk oppskrift inneholder et allergen, bytt eller hopp over – ikke ta det med.
- "vegan": ingen animalske produkter (heller ikke honning, melk, egg, fisk, kjøtt, gelatin).
- "vegetarian": ingen kjøtt eller fisk; egg og melk er OK med mindre allergi.
- "pescatarian": ingen kjøtt; fisk og sjømat OK med mindre allergi.

INNHOLDSREGLER:
- Lag nøyaktig så mange dager som forespurt (1–7), i rekkefølgen av dagsnavnene som er gitt.
- Variasjon: ingen gjentatte retter, miks proteinkilder og kjøkken på tvers.
- Skaler ingrediensmengdene til antall personer.
- Bruk vanlige nordiske dagligvarer.
- Hold prep + steketid realistisk (de fleste hverdager under 45 min totalt).
- Instruksjoner: 3–6 korte nummererte steg per rett.
- "amount"-format: "250g", "2 ss", "1 stk", "en klype" osv. – skalert.

UTGANGSFORMAT (strikt JSON, ingen forord, ingen etterord):
{
  "days": [
    {
      "day": "Mandag",
      "title": "string",
      "description": "én setning, maks 20 ord",
      "prepMinutes": 10,
      "cookMinutes": 25,
      "ingredients": [{ "name": "string", "amount": "string" }],
      "instructions": ["steg 1", "steg 2", "steg 3"]
    }
  ]
}`;

const SYSTEM_EN = `You are LifeMaxxer's meal planner. You generate a dinner plan for a household spanning a user-specified number of days (1–7).

ABSOLUTE SAFETY RULES:
- Never include an ingredient the user is allergic to. This includes sauces, marinades, garnishes, hidden ingredients, and cross-contamination categories. Better to be boring than to harm.
- If a classic recipe contains an allergen, swap or skip it — do not include it.
- If diet is "vegan": no animal products whatsoever (including honey, dairy, eggs, fish, meat, gelatin).
- If diet is "vegetarian": no meat or fish, but eggs and dairy are OK unless flagged as allergens.
- If diet is "pescatarian": no meat, but fish and seafood are OK unless flagged as allergens.

CONTENT RULES:
- Generate exactly the number of days requested (1–7), in the order of day names provided.
- Variety: no repeated dishes, mix protein sources and cuisines across the plan.
- Scale ingredient amounts to the given people count.
- Keep prep + cook time realistic (most weeknights under 45 min total).
- Instructions: 3–6 short numbered steps per dish.
- Ingredient "amount" format: "250g", "2 tbsp", "1 piece", "a pinch" etc — scaled to people.

OUTPUT FORMAT (strict JSON, no preamble, no trailing text):
{
  "days": [
    {
      "day": "Monday",
      "title": "string",
      "description": "one sentence, max 20 words",
      "prepMinutes": 10,
      "cookMinutes": 25,
      "ingredients": [{ "name": "string", "amount": "string" }],
      "instructions": ["step 1", "step 2", "step 3"]
    }
  ]
}`;

const SYSTEMS: Record<Locale, string> = {
  nb: SYSTEM_NB,
  en: SYSTEM_EN,
};

// ---------------------------------------------------------------------------
// User-message templates per locale
// ---------------------------------------------------------------------------

type Copy = {
  people: (n: number) => string;
  diet: (d: string) => string;
  daysCount: (n: number) => string;
  dayNamesHeader: string;
  allergensHeader: string;
  allergensNone: string;
  notesLine: (s: string) => string;
  notesNone: string;
  closing: (n: number) => string;

  swapHeader: string;
  swapTarget: (day: string) => string;
  swapOthersHeader: string;
  swapClosing: (day: string) => string;
};

const COPY: Record<Locale, Copy> = {
  nb: {
    people: (n) => `Antall personer: ${n}`,
    diet: (d) => `Diett: ${d}`,
    daysCount: (n) => `Antall dager: ${n}`,
    dayNamesHeader: 'Dagsnavn (bruk akkurat disse, i denne rekkefølgen):',
    allergensHeader: 'Allergener som SKAL UNNGÅS (strengt):',
    allergensNone: '(ingen)',
    notesLine: (s) => `Brukerens notater: ${s}`,
    notesNone: '(ingen)',
    closing: (n) => `Lag ${n}-dagers middagsplan nå. Returner kun JSON.`,

    swapHeader: 'Du genererer ÉN dag på nytt for en eksisterende middagsplan.',
    swapTarget: (day) => `Måldag: ${day}`,
    swapOthersHeader:
      'De andre dagene i planen (IKKE gjenta noen av disse rettene, hovedproteinet eller kjøkkenstilen):',
    swapClosing: (day) =>
      `Lag nøyaktig ÉN ny dag. Må være vesentlig forskjellig fra de andre. Returner streng JSON for ÉN dag (uten days[] wrapper):

{
  "day": "${day}",
  "title": "string",
  "description": "én setning, maks 20 ord",
  "prepMinutes": 10,
  "cookMinutes": 25,
  "ingredients": [{ "name": "string", "amount": "string" }],
  "instructions": ["steg 1", "steg 2", "steg 3"]
}`,
  },
  en: {
    people: (n) => `People: ${n}`,
    diet: (d) => `Diet: ${d}`,
    daysCount: (n) => `Number of days: ${n}`,
    dayNamesHeader: 'Day names (use exactly these, in this order):',
    allergensHeader: 'Allergens to AVOID (strict):',
    allergensNone: '(none)',
    notesLine: (s) => `User notes: ${s}`,
    notesNone: '(none)',
    closing: (n) => `Generate the ${n}-day dinner plan now. Output only the JSON.`,

    swapHeader: 'You are regenerating ONE day of an existing dinner plan.',
    swapTarget: (day) => `Target day: ${day}`,
    swapOthersHeader:
      'Other days in the plan (do NOT repeat any of these dishes, their core protein, or their cuisine):',
    swapClosing: (day) =>
      `Generate exactly ONE new day. Must be significantly different from the others. Output strict JSON matching this single-day schema, no preamble, no trailing text, no wrapping array — a single object:

{
  "day": "${day}",
  "title": "string",
  "description": "one sentence, max 20 words",
  "prepMinutes": 10,
  "cookMinutes": 25,
  "ingredients": [{ "name": "string", "amount": "string" }],
  "instructions": ["step 1", "step 2", "step 3"]
}`,
  },
};

function allergensList(p: MealPlanParams): string {
  const loc = normalizeLocale(p.locale);
  const c = COPY[loc];
  if (p.allergens.length === 0) return c.allergensNone;
  const labels = ALLERGEN_LABELS[loc];
  return p.allergens.map((a) => `- ${labels[a] ?? a}`).join('\n');
}

export const MEAL_PLAN_V1 = {
  version: 'meal-plan.v1',
  model: MODELS.morningBriefing,

  systemFor(locale: Locale): string {
    return SYSTEMS[normalizeLocale(locale)];
  },

  buildUserFor(p: MealPlanParams): string {
    const loc = normalizeLocale(p.locale);
    const c = COPY[loc];
    const names = dayNames(p.days, loc);
    return `${c.people(p.people)}
${c.diet(p.diet)}
${c.daysCount(names.length)}
${c.dayNamesHeader}
${names.map((n) => `- ${n}`).join('\n')}
${c.allergensHeader}
${allergensList(p)}
${c.notesLine(p.notes.trim() || c.notesNone)}

${c.closing(names.length)}`;
  },

  buildSwapUserFor(
    p: MealPlanParams,
    targetDayName: string,
    otherDays: { day: string; title: string; description?: string }[],
  ): string {
    const loc = normalizeLocale(p.locale);
    const c = COPY[loc];
    const others = otherDays
      .map(
        (d) =>
          `- ${d.day}: ${d.title}${d.description ? ` — ${d.description}` : ''}`,
      )
      .join('\n');
    return `${c.swapHeader}
${c.people(p.people)}
${c.diet(p.diet)}
${c.allergensHeader}
${allergensList(p)}
${c.notesLine(p.notes.trim() || c.notesNone)}

${c.swapTarget(targetDayName)}
${c.swapOthersHeader}
${others || c.allergensNone}

${c.swapClosing(targetDayName)}`;
  },
} as const;
