const CACHE_PREFIX = "dalilna-pwa-";
const CACHE_NAME = CACHE_PREFIX + "v2.1.8";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./regions-yemen.js", "./regions-profiles.js", "./regional-catalog-runtime.js", "./marketplace-client.js", "./features-2.1.js?v=2.1.8", "./features-2.1.css?v=2.1.8", "./jobs-feed.json", "./regional-catalog/manifest.json?v=2.1.8", "./privacy.html", "./terms.html", "./icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Do not cache dynamic API GET responses. In particular, never store account/session data.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for mutable catalogue JSON and critical UI assets.
  const freshnessSensitive = url.pathname.includes("/regional-catalog/")
    || url.pathname.endsWith("/features-2.1.css")
    || url.pathname.endsWith("/features-2.1.js");
  if (freshnessSensitive) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok && response.type !== "opaque") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== "opaque") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
