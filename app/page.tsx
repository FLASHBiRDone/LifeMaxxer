import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HUDPage() {
  const t = await getTranslations();

  return (
    <main className="container max-w-2xl py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('app.name')}
        </h1>
      </header>

      <section className="rounded-2xl border bg-card p-6 space-y-3">
        <h2 className="text-lg font-medium">Phase 0 scaffold</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Foundation is in place. The real HUD lands in Phase 2. Until then,
          this page is intentionally quiet.
        </p>
        <nav className="flex flex-wrap gap-2 pt-2 text-sm">
          <Link
            href="/today"
            className="rounded-full border px-3 py-1 hover:bg-accent hover:text-accent-foreground"
          >
            {t('nav.today')}
          </Link>
          <Link
            href="/inbox"
            className="rounded-full border px-3 py-1 hover:bg-accent hover:text-accent-foreground"
          >
            {t('nav.inbox')}
          </Link>
          <Link
            href="/settings"
            className="rounded-full border px-3 py-1 hover:bg-accent hover:text-accent-foreground"
          >
            {t('nav.settings')}
          </Link>
        </nav>
      </section>
    </main>
  );
}
