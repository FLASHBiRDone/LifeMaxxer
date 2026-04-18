import { google } from 'googleapis';
import { serverEnv } from '@/lib/env';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
];

export function getOAuthClient() {
  if (
    !serverEnv.GOOGLE_CLIENT_ID ||
    !serverEnv.GOOGLE_CLIENT_SECRET ||
    !serverEnv.GOOGLE_REDIRECT_URI
  ) {
    throw new Error('Google OAuth env vars are not set');
  }
  return new google.auth.OAuth2(
    serverEnv.GOOGLE_CLIENT_ID,
    serverEnv.GOOGLE_CLIENT_SECRET,
    serverEnv.GOOGLE_REDIRECT_URI,
  );
}

export function buildConsentUrl(state: string) {
  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}
