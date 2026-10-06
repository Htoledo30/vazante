// Teste ponta a ponta no WebKit com perfil de iPhone (Playwright), servindo o jogo numa SUBPASTA (/icor/)
// como no GitHub Pages. Cada verificação reporta PASS / FAIL / SKIP com motivo (tolerante: telas de
// outras áreas que ainda não existem viram SKIP, não quebram o resto).
//
// Uso:
//   node tests/e2e.mjs                 # build + serve dist/ em /icor/
//   node tests/e2e.mjs --dev           # serve game/ direto (sem build; SW em modo dev)
//   node tests/e2e.mjs --headed        # abre a janela do navegador
//   node tests/e2e.mjs --no-update     # pula o teste de atualização do service worker
//   SHOT_DIR=pasta node tests/e2e.mjs  # onde salvar screenshots (padrão tests/shots)
// Sai com código 1 se houver FAIL.
import { mkdirSync, mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DEV = args.includes('--dev');
const HEADED = args.includes('--headed');
const NO_UPDATE = args.includes('--no-update');
const SHOTS = process.env.SHOT_DIR || join(ROOT, 'tests', 'shots');
const PREFIX = '/icor/';
mkdirSync(SHOTS, { recursive: true });

// ---------------- relatório ----------------
const results = [];
const SKIP = (why) => ({ __skip: true, why });
const ICON = { PASS: '✔', FAIL: '✘', SKIP: '○' };
function report(name, status, info = '') {
  results.push({ name, status, info });
  console.log(`${ICON[status]} ${status.padEnd(4)} ${name}${info ? ' — ' + info : ''}`);
}
async function check(name, fn) {
  try {
    const r = await fn();
    if (r && r.__skip) report(name, 'SKIP', r.why);
    else if (r === false) report(name, 'FAIL');
    else report(name, 'PASS', typeof r === 'string' ? r : '');
    return r;
  } catch (e) {
    report(name, 'FAIL', String(e?.message || e).split('\n')[0].slice(0, 300));
    return false;
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'condição falsa'); };

// ---------------- servidor ----------------
let playwright;
try { playwright = await import('playwright'); } catch (e) {
  console.error('Playwright não encontrado. Rode: npm install && npx playwright install webkit');
  process.exit(1);
}
const { webkit, devices } = playwright;
const { startServer } = await import('../tools/serve.mjs');

let siteDir = join(ROOT, 'game');
let tmpSite = null;
if (!DEV) {
  const { build } = await import('../tools/build.mjs');
  // build numa pasta temporária (permite simular uma versão nova sem tocar em dist/)
  tmpSite = mkdtempSync(join(tmpdir(), 'icor-e2e-'));
  const r = build({ out: tmpSite, quiet: true });
  siteDir = tmpSite;
  console.log(`build ${r.version} (${r.count} arquivos) em ${tmpSite}`);
}
let srv = await startServer({ root: siteDir, port: 0, prefix: PREFIX, quiet: true });
const BASE = `http://localhost:${srv.port}${PREFIX}`;
console.log(`servindo ${DEV ? 'game/' : 'build'} em ${BASE}\n`);

const deviceName = devices['iPhone 13'] ? 'iPhone 13' : Object.keys(devices).find((d) => /iPhone 1[3-5]/.test(d));
const browser = await webkit.launch({ headless: !HEADED });
const context = await browser.newContext({ ...devices[deviceName], serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
const missing = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource/i.test(t)) return; // tratado em 'response'
  errors.push(`console: ${t}`);
});
page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(`${r.status()} ${r.url().slice(BASE.length)}`); });

// ---------------- helpers ----------------
const screenId = () => page.evaluate(() => document.querySelector('#app')?.dataset.screen || null);
async function waitScreen(id, timeout = 6000) {
  const ids = [].concat(id);
  await page.waitForFunction((ids) => ids.includes(document.querySelector('#app')?.dataset.screen), ids, { timeout });
  return screenId();
}
const hasScreen = (id) => page.evaluate((id) => !!window.__ICOR__?.hasScreen(id), id);
const G = () => page.evaluate(() => { const g = window.__ICOR__?.getG(); return g ? JSON.parse(JSON.stringify(g)) : null; });
async function shot(name) { try { await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } catch { /* ignore */ } }

