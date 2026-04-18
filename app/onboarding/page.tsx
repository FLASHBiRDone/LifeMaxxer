import { getTranslations } from 'next-intl/server';

export default async function OnboardingPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-md py-16 space-y-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('onboarding.welcome')}
      </h1>
      <p className="text-muted-foreground">{t('onboarding.subtitle')}</p>
    </main>
  );
}
