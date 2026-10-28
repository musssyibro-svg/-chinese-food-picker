/* Offline cache for the Chinese Food Picker. Photo assets are downloaded in the Pages build. */
const CACHE_NAME = 'chinese-food-picker-v2';
const APP_FILES = [
  './',
  './index.html',
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith('chinese-food-picker-') && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
