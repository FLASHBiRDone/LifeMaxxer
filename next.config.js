const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ['/sw-custom.js'],
  },
});

const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/**
 * Content-Security-Policy. Restrictive enough to block foreign script
 * sources while still letting Next.js, Supabase, Open-Meteo,
 * BigDataCloud, Anthropic, Gemini, and Google's OAuth + Calendar APIs
 * work. `'unsafe-inline'`/`'unsafe-eval'` in script-src are required
 * by Next's runtime + dev HMR — a future hardening pass can swap
 * those for nonces.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: ",
  [
    'connect-src',
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.open-meteo.com',
    'https://geocoding-api.open-meteo.com',
    'https://api.bigdatacloud.net',
    'https://api.anthropic.com',
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    'https://accounts.google.com',
  ].join(' '),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'geolocation=(self), microphone=(self), notifications=(self), camera=(), accelerometer=(), gyroscope=(), magnetometer=(), payment=(), usb=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

module.exports = withPWA(withNextIntl(nextConfig));
