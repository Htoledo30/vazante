// Jogada automática pela INTERFACE no WebKit (perfil iPhone): toca botões como um jogador apressado,
// atravessando intro → criação → cidade → Ermo → combates/eventos/saques → morte → herdeiro → ...
// Objetivo: achar erros de execução, telas sem saída e travas. Não mede balanceamento.
// Uso: node tests/playthrough.mjs [passos=400] [seed]   (sai 1 se houver erro de página ou trava)
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEPS = Number(process.argv[2] || 400);
const SEED = Number(process.argv[3] || 1);
const SHOTS = join(ROOT, 'tests', 'shots', 'play');
mkdirSync(SHOTS, { recursive: true });

const { webkit, devices } = await import('playwright');
const { startServer } = await import('../tools/serve.mjs');
const srv = await startServer({ root: join(ROOT, 'game'), port: 0, prefix: '/icor/', quiet: true });
const BASE = `http://localhost:${srv.port}/icor/`;
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack || ''}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.addInitScript((seed) => {
  let s = seed >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.clear(); localStorage.setItem('icor.settings', JSON.stringify({ hints: false, confirmDanger: false, sound: false, music: false })); } catch { /* */ }
}, SEED);
await page.goto(BASE);
await page.waitForFunction(() => window.__ICOR__ && document.querySelector('#app')?.dataset.screen);

const screen = () => page.evaluate(() => document.querySelector('#app').dataset.screen);
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) }).catch(() => {});

async function closeLayers() {
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const backs = [...document.querySelectorAll('.layer .modal-back:not(.is-closing)')];
      if (!backs.length) return false;
      const top = backs[backs.length - 1];
      const btn = top.querySelector('.modal-actions .btn-primary:not(.is-disabled)') || top.querySelector('.modal-actions .btn:not(.is-disabled)') || top.querySelector('.modal-head .btn');
      if (btn) btn.click(); else top.click();
      return true;
    });
    if (!r) return;
  }
}

/** Toca o primeiro botão habilitado que casa com o seletor/texto. */
async function tap(sel, textRe) {
  const els = await page.$$(sel);
  for (const el of els) {
    const dis = await el.evaluate((n) => n.classList.contains('is-disabled')).catch(() => true);
    if (dis) continue;
    if (textRe) { const t = await el.innerText().catch(() => ''); if (!textRe.test(t)) continue; }
    await el.click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(120);
    return true;
  }
  return false;
}

const seen = new Set();
const counts = {};
let stuck = 0;
let lastSig = '';
let deaths = 0;
let expeditions = 0;

