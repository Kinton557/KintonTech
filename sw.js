/* Kinton Technologies - service worker. Pages are fetched fresh so updates show straight away;
   the last good copy (or offline.html) is used only when there is no connection.
   Payments and the database (other origins) are never touched. */
const CACHE = 'kinton-v3';
const SHELL = ['/', '/index.html', '/offline.html', '/style.css', '/modern.css', '/app-shell.js', '/assets/logo-mark.png', '/assets/logo-mark-light.png', '/assets/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (req.mode === 'navigate' || /\.(css|js|png|ico|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/offline.html') : undefined)))
  );
});
