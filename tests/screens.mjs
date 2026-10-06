// Abre cada tela/aba importante no WebKit (iPhone 13) com estados preparados e tira screenshots.
// Procura erros de página, rolagem horizontal e botões pequenos. Uso: node tests/screens.mjs
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'shots', 'screens');
mkdirSync(OUT, { recursive: true });
const { webkit, devices } = await import('playwright');
const { startServer } = await import('../tools/serve.mjs');
const srv = await startServer({ root: join(ROOT, 'game'), port: 0, prefix: '/icor/', quiet: true });
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await p.addInitScript(() => { try { localStorage.setItem('icor.settings', JSON.stringify({ hints: false, sound: false, music: false })); } catch { /* */ } });
await p.goto(`http://localhost:${srv.port}/icor/`);
await p.waitForFunction(() => window.__ICOR__);

// campanha pronta com herói equipado
await p.evaluate(async () => {
  const st = await import('./js/core/state.js');
  const CH = await import('./js/systems/character.js');
  const IT = await import('./js/systems/items.js');
  const G = st.newCampaign({ seed: 99 });
  G.campaign.flags.introDone = true;
  G.hero = CH.createHero({ name: 'Edda', bg: 'acougueiro' });
  for (const id of ['bandagem', 'tala', 'tocha', 'racao', 'bomba', 'elixir_icor', 'espada_longa', 'cota_malha', 'amuleto_corvo', 'tomo_grito']) IT.addItem(G.hero, IT.makeItem(id, { n: 2 }));
  G.hero.ichor = 12; G.hero.coin = 400;
  G.hero.wounds = [];
  const WS = await import('./js/systems/wounds.js');
  WS.inflictWound(G, { part: 'bracoE', dtype: 'impacto', sev: 2 });
  WS.inflictWound(G, { part: 'pernas', dtype: 'corte', sev: 1 });
  G.hero.mutationPending = 1; G.hero.corruption = 26;
  window.__ICOR__.save();
});
const shots = [];
async function snap(name) {
  await p.waitForTimeout(250);
  const issues = await p.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('rolagem horizontal');
    for (const el of document.querySelectorAll('.btn, .tab')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.height < 35 || r.width < 35)) out.push(`botão pequeno: ${el.innerText.slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  shots.push([name, issues.slice(0, 3)]);
}
async function go(id, params) { await p.evaluate(([i, pr]) => window.__ICOR__.go(i, pr || {}), [id, params]); await p.waitForTimeout(200); }
async function closeAll() { await p.evaluate(() => document.querySelectorAll('.layer .modal-back').forEach((m) => m.remove())); }

await go('city'); await closeAll(); await snap('city');
for (const tab of ['status', 'equip', 'inv', 'corpo', 'dadivas', 'tecnicas']) { await go('sheet', { tab }); await snap(`sheet-${tab}`); }
await go('levelup'); await snap('levelup');
await go('mutation'); await snap('mutation');
for (const svc of ['ferreiro', 'barbeiro', 'boticario', 'templo', 'quartel', 'guilda', 'taverna', 'casa', 'muralha']) {
  await go('svc', { id: svc });
  const tabs = await p.$$('.screen .tabs .tab');
  await snap(`svc-${svc}`);
  for (let i = 1; i < tabs.length; i++) { const t = (await p.$$('.screen .tabs .tab'))[i]; await t.click(); await p.waitForTimeout(150); await snap(`svc-${svc}-${i}`); await closeAll(); }
}
await go('travel'); await snap('travel');
await go('factions'); await snap('factions');
await go('journal'); await snap('journal');
// cerco
await p.evaluate(() => { const G = window.__ICOR__.getG(); G.campaign.pendingSiege = { level: 30, dueDay: 1, announced: 1, ready: true, fight: null }; });
await go('siege'); await snap('siege');
await p.evaluate(() => { window.__ICOR__.getG().campaign.pendingSiege = null; });
// coração e final
await p.evaluate(() => { const G = window.__ICOR__.getG(); G.campaign.bosses = { r1: true, r2: true, r3: true, r4: true, r5: true }; G.campaign.heartPending = true; });
await go('heart'); await snap('heart');
await p.evaluate(async () => { const CP = await import('./js/systems/campaign.js'); CP.chooseEnding(window.__ICOR__.getG(), 'carniceiro'); });
await go('ending'); await snap('ending');
// herdeiros
await p.evaluate(async () => { const st = await import('./js/core/state.js'); const CH = await import('./js/systems/character.js'); const LN = await import('./js/systems/lineage.js'); const G = st.newCampaign({ seed: 5 }); G.hero = CH.createHero({ name: 'Ivo', bg: 'desertor' }); LN.onHeroDeath(G, 'Morto por teste', { region: 'r1', nodeId: 'n3' }); });
await go('heirs'); await snap('heirs');

for (const [n, iss] of shots) if (iss.length) console.log(n.padEnd(22), iss.join(' | '));
console.log(`${shots.length} telas.`);
if (errors.length) { console.log('ERROS:'); for (const e of errors) console.log(' -', e.slice(0, 300)); }
await b.close(); await srv.close?.();
process.exit(errors.length ? 1 : 0);
