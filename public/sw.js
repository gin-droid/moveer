const CACHE_NAME = "moveerai-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/moveerai-icon-192.png",
  "/moveerai-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("moveerai-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (!/\.(?:js|css|svg|png|woff2?)$/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        );
      }
      return response;
    }))
  );
});