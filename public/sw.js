const CACHE_NAME = 'bza-v3';

// Install — cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/bza-logo-new.png',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache STATIC ASSETS ONLY (network-first). Never cache HTML pages,
// navigations, RSC payloads, or API calls: those must always come from the
// network so fresh data never gets masked by a stale cached page.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Detect dynamic content that must NEVER be served from cache.
  const isRSC =
    url.searchParams.has('_rsc') ||
    req.headers.get('RSC') === '1' ||
    (req.headers.get('Accept') || '').includes('text/x-component');
  const isDynamic =
    url.pathname.startsWith('/api/') ||
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    isRSC;

  // Let the browser fetch dynamic content directly — the SW stays out of it.
  if (isDynamic) return;

  // Static assets (images, fonts, /_next/static chunks): network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'BZA.', body: event.data.text() }; }

  const { title = 'BZA.', body = '', icon, badge, url = '/notifications' } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      tag: 'bza-notification',
      renotify: true,
      data: { url },
    })
  );
});

// Click — open / focus the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});