/** Toca no botão cujo rótulo contém o texto (prioriza dock e camadas abertas). */
async function tap(text, { within = null, exact = false, timeout = 3000 } = {}) {
  const scope = within ? page.locator(within) : page;
  const loc = scope.locator('button', exact ? { hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) } : { hasText: text });
  const layer = page.locator('.layer button', { hasText: text });
  const target = (await layer.count()) ? layer.first() : loc.first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
  await page.waitForTimeout(220); // guarda de toque duplo (180ms) do dom.js
}
/** Fecha dicas/folhas abertas. */
async function dismissLayers(max = 6) {
  for (let i = 0; i < max; i++) {
    const n = await page.locator('.layer .modal-back').count();
    if (!n) return;
    const ok = page.locator('.layer .modal-back').last().locator('button', { hasText: /Entendi|Continuar|OK|Fechar/ });
    if (await ok.count()) await ok.first().click().catch(() => {});
    else await page.locator('.layer .modal-back').last().locator('button[aria-label="Fechar"]').first().click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
/** Avança por telas desconhecidas tocando o botão principal do dock até chegar no alvo. */
async function advanceTo(targets, maxSteps = 25) {
  targets = [].concat(targets);
  const path = [];
  for (let i = 0; i < maxSteps; i++) {
    await dismissLayers();
    const cur = await screenId();
    if (path[path.length - 1] !== cur) path.push(cur);
    if (targets.includes(cur)) return { ok: true, path };
    // preenche campos de texto vazios (nome do herói etc.)
    for (const inp of await page.locator('main input[type=text], main input:not([type]), footer input').all()) {
      if (!(await inp.inputValue().catch(() => 'x'))) await inp.fill('Teste').catch(() => {});
    }
    const cands = page.locator('footer.dock button.btn:not(.is-disabled)');
    const n = await cands.count();
    let clicked = false;
    // prioridade: primário/sangue, evitando Voltar/Menu
    for (const pref of ['.btn-primary', '.btn-blood', '']) {
      for (let k = n - 1; k >= 0 && !clicked; k--) {
        const b = cands.nth(k);
        const cls = (await b.getAttribute('class')) || '';
        const label = (await b.innerText()).trim();
        if (/Voltar|Menu|Sair/i.test(label)) continue;
        if (pref && !cls.includes(pref.slice(1))) continue;
        await b.click().catch(() => {});
        clicked = true;
      }
      if (clicked) break;
    }
    if (!clicked) {
      // sem dock útil: tenta um botão principal na tela
      const mb = page.locator('main button.btn-primary:not(.is-disabled), main button.btn-blood:not(.is-disabled)');
      if (await mb.count()) { await mb.first().click().catch(() => {}); clicked = true; }
    }
    if (!clicked) return { ok: false, path, why: `sem botão para avançar em "${cur}"` };
    await page.waitForTimeout(300);
  }
  return { ok: false, path, why: 'passos esgotados' };
}
async function layoutIssues() {
  return page.evaluate(() => {
    const out = { hscroll: false, small: [] };
    const de = document.documentElement;
    const main = document.querySelector('main.screen');
    out.hscroll = de.scrollWidth > window.innerWidth + 1 || (main && main.scrollWidth > main.clientWidth + 1);
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const min = b.classList.contains('btn-small') || b.classList.contains('sh-help-btn') || b.classList.contains('tab') ? 36 : 44;
      if (r.height < min - 0.5 || r.width < Math.min(min, 36) - 0.5) out.small.push(`${(b.innerText || b.getAttribute('aria-label') || '?').trim().slice(0, 24)} (${Math.round(r.width)}×${Math.round(r.height)})`);
      if (r.right > window.innerWidth + 1) out.hscroll = true;
    }
    return out;
  });
}

// =====================================================================
// 1. carga, metadados, PWA
// =====================================================================
await check('Título carrega na subpasta /icor/', async () => {
  await page.goto(BASE, { waitUntil: 'load' });
  await waitScreen('title', 10000);
  await shot('01-titulo');
  return `dispositivo ${deviceName}`;
});
await check('Logotipo e menu do título', async () => {
  const txt = await page.locator('main').innerText();
  assert(/ICOR/.test(txt), 'logotipo ausente');
  assert(await page.locator('footer.dock button', { hasText: 'Nova campanha' }).count(), 'botão Nova campanha ausente');
  for (const l of ['Como jogar', 'Configurações', 'Backup']) assert(await page.locator('main button', { hasText: l }).count(), `botão ${l} ausente`);
});
let onlineFailed = [];
await check('Módulos de todas as áreas carregaram', async () => {
  const rep = await page.evaluate(() => window.__ICOR_BOOT__ || null);
  if (!rep) return SKIP('main.js sem relatório de boot');
  onlineFailed = rep.failed.map((f) => f.name);
  if (rep.failed.length) throw new Error(`falharam: ${rep.failed.map((f) => `${f.name} (${f.error.slice(0, 80)})`).join('; ')}`);
  return rep.loaded.join(', ');
});
await check('Metas iOS (viewport-fit, apple-touch-icon, standalone)', async () => {
  const m = await page.evaluate(() => ({
    vp: document.querySelector('meta[name=viewport]')?.content || '',
    apple: !!document.querySelector('meta[name=apple-mobile-web-app-capable]'),
    touch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
  }));
  assert(m.vp.includes('viewport-fit=cover'), 'viewport sem viewport-fit=cover');
  assert(m.apple, 'falta apple-mobile-web-app-capable');
  const r = await page.request.get(new URL(m.touch, BASE).toString());
  assert(r.ok(), 'apple-touch-icon inacessível');
});
await check('Manifest válido e ícones acessíveis', async () => {
  const href = await page.evaluate(() => document.querySelector('link[rel=manifest]').href);
  const r = await page.request.get(href);
  assert(r.ok(), 'manifest 404');
  const m = await r.json();
  assert(m.display === 'standalone' && m.start_url === './' && m.scope === './', 'display/start_url/scope');
  for (const i of m.icons) assert((await page.request.get(new URL(i.src, href).toString())).ok(), `ícone ${i.src}`);
  return `${m.short_name}, ${m.icons.length} ícones`;
});
let swOk = false;
await check('Service worker ativo no escopo /icor/', async () => {
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { unsupported: true };
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    return reg ? { scope: reg.scope, active: !!reg.active } : { timeout: true };
  });
  if (sw.unsupported) return SKIP('WebKit desta plataforma sem service worker');
  if (sw.timeout) return SKIP('service worker não ficou pronto em 8s (WebKit/Windows pode não suportar)');
  assert(sw.active && sw.scope.endsWith(PREFIX), `escopo ${sw.scope}`);
  swOk = true;
  return sw.scope;
});
await check('Sem rolagem horizontal e botões ≥ 44px no título', async () => {
  const L = await layoutIssues();
  assert(!L.hscroll, 'há rolagem horizontal');
  assert(!L.small.length, `botões pequenos: ${L.small.join(', ')}`);
});

