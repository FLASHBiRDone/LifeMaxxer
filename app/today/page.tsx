import { getTranslations } from 'next-intl/server';

export default async function TodayPage() {
  const t = await getTranslations();

  return (
    <main className="container max-w-xl py-10 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('today.title')}
      </h1>
      <p className="text-muted-foreground">{t('today.loading')}</p>
      <p className="text-xs text-muted-foreground">
        Phase 1 will populate this view with the morning briefing.
      </p>
    </main>
  );
}
