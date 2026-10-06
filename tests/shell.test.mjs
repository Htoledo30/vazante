// Testes da área F (shell, ajuda, áudio, PWA, ferramentas) — Node puro, sem framework.
// Uso: node tests/shell.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'game');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`  FALHA ${name}\n        ${e?.stack?.split('\n').slice(0, 3).join('\n        ') || e}`); }
}

const CONTRACT_TOPICS = 'inicio combate partes intencoes folego defesas moral pavor corrupcao feridas icor nivel maestria expedicao luz fome peso acampar cidade chaga faccoes linhagem testes itens qualidade uncao contratos cerco'.split(' ');
const CONTRACT_SFX = 'tap deny hit hit_heavy crit sever block parry miss death enemy_death heal coin ichor step door fire camp levelup dread corrupt bell siege win lose scream bone squelch whisper'.split(' ');

console.log('F — shell / ajuda / áudio / PWA');

// ---------------- ajuda ----------------
const help = await import('../game/js/ui/help.js');
await test('HELP cobre todos os tópicos do contrato', () => {
  for (const t of CONTRACT_TOPICS) {
    assert.ok(help.HELP[t], `tópico ausente: ${t}`);
    assert.ok(help.HELP[t].title?.length > 2, `${t} sem título`);
    assert.ok(help.HELP[t].body?.length > 60, `${t} com corpo vazio`);
  }
});
await test('textos de ajuda são curtos (sem paredes de texto)', () => {
  for (const [k, t] of Object.entries(help.HELP)) {
    assert.ok(t.body.length < 1100, `${k} longo demais (${t.body.length})`);
    for (const p of t.body.split(/\n\n+/)) assert.ok(p.length < 520, `${k}: parágrafo longo`);
    if (t.tip) assert.ok(t.tip.length < 140, `${k}: dica longa`);
  }
});
await test('"veja também" aponta para tópicos existentes e grupos são válidos', () => {
  const groups = new Set(help.HELP_GROUPS.map((g) => g[0]));
  for (const [k, t] of Object.entries(help.HELP)) {
    assert.ok(groups.has(t.group), `${k}: grupo inválido ${t.group}`);
    for (const s of t.see || []) { assert.ok(help.HELP[s], `${k} -> ${s} inexistente`); assert.notEqual(s, k); }
  }
  const listed = help.topicsByGroup().flatMap((g) => g.topics);
  assert.equal(listed.length, Object.keys(help.HELP).length);
});
await test('números do DESIGN aparecem nas regras', () => {
  assert.match(help.HELP.testes.body, /35 \+ atributo × 8/);
  assert.match(help.HELP.folego.body, /6 \+ VIG/);
  assert.match(help.HELP.pavor.body, /75 Aterrorizado/);
  assert.match(help.HELP.corrupcao.body, /A cada 25/);
  assert.match(help.HELP.chaga.body, /30, 60 e 90/);
  assert.match(help.HELP.qualidade.body, /\+30%/);
  assert.match(help.HELP.nivel.body, /nível atual \+ 1/);
});
await test('hintOnce mostra uma única vez e respeita "sem dicas"', async () => {
  const save = await import('../game/js/core/save.js');
  save.saveSettings({ ...save.DEFAULT_SETTINGS, seenHelp: {} });
  assert.equal(help.hintSeen('pavor'), false);
  assert.equal(help.hintOnce('pavor'), true);
  assert.equal(help.hintOnce('pavor'), false);
  assert.equal(help.hintSeen('pavor'), true);
  assert.equal(help.hintOnce('nao_existe'), false);
  const s = save.loadSettings(); s.hints = false; save.saveSettings(s);
  assert.equal(help.hintOnce('luz'), false);
  help.resetHints();
  assert.equal(help.hintOnce('luz'), true);
});

