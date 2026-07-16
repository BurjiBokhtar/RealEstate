// Minimal service worker: exists so the browser offers "Install app".
//
// Deliberately does NOT cache pages or API responses. This is a CRM where
// people take money: a cached balance, an out-of-date payment schedule or a
// stale apartment status is worse than no offline mode at all -- staff would
// be looking at numbers that quietly disagree with the database. So every
// request goes to the network, exactly as it would without a worker.
//
// Chrome requires a fetch handler for the install prompt, hence the
// pass-through below; the only thing we keep is our own icon set, which is
// immutable and safe to serve from cache.

const ICON_CACHE = "crm-icons-v1";
const ICONS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ICON_CACHE).then((c) => c.addAll(ICONS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== ICON_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && ICONS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }
  // Everything else: straight to the network, no cache, no interception.
});
