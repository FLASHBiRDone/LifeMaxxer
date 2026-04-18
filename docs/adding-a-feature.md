# Adding a feature

A short playbook so features don't leak across phases.

## Before writing code

1. **Is this feature in the current phase?** If no, stop. Write an issue instead. See `BUILD_SPEC.md §2`.
2. **Is this feature in the "non-goals" list?** (`BUILD_SPEC.md §10`.) If yes, stop.
3. **Does it touch sensitive data?** Re-read `PRIVACY_ARCHITECTURE.md` before designing the schema.
4. **Is there existing vocabulary for it?** Check `/locales/*.json` and `lib/vocabulary.ts`. Reuse rather than invent.

## While writing

- One PR per feature. Small. Reviewable.
- Add `i18n` keys to both `nb.json` and `en.json` in the same commit.
- If the feature stores new user data, write the migration and the RLS policy in the same commit.
- If the feature calls Claude, create a versioned prompt file under `lib/prompts/` and log every call to `ai_messages`.
- If the feature fires a notification, it must be gated by an opt-in toggle in `user_settings`.

## Before merging

```bash
npm run typecheck && npm run lint && npm test
```

For UI changes:

- Click through the feature in a real browser.
- Test with `prefers-reduced-motion: reduce`.
- Test with the Low Stim sensory toggle (Phase 7).
- Read every new string aloud. Does it pass `copy-rules.md`?

For DB changes:

- Run the new migration against a fresh Supabase instance.
- Run the privacy audit test suite (`/tests/privacy/`).
- Verify that a second test user cannot read the first user's new rows.

## Commit style

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Subject line in imperative mood, ≤ 72 chars.
