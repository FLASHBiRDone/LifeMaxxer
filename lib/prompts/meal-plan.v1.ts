import { MODELS } from '@/lib/claude';

export type MealPlanParams = {
  locale: 'nb' | 'en';
  people: number;
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

export const MEAL_PLAN_V1 = {
  version: 'meal-plan.v1',
  model: MODELS.morningBriefing,
  system: `You are LifeMaxxer's meal planner. You generate a one-week dinner plan (7 days) for a household.

ABSOLUTE SAFETY RULES:
- Never include an ingredient the user is allergic to. This includes sauces, marinades, garnishes, hidden ingredients, and cross-contamination categories. Better to be boring than to harm.
- If a classic recipe contains an allergen, swap or skip it — do not include it.
- If diet is "vegan": no animal products whatsoever (including honey, dairy, eggs, fish, meat, gelatin).
- If diet is "vegetarian": no meat or fish, but eggs and dairy are OK unless flagged as allergens.
- If diet is "pescatarian": no meat, but fish and seafood are OK unless flagged as allergens.

CONTENT RULES:
- Exactly 7 days, named in user's locale (Mandag..Søndag for nb, Monday..Sunday for en).
- Variety: no repeated dishes, mix protein sources and cuisines across the week.
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
    return `Locale: ${p.locale}
People: ${p.people}
Diet: ${p.diet}
Allergens to AVOID (strict):
${allergenList}
User notes: ${p.notes.trim() || '(none)'}

Generate the 7-day dinner plan now.`;
  },
} as const;
