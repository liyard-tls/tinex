const CACHE_NAME = 'tinex-v1';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/favicon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      // Use addAll with catch for each to avoid blocking on failures
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.log('Failed to cache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
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

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept Share Target POST requests
  if (event.request.method === 'POST' && url.pathname === '/import/share-target/') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('statement'); // 'statement' is the name from manifest.json

          if (!file) {
            return Response.redirect('/import/?error=true', 303);
          }

          // Store the file in a dedicated cache
          const cache = await caches.open('shared-files-cache');
          // Use a unique name for the cache entry, e.g., based on timestamp
          const fileUrl = `/shared/${Date.now()}_${file.name}`;
          await cache.put(fileUrl, new Response(file));
          
          const redirectUrl = self.registration.scope + `import?shared_file=${encodeURIComponent(fileUrl)}`;

          // Notify any open clients
          const clients = await self.clients.matchAll({ type: 'window' });
          for (const client of clients) {
            client.postMessage({
              type: 'FILE_SHARED',
              fileUrl: fileUrl,
            });
          }
          
          // Redirect the browser to the import page with the file param.
          // This is more robust than trying to manage windows/focus.
          return Response.redirect(redirectUrl, 303);

        } catch (error) {
          console.error('Share target error:', error);
          return Response.redirect('/import/?error=true', 303);
        }
      })()
    );
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API and Firebase requests
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();

        // Cache the response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Placeholder for future offline transaction sync
  console.log('Syncing offline transactions...');
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'TineX', options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
