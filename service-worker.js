/* Offline-first service worker for the Chinese Food Picker. */
const CACHE_NAME = 'chinese-food-picker-v5';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './food_intro_en.txt',
  './food_intro_zh.txt',
  './readme.txt',
  './PHOTO-LINKS.txt',
  './food-images/chinese-feast.jpg',
  './food-images/dumpling.jpg',
  './food-images/drink.jpg',
  './food-images/egg.jpg',
  './food-images/soup.jpg',
  './food-images/noodles.jpg',
  './food-images/rice.jpg',
  './food-images/skewer.jpg',
  './food-images/street.jpg',
  './food-images/stirfry.jpg',
  './food-images/tofu.jpg',
  './food-images/fish.jpg',
  './food-images/greens.jpg',
  './food-images/dessert.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache what is available; a single missing optional resource must not
    // prevent the app shell from installing.
    await Promise.allSettled(APP_FILES.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok && response.type === 'basic') {
          await cache.put(path, response);
        }
      } catch (_) {
        // Continue installing; navigation fallback still works when available.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('chinese-food-picker-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation is network-first so users receive new deployments promptly.
  // Fall back to the cached app shell when offline or the network fails.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) ||
          new Response('You are offline. Reopen the Chinese Food Picker when connected once to cache it.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  // Cache-first for same-origin static assets, with a safe network fallback.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