// =====================================================================
// 2. telas do shell
// =====================================================================
for (const [label, id, shotName] of [['Como jogar', 'help', '02-ajuda'], ['Configurações', 'settings', '03-config'], ['Backup', 'backup', '05-backup']]) {
  await check(`Tela ${id} abre e volta`, async () => {
    await tap(label, { within: 'main' });
    await waitScreen(id);
    await shot(shotName);
    const L = await layoutIssues();
    assert(!L.hscroll, 'rolagem horizontal');
    assert(!L.small.length, `botões pequenos: ${L.small.join(', ')}`);
    if (id === 'help') {
      await tap('Fôlego');
      await page.waitForFunction(() => /Fôlego/.test(document.querySelector('main')?.innerText || ''));
      await shot('02b-ajuda-topico');
      await tap('Tópicos');
    }
    await tap('Voltar', { within: 'footer' });
    await waitScreen('title');
  });
}
await check('Tela install abre (detecta modo navegador)', async () => {
  await tap('Instalar', { within: 'main' }).catch(() => tap('Modo app', { within: 'main' }));
  await waitScreen('install');
  const txt = await page.locator('main').innerText();
  assert(/Compartilhar/.test(txt) || /modo app/i.test(txt), 'instruções ausentes');
  await shot('04-instalar');
  await tap('Voltar', { within: 'footer' });
  await waitScreen('title');
});
await check('Configurações persistem (volume)', async () => {
  await tap('Configurações', { within: 'main' });
  await waitScreen('settings');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('icor.settings') || '{}').volume ?? 0.7);
  await page.locator('button[aria-label="Diminuir volume"]').click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('icor.settings') || '{}').volume);
  assert(Math.abs(after - (before - 0.1)) < 0.01, `volume ${before} -> ${after}`);
  await page.locator('button[aria-label="Aumentar volume"]').click();
  await tap('Voltar', { within: 'footer' });
  await waitScreen('title');
});

