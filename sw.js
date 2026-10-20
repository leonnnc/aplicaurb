/* Service worker · URB San Lucas
   Permite instalar la app y abrirla sin conexión. */
const CACHE = 'urb-2.4.2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css?v=29',
  './assets/js/data.js?v=29',
  './assets/js/core.js?v=29',
  './assets/js/camera.js?v=29',
  './assets/js/views-panel.js?v=29',
  './assets/js/views-map.js?v=29',
  './assets/js/views-access.js?v=29',
  './assets/js/views-records.js?v=29',
  './assets/js/views-reports.js?v=29',
  './assets/js/app.js?v=29',
  './assets/img/urb-splash.jpg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/hero.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Navegación: red primero, respaldo en caché
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Recursos: caché primero y actualización en segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
