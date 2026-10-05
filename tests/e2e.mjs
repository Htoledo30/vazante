// Teste ponta a ponta no WebKit (perfil iPhone 13), servindo a build de produção (dist/)
// numa SUBPASTA (/vazante/), como no GitHub Pages. Verifica: manifest, service worker, offline,
// fluxo completo (intro → tutorial → vila → expedição com combates, eventos, loja, chefe),
// persistência ao recarregar e ausência de erros de página.
// Uso: node tests/e2e.mjs [maxPassos]
import { webkit, devices } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const MAX = Number(process.argv[2] || 400);
const SHOTS = process.env.SHOT_DIR || 'tests/shots';
mkdirSync(SHOTS, { recursive: true });
execFileSync(process.execPath, ['tools/build.mjs'], { stdio: 'inherit' });
const port = 8123;
const srv = spawn(process.execPath, ['tools/serve.mjs', 'dist', String(port), '/vazante/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const BASE = `http://localhost:${port}/vazante/`;

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE);
await page.waitForSelector('.title-screen', { timeout: 8000 });
ok('Título carrega na subpasta', true);
const manifest = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); return r.ok ? r.json() : null; });
ok('Manifest acessível e standalone', manifest && manifest.display === 'standalone' && manifest.start_url === './', manifest && manifest.short_name);
const icons = await page.evaluate(async () => Promise.all(['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].map(async (p) => (await fetch(p)).ok)));
ok('Ícones acessíveis', icons.every(Boolean));
const meta = await page.evaluate(() => ({
  vp: document.querySelector('meta[name=viewport]').content,
  apple: !!document.querySelector('meta[name=apple-mobile-web-app-capable]'),
  touch: !!document.querySelector('link[rel=apple-touch-icon]'),
}));
ok('Viewport com viewport-fit=cover e metas iOS', meta.vp.includes('viewport-fit=cover') && meta.apple && meta.touch);
const sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return { scope: reg.scope, active: !!reg.active }; });
ok('Service worker ativo no escopo da subpasta', sw.active && sw.scope.endsWith('/vazante/'), sw.scope);

// injeta o bot (apenas no teste)
const botSrc = readFileSync('tests/bot.mjs', 'utf8').replaceAll('../game/js/', './js/') + '\nwindow.__bot = { botTurn, playCombat };';
await page.addScriptTag({ type: 'module', content: botSrc });
await page.waitForFunction(() => !!window.__bot, null, { timeout: 5000 });

// ---------- novo jogo ----------
await page.getByText('Novo jogo').click();
await page.getByText('Pular').click();
await page.locator('input.name').fill('Teste');
await page.getByText('Descer à praia').click();
await page.waitForSelector('canvas.board');
ok('Tutorial: combate abre', true);
await page.screenshot({ path: `${SHOTS}/e2e-tutorial.png` });

async function dismissHints() {
  for (let i = 0; i < 5; i++) {
    const b = page.locator('.hint button');
    if (await b.count()) await b.first().click().catch(() => {}); else break;
    await page.waitForTimeout(120);
  }
}

async function botCombat(maxTurns = 50) {
  let turns = 0;
  for (let t = 0; t < 600 && turns < maxTurns; t++) {
    await dismissHints();
    const st = await page.evaluate(() => { const a = window.__vazante; const c = a.run && a.run.combat; return c ? c.phase : 'none'; });
    if (st !== 'player') return st;
    const busy = await page.evaluate(() => window.__vazante.combatUI && window.__vazante.combatUI.busy);
    if (busy) { await page.waitForTimeout(200); continue; }
    turns++;
    await page.evaluate(() => {
      const a = window.__vazante; const c = a.run.combat;
      window.__bot.botTurn(c);
      c.ev = [];
      a.combatUI.board.sync();
      a.combatUI.afterAction();
    });
    await page.waitForTimeout(60);
  }
  return 'timeout';
}

// tutorial: um turno pela interface (toque real) e o resto com o bot
await dismissHints();
const box = await page.locator('canvas.board').boundingBox();
const T = box.width / 7;
await page.mouse.click(box.x + T * 3.5, box.y + T * 4.5);
await page.waitForTimeout(700);
const moved = await page.evaluate(() => window.__vazante.run.combat.turn.moved);
ok('Toque no tabuleiro move a personagem', moved);
await page.locator('.act', { hasText: 'Desfazer' }).click();
await page.waitForTimeout(300);
const undone = await page.evaluate(() => !window.__vazante.run.combat.turn.moved);
ok('Desfazer movimento funciona', undone);
await page.locator('.act', { hasText: 'Fim do turno' }).click();
await page.waitForTimeout(200);
const armed = await page.locator('.act.end.arm').count();
ok('Fim de turno pede confirmação quando há ações sobrando', armed === 1);
await page.locator('.act.end').click();
await page.waitForTimeout(2500);
const round2 = await page.evaluate(() => window.__vazante.run && window.__vazante.run.combat && window.__vazante.run.combat.round);
ok('Turno inimigo resolvido, rodada 2', round2 === 2, 'rodada ' + round2);
const tut = await botCombat();
await page.waitForTimeout(1200);
await page.waitForSelector('text=Subir para Salgema', { timeout: 8000 }).catch(() => {});
ok('Tutorial termina e leva à vila', await page.getByText('Subir para Salgema').count() > 0, tut);
await page.getByText('Subir para Salgema').click();
await page.waitForSelector('text=Descer à cidade');
await page.screenshot({ path: `${SHOTS}/e2e-hub.png` });

// visita locais da vila
for (const loc of ['Casa da Avó Zélia', 'Forja da Ilda', 'Taverna O Anzol', 'Arquivo do Frei Anselmo']) {
  await page.getByText(loc).first().click();
  await page.waitForTimeout(250);
  await page.locator('button[aria-label=Voltar]').click();
  await page.waitForTimeout(200);
}
ok('Locais da vila abrem e voltam', await page.getByText('Descer à cidade').count() > 0);

// ---------- expedição ----------
async function runLoop(label, maxSteps) {
  const seen = {};
  for (let step = 0; step < maxSteps; step++) {
    await dismissHints();
    const s = await page.evaluate(() => { const a = window.__vazante; return { view: a.view, screen: a.run ? a.run.screen : null, combat: !!(a.run && a.run.combat), district: a.run ? a.run.district : 0 }; });
    const key = s.view === 'run' ? s.screen : s.view;
    seen[key] = (seen[key] || 0) + 1;
    if (s.view === 'hub') return { seen, end: 'hub' };
    try {
      if (s.view === 'summary') { await page.getByText('Voltar a Salgema').click(); continue; }
      if (s.view !== 'run') { await page.waitForTimeout(200); continue; }
      switch (s.screen) {
        case 'combat': {
          const r = await botCombat(60);
          if (r === 'timeout') { await page.screenshot({ path: `${SHOTS}/e2e-timeout-${label}.png` }); return { seen, end: 'combat-timeout' }; }
          await page.waitForTimeout(900);
          break;
        }
        case 'map':
          await page.locator('.map-node.sel').first().click();
          await page.getByRole('button', { name: 'Ir' }).click();
          break;
        case 'reward': {
          const cards = page.locator('.scroll .card.tap');
          if (await cards.count()) { await cards.first().click(); await page.getByRole('button', { name: 'Pegar' }).click(); }
          else await page.getByRole('button', { name: 'Continuar' }).click();
          break;
        }
        case 'levelup':
          await page.locator('.scroll .card.tap').first().click();
          await page.getByRole('button', { name: 'Confirmar' }).click();
          break;
        case 'event': {
          const c = page.locator('.btn.choice:not([disabled])');
          if (await c.count()) await c.first().click();
          else { const b = page.locator('.bottombar .btn'); await b.first().click(); }
          await page.waitForTimeout(150);
          const cont = page.locator('.bottombar .btn');
          if (await cont.count()) await cont.first().click();
          break;
        }
        case 'shop': {
          const buyBtn = page.locator('.card .btn.small.primary');
          if (await buyBtn.count()) await buyBtn.first().click();
          await page.waitForTimeout(100);
          await page.getByText('Seguir viagem').click();
          break;
        }
        case 'rest': {
          const opts = page.locator('.scroll .card.tap:not(.locked)');
          await opts.first().click();
          await page.waitForTimeout(150);
          const sheetCard = page.locator('.sheet .card.tap');
          if (await sheetCard.count()) await sheetCard.first().click();
          break;
        }
        case 'bossintro': await page.getByText('Enfrentar').click(); break;
        case 'extract': await page.getByRole('button', { name: label === 'deep' ? '⬇ Descer' : '⬆ Subir' }).click(); break;
        case 'dead': await page.getByText('Acordar na praia').click(); break;
        case 'ending': {
          for (let i = 0; i < 8; i++) { if (await page.getByText('Voltar a Salgema').count()) break; await page.mouse.click(200, 400); await page.waitForTimeout(150); }
          await page.getByText('Voltar a Salgema').click();
          break;
        }
        default: await page.waitForTimeout(200);
      }
    } catch (e) {
      console.log('passo falhou', key, e.message.split('\n')[0]);
      await page.screenshot({ path: `${SHOTS}/e2e-fail-${label}-${step}.png` });
    }
    await page.waitForTimeout(120);
  }
  return { seen, end: 'max-steps' };
}

await page.getByText('Descer à cidade').click();
await page.getByRole('button', { name: /Descer: Porto/ }).click();
await page.waitForSelector('.map-node');
ok('Expedição começa no mapa', true);
await page.screenshot({ path: `${SHOTS}/e2e-map.png` });

// persistência: recarrega no meio da expedição
await page.locator('.map-node.sel').first().click();
await page.getByRole('button', { name: 'Ir' }).click();
await page.waitForTimeout(800);
const before = await page.evaluate(() => JSON.stringify({ s: window.__vazante.run.screen, hp: window.__vazante.run.hero.hp, cur: window.__vazante.run.cur }));
await page.reload();
await page.waitForSelector('.title-screen');
await page.getByText('Continuar expedição').click();
await page.waitForTimeout(600);
const after = await page.evaluate(() => JSON.stringify({ s: window.__vazante.run.screen, hp: window.__vazante.run.hero.hp, cur: window.__vazante.run.cur }));
ok('Save preserva a expedição ao recarregar', before === after, after);
await page.addScriptTag({ type: 'module', content: botSrc });
await page.waitForFunction(() => !!window.__bot);

const r1 = await runLoop('deep', MAX);
ok('Expedição percorrida até voltar à vila', r1.end === 'hub', r1.end + ' ' + JSON.stringify(r1.seen));
const metaAfter = await page.evaluate(() => { const m = window.__vazante.meta; return { runs: m.runs, conchas: m.conchas, bosses: m.bosses, best: m.bestiary, kills: m.totalKills }; });
ok('Progressão persistente registrada (Conchas/bestiário)', metaAfter.runs >= 1 && metaAfter.kills > 0, `runs=${metaAfter.runs} conchas=${metaAfter.conchas} chefes=${metaAfter.bosses.join(',')} abates=${metaAfter.kills}`);

// segunda expedição: compra melhoria e recomeça (ciclo completo + início de outro)
await page.evaluate(() => { const a = window.__vazante; a.meta.conchas += 100; a.save(); a.render(); });
await page.getByText('Farol de Salgema').click();
const buyRelight = page.getByRole('button', { name: 'Comprar' });
if (await buyRelight.count()) await buyRelight.first().click();
await page.locator('button[aria-label=Voltar]').click();
const farol = await page.evaluate(() => !!window.__vazante.meta.upgrades.light_relight);
ok('Melhoria permanente comprada (Farol → Faroleiro)', farol);
await page.getByText('Descer à cidade').click();
await page.getByText('Faroleiro').first().click();
await page.getByRole('button', { name: /Descer: Porto/ }).click();
await page.waitForSelector('.map-node');
const cls = await page.evaluate(() => window.__vazante.run.hero.cls);
ok('Nova expedição com classe desbloqueada', cls === 'faroleiro', cls);
const r2 = await runLoop('up', 120);
ok('Segunda expedição jogável', ['hub', 'max-steps'].includes(r2.end), JSON.stringify(r2.seen));

// offline: recarrega sem rede
// offline: derruba o servidor e recarrega — tudo deve vir do cache do service worker
const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find((k) => k.startsWith('vazante-'))); return (await c.keys()).length; });
srv.kill();
await new Promise((r) => setTimeout(r, 500));
let offOk = false;
try {
  await page.reload({ timeout: 10000 });
  await page.waitForSelector('.title-screen', { timeout: 8000 });
  offOk = true;
} catch (e) { console.log('offline:', e.message.split(String.fromCharCode(10))[0]); }
ok('Funciona offline (servidor desligado) após o cache', offOk, `${cached} arquivos em cache`);
if (offOk) {
  await page.getByText('Continuar em Salgema').click();
  await page.waitForSelector('text=Descer à cidade', { timeout: 5000 }).catch(() => {});
  ok('Progresso continua acessível offline', await page.getByText('Descer à cidade').count() > 0);
}

// layout: sem rolagem horizontal
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok('Sem rolagem horizontal', !overflow);

ok('Sem erros de página', errors.length === 0, errors.slice(0, 5).join(' | '));
await page.screenshot({ path: `${SHOTS}/e2e-final.png` });
await browser.close();
srv.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
process.exit(failed.length ? 1 : 0);
