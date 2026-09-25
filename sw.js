// 최소 서비스워커: 화면 파일만 캐시, 데이터(API)는 항상 네트워크
const C = 'peppercorn-v2', FILES = ['./', 'index.html', 'logo.webp', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;                  // Apps Script 데이터는 캐시 안 함
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request)));
});
