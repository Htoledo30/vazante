// Service worker do Vazante: cache offline versionado.
// VERSION e ASSETS são gerados por tools/gen-sw.mjs (npm run build).
const VERSION = 'e8a9722287';
const ASSETS = [
  './',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/combat/ai.js',
  'js/combat/attacks.js',
  'js/combat/engine.js',
  'js/combat/flow.js',
  'js/combat/registry.js',
  'js/core/rng.js',
  'js/core/save.js',
  'js/core/util.js',
  'js/data/classes.js',
  'js/data/enemies.js',
  'js/data/events.js',
  'js/data/hub.js',
  'js/data/index.js',
  'js/data/items.js',
  'js/data/maps.js',
  'js/data/skilllib.js',
  'js/data/skills.js',
  'js/data/statuses.js',
  'js/data/story.js',
  'js/main.js',
  'js/run/hero.js',
  'js/run/meta.js',
  'js/run/ops.js',
  'js/run/run.js',
  'js/ui/app.js',
  'js/ui/audio.js',
  'js/ui/board.js',
  'js/ui/combatui.js',
  'js/ui/dom.js',
  'js/ui/help.js',
  'js/ui/screens.js',
  'js/ui/sprites.js',
  'manifest.webmanifest',
];
const CACHE = 'vazante-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls = ASSETS.map((a) => new URL(a, self.registration.scope).toString());
    await cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('vazante-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match(new URL('./', self.registration.scope).toString());
      try {
        const net = await fetch(req);
        return net;
      } catch (e) {
        if (shell) return shell;
        throw e;
      }
    }
    try {
      const net = await fetch(req);
      if (net && net.ok && url.pathname.startsWith(new URL(self.registration.scope).pathname)) cache.put(req, net.clone());
      return net;
    } catch (e) {
      const any = await caches.match(req, { ignoreSearch: true });
      if (any) return any;
      throw e;
    }
  })());
});
