/* Cache-first service worker. The build replaces __CACHE_VERSION__. */
const CACHE = "field-apps-__CACHE_VERSION__";
const ASSETS = __ASSET_LIST__;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.filter((path) => path !== "./"));
    const home = await cache.match("./index.html");
    if (home) await cache.put("./", home.clone());
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch (error) {
      if (request.mode === "navigate") {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Promise.reject(error);
      }
      throw error;
    }
  })());
});
