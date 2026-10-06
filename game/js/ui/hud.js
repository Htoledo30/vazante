// HUD compacto (Área A): Vida, Pavor, Corrupção, Icor, moedas, dia/hora, Chaga; luz e rações no Ermo.
// Duas linhas no máximo a 375px. Toque no nome abre a Ficha; ☰ abre o menu.
import { h, bar, button } from './dom.js';
import { go } from './app.js';
import { getG } from '../core/state.js';
import { derive } from '../systems/character.js';
import { timeOf, fmtHour, isNightHour } from '../core/util.js';

const REGION_SHORT = { r1: 'Campos', r2: 'Floresta', r3: 'Catacumbas', r4: 'Vel-Maren', r5: 'Cadáver' };

function mini(kind, value, max, label, title) {
  return h('div.ch-hud-meter', { class: `ch-hud-${kind}`, attrs: { title } },
    h('span.ch-hud-ico', label),
    bar(value, max, kind, `${Math.round(value)}`));
}

export function renderHud(el, screenId) {
  const G = getG();
  el.classList.add('ch-hud');
  if (!G) { el.append(h('div.row', h('span.muted.small', 'ICOR'), h('span.spacer'), menuBtn())); return; }
  const hero = G.hero;
  const t = timeOf(G.time || 0);
  const night = isNightHour(t.hour);
  const chaga = Math.round(G.chaga || 0);

  // linha 1: herói
  if (hero && !hero.dead) {
    let D = null;
    try { D = derive(hero); } catch (e) { console.error(e); }
    const hpMax = D?.hpMax || 50;
    const alerts = [];
    if ((hero.mutationPending || 0) > 0) alerts.push(h('span.ch-hud-alert.t-corr', '✦'));
    if ((hero.wounds || []).some((w) => w.infected)) alerts.push(h('span.ch-hud-alert.t-rot', '☣'));
    if ((hero.wounds || []).some((w) => w.bleeding && !w.treated)) alerts.push(h('span.ch-hud-alert.t-blood', '🩸'));
    el.append(h('div.ch-hud-row',
      h('button.ch-hud-name', { type: 'button', on: { click: () => go('sheet') }, attrs: { 'aria-label': 'Abrir ficha' } },
        h('span.ch-hud-nm', hero.name), h('span.ch-hud-lv', `nv ${hero.level || 1}`), alerts),
      h('div.ch-hud-bars',
        mini('hp', hero.hp || 0, hpMax, '♥', 'Vida'),
        mini('dread', hero.dread || 0, 100, '☠', 'Pavor'),
        mini('corr', hero.corruption || 0, 100, '✦', 'Corrupção')),
    ));
  }
  // linha 2: mundo
  const exp = G.expedition;
  const bits = [
    h('span.ch-hud-chip', { class: night ? 't-dread' : '' }, `${night ? '☾' : '☀'} D${t.day} ${fmtHour(t.hour)}`),
    h('span.ch-hud-chip.t-rot', { attrs: { title: 'Chaga: a 100, Valdrem cai' } }, `☣ ${chaga}`),
  ];
  if (hero && !hero.dead) {
    bits.push(h('span.ch-hud-chip.t-ichor', `⚱ ${hero.ichor || 0}`));
    bits.push(h('span.ch-hud-chip', `◉ ${hero.coin || 0}`));
  }
  if (exp && hero) {
    const torches = (hero.inv || []).filter((i) => i.id === 'tocha').reduce((s, i) => s + (i.n || 1), 0);
    const rations = (hero.inv || []).filter((i) => i.id === 'racao').reduce((s, i) => s + (i.n || 1), 0);
    bits.push(h('span.ch-hud-chip', { class: (exp.light || 0) <= 0 && !torches ? 't-bad' : 't-warn' }, `🔥${Math.round((exp.light || 0) * 10) / 10}h+${torches}`));
    bits.push(h('span.ch-hud-chip', { class: rations ? '' : 't-bad' }, `🍖${rations}`));
    bits.push(h('span.ch-hud-chip.muted', REGION_SHORT[exp.region] || ''));
  }
  el.append(h('div.ch-hud-row.ch-hud-world', h('div.ch-hud-chips', bits), menuBtn()));
}

function menuBtn() {
  return button('☰', () => import('./screens/shell.js').then((m) => m.openPauseMenu()), { kind: ['ghost', 'small'], title: 'Menu' });
}
