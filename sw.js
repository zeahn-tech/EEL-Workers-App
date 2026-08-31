const CACHE_NAME = 'eel-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {
      // Silent fail for missing assets during install
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER intercept Supabase API calls — let them go straight to network
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // If we have it in cache, return it
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request).then((networkResponse) => {
        // Cache valid GET responses
        if (request.method === 'GET' && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // ← THIS .catch() IS HERE — inside the fetch() chain
        // If network fails and nothing in cache, return offline fallback
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        // Return a real Response object instead of undefined
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      });

    }).catch(() => {
      // ← AND THIS .catch() IS HERE — if caches.match() itself fails
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});