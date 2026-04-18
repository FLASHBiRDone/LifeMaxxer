import { getTranslations } from 'next-intl/server';

export default async function HabitsPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-xl py-10 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('nav.habits')}
      </h1>
      <p className="text-xs text-muted-foreground">Lands in Phase 3.</p>
    </main>
  );
}
