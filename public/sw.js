// BigWealth service worker: caches the app shell so the installed app opens
// offline. It never caches API responses — those live on another origin and
// money data must not be served stale.
const CACHE = 'bigwealth-shell-v1'
// The app's root URL (works under the GitHub Pages sub-path too).
const SHELL = self.registration.scope

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  // Page loads: prefer the network so a new deploy shows up immediately; fall
  // back to the cached shell when offline (the SPA router handles the path).
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        try {
          const response = await fetch(request)
          if (response.ok) cache.put(SHELL, response.clone())
          return response
        } catch {
          return (await cache.match(SHELL)) ?? Response.error()
        }
      })(),
    )
    return
  }

  // Static files (hashed bundles, icons): serve from cache, refresh in the
  // background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached ?? Response.error())
      return cached ?? refresh
    })(),
  )
})
