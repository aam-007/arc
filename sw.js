const CACHE_PREFIX = 'arc-';
const CACHE = 'arc-v10-production-cleanup';
const FILES = [
  './',
  'index.html',
  'app.js',
  'ui.js',
  'welcome.js',
  'arrival.js',
  'engine.js',
  'storage.js',
  'backup.js',
  'forecast.js',
  'academic.js',
  'export.js',
  'style.css',
  'glass.css',
  'arrival.css',
  'icon.svg',
  'manifest.webmanifest',
];
const appAssets = new Set(FILES.map((file) => new URL(file, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (!appAssets.has(url.href)) return;
  // Cache the fixed application shell only, never arbitrary same-origin data.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cache.put(url.href, response.clone()).catch(() => {}));
        return response;
      } catch {
        return (await cache.match(url.href)) || Response.error();
      }
    })(),
  );
});
