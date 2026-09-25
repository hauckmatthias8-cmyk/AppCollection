const APP_VERSION = '1.2.2';
const CACHE = `hauckis-apps-${APP_VERSION}`;
const ASSETS = [
  './', './index.html', './collection.css', './pwa.js', './manifest.webmanifest', './version.json',
  './icon-192.png', './icon-512.png',
  './cube.html', './cube.css', './cube-app.js', './cube.js', './solve.js',
  './sudoku.html', './sudoku.css', './sudoku-app.js', './sudoku-core.js',
  './THIRD_PARTY_LICENSES.txt'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of ASSETS) {
      const response = await fetch(new Request(url, {cache:'reload'}));
      if (!response.ok) throw new Error(`Precache failed: ${url}`);
      await cache.put(url, response);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const networkFirst = event.request.mode === 'navigate' ||
    (sameOrigin && /\.(?:js|css|json|webmanifest)$/i.test(url.pathname));

  if (networkFirst) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, {cache:'no-cache'});
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(event.request)) ||
               (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error());
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const fresh = await fetch(event.request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, fresh.clone());
    }
    return fresh;
  })());
});
