// ponytail: app-shell only, network-first. Notes live in the DB behind auth,
// so there's nothing worth caching beyond "the shell still loads offline."
// Bump CACHE_NAME to invalidate old caches on the next deploy.
const CACHE_NAME = "rbnotes-shell-v1";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached ?? (event.request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});