for (let step = 0; step < STEPS; step++) {
  await closeLayers();
  const sc = await screen();
  counts[sc] = (counts[sc] || 0) + 1;
  if (step % 10 === 0) console.log(`passo ${step} tela ${sc} erros ${errors.length}`);
  if (!seen.has(sc)) { seen.add(sc); await shot(`${String(seen.size).padStart(2, '0')}-${sc}`); }
  const sig = await page.evaluate(() => { const G = window.__ICOR__.getG(); return JSON.stringify([document.querySelector('#app').dataset.screen, G?.time, G?.hero?.hp, G?.combat?.round, G?.expedition?.node, G?.event?.stage, (G?.hero?.inv || []).length, G?.lineage?.generation]); });
  if (sig === lastSig) stuck++; else stuck = 0;
  lastSig = sig;
  if (stuck > 12) { console.log('TRAVOU em', sc); await shot(`STUCK-${sc}`); errors.push(`trava na tela ${sc}`); break; }

  let ok = false;
  try {
  switch (sc) {
    case 'title':
      ok = await tap('.dock .btn, .screen .btn', /Continuar|Nova campanha/);
      break;
    case 'intro': case 'create':
      ok = await tap('.dock .btn-primary');
      break;
    case 'heirs': deaths++; ok = await tap('.screen .btn-primary'); break;
    case 'city': {
      const G = await page.evaluate(() => { const g = window.__ICOR__.getG(); return { coin: g.hero?.coin || 0, ichor: g.hero?.ichor || 0, lvl: !!document.querySelector('.ct-alert .btn-blood') }; });
      if (G.lvl && Math.random() < 0.5) { ok = await tap('.ct-alert .btn-blood'); break; }
      if (stuck > 3 || Math.random() < 0.7) ok = await tap('.dock .btn-primary', /Portão/);
      else ok = await tap('.ct-svc');
      break;
    }
    case 'svc': ok = (Math.random() < 0.6 && await tap('.screen .btn:not(.btn-ghost)')) || await tap('.dock .btn', /Voltar/); break;
    case 'levelup':
      await tap('.screen .grid-3 .btn');
      await tap('.screen .btn-left');
      ok = await tap('.dock .btn-blood');
      if (!ok) ok = await tap('.dock .btn', /Voltar/);
      break;
    case 'mutation': ok = await tap('.screen .btn-blood') || await tap('.dock .btn'); break;
    case 'travel': expeditions++; ok = await tap('.dock .btn-primary', /Partir/) || await tap('.dock .btn', /Cidade/); break;
    case 'map': {
      const adj = await page.$$('.ex-node.is-adj');
      const hp = await page.evaluate(() => { const g = window.__ICOR__.getG(); return (g.hero?.hp || 0) / 60; });
      if (hp < 0.35 && Math.random() < 0.5) { ok = await tap('.dock .btn', /Voltar/); if (ok) { await page.waitForTimeout(150); ok = await tap('.layer .btn-left'); } break; }
      if (Math.random() < 0.08) { ok = await tap('.dock .btn', /Acampar/); break; }
      if (await tap('.dock .btn-blood', /Explorar/) && Math.random() < 0.5) { ok = true; break; }
      if (adj.length) {
        const pick = adj[Math.floor(Math.random() * adj.length)];
        await pick.dispatchEvent('click');
        await page.waitForTimeout(80);
        ok = await tap('.dock .btn-primary', /^Ir/);
      }
      if (!ok) ok = await tap('.dock .btn', /Voltar/) && await tap('.layer .btn-left');
      break;
    }
    case 'node': ok = (Math.random() < 0.75 && await tap('.screen .btn:not(.btn-ghost):not(.sh-help-btn)')) || await tap('.dock .btn-primary'); break;
    case 'camp': ok = Math.random() < 0.6 ? await tap('.dock .btn-primary') : await tap('.dock .btn', /Levantar/); break;
    case 'combat': {
      if (await page.$('.cb-result')) { await tap('.screen .btn', /Executar|Poupar/); ok = await tap('.dock .btn-primary'); break; }
      if (await page.$('.cb-pending')) { ok = await tap('.cb-enemy.is-target'); if (ok) { await page.waitForTimeout(150); await tap('.layer .cb-part-pick .btn'); } break; }
      const cats = await page.$$('.dock .tab');
      if (cats.length && Math.random() < 0.25) { await cats[Math.floor(Math.random() * cats.length)].click(); await page.waitForTimeout(60); }
      ok = await tap('.cb-actions .btn');
      if (!ok) { await cats[0]?.click(); ok = await tap('.cb-actions .btn'); }
      await page.waitForTimeout(100);
      if (await page.$('.layer .cb-part-pick')) await tap('.layer .cb-part-pick .btn');
      break;
    }
    case 'event':
      ok = await tap('.ev-options .btn') || await tap('.dock .btn-primary') || await tap('.dock .btn');
      break;
    case 'loot': ok = await tap('.dock .btn-primary', /Pegar/) || await tap('.dock .btn'); break;
    case 'sheet': ok = await tap('.dock .btn', /Voltar/); break;
    case 'siege': ok = await tap('.dock .btn-blood') || await tap('.dock .btn'); break;
    case 'heart': ok = await tap('.screen .btn-blood') || await tap('.dock .btn'); break;
    case 'ending': console.log('FIM DE CAMPANHA'); step = STEPS; ok = true; break;
    default: ok = await tap('.dock .btn') || await tap('.screen .btn');
  }
  } catch (e) { /* elemento sumiu durante o toque */ }
  if (!ok) await page.waitForTimeout(50);
  if (errors.length > 8) break;
}
const G = await page.evaluate(() => { const g = window.__ICOR__.getG(); return g && { day: Math.floor(g.time / 24) + 1, chaga: g.chaga, gen: g.lineage.generation, dead: g.lineage.dead.length, hero: g.hero && { lvl: g.hero.level, hp: g.hero.hp, ichor: g.hero.ichor, coin: g.hero.coin, wounds: g.hero.wounds.length }, bosses: g.campaign.bosses }; });
console.log('telas:', counts);
console.log('estado final:', JSON.stringify(G));
console.log(`expedições: ${expeditions}, mortes vistas: ${deaths}`);
if (errors.length) { console.log('\nERROS:'); for (const e of errors) console.log(' -', e.slice(0, 600)); }
await browser.close();
await srv.close?.();
process.exit(errors.length ? 1 : 0);
