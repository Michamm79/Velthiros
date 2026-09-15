/* Velthiros - offline service worker.

   The whole game is one self-contained HTML file, so "offline" only means
   holding on to that file plus the icons. Cache-first: the game never needs
   the network mid-play, and a phone on a train should not stall on a fetch.

   CACHE is rewritten by tools/build.mjs with a hash of the bundle, so every
   deploy lands in a fresh cache and the old one is dropped on activate. */
var CACHE = '__VERSION__';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* addAll is all-or-nothing, so one missing icon would sink the whole
         install; take them one at a time and let stragglers fail quietly */
      .then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        /* refresh in the background so the next launch is current */
        e.waitUntil(fetch(req).then(function (res) {
          if (res && res.ok) return caches.open(CACHE).then(function (c) { return c.put(req, res); });
        }).catch(function () {}));
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); }));
        }
        return res;
      }).catch(function () {
        /* a navigation with no cache and no network still gets the game */
        return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
      });
    })
  );
});
