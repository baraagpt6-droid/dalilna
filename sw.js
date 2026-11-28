const CACHE_PREFIX = "dalilna-pwa-";
const CACHE_NAME = CACHE_PREFIX + "v3.1.0-merchant-profile2";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./app-native-bridge.js?v=3.1.0", "./app-update.js?v=3.1.0-store-safe1", "./market-price-guide.js?v=3.1.0", "./market-price-guide.css?v=3.1.0", "./market_prices_yemen.json", "./regions-yemen.js", "./regions-profiles.js", "./regional-catalog-runtime.js", "./marketplace-client.js", "./profile-manager.js?v=3.1.0-merchant-profile2", "./features-2.1.js?v=3.1.0", "./features-2.1.css?v=3.1.0", "./v3.0.0.js?v=3.1.0-profile-identity1", "./v3.0.0.css?v=3.1.0-profile-polish1", "./jobs-feed.json", "./version.json", "./market_items.json", "./regional-catalog/manifest.json?v=3.1.0", "./privacy.html", "./terms.html", "./icons/icon.svg", "./market-price-images/solar-panel.svg", "./market-price-images/solar-inverter.svg", "./market-price-images/solar-battery.svg", "./market-price-images/gel-battery.svg", "./market-price-images/phone-samsung.svg", "./market-price-images/phone-xiaomi.svg", "./market-price-images/phone-iphone.svg", "./market-price-images/vehicle-hilux.svg", "./market-price-images/property-apartment.svg", "./market-price-images/property-shop.svg", "./market-price-images/laptop.svg"];

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
    || url.pathname.endsWith("/profile-manager.js")
    || url.pathname.endsWith("/features-2.1.js")
    || url.pathname.endsWith("/v3.0.0.js")
    || url.pathname.endsWith("/v3.0.0.css")
    || url.pathname.endsWith("/app-update.js")
    || url.pathname.endsWith("/market_prices_yemen.json")
    || url.pathname.endsWith("/version.json")
    || url.pathname.endsWith("/jobs-feed.json");
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
