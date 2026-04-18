import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getOAuthClient } from '@/lib/google';
import { encrypt } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('gcal_oauth_state')?.value;
  cookieStore.delete('gcal_oauth_state');

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL('/settings?gcal=state_error', url.origin));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    return NextResponse.redirect(
      new URL('/settings?gcal=missing_tokens', url.origin),
    );
  }

  const { error } = await supabase.from('google_tokens').upsert({
    user_id: user.id,
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
    expires_at: new Date(tokens.expiry_date).toISOString(),
  });

  if (error) {
    return NextResponse.redirect(new URL('/settings?gcal=db_error', url.origin));
  }

  return NextResponse.redirect(new URL('/settings?gcal=connected', url.origin));
}
