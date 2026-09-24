// Kept at this path so devices that installed the earlier version update in place.
// Never caches app pages: they contain logged-in data and must stay fresh.
const CACHE = 'prolux-crm-v2'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/logo-mark.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Also clears v1, which cached dashboard HTML.
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Assets the offline page itself needs (e.g. the logo).
  if (PRECACHE.includes(url.pathname)) {
    e.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }

  // Build assets are content-hashed, so a cached copy is never stale.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy))
      }
      return res
    })))
  }
})
