# Privacy architecture

This document is the binding contract between the app and its primary user. Every table, policy, and data flow must conform to it. If you are about to write code that might violate these rules — stop, and re-read.

## Design axioms

1. **Sensitive data is the user's, not the household's.** Partners are *separate accounts* that happen to share a shopping list. They are not co-owners of each other's thoughts.
2. **Default to DENY.** Every new table starts with RLS enabled and zero policies. Open access explicitly, table by table.
3. **The service role key is quarantined.** It lives only in server-side cron jobs and API routes. It never reaches a client bundle. Prefer the anon key with a signed-in session wherever possible.
4. **Encryption at rest for any credential we hold.** Google OAuth refresh tokens are AES-256-GCM–wrapped with `TOKEN_ENCRYPTION_KEY` before insert. Supabase's storage encryption is not a substitute — it protects against disk loss, not against a leaked anon key.
5. **No analytics that leave our infrastructure.** PostHog is only viable self-hosted, if added at all (v1: none).
6. **The partner is a second user, not an admin.** Partner role has no elevated permissions anywhere.

## Data sensitivity matrix

| Table | Sensitivity | Who can read | Who can write |
|---|---|---|---|
| `user_profiles` | personal | self | self |
| `user_settings` | personal | self | self |
| `google_tokens` | **credential** | self | self (via server) |
| `calendar_events` | personal | self | self |
| `quests` | personal | self | self |
| `habits`, `habit_logs` | personal | self | self |
| `mana_logs` | **private** | self | self |
| `respawn_tokens` | personal | self | self |
| `brain_dump` | **private (most)** | self | self |
| `medications`, `medication_logs` | **private (highest)** | self | self |
| `ai_messages` | **private** | self | self |
| `pantry` | personal | self | self |
| `push_subscriptions` | personal | self | self |
| `households` | shared | members | creator |
| `household_members` | shared | members | self (own row) |
| `shopping_list_items` | shared | members | members |
| `ingredients`, `recipes`, `recipe_ingredients` | public-read | authenticated | service role only |

Rule: rows marked **private** never participate in a join across users, ever. Not for analytics, not for "smart" features, not for a debug tool.

## Household firewall

Two users in the same household share:

- Shopping list (both read, both write)
- Calendar events explicitly flagged `shared = true` (Phase 6)
- Co-presence status (Phase 6, optional, opt-in)

They do **not** share:

- Habits, habit logs, or streaks
- Mana / energy logs
- Brain dump
- Medications and medication logs
- AI messages (morning briefing, weekly debrief, chat)
- Quest completion state
- Google tokens or sync state

This is enforced by RLS. An application bug cannot leak across the firewall because the database denies the query.

## Tests that must exist

Before v1 ships:

1. **Cross-user read tests.** Sign in as partner B, query every private table scoped to user A, assert 0 rows.
2. **Cross-user write tests.** Sign in as partner B, attempt to insert into user A's brain dump — assert permission denied.
3. **Service-role isolation.** Grep the compiled client bundle for `SUPABASE_SERVICE_ROLE_KEY` — must not appear.
4. **Token encryption roundtrip.** Encrypt/decrypt property test; asserts unchanged after round trip and that ciphertext differs from plaintext.
5. **Allergen filtering.** Property test: `isSafeForUser(recipe, user)` is false whenever the intersection is non-empty. (See `lib/allergens.ts`.)

These live under `/tests/privacy/` and run in CI on every PR.

## Crisis-language handling

The AI prompts (morning briefing, weekly debrief, chat) include an explicit clause: if user text or context hints at self-harm, severe distress, or suicidal ideation, the assistant stops the normal flow and surfaces crisis resources (Mental Helse 116 123 in Norway). Never treats it as a gamified event. See `lib/prompts/` and `docs/copy-rules.md`.

## Data portability

- Full JSON export of the user's entire row graph, downloadable at `/settings/export` (Phase 7).
- Clinician export (PDF) is a derived view built from the same queries — no separate data flow.
- Account deletion cascades via `on delete cascade` from `auth.users` → every table listed above.

## Breach protocol (if the worst happens)

1. Rotate `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` — all of them, same day.
2. Force-re-encrypt `google_tokens` with the new token key (a background job iterates with the old key, writes with the new).
3. Tell the user, in plain Norwegian, what may have leaked and what was rotated. Before anyone else.
