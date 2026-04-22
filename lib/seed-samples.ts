import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A set of starter rewards covering the main bounty currencies so a
 * fresh household sees a usable catalog. Mix of XP-only, token-only,
 * and dual-priced entries.
 */
const SAMPLE_REWARDS: Array<{
  title: string;
  emoji: string;
  cost_xp: number;
  cost_tokens: number;
}> = [
  { title: '30 min TikTok',           emoji: '📱', cost_xp: 0,   cost_tokens: 40 },
  { title: '30 min Snapchat',         emoji: '💬', cost_xp: 0,   cost_tokens: 40 },
  { title: '1 time ekstra skjermtid', emoji: '⏱️', cost_xp: 0,   cost_tokens: 100 },
  { title: '50 kr i lommepenger',     emoji: '💰', cost_xp: 0,   cost_tokens: 120 },
  { title: 'Velg middag neste dag',   emoji: '🍽️', cost_xp: 60,  cost_tokens: 0 },
  { title: 'Iskrem etter middag',     emoji: '🍦', cost_xp: 50,  cost_tokens: 0 },
  { title: 'Fredagskos med snacks',   emoji: '🍿', cost_xp: 150, cost_tokens: 60 },
  { title: 'Se en film sammen',       emoji: '🎬', cost_xp: 200, cost_tokens: 80 },
  { title: 'Sove lenger i helgen',    emoji: '😴', cost_xp: 100, cost_tokens: 0 },
];

/**
 * Typical household chores with modest XP bounties. All posted by the
 * seeding user so the poster_id is valid and the RLS check passes.
 * Bounty totals are kept small (10–50 XP) so a kid can clear a few in
 * a day without the parent's XP balance going into the red.
 */
const SAMPLE_TASKS: Array<{
  title: string;
  description: string | null;
  category_label: string;
  bounty_xp: number;
  bounty_tokens: number;
}> = [
  {
    title: 'Tøm oppvaskmaskinen',
    description: 'Sett alt på plass der det hører hjemme.',
    category_label: 'Hushold',
    bounty_xp: 20,
    bounty_tokens: 5,
  },
  {
    title: 'Ta ut søpla',
    description: 'Restavfall, papir og plast til rett dunk.',
    category_label: 'Hushold',
    bounty_xp: 15,
    bounty_tokens: 0,
  },
  {
    title: 'Støvsug stue og gang',
    description: null,
    category_label: 'Hushold',
    bounty_xp: 40,
    bounty_tokens: 10,
  },
  {
    title: 'Heng opp vasketøyet',
    description: 'Tørkestativet står på badet.',
    category_label: 'Hushold',
    bounty_xp: 25,
    bounty_tokens: 0,
  },
  {
    title: 'Rydde kjøkkenet etter middag',
    description: 'Bord, benker, oppvask og gulv.',
    category_label: 'Hushold',
    bounty_xp: 30,
    bounty_tokens: 10,
  },
  {
    title: 'Vaske badet',
    description: 'Servant, toalett, speil og gulv.',
    category_label: 'Hushold',
    bounty_xp: 50,
    bounty_tokens: 20,
  },
];

/**
 * Seed sample rewards for a household if it has zero rewards on record
 * (archived or not). Never reseeds a household that has ever had a
 * reward — if the user deletes everything we respect that as intent.
 */
export async function seedSampleRewards(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<number> {
  const { count } = await supabase
    .from('rewards')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);
  if ((count ?? 0) > 0) return 0;

  const rows = SAMPLE_REWARDS.map((r) => ({
    household_id: householdId,
    title: r.title,
    emoji: r.emoji,
    cost_xp: r.cost_xp,
    cost_tokens: r.cost_tokens,
    created_by: userId,
  }));

  const { error, count: inserted } = await supabase
    .from('rewards')
    .insert(rows, { count: 'exact' });
  if (error) {
    console.error('[seed-samples] rewards failed', error);
    return 0;
  }
  return inserted ?? rows.length;
}

/**
 * Seed sample household tasks if the household has zero tasks on record
 * in any state. Seeds from the calling user so poster_id is valid and
 * XP debits come out of the seeder's ledger — the seeder should be a
 * parent (typical first user) so there's no issue.
 */
export async function seedSampleTasks(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<number> {
  const { count } = await supabase
    .from('household_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);
  if ((count ?? 0) > 0) return 0;

  // Resolve category labels → ids (call after default seed has run)
  const { data: cats } = await supabase
    .from('task_categories')
    .select('id, label')
    .eq('household_id', householdId);
  const catIdByLabel = new Map(
    ((cats as any[]) ?? []).map((c) => [c.label.toLowerCase(), c.id as string]),
  );

  const rows = SAMPLE_TASKS.map((t) => ({
    household_id: householdId,
    posted_by_user_id: userId,
    title: t.title,
    description: t.description,
    category_id: catIdByLabel.get(t.category_label.toLowerCase()) ?? null,
    bounty_xp: t.bounty_xp,
    bounty_tokens: t.bounty_tokens,
    status: 'open',
  }));

  const { error, count: inserted } = await supabase
    .from('household_tasks')
    .insert(rows, { count: 'exact' });
  if (error) {
    console.error('[seed-samples] tasks failed', error);
    return 0;
  }

  // Sample tasks are onboarding freebies — we intentionally skip the
  // poster debit so the seeding user's balance stays at 0. Kids still
  // earn normal payouts when they complete; the XP/tokens created this
  // way only flow in once per household (capped by the sample set).
  return inserted ?? rows.length;
}
