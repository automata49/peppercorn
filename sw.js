const BUILD_REV = 'fe2ac100c4eb'
const CACHE_NAME = `peppercorn-shell-${BUILD_REV}`
const APP_ROOT = new URL('./', self.registration.scope)

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([
    APP_ROOT.href,
    new URL('folio-b-icon-192.png?v=u1', APP_ROOT).href,
  ])))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('peppercorn-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return
  const url = new URL(event.request.url)
  if (url.origin !== APP_ROOT.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return
  event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(APP_ROOT.href, copy)))
    }
    return response
  }).catch(async () => (await caches.match(APP_ROOT.href)) || Response.error()))
})
