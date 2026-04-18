# Prompt engineering

All prompts are versioned TypeScript files in `/lib/prompts/`. Never hardcode prompts inline in API routes.

## Versioning

One file per prompt, named `{context}.v{N}.ts`. Export a single const with `{ version, model, system, buildUser }`. Bump the suffix when you change the system prompt, not when you fix a typo in `buildUser`.

Every call writes the `version` string into `ai_messages.prompt_version` so we can diff behavior across prompt revisions.

## Models

Pinned in `lib/claude.ts`:

- `MODELS.morningBriefing` → `claude-haiku-4-5` (fast, cheap, good enough)
- `MODELS.weeklyDebrief` → `claude-sonnet-4-6` (quality matters)
- `MODELS.chat` → `claude-sonnet-4-6`

## Prompt caching

The weekly debrief's system prompt is long (>1024 tokens). Mark the system block with `cache_control: { type: 'ephemeral' }` when calling the SDK. Saves ~90% on subsequent cache hits within the 5-minute TTL window. See Anthropic docs for exact field placement.

## Output contracts

- **Morning briefing**: strict JSON. Parse with `zod`. If parse fails, fall back to a static message — do not retry silently on the user's behalf.
- **Weekly debrief**: free-form markdown, ≤ 250 words. No parsing.
- **Chat**: streamed text, no structure.

## Golden files

Each prompt has a `__tests__/{name}.golden.md` file with 3-5 representative inputs and the expected output shape. When you change the prompt, re-run the test script, diff the goldens, and **have a human read them before committing**. Tone regressions do not show up in unit tests.

## Budgeting

- `ANTHROPIC_MONTHLY_BUDGET_USD` in env caps cumulative `ai_messages.cost_usd` per calendar month.
- If the cap is exceeded, degrade gracefully: morning briefing falls back to a calendar-only static summary; chat refuses new turns with a gentle message.

## Copy rules

All prompt text is subject to `copy-rules.md`. The system prompt itself lists the forbidden vocabulary so the model self-enforces.
