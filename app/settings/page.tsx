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

      <div className="space-y-4">
        <GoogleCalendarCard connected={Boolean(gtok)} status={gcalStatus} />
        <PushToggle initialEnabled={Boolean((settings as any)?.push_enabled)} />
      </div>

      <div className="pt-4">
        <SignOutButton />
      </div>
    </main>
  );
}