// ---------------- áudio ----------------
const audio = await import('../game/js/ui/audio.js');
await test('áudio tem todos os sons do contrato', () => {
  for (const s of CONTRACT_SFX) assert.ok(audio.SFX_NAMES.includes(s), `som ausente: ${s}`);
  const src = readFileSync(join(GAME, 'js/ui/audio.js'), 'utf8');
  for (const s of CONTRACT_SFX) assert.ok(new RegExp(`\\b${s}: \\(`).test(src), `síntese ausente: ${s}`);
  assert.ok(!/Math\.random/.test(src), 'audio.js não deve usar Math.random');
});
await test('áudio é inerte sem contexto (Node / antes do toque)', () => {
  assert.equal(audio.playSfx('hit'), false);
  audio.configureAudio({ volume: 3, sound: false });
  assert.equal(audio.audioState().settings.volume, 1);
  assert.equal(audio.audioState().settings.sound, false);
  audio.playAmbient('city'); audio.stopAmbient();
});
await test('ambiente por tela', () => {
  assert.equal(audio.ambientForScreen('title', null), 'title');
  assert.equal(audio.ambientForScreen('combat', { combat: { context: { source: 'siege' } } }), 'siege');
  assert.equal(audio.ambientForScreen('combat', { combat: { context: { boss: true } } }), 'boss');
  assert.equal(audio.ambientForScreen('map', { expedition: { region: 'r1', light: 0 }, time: 12 }), 'dark');
  assert.equal(audio.ambientForScreen('map', { expedition: { region: 'r1', light: 5 }, time: 12 }), 'field');
  assert.equal(audio.ambientForScreen('map', { expedition: { region: 'r1', light: 5 }, time: 22 }), 'dark');
  assert.equal(audio.ambientForScreen('city', { hero: {}, campaign: {} }), 'city');
});

// ---------------- shell (lógica pura) ----------------
const shell = await import('../game/js/ui/screens/shell.js');
const state = await import('../game/js/core/state.js');
await test('shell exporta as telas do contrato', () => {
  const ids = shell.default.map((s) => s.id);
  for (const id of ['title', 'settings', 'help', 'install', 'backup', 'credits']) assert.ok(ids.includes(id), `tela ${id}`);
  for (const s of shell.default) assert.equal(typeof s.render, 'function');
  assert.equal(shell.default.find((s) => s.id === 'title').hud, false);
  assert.equal(typeof shell.openPauseMenu, 'function');
  assert.equal(typeof shell.init, 'function');
});
await test('resumeTarget escolhe a tela certa', () => {
  const all = () => true;
  const G = () => state.newCampaign({ seed: 1 });
  assert.equal(shell.resumeTarget(null, all), 'title');
  let g = G();
  assert.equal(shell.resumeTarget(g, all), 'create', 'sem herói -> create');
  g.hero = { name: 'X', hp: 30, level: 1, flags: {} };
  assert.equal(shell.resumeTarget(g, all), 'city');
  g.expedition = { region: 'r1', node: 'n1' };
  assert.equal(shell.resumeTarget(g, all), 'map');
  g.pendingLoot = { items: [], source: 'expedition' };
  assert.equal(shell.resumeTarget(g, all), 'loot');
  g.event = { id: 'e', ctx: { source: 'expedition' }, stage: 'choose' };
  assert.equal(shell.resumeTarget(g, all), 'event');
  g.combat = { id: 'c', actors: [], context: { source: 'expedition' } };
  assert.equal(shell.resumeTarget(g, all), 'combat');
  g = G(); g.lineage.heirs = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  assert.equal(shell.resumeTarget(g, all), 'heirs');
  g.campaign.ended = { type: 'fall', day: 90 };
  assert.equal(shell.resumeTarget(g, all), 'ending');
  g = G(); g.hero = { name: 'X', hp: 30, flags: { mutationPending: true } };
  assert.equal(shell.resumeTarget(g, all), 'mutation');
});
await test('resumeTarget cai em telas existentes (fallback)', () => {
  const only = (...ids) => (id) => ids.includes(id);
  const g = state.newCampaign({ seed: 2 });
  g.hero = { name: 'X', hp: 10, flags: {} };
  g.combat = { id: 'c' };
  assert.equal(shell.resumeTarget(g, only('city')), 'city');
  g.combat = null; g.expedition = { region: 'r1' };
  assert.equal(shell.resumeTarget(g, only('city')), 'city');
  assert.equal(shell.resumeTarget(g, only()), 'title');
  g.campaign.ended = { type: 'fall' };
  assert.equal(shell.resumeTarget(g, only('city')), 'title');
});
await test('campaignSummary', () => {
  const g = state.newCampaign({ seed: 3, houseName: 'Casa Teste' });
  g.time = 24 * 4 + 13; g.chaga = 37.4;
  let s = shell.campaignSummary(g);
  assert.equal(s.house, 'Casa Teste'); assert.equal(s.day, 5); assert.equal(s.hour, 13); assert.equal(s.chaga, 37);
  assert.equal(s.hero, null);
  g.hero = { name: 'Edra', level: 3 }; g.expedition = { region: 'r2' };
  s = shell.campaignSummary(g);
  assert.equal(s.hero.name, 'Edra'); assert.match(s.where, /Floresta/);
  assert.equal(shell.campaignSummary(null), null);
  g.lineage.dead.push({ name: 'Vor', cause: 'Devorado por cães', day: 3 });
  assert.equal(shell.campaignSummary(g).lastDead.name, 'Vor');
});
await test('savedAgo', () => {
  assert.equal(shell.savedAgo(1000, 0), null);
  assert.equal(shell.savedAgo(10_000, 8_000), 'agora');
  assert.equal(shell.savedAgo(40_000, 0 + 10_000), 'há 30s');
  assert.equal(shell.savedAgo(10 * 60_000 + 1, 1), 'há 10 min');
});
await test('backup: exportar → importar preserva o estado', async () => {
  const save = await import('../game/js/core/save.js');
  const g = state.newCampaign({ seed: 4, houseName: 'Casa Ãção' });
  g.hero = { name: 'Çéu', level: 2 };
  const txt = shell.wrapBackup(save.exportSave());
  assert.ok(txt.startsWith('ICOR1:'));
  const spaced = txt.slice(0, 30) + '\n  ' + txt.slice(30);
  state.setG(null);
  assert.equal(save.importSave(shell.unwrapBackup(spaced)), true);
  assert.equal(state.getG().lineage.house, 'Casa Ãção');
  assert.equal(state.getG().hero.name, 'Çéu');
  assert.equal(save.importSave(shell.unwrapBackup('ICOR1:lixo')), false);
});
await test('atualização automática após 3 adiamentos', () => {
  assert.equal(shell.shouldAutoApply(0), false);
  assert.equal(shell.shouldAutoApply(2), false);
  assert.equal(shell.shouldAutoApply(3), true);
});
await test('confirmRisky resolve sozinho quando confirmações estão desligadas', async () => {
  const save = await import('../game/js/core/save.js');
  const s = save.loadSettings(); s.confirmDanger = false; save.saveSettings(s);
  assert.equal(await shell.confirmRisky('x'), true);
  s.confirmDanger = true; save.saveSettings(s);
});

