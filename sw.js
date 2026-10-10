/* Офлайн: оболочка приложения и данные — из кэша; картинки кэшируются по мере просмотра. */
const VERSION = '9484f466';
const SHELL = `dlt-shell-${VERSION}`;
const IMAGES = 'dlt-img-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data/data.js', 'data/numbers.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('dlt-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // своё: сначала кэш, в фоне обновляем
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.destination === 'image') {
    // картинки с safedrivedlt / testdrivinglicence: кэш, иначе сеть
    e.respondWith(caches.open(IMAGES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') c.put(req, r.clone()).catch(() => {});
        return r;
      } catch (err) {
        return Response.error();
      }
    }));
  }
});
