const CACHE = "nexora-pwa-v1";

const BASE = new URL("./", self.location.href);

const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
].map(path => new URL(path, BASE).href);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(FILES);
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(name =>
            name.startsWith("nexora-pwa-") && name !== CACHE
          )
          .map(name => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo guardamos archivos propios dentro de NEXORA.
  // Las fotos y los videos externos seguirán necesitando internet.
  if (
    request.method !== "GET" ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname)
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      try {
        // Primero buscamos una versión actualizada en internet.
        const response = await fetch(request);

        if (response.ok) {
          try {
            await cache.put(request, response.clone());
          } catch {
            // Si el almacenamiento está lleno, seguimos en línea.
          }
        }

        return response;
      } catch {
        // Sin internet, usamos la copia guardada.
        const saved = await cache.match(request);
        if (saved) return saved;

        if (request.mode === "navigate") {
          const home = await cache.match(
            new URL("./index.html", BASE).href
          );

          if (home) return home;
        }

        return new Response("Contenido no disponible sin conexión.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })()
  );
});
