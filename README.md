# LifeMaxxer

A gamified life-management PWA, built for one person at a time — starting with an ADHD-friendly morning briefing, a private brain dump, and a calendar that plays like a quest log.

Full design intent and phased plan: [`BUILD_SPEC.md`](./BUILD_SPEC.md).
Privacy contract (read before touching data): [`PRIVACY_ARCHITECTURE.md`](./PRIVACY_ARCHITECTURE.md).
Language rules for all UI and AI copy: [`docs/copy-rules.md`](./docs/copy-rules.md).

## Status

**Phase 0 — Foundation.** Project is scaffolded; no user-facing features ship yet. See `BUILD_SPEC.md §2` for the phased plan.

## Stack

Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres + Auth + RLS) · Anthropic Claude API · Google Calendar · Web Push · next-intl (nb/en) · `@ducanh2912/next-pwa` · Vercel.

See `BUILD_SPEC.md §1` for the locked stack list and anti-additions.

## Getting started

```bash
cp .env.example .env.local
# fill in Supabase, Anthropic, Google, VAPID keys

npm install
npm run dev
```

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Generate a token encryption key (32 bytes, base64):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply Supabase migrations:

```bash
supabase link --project-ref <your-project>
supabase db push
supabase db seed
```

## Scripts

- `npm run dev` — local dev server (PWA service worker disabled)
- `npm run build` — production build
- `npm run typecheck` — strict TS check, no emit
- `npm run lint` — ESLint (Next config)
- `npm run test` — Vitest

Before every commit: `npm run typecheck && npm run lint && npm test`.

## Directory layout

See `BUILD_SPEC.md §5` — it is the source of truth. Do not drift.

## Deploying

- Vercel project connected to `main`
- Env vars set via Vercel dashboard
- Cron schedule lives in `vercel.json` (times UTC; adjust for Europe/Oslo)
- Supabase project in eu-central for latency + GDPR

## Contributing

This is a personal-use app for one primary user and her partner. If you are not Casper, open an issue before writing code.

When the answer isn't in `BUILD_SPEC.md`:

1. Privacy question? Default to MORE private.
2. Scope question? Default to LESS.
3. UI question? Default to QUIETER.
4. Copy question? Default to KINDER.
5. Technical question? Default to SIMPLER.
