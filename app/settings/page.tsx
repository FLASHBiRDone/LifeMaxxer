import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { PushToggle } from '@/components/settings/push-toggle';
import { GoogleCalendarCard } from '@/components/settings/google-calendar';
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

  const [{ data: settings }, { data: gtok }] = await Promise.all([
    supabase
      .from('user_settings')
      .select('push_enabled, morning_briefing_enabled')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('google_tokens')
      .select('expires_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const params = await searchParams;
  const gcalStatus = typeof params.gcal === 'string' ? params.gcal : null;

  return (
    <main className="container max-w-xl py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('nav.settings')}
        </h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>

      <GoogleCalendarCard
        connected={Boolean(gtok)}
        status={gcalStatus}
      />

      <PushToggle initialEnabled={Boolean((settings as any)?.push_enabled)} />

      <SignOutButton />
    </main>
  );
}
