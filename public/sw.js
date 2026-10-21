const CACHE_NAME = "moveerai-shell-v2";
const MAX_CACHED_ASSETS = 80;
const APP_BASE_PATH = new URL("./", self.location.href).pathname;
const APP_SHELL = [
  APP_BASE_PATH,
  `${APP_BASE_PATH}manifest.json`,
  `${APP_BASE_PATH}favicon.svg`,
  `${APP_BASE_PATH}moveerai-icon-192.png`,
  `${APP_BASE_PATH}moveerai-icon-512.png`,
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
    event.respondWith(fetch(request).catch(() => caches.match(APP_BASE_PATH)));
    return;
  }

  if (!/\.(?:js|css|svg|png|webp|woff2?)$/i.test(url.pathname)) return;

  const cacheResponse = (response) => {
    if (response.ok) {
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, response.clone()).then(() => trimCache(cache)))
      );
    }
    return response;
  };

  // Hashed build files never change: serve them from cache. Other files (icons, logos)
  // can be replaced with the same name, so prefer the network.
  if (url.pathname.startsWith(`${APP_BASE_PATH}assets/`)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(cacheResponse)));
  } else {
    event.respondWith(fetch(request).then(cacheResponse).catch(() => caches.match(request)));
  }
});

async function trimCache(cache) {
  const keys = await cache.keys();
  const shell = new Set(APP_SHELL.map((path) => new URL(path, self.location.origin).href));
  const removable = keys.filter((key) => !shell.has(key.url));
  const excess = removable.length - MAX_CACHED_ASSETS;
  if (excess > 0) await Promise.all(removable.slice(0, excess).map((key) => cache.delete(key)));
}