// ---------------- PWA ----------------
await test('manifest válido', () => {
  const m = JSON.parse(readFileSync(join(GAME, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'ICOR — O Deus Apodrecido');
  assert.equal(m.short_name, 'ICOR');
  assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.equal(m.id, './');
  assert.equal(m.display, 'standalone'); assert.equal(m.orientation, 'portrait');
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i); assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  const sizes = m.icons.map((i) => i.sizes);
  for (const s of ['192x192', '512x512']) assert.ok(sizes.includes(s));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/'), 'caminho relativo');
    const buf = readFileSync(join(GAME, i.src));
    assert.equal(buf.toString('latin1', 1, 4), 'PNG');
    const [w, hgt] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.equal(`${w}x${hgt}`, i.sizes, `${i.src} tamanho`);
  }
});
await test('index.html tem metas iOS, manifest e caminhos relativos', () => {
  const html = readFileSync(join(GAME, 'index.html'), 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /rel="apple-touch-icon"[^>]*href="icons\/apple-touch-icon.png"/);
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.ok(!/(href|src)="\//.test(html), 'nada de caminhos absolutos');
  const apple = readFileSync(join(GAME, 'icons/apple-touch-icon.png'));
  assert.equal(apple.readUInt32BE(16), 180);
});

const { genSW, listAssets } = await import('../tools/gen-sw.mjs');
await test('gen-sw: versão por hash, lista sem sw.js, determinístico', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'icor-sw-'));
  try {
    cpSync(GAME, tmp, { recursive: true });
    const a = genSW(tmp);
    assert.match(a.version, /^[0-9a-f]{10}$/);
    assert.ok(a.assets.includes('index.html') && a.assets.includes('js/main.js') && a.assets.includes('manifest.webmanifest'));
    assert.ok(!a.assets.includes('sw.js'));
    const sw = readFileSync(join(tmp, 'sw.js'), 'utf8');
    assert.match(sw, new RegExp(`const VERSION = '${a.version}';`));
    assert.match(sw, /'js\/ui\/screens\/shell.js',/);
    const b = genSW(tmp);
    assert.equal(a.version, b.version, 'mesmo conteúdo = mesma versão');
    assert.deepEqual(listAssets(tmp), a.assets);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  // a fonte continua em modo dev
  assert.match(readFileSync(join(GAME, 'sw.js'), 'utf8'), /const VERSION = 'dev';/);
});