// =====================================================================
// 3. fluxo de campanha
// =====================================================================
let heroName = null;
await check('Nova campanha → intro/criação', async () => {
  await tap('Nova campanha', { within: 'footer' });
  await page.waitForTimeout(300);
  if (await page.locator('.layer button', { hasText: 'Apagar e começar' }).count()) await tap('Apagar e começar');
  const g = await G();
  assert(g && g.v && g.city, 'G não foi criado');
  const cur = await screenId();
  if (cur === 'title') return SKIP('telas intro/create ainda não existem (área D/A)');
  await shot('06-intro');
  return `foi para "${cur}"`;
});
await check('Intro → criação de personagem', async () => {
  if (!(await hasScreen('create'))) return SKIP('tela create (área A) inexistente');
  const r = await advanceTo('create', 12);
  if (!r.ok) throw new Error(`${r.why}; caminho ${r.path.join(' → ')}`);
  await shot('07-criacao');
  const L = await layoutIssues();
  assert(!L.hscroll, 'rolagem horizontal na criação');
  return r.path.join(' → ');
});
await check('Criação → cidade', async () => {
  if (!(await hasScreen('create')) || !(await hasScreen('city'))) return SKIP('telas create/city ainda não existem');
  if ((await screenId()) !== 'create') return SKIP('não chegou na criação');
  const r = await advanceTo('city', 30);
  if (!r.ok) throw new Error(`${r.why}; caminho ${r.path.join(' → ')}`);
  const g = await G();
  assert(g.hero, 'herói não criado');
  heroName = g.hero.name;
  await shot('08-cidade');
  const L = await layoutIssues();
  assert(!L.hscroll, 'rolagem horizontal na cidade');
  return `${heroName} em Valdrem; ${L.small.length ? 'botões pequenos: ' + L.small.slice(0, 5).join(', ') : 'botões OK'}`;
});
await check('Menu de pausa abre e "Salvar e sair" volta ao título', async () => {
  const g = await G();
  if (!g) return SKIP('sem campanha');
  if ((await screenId()) === 'title') return SKIP('jogo ainda não sai do título');
  const hudBtn = page.locator('header.hud button', { hasText: /Menu|☰/ });
  // botões ignoram toques nos primeiros ~180 ms após renderizar (anti-toque-duplo): tenta de novo
  for (let i = 0; i < 3 && !(await page.locator('.sh-pause').count()); i++) {
    if (await hudBtn.count()) await hudBtn.first().click();
    else await page.evaluate(() => window.__ICOR__.openPauseMenu());
    await page.waitForTimeout(400);
  }
  await page.locator('.sh-pause').waitFor({ timeout: 3000 });
  await shot('09-pausa');
  await tap('Salvar e sair');
  await waitScreen('title');
  return (await hudBtn.count()) ? 'via botão do HUD' : 'via API (HUD sem botão Menu)';
});
await check('Recarregar preserva o progresso (Continuar)', async () => {
  const before = await G();
  if (!before) return SKIP('sem campanha');
  await page.reload({ waitUntil: 'load' });
  await waitScreen('title', 10000);
  const btn = page.locator('footer.dock button', { hasText: /Continuar|Ver o fim/ });
  assert(await btn.count(), 'botão Continuar ausente após recarregar');
  const after = await G();
  assert(after && after.seed === before.seed && after.time === before.time, 'estado diferente após recarregar');
  if (before.hero) assert(after.hero?.name === before.hero.name, 'herói diferente');
  const expected = await page.evaluate(() => window.__ICOR__.resumeTarget());
  if (expected === 'title') return SKIP('progresso salvo OK, mas nenhuma tela de jogo existe para retomar');
  await btn.first().click();
  await page.waitForTimeout(400);
  const cur = await screenId();
  assert(cur === expected, `continuou em ${cur}, esperado ${expected}`);
  return `retomou em "${cur}"`;
});
await check('Backup exporta texto ICOR1:', async () => {
  if (!(await G())) return SKIP('sem campanha');
  await page.evaluate(() => { window.__ICOR__.go('backup'); });
  await waitScreen('backup');
  const v = await page.locator('textarea.sh-code').first().inputValue();
  assert(v.startsWith('ICOR1:') && v.length > 100, 'texto de backup inválido');
  await page.evaluate(() => window.__ICOR__.go('title', {}, { replace: true }));
  await waitScreen('title');
  return `${(v.length / 1024).toFixed(1)} KB`;
});

