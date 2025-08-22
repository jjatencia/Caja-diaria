const CACHE_NAME = 'pwa-cache-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css?v=2',
  './app.js',
  './manifest.json',
  './icon-180.png'
];

const API_KEY = globalThis.API_KEY || '';

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
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) No tocar nada que no sea GET (evita el error con POST)
  if (req.method !== 'GET') return;

  // 2) No cachear llamadas a la API ni a otros orígenes
  const url = new URL(req.url);
  const isSameOrigin = self.location.origin === url.origin;
  const isApi = url.pathname.startsWith('/api/');
  if (!isSameOrigin || isApi) return;

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Respuestas “opaques” o con error no se cachean
        if (!networkResponse || !networkResponse.ok || networkResponse.type === 'opaqueredirect') {
          return networkResponse;
        }
        const respClone = networkResponse.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone))
        );
        return networkResponse;
      })
      .catch(() => caches.match(req))
  );
});


// Cola de alertas para reenviar cuando haya conexión
let alertQueue = [];

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'queue-alert') {
    alertQueue.push(event.data.payload);
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'send-alert') {
    event.waitUntil((async () => {
      if (!API_KEY) return;
      const remaining = [];
      for (const data of alertQueue) {
        try {
          const response = await fetch('/api/send-alert', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': API_KEY
            },
            body: JSON.stringify(data)
          });
          if (!response.ok) {
            console.error('Failed to resend alert', response.status);
            remaining.push(data);
          }
        } catch (err) {
          console.error('Failed to resend alert', err);
          remaining.push(data);
        }
      }
      alertQueue = remaining;
    })());
  }
});
