import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { BottomNav } from '@/components/shared/nav';
import { createClient } from '@/lib/supabase/server';
import { fetchCurrentWeather } from '@/lib/weather';
import { resolveTheme, DEFAULT_THEME, type Theme } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LifeMaxxer',
  description: 'A quiet place to play your own life.',
  applicationName: 'LifeMaxxer',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LifeMaxxer',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf6' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1115' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/**
 * Resolve the dynamic theme on the server so first paint already has
 * the correct palette — no flash of "wrong sky" while the client
 * boots. Falls back to the default day-clear if anything fails.
 */
async function resolveDynamicTheme(): Promise<Theme> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_THEME;

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('latitude, longitude, timezone')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_settings')
        .select('theme_dynamic')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    // theme_dynamic missing (older accounts pre-migration) defaults
    // to true — opt-out, not opt-in, so the feature is visible.
    if ((settings as any)?.theme_dynamic === false) return DEFAULT_THEME;

    const tz = (profile as any)?.timezone ?? 'Europe/Oslo';
    const lat = (profile as any)?.latitude;
    const lon = (profile as any)?.longitude;

    let weatherCode: number | null = null;
    if (lat != null && lon != null) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
        try {
          const w = await fetchCurrentWeather(latNum, lonNum, tz);
          weatherCode = w?.conditionCode ?? null;
        } catch {
          /* weather fetch is best-effort — fall through to clear */
        }
      }
    }

    return resolveTheme({ timezone: tz, weatherCode });
  } catch {
    return DEFAULT_THEME;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = await resolveDynamicTheme();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className="min-h-dvh antialiased font-sans pb-[calc(6rem+env(safe-area-inset-bottom))]"
        data-theme={theme.time}
        data-weather={theme.weather}
        {...(theme.moon ? { 'data-moon': theme.moon } : {})}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
            <BottomNav />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
