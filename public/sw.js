// Service Worker for Habit Tracker PWA
// Provides offline caching and background sync

const CACHE_NAME = 'habit-tracker-v2';
const RUNTIME_CACHE = 'habit-tracker-runtime-v2';

// Static assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const DEV_ASSET_PREFIXES = ['/src/', '/node_modules/', '/@vite/', '/@fs/'];

function shouldHandleFetch(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (DEV_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;
  if (url.searchParams.has('import')) return false;
  if (request.headers.get('accept')?.includes('text/event-stream')) return false;

  return true;
}

function canCacheResponse(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return false;

  const contentType = response.headers.get('content-type') || '';
  if (request.mode === 'navigate') {
    return contentType.includes('text/html');
  }

  return !contentType.includes('text/html');
}

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) =>
            cacheName.startsWith('habit-tracker') &&
            cacheName !== CACHE_NAME &&
            cacheName !== RUNTIME_CACHE
          )
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (!shouldHandleFetch(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        // Fetch in background to update cache
        event.waitUntil(
          fetch(event.request).then((response) => {
            if (canCacheResponse(event.request, response)) {
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(event.request, response.clone());
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (canCacheResponse(event.request, response)) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-habits') {
    event.waitUntil(syncHabits());
  }
});

async function syncHabits() {
  // This will be triggered when the app comes back online
  // The actual sync logic is handled by the frontend's useDashboard hook
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
