import { MODELS } from '@/lib/claude';

export type MealPlanParams = {
  locale: 'nb' | 'en';
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

const ALLERGEN_LABELS: Record<string, string> = {
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

const DAYS_NB = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayNames(count: number, locale: 'nb' | 'en'): string[] {
  const src = locale === 'nb' ? DAYS_NB : DAYS_EN;
  return src.slice(0, Math.max(1, Math.min(7, count)));
}

export const MEAL_PLAN_V1 = {
  version: 'meal-plan.v1',
  model: MODELS.morningBriefing,
  system: `You are LifeMaxxer's meal planner. You generate a dinner plan for a household spanning a user-specified number of days (1–7).

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
- Use common Nordic grocery items when locale is nb.
- Keep prep + cook time realistic (most weeknights under 45 min total).
- Instructions: 3–6 short numbered steps per dish.
- Ingredient "amount" format: "250g", "2 ss", "1 stk", "a pinch" etc — scaled to people.

OUTPUT FORMAT (strict JSON, no preamble, no trailing text):
{
  "days": [
    {
      "day": "Mandag",
      "title": "string",
      "description": "one sentence, max 20 words",
      "prepMinutes": 10,
      "cookMinutes": 25,
      "ingredients": [{ "name": "string", "amount": "string" }],
      "instructions": ["step 1", "step 2", "step 3"]
    }
  ]
}`,
  buildUser: (p: MealPlanParams) => {
    const allergenList =
      p.allergens.length === 0
        ? '(none)'
        : p.allergens.map((a) => `- ${ALLERGEN_LABELS[a] ?? a}`).join('\n');
    const names = dayNames(p.days, p.locale);
    return `Locale: ${p.locale}
People: ${p.people}
Diet: ${p.diet}
Number of days: ${names.length}
Day names (use exactly these, in this order):
${names.map((n) => `- ${n}`).join('\n')}
Allergens to AVOID (strict):
${allergenList}
User notes: ${p.notes.trim() || '(none)'}

Generate the ${names.length}-day dinner plan now.`;
  },
  /**
   * Prompt for regenerating ONE day of an existing plan, avoiding the
   * other days' dishes / core proteins / cuisines.
   */
  buildSwapUser: (
    p: MealPlanParams,
    targetDayName: string,
    otherDays: { day: string; title: string; description?: string }[],
  ) => {
    const allergenList =
      p.allergens.length === 0
        ? '(none)'
        : p.allergens.map((a) => `- ${ALLERGEN_LABELS[a] ?? a}`).join('\n');
    const others = otherDays
      .map((d) => `- ${d.day}: ${d.title}${d.description ? ` — ${d.description}` : ''}`)
      .join('\n');
    return `You are regenerating ONE day of an existing dinner plan.
Locale: ${p.locale}
People: ${p.people}
Diet: ${p.diet}
Allergens to AVOID (strict):
${allergenList}
User notes: ${p.notes.trim() || '(none)'}

Target day: ${targetDayName}
Other days in the plan (do NOT repeat any of these dishes, their
core protein, or their cuisine):
${others || '(none)'}

Generate exactly ONE new day. Must be significantly different from
the others. Output strict JSON matching this single-day schema, no
preamble, no trailing text, no wrapping array — a single object:

{
  "day": "${targetDayName}",
  "title": "string",
  "description": "one sentence, max 20 words",
  "prepMinutes": 10,
  "cookMinutes": 25,
  "ingredients": [{ "name": "string", "amount": "string" }],
  "instructions": ["step 1", "step 2", "step 3"]
}`;
  },
} as const;
