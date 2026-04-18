import webpush from 'web-push';
import { serverEnv, publicEnv } from '@/lib/env';

let configured = false;

function configure() {
  if (configured) return;
  if (
    !publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !serverEnv.VAPID_PRIVATE_KEY ||
    !serverEnv.VAPID_SUBJECT
  ) {
    throw new Error('VAPID env vars are not set');
  }
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT,
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    serverEnv.VAPID_PRIVATE_KEY,
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function sendPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
) {
  configure();
  await webpush.sendNotification(sub, JSON.stringify(payload), {
    TTL: 60 * 60 * 4,
  });
}
