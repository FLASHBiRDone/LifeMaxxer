import { getTranslations } from 'next-intl/server';

export default async function SettingsPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-xl py-10 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('nav.settings')}
      </h1>
      <p className="text-xs text-muted-foreground">
        Locale, notification, and vocabulary settings live here.
      </p>
    </main>
  );
}
