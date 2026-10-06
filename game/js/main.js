// Ponto de entrada: monta a interface, registra telas e ganchos, carrega o save.
//
// Cada área registra suas telas (export default [defs]) e, opcionalmente, ganchos (export function init()).
// As áreas são importadas dinamicamente e de forma ISOLADA: se um módulo falhar ao carregar,
// o resto do jogo continua de pé (título, configurações, backup) e o erro é mostrado.
import { mount, registerScreen, setHud, go, reportError } from './ui/app.js';
import { load } from './core/save.js';
import { h, button } from './ui/dom.js';

const AREAS = [
  ['shell', () => import('./ui/screens/shell.js')],
  ['character', () => import('./ui/screens/character.js')],
  ['combat', () => import('./ui/screens/combat.js')],
  ['expedition', () => import('./ui/screens/expedition.js')],
  ['city', () => import('./ui/screens/city.js')],
  ['event', () => import('./ui/screens/event.js')],
];

/** HUD mínimo caso ui/hud.js não carregue: só o botão de menu (nunca prender o jogador). */
function fallbackHud(el) {
  el.append(h('div.row', h('span.muted.small', 'ICOR'), h('span.spacer'),
    button('☰ Menu', () => import('./ui/screens/shell.js').then((m) => m.openPauseMenu()), { kind: ['ghost', 'small'] })));
}

export const bootReport = { loaded: [], failed: [] };

async function boot() {
  const root = document.getElementById('app');
  mount(root);
  const mods = await Promise.allSettled(AREAS.map(([, f]) => f()));
  const inits = [];
  mods.forEach((r, i) => {
    const name = AREAS[i][0];
    if (r.status === 'rejected') {
      bootReport.failed.push({ name, error: String(r.reason?.message || r.reason) });
      console.error(`[boot] módulo ${name} falhou:`, r.reason);
      return;
    }
    bootReport.loaded.push(name);
    for (const def of r.value.default || []) {
      try { registerScreen(def); } catch (e) { reportError(e); }
    }
    if (typeof r.value.init === 'function') inits.push([name, r.value.init]);
  });
  try {
    const hud = await import('./ui/hud.js');
    setHud(hud.renderHud || fallbackHud);
  } catch (e) {
    bootReport.failed.push({ name: 'hud', error: String(e?.message || e) });
    console.error('[boot] hud falhou:', e);
    setHud(fallbackHud);
  }
  // shell primeiro (ciclo de vida, áudio, service worker), depois as demais áreas
  for (const [name, init] of inits) {
    try { await init(); } catch (e) { console.error(`[boot] init ${name}:`, e); reportError(e); }
  }
  try { load(); } catch (e) { reportError(e); } // define G se houver save (o título decide "Continuar")
  go('title', {}, { replace: true });
  if (bootReport.failed.length) {
    reportError(new Error(`Partes do jogo não carregaram: ${bootReport.failed.map((f) => f.name).join(', ')}`));
  }
  window.__ICOR_BOOT__ = bootReport;
}

window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
boot().catch((e) => {
  reportError(e);
  const root = document.getElementById('app');
  if (root && !root.querySelector('.screen')) {
    root.textContent = '';
    root.append(h('div.boot', h('div.boot-title', 'ICOR'), h('div.boot-sub', 'Falha ao iniciar. Recarregue a página.'), h('pre.small.muted', String(e?.message || e))));
  }
});
