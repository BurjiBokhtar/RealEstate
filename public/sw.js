// Service worker: keeps the app OPENING and NAVIGATING offline, without ever
// caching money data.
//
// What is cached (all same-origin, all safe):
//  - Next.js build assets under /_next/static/* -- content-hashed and
//    immutable, so a cached copy is never stale.
//  - Page shells (navigation requests) -- network-first, falling back to a
//    cached shell only when offline, so the app loads instead of showing the
//    browser's dead-dinosaur page.
//
// What is NEVER touched:
//  - Supabase (a different origin) -- every data read/write goes straight to
//    the network. Balances, schedules and statuses are never served from a
//    cache, so you never look at numbers that quietly disagree with the
//    database, and nothing user-specific is stored on a shared machine.
//
// Bump CACHE_VERSION to force old clients to refresh their cached shell.

const CACHE_VERSION = "crm-v2";
const ICONS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ICONS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only our own origin. Supabase and any other host go straight to network.
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache-first (fast, and available offline).
  if (url.pathname.startsWith("/_next/static/") || ICONS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Page navigations: network-first, fall back to the last cached shell when
  // offline so the app still opens.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/");
        })
    );
    return;
  }
  // Everything else: network, no interception.
});