/** Executa sw.js num escopo falso de service worker para testar instalação, fetch e mensagens. */
function fakeSW(src, { online = true, files = {} } = {}) {
  const listeners = {};
  const store = new Map(); // cacheName -> Map(url -> body)
  const mkRes = (body, ok = true) => ({ ok, status: ok ? 200 : 404, type: 'basic', body, clone() { return mkRes(body, ok); } });
  const net = { online, files, calls: 0 };
  const caches = {
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      const key = (r) => String(r.url || r).split('?')[0];
      return {
        async addAll(reqs) { for (const r of reqs) { const res = await self.fetch(r); if (!res.ok) throw new Error('404 ' + key(r)); m.set(key(r), res); } },
        async add(r) { const res = await self.fetch(r); if (!res.ok) throw new Error('404'); m.set(key(r), res); },
        async put(r, res) { m.set(key(r), res); },
        async match(r) { return m.get(key(r)) || undefined; },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(k) { return store.delete(k); },
    async match(r) { for (const m of store.values()) { const x = m.get(String(r.url || r).split('?')[0]); if (x) return x; } return undefined; },
  };
  const scope = 'http://localhost/icor/';
  const self = {
    registration: { scope },
    location: new URL(scope + 'sw.js'),
    addEventListener: (t, fn) => { listeners[t] = fn; },
    skipWaiting: () => { self.skipped = true; },
    clients: { claim: async () => {} },
    fetch: async (r) => {
      net.calls++;
      if (!net.online) throw new TypeError('offline');
      const u = String(r.url || r).split('?')[0];
      const path = u.replace(scope, '') || 'index.html';
      return path in net.files || u === scope ? mkRes(net.files[path] ?? 'INDEX') : mkRes('', false);
    },
  };
  class Request { constructor(url, opts = {}) { this.url = url; this.mode = opts.mode || 'cors'; this.method = 'GET'; } }
  const ctx = vm.createContext({ self, caches, Request, URL, Promise, console, fetch: self.fetch, setTimeout });
  vm.runInContext(src, ctx);
  const fire = async (type, data) => {
    let p = null, responded = null;
    const ev = { ...data, waitUntil: (x) => { p = x; }, respondWith: (x) => { responded = x; } };
    listeners[type](ev);
    if (p) await p;
    return responded ? await responded : undefined;
  };
  return { fire, store, net, self, Request };
}

await test('sw.js (produção): instala tudo, cache primeiro, offline com fallback de navegação', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'icor-sw2-'));
  try {
    cpSync(GAME, tmp, { recursive: true });
    const { version, assets } = genSW(tmp);
    const src = readFileSync(join(tmp, 'sw.js'), 'utf8');
    const files = Object.fromEntries(assets.map((a) => [a, 'conteudo:' + a]));
    const sw = fakeSW(src, { files });
    await sw.fire('install', {});
    const cache = sw.store.get('icor-' + version);
    assert.ok(cache, 'cache versionado criado');
    assert.equal(cache.size, assets.length + 1);
    // cache primeiro: mesmo offline o JS vem do cache
    sw.net.online = false;
    const r = await sw.fire('fetch', { request: new sw.Request('http://localhost/icor/js/main.js') });
    assert.equal(r.body, 'conteudo:js/main.js');
    // navegação offline para rota desconhecida -> casca
    const nav = await sw.fire('fetch', { request: new sw.Request('http://localhost/icor/qualquer', { mode: 'navigate' }) });
    assert.ok(nav && nav.ok, 'fallback de navegação');
    // mensagens
    let reply = null;
    await sw.fire('message', { data: { type: 'GET_VERSION' }, ports: [{ postMessage: (m) => { reply = m; } }] });
    assert.equal(reply.version, version);
    assert.ok(!sw.self.skipped, 'não pula a espera sozinho');
    await sw.fire('message', { data: { type: 'SKIP_WAITING' } });
    assert.ok(sw.self.skipped);
    // ativação apaga caches antigos
    sw.store.set('icor-velho', new Map());
    sw.store.set('outro-app', new Map());
    await sw.fire('activate', {});
    assert.ok(!sw.store.has('icor-velho')); assert.ok(sw.store.has('outro-app'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
await test('sw.js (dev): rede primeiro, cópia offline', async () => {
  const src = readFileSync(join(GAME, 'sw.js'), 'utf8');
  const sw = fakeSW(src, { files: { 'index.html': 'I', 'js/a.js': 'A1' } });
  await sw.fire('install', {});
  let r = await sw.fire('fetch', { request: new sw.Request('http://localhost/icor/js/a.js') });
  assert.equal(r.body, 'A1');
  sw.net.files['js/a.js'] = 'A2';
  r = await sw.fire('fetch', { request: new sw.Request('http://localhost/icor/js/a.js') });
  assert.equal(r.body, 'A2', 'rede primeiro em dev');
  await new Promise((ok) => setTimeout(ok, 5));
  sw.net.online = false;
  r = await sw.fire('fetch', { request: new sw.Request('http://localhost/icor/js/a.js') });
  assert.equal(r.body, 'A2', 'cópia offline');
});

// ---------------- servidor e build ----------------
await test('serve.mjs: prefixo, tipos, 404 e travessia', async () => {
  const { startServer } = await import('../tools/serve.mjs');
  const srv = await startServer({ root: GAME, port: 0, prefix: '/icor/', quiet: true });
  try {
    const base = `http://localhost:${srv.port}`;
    let r = await fetch(`${base}/icor/`);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
    r = await fetch(`${base}/icor/manifest.webmanifest`);
    assert.match(r.headers.get('content-type'), /manifest\+json/);
    r = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    r = await fetch(`${base}/outro/index.html`);
    assert.equal(r.status, 404);
    r = await fetch(`${base}/icor/..%2f..%2fpackage.json`);
    assert.ok(r.status === 403 || r.status === 404);
    r = await fetch(`${base}/icor/nao-existe.js`);
    assert.equal(r.status, 404);
  } finally { await srv.close(); }
});
await test('build gera dist completo', async () => {
  const { build } = await import('../tools/build.mjs');
  const out = mkdtempSync(join(tmpdir(), 'icor-dist-'));
  try {
    const r = build({ out, quiet: true });
    assert.ok(existsSync(join(out, '.nojekyll')));
    assert.ok(existsSync(join(out, 'index.html')));
    assert.ok(existsSync(join(out, 'icons/icon-512.png')));
    const sw = readFileSync(join(out, 'sw.js'), 'utf8');
    assert.match(sw, new RegExp(`const VERSION = '${r.version}';`));
    assert.equal(readFileSync(join(out, 'version.txt'), 'utf8').trim(), r.version);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

await test('check.mjs: comentários, exports e imports', async () => {
  const chk = await import('../tools/check.mjs');
  const src = `// ui/screens/*.js não abre bloco\nconst u = 'http://x//y'; /* bloco\n export function falsa() {} */\nexport function a() {}\nexport const b = 1, c = 2;\nexport { d as e, f };\nexport default [];\nexport * from './z.js';`;
  const ex = chk.exportsOf(src);
  for (const n of ['a', 'b', 'e', 'f', 'default']) assert.ok(ex.names.has(n), `export ${n}`);
  assert.ok(!ex.names.has('falsa'));
  assert.deepEqual(ex.star, ['./z.js']);
  assert.match(chk.stripComments(src), /http:\/\/x\/\/y/);
  const im = chk.importsOf(`import X, { a, b as c } from './m.js';\nimport './side.js';\nconst m = await import('./dyn.js');`);
  assert.deepEqual(im[0].names, ['default', 'a', 'b']);
  assert.ok(im.some((i) => i.spec === './side.js'));
  assert.ok(im.some((i) => i.spec === './dyn.js' && i.dynamic));
});

console.log(`\n${passed} ok, ${failed} falha(s)`);
process.exit(failed ? 1 : 0);
