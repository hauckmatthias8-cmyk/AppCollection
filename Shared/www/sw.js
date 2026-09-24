const APP_VERSION = '1.0.4';
const CACHE = `hauckis-apps-${APP_VERSION}`;
const ASSETS = [
  './', './index.html', './collection.css', './pwa.js', './manifest.webmanifest', './version.json',
  './icon-192.png', './icon-512.png',
  './cube.html', './cube.css', './cube-app.js', './cube.js', './solve.js',
  './sudoku.html', './sudoku.css', './sudoku-app.js', './sudoku-core.js',
  './THIRD_PARTY_LICENSES.txt'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(event.request)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request, {ignoreSearch:true});
    if (cached) return cached;
    const fresh = await fetch(event.request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      cache.put(event.request, fresh.clone());
    }
    return fresh;
  })());
});
