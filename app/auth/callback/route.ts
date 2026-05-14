import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Restrict the `next` redirect target to same-origin paths only.
 * `new URL(next, origin)` happily accepts absolute or
 * protocol-relative inputs (`//evil.com/x`) and overrides the base,
 * which would let an attacker bounce a freshly-authenticated user
 * off-site. Require a leading single `/` and reject `//…` plus
 * embedded CR/LF that could smuggle a header split.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/today';
  }
  if (/[\r\n]/.test(value)) return '/today';
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
