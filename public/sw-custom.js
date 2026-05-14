// Custom service worker handlers merged by next-pwa at build time.
// next-pwa generates the main sw.js; this file is imported via importScripts.
// We handle `push`, `notificationclick`, and a `message` event used
// by the client to clear auth-sensitive caches on sign-out.

/**
 * Clear caches that can hold the previous user's personal data when
 * a sign-out is happening. Static-asset caches (workbox-precache,
 * static-image-assets, etc.) stay so the next user doesn't redownload
 * the whole app shell.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_SESSION_CACHE') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      const personal = names.filter((n) =>
        n.includes('pages') ||
        n.includes('apis') ||
        n.includes('next-data') ||
        n.includes('cross-origin') ||
        n.includes('static-data-assets'),
      );
      await Promise.all(personal.map((n) => caches.delete(n)));
    })());
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'LifeMaxxer', body: event.data.text() };
  }

  const { title = 'LifeMaxxer', body = '', url = '/', tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
