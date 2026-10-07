// Keeps the app working offline. Bump VERSION whenever you upload a changed file.
const VERSION = "rightnote-v32";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "data/cities.json",
  // note photos, so every note shows offline
  "img/vnd/1000-back.jpg", "img/vnd/1000-front.jpg", "img/vnd/2000-back.jpg", "img/vnd/2000-front.jpg", "img/vnd/5000-back.jpg", "img/vnd/5000-front.jpg", "img/vnd/10000-back.jpg", "img/vnd/10000-front.jpg", "img/vnd/20000-back.jpg", "img/vnd/20000-front.jpg", "img/vnd/50000-back.jpg", "img/vnd/50000-front.jpg", "img/vnd/100000-back.jpg", "img/vnd/100000-front.jpg", "img/vnd/200000-back.jpg", "img/vnd/200000-front.jpg", "img/vnd/500000-back.jpg", "img/vnd/500000-front.jpg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// "rightnote-photos" holds city photos saved by the page; it survives updates
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "rightnote-photos").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // rate lookups go straight to the network
  // Network first so updates arrive when online; fall back to the saved copy offline
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
