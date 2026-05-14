/**
 * Strip characters that could let an attacker break out of a quoted
 * span in a downstream LLM prompt (image-gen, etc.). We keep letters,
 * digits, common punctuation, and a generous set of diacritics for
 * Norwegian and other European names. Quotes (single, double, back-
 * tick), angle brackets, and control characters are removed. Length
 * is clamped so a paste of giant text can't dominate the prompt.
 *
 * This is a *defence-in-depth* layer: upstream the title already
 * comes from a zod-validated AI plan, but that plan was generated
 * from user free-text params, so a determined user could chain a
 * payload into a quoted span. Stripping the quote characters here
 * removes the break-out vector regardless.
 */
export function sanitizePromptValue(input: string, maxLen = 120): string {
  if (!input) return '';
  return input
    // Strip ASCII control characters (incl. CR/LF) and the chars used
    // for delimiter-injection: quotes, backticks, angle brackets, and
    // braces. Backslashes also out — they're an escape-injection vector.
    .replace(/[\x00-\x1F\x7F"'`<>{}\\]/g, '')
    // Collapse any leftover whitespace runs.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}
