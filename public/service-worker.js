const CACHE = "meridian-nexus-v19";
const SHELL = ["/", "/styles.css?v=20260624-2", "/app.js?v=20260624-2", "/manifest.webmanifest", "/assets/brand/app-logo.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  const networkRequest = new Request(event.request, { cache: "reload" });
  event.respondWith(fetch(networkRequest).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((response) => response || caches.match("/"))));
});
