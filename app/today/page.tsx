import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { TodayQuests } from '@/components/today/quests';
import { EnergyCheckIn } from '@/components/today/energy';
import { RunBriefingButton } from '@/components/today/run-briefing';

export const dynamic = 'force-dynamic';

type BriefingOutput = {
  intro: string;
  quests: { title: string; why: string }[];
};

export default async function TodayPage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString } = osloDayBounds();

  const [{ data: briefingRow }, { data: quests }, { data: mana }] =
    await Promise.all([
      supabase
        .from('ai_messages')
        .select('content, created_at')
        .eq('user_id', user.id)
        .eq('context_type', 'morning_briefing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('quests')
        .select('id, title, completed_at, is_main')
        .eq('user_id', user.id)
        .eq('scheduled_for', dateString)
        .order('is_main', { ascending: false }),
      supabase
        .from('mana_logs')
        .select('level')
        .eq('user_id', user.id)
        .eq('logged_for', dateString)
        .maybeSingle(),
    ]);

  let briefing: BriefingOutput | null = null;
  if (briefingRow?.content) {
    try {
      briefing = JSON.parse(briefingRow.content) as BriefingOutput;
    } catch {
      briefing = null;
    }
  }

  return (
    <main className="container max-w-xl py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {dateString}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('today.title')}
        </h1>
        {briefing?.intro ? (
          <p className="text-base leading-relaxed">{briefing.intro}</p>
        ) : (
          <p className="text-base leading-relaxed text-muted-foreground">
            {t('today.empty')}
          </p>
        )}
      </header>

      <EnergyCheckIn initialLevel={(mana as any)?.level ?? null} />

      <TodayQuests quests={(quests as any[]) ?? []} />

      <div className="pt-4 border-t">
        <RunBriefingButton hasBriefing={Boolean(briefing)} />
      </div>
    </main>
  );
}
