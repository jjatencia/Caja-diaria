const CACHE_NAME = 'pwa-cache-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css?v=2',
  './app.js',
  './manifest.json',
  './icon-180.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      )
      .then(() => {
        self.clients.claim();
        return self.clients
          .matchAll()
          .then(clients =>
            Promise.all(clients.map(client => client.navigate(client.url)))
          );
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const responseClone = networkResponse.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone))
        );
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
