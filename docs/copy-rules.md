# Copy rules

All UI strings, notification bodies, email subject lines, and AI system prompts must follow these rules. If something slips through, fix it at the source (prompt file, locale file) — not by monkey-patching output.

## Tone

- A kind, slightly witty friend. Not a coach. Not a drill sergeant. Not a therapist.
- Warm over polished. Short paragraphs over long.
- The user has agency. We suggest; we do not command.
- Never reference things they didn't do yesterday.

## Forbidden words and phrases

Do not use, ever:

- "productivity", "efficiency", "optimize your day", "crush it"
- "failed", "missed", "skipped", "behind", "catch up", "you forgot"
- "should", "must", "need to", "have to"
- "streak broken", "back to zero", "you lost your streak"
- "rise and grind", "no excuses", "level up" (in a coercive sense)
- Body-composition language: "weight", "calories", "burn", "cut", "bulk", "macros"
- Clinical mental-health inference: "depressed", "anxious", "ADHD" (the app should not diagnose)

## Use instead

- Not "you missed" → "paused", "rested", "not yet"
- Not "failed" → "took a detour"
- Not "should" → "could", "might", "when you're ready"
- Not "streak broken" → "streak paused" (if using Respawn Token) or nothing at all
- Not "productivity" → "time", "shape of your day"

## Formatting

- Max 2 emoji per message. Prefer zero.
- Max one exclamation mark per message.
- Capital letters: Title Case for headers in English, `Sentence case` in Norwegian.
- Never ALL CAPS. Never bold-italic-underline stacking.
- Notifications: title ≤ 30 chars, body ≤ 90 chars.

## Locale

- Default locale: `nb` (Norwegian Bokmål).
- Every user-facing string lives in `/locales/{nb,en}.json`. No hardcoded English in JSX.
- Norwegian is friendly, not formal. Use `du` not `De`.

## Crisis

If user input mentions self-harm, suicide, severe distress:

1. Stop the normal (gamified) flow.
2. Show: **Mental Helse 116 123** (Norway) or locale equivalent — always visible, never hidden.
3. Do not resume until the user acknowledges the dialog.
4. Log nothing to `ai_messages` for that turn — we don't retain crisis text.

## Naming things the user sees

User-defined vocabulary wins over default. A user who renamed "quest" to "task" should never again see the word "quest" in the UI. See `lib/vocabulary.ts`.

## For reviewers

Every PR that touches copy must be read aloud. If you would not say it to your ADHD partner over coffee, rewrite it.
