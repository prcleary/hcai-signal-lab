// service-worker.js
//
// Offline support for HCAI Signal Lab. Uses a versioned cache and a
// cache-first strategy for the small, fixed list of app assets. Bump
// CACHE_VERSION on any release that changes an asset; the activate
// step removes older caches automatically.
//
// The registration in index.html only fires under http(s) origins, so
// this file is never used when the app is opened via file:// (which is
// already offline by definition).

const CACHE_VERSION = "v1-2026-07-22";
const CACHE_NAME = `hcai-signal-lab-${CACHE_VERSION}`;

// Explicit list of every asset the app needs to run. Keep this list in
// step with the files served from the site root.
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./css/app.css",
  "./js/app.js",
  "./js/chart.js",
  "./js/export.js",
  "./js/generator.js",
  "./js/statistics.js",
  "./js/storage.js",
  "./js/templates.js",
  "./js/tips.js",
  "./js/topics.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  // Only handle same-origin GETs. Anything else (POSTs, cross-origin
  // requests) bypasses the cache and goes straight to the network so
  // we do not accidentally interfere with future integrations.
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // Cache successful basic responses so future navigations
          // work offline even if the browser evicted the initial
          // pre-cache entry.
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Navigation fallback: when offline and requesting a page
          // that was not pre-cached, hand back the app shell so the
          // learner sees the UI instead of a browser error page.
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          throw new Error("Offline and resource not cached");
        });
    })
  );
});
