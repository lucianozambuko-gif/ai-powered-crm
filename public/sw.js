// Minimal service worker: makes Cloud CRM installable. CRM data always comes
// fresh from the network; only the offline fallback page is cached.
const CACHE = "cloud-crm-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      c.put("/offline", new Response(
        "<!doctype html><meta name=viewport content='width=device-width'><body style='background:#0b1020;color:#e8ecf6;font-family:system-ui;padding:40px;text-align:center'><h2>You're offline</h2><p>Cloud CRM needs a connection. It will work again once you're back online.</p>",
        { headers: { "Content-Type": "text/html" } },
      )),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
  }
});
