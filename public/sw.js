// Service Worker — Notion Club PWA
//
// Stratégies de cache :
//   • Assets statiques Next (`/_next/static/*`) : cache-first immutable
//     (Next versionne déjà les filenames, donc cacher pour toujours est
//     safe — le navigateur récupère un nouveau filename quand le bundle
//     change).
//   • Polices, icônes, images statiques de `/public` (`/icons/*`, *.svg,
//     *.woff2, *.otf) : cache-first.
//   • Document HTML (pages App Router) : network-first avec fallback
//     cache → permet la navigation offline minimale après une 1ʳᵉ visite.
//   • Tout le reste (API, server actions, supabase) : pass-through.
//
// Le SW met aussi en place le squelette `push` / `notificationclick` :
// les handlers sont actifs dès maintenant mais sans backend de push
// abonné, ils ne sont jamais appelés. Activer le push se fera dans une
// PR séparée (cf. roadmap PWA — section "Notifications").

const SW_VERSION = "v1";
const STATIC_CACHE = `nc-static-${SW_VERSION}`;
const DOCUMENT_CACHE = `nc-document-${SW_VERSION}`;

// Pré-cache minimal : juste l'app shell et les icônes. Les pages sont
// récupérées au runtime puis mises en cache à la volée.
const PRECACHE_URLS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DOCUMENT_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (/\.(woff2?|otf|ttf|svg|png|jpg|jpeg|webp|ico)$/i.test(url.pathname)) {
    return true;
  }
  return false;
}

function isHtmlNavigation(request, url) {
  if (request.mode === "navigate") return true;
  if (request.method !== "GET") return false;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") && url.origin === self.location.origin;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pas de cache sur les routes dynamiques sensibles.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isHtmlNavigation(request, url)) {
    event.respondWith(networkFirst(request, DOCUMENT_CACHE));
  }
});

// Permet à la page d'envoyer un message `{ type: "SKIP_WAITING" }` pour
// activer une nouvelle version du SW sans attendre que tous les onglets
// soient fermés.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Squelette pour la future PR push notifications — handlers déclarés en
// avance pour qu'iOS Safari accepte la souscription côté client une fois
// le backend prêt.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Notion Club", body: event.data.text() };
  }
  const title = payload.title || "Notion Club";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: payload.data || {},
    tag: payload.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })(),
  );
});