// =====================================================================
// 4. offline e atualização
// =====================================================================
await check('Funciona offline após o cache', async () => {
  if (!swOk) return SKIP('service worker indisponível');
  await page.reload({ waitUntil: 'load' }); // garante que a página está controlada
  await waitScreen('title', 10000);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) return SKIP('página não ficou sob controle do service worker');
  // Corte REAL de rede: derruba o servidor. (context.setOffline do WebKit bloqueia até respostas do
  // service worker — limitação da emulação, não do iPhone.)
  const port = srv.port;
  await srv.close();
  try {
    await page.reload({ waitUntil: 'load' });
    await waitScreen('title', 10000);
    await shot('10-offline');
    const rep = await page.evaluate(() => window.__ICOR_BOOT__);
    const extra = (rep?.failed || []).map((f) => f.name).filter((n) => !onlineFailed.includes(n));
    assert(!extra.length, `módulos que só falham offline: ${extra.join(', ')}`);
    const g = await G();
    return `título offline${g ? ', campanha carregada' : ''}`;
  } finally {
    srv = await startServer({ root: siteDir, port, prefix: PREFIX, quiet: true });
  }
});
await check('Atualização segura: nova versão espera e aplica no título', async () => {
  if (NO_UPDATE) return SKIP('--no-update');
  if (DEV) return SKIP('modo --dev não tem versão de build');
  if (!swOk) return SKIP('service worker indisponível');
  const v1 = await page.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then((r) => r.text()).then((t) => t.trim()));
  // publica "versão 2": muda um arquivo e regenera o sw.js
  const { genSW } = await import('../tools/gen-sw.mjs');
  writeFileSync(join(siteDir, 'css', 'shell.css'), readFileSync(join(siteDir, 'css', 'shell.css'), 'utf8') + '\n/* e2e v2 */\n');
  const v2 = genSW(siteDir).version;
  writeFileSync(join(siteDir, 'version.txt'), v2 + '\n');
  assert(v1 !== v2, 'versão não mudou');
  const st = await page.evaluate(async () => { await window.__ICOR__.checkUpdate(); return window.__ICOR__.update(); });
  assert(st.ready, `nova versão não ficou pronta: ${JSON.stringify(st)}`);
  // ainda na versão antiga até o jogador aceitar
  const ctrlV = await page.evaluate(() => new Promise((res) => { const c = new MessageChannel(); c.port1.onmessage = (e) => res(e.data.version); navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [c.port2]); setTimeout(() => res(null), 2000); }));
  assert(ctrlV === v1, `controlador mudou sozinho (${ctrlV})`);
  await page.waitForFunction(() => /Nova versão pronta/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 4000 });
  await shot('11-atualizacao');
  const nav = page.waitForNavigation({ timeout: 10000 });
  await tap('Atualizar agora');
  await nav;
  await waitScreen('title', 10000);
  const ctrlV2 = await page.evaluate(() => new Promise((res) => { const c = new MessageChannel(); c.port1.onmessage = (e) => res(e.data.version); navigator.serviceWorker.controller?.postMessage({ type: 'GET_VERSION' }, [c.port2]); setTimeout(() => res(null), 2000); }));
  assert(ctrlV2 === v2, `após atualizar: ${ctrlV2}, esperado ${v2}`);
  const g = await G();
  return `${v1} → ${v2}${g ? ', campanha preservada' : ''}`;
});

// =====================================================================
// 5. erros
// =====================================================================
await check('Sem recursos 404', async () => {
  const uniq = [...new Set(missing)];
  if (uniq.length) throw new Error(uniq.slice(0, 8).join('; '));
});
await check('Sem erros de console/página', async () => {
  const uniq = [...new Set(errors)];
  if (uniq.length) throw new Error(`${uniq.length}: ${uniq.slice(0, 5).join(' | ')}`);
});

await browser.close();
await srv.close();
if (tmpSite) rmSync(tmpSite, { recursive: true, force: true });

const c = (s) => results.filter((r) => r.status === s).length;
console.log(`\n──────── e2e: ${c('PASS')} PASS · ${c('FAIL')} FAIL · ${c('SKIP')} SKIP ────────`);
console.log(`screenshots em ${SHOTS}`);
writeFileSync(join(SHOTS, 'e2e-report.json'), JSON.stringify({ at: new Date().toISOString(), device: deviceName, base: BASE, results, errors, missing: [...new Set(missing)] }, null, 2));
process.exit(c('FAIL') ? 1 : 0);
