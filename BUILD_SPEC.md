# LifeMaxxer — Build Specification

> **To the AI agent reading this:** You are building a gamified life-management PWA for a single primary user (the builder's ADHD partner). This is not a startup. It is a personal tool that may later generalize. Every design decision should favor **that one user's actual life** over hypothetical scale.
>
> Read this document fully before writing code. Work through phases in order. Do not jump ahead. Each phase has acceptance criteria — verify them before moving on.

---

## 0. First principles (do not skip)

Before touching code, internalize these:

1. **ADHD brains get worse under visual overload.** If your instinct is "let's add one more badge," resist it. Whitespace is a feature.
2. **Every notification is a debt.** Only send what the user has explicitly opted into. Default to silence.
3. **Streaks destroy more habits than they build.** Use Respawn Tokens. Never show a "you broke your streak" message.
4. **Shame kills ADHD users.** No language suggesting failure, laziness, or falling behind. Ever. See `docs/copy-rules.md`.
5. **Privacy is architectural.** Read `PRIVACY_ARCHITECTURE.md` before building anything that stores data. Sensitive data (brain dump, sobriety, mood, medication) has a different RLS policy than shared data (calendar, shopping list).
6. **The partner (builder) is a second user, not an admin.** He does not see her private data. See privacy doc.
7. **Norwegian + English.** UI copy uses next-intl. All user-facing strings are in `/locales/{en,nb}.json`. Default locale: `nb`.

---

## 1. Tech stack (locked — do not deviate)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | SSR, PWA support, API routes in one repo |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible primitives |
| Database | Supabase (Postgres) | Auth, RLS, realtime, storage, all in one |
| Auth | Supabase Auth (Google OAuth + magic link) | Google OAuth gives us Calendar access scope too |
| AI | Anthropic Claude API | `claude-sonnet-4-6` for weekly coach, `claude-haiku-4-5` for morning briefing |
| Calendar | Google Calendar API v3 | Primary integration |
| Push | Web Push API via `web-push` lib | PWA-native, no Firebase needed |
| Deploy | Vercel | Native Next.js, cheap for personal use |
| i18n | next-intl | Norwegian + English |
| Forms | react-hook-form + zod | Validation + type safety |
| State | Zustand for client state, Server Components for server state | Avoid Redux complexity |
| Analytics | **None in v1.** PostHog later if needed, self-hosted only. | Privacy-first |

**Do not add:**
- Redux, Recoil, or any global state library beyond Zustand
- A component library beyond shadcn/ui
- A CSS-in-JS library
- An ORM (use Supabase client directly; it's typed)
- Any analytics that ships data off our infrastructure

---

## 2. Phased build plan

Build phase by phase. Each phase ships. Get user feedback before moving on. The full phase list lives in the original design brief; phase-0 scaffolding is already committed in this repo and the remaining phases (1–7) are tracked as milestones on GitHub.

Key anchors:

- **Phase 0 — Foundation** (this commit): Next.js + Supabase + PWA + i18n + RLS.
- **Phase 1 — Morning Briefing**: the whole v1 in itself. Ship this before anything else.
- **Phase 2 — HUD**: character sheet, calendar-as-quest-log, Boss Battle with hyperfocus safeguards.
- **Phase 3 — Stats & Habits**: Stat-Maxxing, mana, Respawn Tokens, medications, custom vocabulary.
- **Phase 4 — AI Game Master**: weekly debrief, chat.
- **Phase 5 — Recipes & Food**: deterministic allergen filtering.
- **Phase 6 — Partner mode / light family**: shared shopping list, body doubling.
- **Phase 7 — Polish**: sensory toggles, accessibility, data export, clinician export.

Do not leak later-phase features into earlier PRs. See `docs/adding-a-feature.md`.

---

## 3. Data model

All tables in Supabase Postgres. DDL lives in `/supabase/migrations/`. RLS policies live in a separate migration for auditability. Sensitivity levels and access rules are in `PRIVACY_ARCHITECTURE.md`.

Key tables (abbreviated — see migrations for DDL):

- Identity: `user_profiles`, `households`, `household_members`
- Calendar integration: `google_tokens` (encrypted), `calendar_events`
- Gameplay: `quests`, `habits`, `habit_logs`, `mana_logs`, `respawn_tokens`
- Private: `brain_dump`, `medications`, `medication_logs`, `ai_messages`
- Food: `ingredients`, `recipes`, `recipe_ingredients`, `pantry`, `shopping_list_items`
- Platform: `push_subscriptions`, `user_settings`

---

## 4. External integrations

### Google Calendar
OAuth scopes: `calendar.events`, `calendar.readonly`, `openid email profile`. Refresh tokens encrypted via `lib/crypto.ts` before insert into `google_tokens`. Two-way sync via `syncToken`. Watch channels for push updates. See `lib/google.ts`.

### Anthropic Claude
Server-side only. Prompt files under `/lib/prompts/`. Every call logs to `ai_messages` with token usage and cost. Monthly cap via `ANTHROPIC_MONTHLY_BUDGET_USD` env. See `lib/claude.ts` and `docs/prompt-engineering.md`.

### Web Push
VAPID keys in env. Subscribe only after explicit user opt-in. Service worker handlers live in `public/sw-custom.js`. See `lib/push.ts`.

---

## 5. Directory structure

See the existing tree in this repo. Source of truth. Do not drift.

---

## 6. AI prompt engineering

See `docs/prompt-engineering.md` and `/lib/prompts/`.

Copy rules live in `docs/copy-rules.md`. Every prompt echoes the forbidden-vocabulary list back to the model so it self-enforces.

---

## 7. Medication reminders

Never store prescription details, dosage, or diagnosis. Only a user-chosen name and reminder times. Gentle copy, no "missed" counts, clinician-only pattern data. Opt-in. See `PRIVACY_ARCHITECTURE.md`.

---

## 8. Recipe & allergen safety

**The AI does not decide what is safe to eat. Ever.**

Allergen filtering happens in SQL against a curated database with verified allergen tags. The AI only suggests combinations from an already-filtered set. See `lib/allergens.ts` for the EU-FIC-14 allergen list and `isSafeForUser()`.

---

## 9. Non-goals

Resist the urge to build:

- Social features / leaderboards / public achievements
- AI-generated recipes from scratch
- Partner visibility into user's habits, mana, mood, brain dump
- Kid/chore/allowance module in v1
- Paid tiers, Stripe integration
- Email newsletters
- Analytics that leave our infrastructure
- AI that generates medical, legal, or financial advice
- Streaks without Respawn Tokens
- Notifications without explicit opt-in
- Diet/calorie tracking
- Mood tracking beyond 3-level Mana

---

## 10. Testing strategy

- **Unit** (Vitest): allergen filtering, vocabulary substitution, prompt output parsing.
- **Integration** (Playwright, added in Phase 1+): OAuth, calendar sync, morning briefing.
- **Privacy audit** (`/tests/privacy/`): cross-user read/write attempts must fail. Runs in CI.
- **AI goldens**: per-prompt representative inputs + expected outputs. Human-reviewed on change.
- **Manual**: the partner. She is the only user who matters in v1.

---

## 11. Deployment

- Vercel, connected to `main`; preview deploys per PR.
- Supabase, single prod project, EU region.
- Secrets in Vercel env vars only. Never committed.
- Cron in `vercel.json` (times UTC):
  - `morning-briefing`: `30 6 * * *`
  - `dinner-panic`: `30 15 * * *`
  - `weekly-debrief`: `0 18 * * 0`
  - `calendar-sync`: `*/15 * * * *`
- Supabase PITR on; weekly JSON export emailed to user.

---

## 12. Definition of done for v1

1. Partner uses morning briefing 5+ mornings/week for 4 consecutive weeks, unprompted.
2. Brain Dump has captured 50+ items without reset.
3. ≥3 habits tracked for 30+ days with ≥1 Respawn Token use.
4. Weekly Debrief has been read (not just delivered) 3 weeks running.
5. Zero privacy incidents.
6. Partner has NOT asked to turn off any notification.
7. She has renamed at least one piece of vocabulary (proving the app feels like hers).

If any fail, fix the failing one before expanding scope.

---

## 13. When you're unsure

- **Privacy?** MORE private.
- **Scope?** LESS.
- **UI?** QUIETER.
- **Copy?** KINDER.
- **Technical?** SIMPLER.

---

## 14. Handoff

- Work phase by phase. Do not leak later phases into earlier PRs.
- Before every commit: `npm run typecheck && npm run lint && npm test`.
- Conventional commit messages.
- One PR per feature. Small, reviewable.
- When a design decision isn't specified, ask in a PR comment rather than guessing.
- This app will be used by someone the builder loves. Treat every line of code accordingly.
