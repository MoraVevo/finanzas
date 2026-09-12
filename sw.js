// Service worker: la app abre instantáneo y funciona offline.
// Estrategia: red-primero para HTML/JS (evita servir mezclas de versiones al
// actualizar) con respaldo en caché si no hay red; caché-primero para lo demás.
// Al desplegar cambios, bump de CACHE para limpiar entradas viejas.
const CACHE = 'finanzas-v16';
const NUCLEO = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './vendor/dexie.min.js',
  './vendor/preact-standalone.module.js',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const esDinamico = url =>
  url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css') ||
  url.pathname === '/' || url.pathname.endsWith('/');

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    (esDinamico(url)
      ? fetch(e.request)
          .then(res => {
            if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          })
          .catch(() => caches.match(e.request, { ignoreSearch: true }))
      : caches.match(e.request, { ignoreSearch: true }).then(hit => {
          const net = fetch(e.request).then(res => {
            if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          }).catch(() => hit);
          return hit || net;
        })
    ).then(res => res || caches.match('./index.html'))
  );
});
