/* Офлайн: при установке сохраняет приложение, данные и ВСЕ картинки (img/, список — data/images.json). */
const VERSION = '40b289fa';
const SHELL = `dlt-shell-${VERSION}`;
const IMAGES = 'dlt-img-v2';          // картинки не меняются — кэш переживает обновления
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data/data.js', 'data/numbers.js', 'data/guide.js', 'data/images.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

async function cacheImages() {
  const list = await (await fetch('data/images.json', { cache: 'no-cache' })).json();
  const c = await caches.open(IMAGES);
  const have = new Set((await c.keys()).map(r => new URL(r.url).pathname));
  const base = new URL('./', self.registration.scope).pathname;
  const missing = list.filter(p => !have.has(base + p));
  // пачками по 20, чтобы не забивать сеть
  for (let i = 0; i < missing.length; i += 20) await c.addAll(missing.slice(i, i + 20));
  // убрать картинки, которых больше нет в данных
  const keep = new Set(list.map(p => base + p));
  await Promise.all((await c.keys()).filter(r => !keep.has(new URL(r.url).pathname)).map(r => c.delete(r)));
}

self.addEventListener('install', e => {
  // картинки не должны ломать установку: если что-то не скачалось, докачаем позже
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))
    .then(() => cacheImages().then(() => 'images-cached', () => 'images-failed'))
    .then(msg => self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage(msg))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('dlt-shell-') && k !== SHELL) || k === 'dlt-img-v1').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// страница может попросить докачать картинки (кнопка «Проверить офлайн»)
self.addEventListener('message', e => {
  if (e.data === 'cache-images') e.waitUntil(cacheImages().then(() => e.source && e.source.postMessage('images-cached')).catch(() => e.source && e.source.postMessage('images-failed')));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/img/')) {
    // картинки: только кэш, иначе сеть (и сохранить)
    e.respondWith(caches.open(IMAGES).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // приложение и данные: сначала кэш, в фоне обновляем
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
