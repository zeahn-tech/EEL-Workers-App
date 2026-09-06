const CACHE_NAME = 'eel-messenger-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './offline.html'
];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first, fall back to cache then offline page
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Dynamic caching for static assets
        if (response.status === 200 && (event.request.url.startsWith('http') || event.request.url.startsWith('https'))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
        });
      })
  );
});

// Push notification event listener — this is the one path that can reach someone whose
// browser is fully closed; the rest of the app's notification system (sound, toast,
// unread badges) only works while a tab is open and connected to Supabase Realtime.
self.addEventListener('push', (event) => {
  let data = { title: 'EEL Messenger', body: 'New operational dispatch message received' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './favicon.svg',
    vibrate: [100, 50, 100],
    tag: data.tag, // groups/replaces stacked notifications from the same conversation
    data: {
      dateOfArrival: Date.now(),
      chatKey: data.tag
    }
  };

  event.waitUntil(
    (async () => {
      // If the app is already open and visible somewhere, the in-app system (toast,
      // sound, unread badge) already covers this live — showing an OS notification too
      // would just be a redundant, slightly annoying double-notification for the exact
      // same message. Only show the OS-level popup when nobody's actually looking.
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isAppVisible = clientsList.some((client) => client.visibilityState === 'visible' && client.focused);
      if (isAppVisible) return;

      return self.registration.showNotification(data.title, options);
    })()
  );
});

// Clicking the notification focuses an already-open tab if one exists, or opens a new
// one — either way landing them back in the app rather than just dismissing silently.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientsList.find((client) => 'focus' in client);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('./');
    })()
  );
});
