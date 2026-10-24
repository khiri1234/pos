const CACHE_NAME = 'khoory-pos-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept writes - Firestore sales/inventory calls go straight through

  const url = new URL(req.url);

  // Live Firebase/Firestore data calls must always hit the network untouched - never cache or replay these.
  if (/(^|\.)googleapis\.com$/.test(url.hostname) || /(^|\.)firebaseio\.com$/.test(url.hostname)) {
    return;
  }

  if (url.origin === location.origin) {
    // App shell (this file, index.html, manifest, icons): network-first so edits deploy promptly,
    // falling back to the cached copy (or cached index.html for a fresh navigation) when offline.
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Third-party static libraries (fonts, CDN scripts): cache-first for instant/offline loads,
  // falling back to network and caching whatever comes back.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
