// Service worker do ICOR — cache offline versionado com atualização segura.
//
// VERSION e ASSETS são gerados por tools/gen-sw.mjs durante o build (dist/sw.js).
// Em desenvolvimento (game/ servido direto) VERSION = 'dev': rede primeiro, cache só como reserva offline.
//
// Atualização segura:
//   - uma versão nova instala e ESPERA (nada de skipWaiting automático);
//   - o jogo mostra "Nova versão pronta" no título/menu e, quando o jogador está num lugar seguro
//     (título, depois de salvar), envia {type:'SKIP_WAITING'}; a página recarrega no 'controllerchange'.
//   - o jogo pode perguntar a versão: {type:'GET_VERSION'} -> responde {type:'VERSION', version}.
const VERSION = 'dev';
const ASSETS = [];
const PREFIX = 'icor-';
const CACHE = PREFIX + VERSION;
const DEV = VERSION === 'dev';

const scoped = (p) => new URL(p, self.registration.scope).toString();

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (DEV) {
      // best-effort: só a casca, o resto entra no cache conforme é usado
      await Promise.allSettled(['./', 'index.html'].map((p) => cache.add(new Request(scoped(p), { cache: 'reload' }))));
      return;
    }
    // produção: tudo ou nada (uma versão pela metade nunca deve assumir o controle)
    const urls = ['./', ...ASSETS].map(scoped);
    await cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'GET_VERSION') {
    const msg = { type: 'VERSION', version: VERSION, assets: ASSETS.length };
    if (event.ports && event.ports[0]) event.ports[0].postMessage(msg);
    else if (event.source) event.source.postMessage(msg);
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  return (await cache.match(req, { ignoreSearch: true })) || null;
}

async function shell() {
  const cache = await caches.open(CACHE);
  return (await cache.match(scoped('./'))) || (await cache.match(scoped('index.html'))) || null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const isNav = req.mode === 'navigate';

  if (DEV) {
    // rede primeiro; guarda cópia para jogar offline depois
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok && net.type === 'basic') {
          const copy = net.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return net;
      } catch (e) {
        const hit = await fromCache(req);
        if (hit) return hit;
        if (isNav) { const s = await shell(); if (s) return s; }
        throw e;
      }
    })());
    return;
  }

  // produção: cache da versão primeiro (consistência), rede como reserva
  event.respondWith((async () => {
    const hit = await fromCache(req);
    if (hit) return hit;
    if (isNav) {
      const s = await shell();
      try {
        const net = await fetch(req);
        if (net && net.ok) return net;
        return s || net;
      } catch (e) {
        if (s) return s;
        throw e;
      }
    }
    try {
      const net = await fetch(req);
      if (net && net.ok && net.type === 'basic') {
        const copy = net.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return net;
    } catch (e) {
      const any = await caches.match(req, { ignoreSearch: true });
      if (any) return any;
      throw e;
    }
  })());
});
