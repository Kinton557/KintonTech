/* Kinton Technologies - tiny service worker. Pages are always fetched fresh (so updates show straight away);
   the last good copy is only used when the visitor is offline. Payments and the database are never cached. */
const CACHE = 'kinton-v1';
const SHELL = ['/', '/index.html', '/style.css', '/modern.css', '/404.html'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;     // Firebase, Paynow, fonts: leave alone
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (req.mode === 'navigate' || /\.(css|js|png|ico|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
