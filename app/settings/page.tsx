import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChefHat, ChevronRight, Dumbbell, Flame, ShoppingBasket, Store, Sunrise, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PushToggle } from '@/components/settings/push-toggle';
import { NotificationPreferences } from '@/components/settings/notification-prefs';
import { GoogleCalendarCard } from '@/components/settings/google-calendar';
import { HouseholdCard } from '@/components/settings/household-card';
import { SignOutButton } from '@/components/settings/sign-out';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: settings }, { data: gtok }, { data: profile }, { data: membership }] =
    await Promise.all([
      supabase
        .from('user_settings')
        .select(
          'push_enabled, morning_briefing_enabled, dinner_panic_enabled, weekly_debrief_enabled',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('google_tokens')
        .select('expires_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
    ]);

  let household: any = null;
  let householdRole: string | null = null;
  let householdMembers: any[] = [];
  let householdInvites: any[] = [];
  if ((membership as any)?.household_id) {
    const householdId = (membership as any).household_id as string;
    householdRole = (membership as any).role as string;
    const [{ data: hh }, { data: mems }, { data: invs }] = await Promise.all([
      supabase
        .from('households')
        .select('id, name, created_by, created_at')
        .eq('id', householdId)
        .maybeSingle(),
      supabase
        .from('household_members')
        .select('user_id, role, joined_at')
        .eq('household_id', householdId),
      supabase
        .from('household_invites')
        .select('id, code, role, created_at, expires_at, used_at')
        .eq('household_id', householdId)
        .is('used_at', null)
        .order('created_at', { ascending: false }),
    ]);
    household = hh;
    const memList = (mems as any[]) ?? [];
    if (memList.length > 0) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, email, display_name')
        .in('id', memList.map((m) => m.user_id));
      const profMap = new Map(((profs as any[]) ?? []).map((p) => [p.id, p]));
      householdMembers = memList.map((m) => {
        const p = profMap.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          email: p?.email ?? null,
          display_name: p?.display_name ?? null,
          is_me: m.user_id === user.id,
        };
      });
    }
    const now = Date.now();
    householdInvites = ((invs as any[]) ?? []).filter(
      (i) => new Date(i.expires_at).getTime() > now,
    );
  }

  const params = await searchParams;
  const gcalStatus = typeof params.gcal === 'string' ? params.gcal : null;
  const initial = (user.email ?? '?').charAt(0).toUpperCase();

  return (
    <main className="container max-w-xl py-6 space-y-6">
      <header className="rounded-3xl grad-hero border p-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl grad-primary text-primary-foreground flex items-center justify-center text-2xl font-bold soft-shadow">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            {t('nav.settings')}
          </p>
          <h1 className="text-xl font-bold truncate">{user.email}</h1>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Snarveier
        </h2>
        <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border/50 soft-shadow">
          <ShortcutLink href="/gm" icon={<Sunrise className="h-5 w-5" />} label="Morgen-ritual" />
          <ShortcutLink href="/marked" icon={<Store className="h-5 w-5" />} label="Marked" />
          <ShortcutLink href="/rewards" icon={<Trophy className="h-5 w-5" />} label="Belønninger" />
          <ShortcutLink href="/training" icon={<Dumbbell className="h-5 w-5" />} label="Trening" />
          <ShortcutLink href="/recipes" icon={<ChefHat className="h-5 w-5" />} label="Middager" />
          <ShortcutLink href="/shopping" icon={<ShoppingBasket className="h-5 w-5" />} label="Handleliste" />
          <ShortcutLink href="/habits" icon={<Flame className="h-5 w-5" />} label="Administrer vaner" />
        </div>
      </section>

      <div className="space-y-4">
        <HouseholdCard
          household={household}
          role={householdRole}
          members={householdMembers}
          invites={householdInvites}
          currentDisplayName={(profile as any)?.display_name ?? null}
        />
        <GoogleCalendarCard connected={Boolean(gtok)} status={gcalStatus} />
        <PushToggle initialEnabled={Boolean((settings as any)?.push_enabled)} />
        <NotificationPreferences
          pushEnabled={Boolean((settings as any)?.push_enabled)}
          initial={{
            morning_briefing_enabled: Boolean(
              (settings as any)?.morning_briefing_enabled ?? true,
            ),
            dinner_panic_enabled: Boolean(
              (settings as any)?.dinner_panic_enabled ?? false,
            ),
            weekly_debrief_enabled: Boolean(
              (settings as any)?.weekly_debrief_enabled ?? true,
            ),
          }}
        />
      </div>

      <div className="pt-4">
        <SignOutButton />
      </div>
    </main>
  );
}

function ShortcutLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/5 transition-colors">
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
