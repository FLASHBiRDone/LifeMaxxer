import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['nb', 'en'] as const;
export const defaultLocale = 'nb' as const;
export type Locale = (typeof locales)[number];

function pickLocale(candidate: string | undefined): Locale {
  if (candidate && (locales as readonly string[]).includes(candidate)) {
    return candidate as Locale;
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  let locale = pickLocale(cookieLocale);

  if (!cookieLocale) {
    const accept = (await headers()).get('accept-language') ?? '';
    const preferred = accept.split(',')[0]?.split('-')[0];
    locale = pickLocale(preferred);
  }

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
    timeZone: 'Europe/Oslo',
  };
});
