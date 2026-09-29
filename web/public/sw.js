const CACHE = 'bang-toan-v3';

// Precache the shell and every hashed asset referenced by index.html so the app works offline after the first visit.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const html = await (await fetch('./', { cache: 'reload' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/?(?:assets\/[^"]+|manifest\.webmanifest|icon\.svg|apple-touch-icon\.png))"/g)].map((m) => m[1]);
      await cache.addAll(['./', ...new Set(assets)]);
      await self.skipWaiting();
    })().catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // network first so a new deployment is picked up; fall back to the cached shell offline
    const network = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./', copy));
      }
      return res;
    });
    const timeout = new Promise((_, rej) => setTimeout(rej, 4000));
    e.respondWith(
      Promise.race([network, timeout]).catch(async () => (await caches.match('./')) ?? network),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
