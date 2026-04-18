import { getTranslations } from 'next-intl/server';

export default async function RecipesPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-xl py-10 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('nav.recipes')}
      </h1>
      <p className="text-xs text-muted-foreground">Lands in Phase 5.</p>
    </main>
  );
}
