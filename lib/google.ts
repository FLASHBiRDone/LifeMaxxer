import { google, calendar_v3 } from 'googleapis';
import { serverEnv } from '@/lib/env';
import { decrypt, encrypt } from '@/lib/crypto';

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

export type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

/**
 * Build an authorized OAuth client for a user using their encrypted stored
 * tokens. If the access token is expired, refresh it and return the new
 * expiry so the caller can persist it.
 */
export async function authorizedClient(stored: StoredTokens) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: decrypt(stored.access_token),
    refresh_token: decrypt(stored.refresh_token),
    expiry_date: new Date(stored.expires_at).getTime(),
  });

  let rotated: { access_token: string; expires_at: string } | null = null;
  const expired = new Date(stored.expires_at).getTime() < Date.now() + 60_000;
  if (expired) {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token && credentials.expiry_date) {
      client.setCredentials(credentials);
      rotated = {
        access_token: encrypt(credentials.access_token),
        expires_at: new Date(credentials.expiry_date).toISOString(),
      };
    }
  }

  return { client, rotated };
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string | null;
};

/**
 * Fetch events between two ISO timestamps from the user's primary calendar.
 * Intentionally minimal — Phase 1 only needs today's events.
 */
export async function listEvents(
  auth: Awaited<ReturnType<typeof authorizedClient>>['client'],
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const items: calendar_v3.Schema$Event[] = res.data.items ?? [];
  return items
    .filter((e) => e.id && e.summary)
    .map((e) => ({
      id: e.id!,
      title: e.summary!,
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      description: e.description ?? null,
    }));
}

export type NewCalendarEvent = {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  colorId?: string;
};

export async function createEvent(
  auth: Awaited<ReturnType<typeof authorizedClient>>['client'],
  event: NewCalendarEvent,
  calendarId: string = 'primary',
): Promise<string> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      colorId: event.colorId,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 30 }],
      },
    },
  });
  return res.data.id!;
}

const LIFEMAXXING_CAL_NAME = 'LifeMaxxing';
const LIFEMAXXING_CAL_DESC = 'Automatisk lagde hendelser fra LifeMaxxer';

/**
 * Return the calendar id for the user's "LifeMaxxing" calendar. Creates
 * it once if it doesn't exist. Reads/writes a cached id from the caller-
 * supplied getStored callback so we don't list calendars on every event.
 */
export async function getOrCreateLifemaxxingCalendar(
  auth: Awaited<ReturnType<typeof authorizedClient>>['client'],
  cached: string | null,
): Promise<{ id: string; rotated: boolean }> {
  if (cached) return { id: cached, rotated: false };

  const calendar = google.calendar({ version: 'v3', auth });

  // Look for an existing calendar with the name (user may have created
  // it manually or we may have just not stored the id yet).
  const list = await calendar.calendarList.list({ maxResults: 250 });
  const existing = (list.data.items ?? []).find(
    (c) => c.summary === LIFEMAXXING_CAL_NAME,
  );
  if (existing?.id) return { id: existing.id, rotated: true };

  // Create a new calendar dedicated to LifeMaxxer events.
  const created = await calendar.calendars.insert({
    requestBody: {
      summary: LIFEMAXXING_CAL_NAME,
      description: LIFEMAXXING_CAL_DESC,
      timeZone: 'Europe/Oslo',
    },
  });
  const id = created.data.id;
  if (!id) throw new Error('kunne ikke opprette LifeMaxxing-kalenderen');

  // Give the new calendar a teal color that matches the app theme.
  try {
    await calendar.calendarList.patch({
      calendarId: id,
      requestBody: { colorId: '7' }, // Google calendar "Peacock" — a teal-ish blue
    });
  } catch {
    /* non-critical */
  }

  return { id, rotated: true };
}

export type EventPatch = {
  summary?: string;
  description?: string;
  start?: Date;
  end?: Date;
};

export async function patchEvent(
  auth: Awaited<ReturnType<typeof authorizedClient>>['client'],
  googleEventId: string,
  patch: EventPatch,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  const requestBody: calendar_v3.Schema$Event = {};
  if (patch.summary !== undefined) requestBody.summary = patch.summary;
  if (patch.description !== undefined) requestBody.description = patch.description;
  if (patch.start) requestBody.start = { dateTime: patch.start.toISOString() };
  if (patch.end) requestBody.end = { dateTime: patch.end.toISOString() };
  await calendar.events.patch({
    calendarId: 'primary',
    eventId: googleEventId,
    requestBody,
  });
}
