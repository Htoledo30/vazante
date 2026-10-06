// Tela de evento narrativo (Área E).
// Lê G.event (persistido): fechar o app no meio e voltar retoma no mesmo ponto (escolha ou resultado).
import { h, button, chip, prose, haptic } from '../dom.js';
import { go, reportError, scrollToBottom } from '../app.js';
import { getG } from '../../core/state.js';
import { sfx } from '../../core/bus.js';
import { isNightHour } from '../../core/util.js';
import * as flow from '../../systems/flow.js';
import {
  eventView, choose, finishEvent, installEventHooks, eventIsStale, abandonEvent, nextStep,
  POOL_LABEL, ATTR_LABEL,
} from '../../systems/events.js';

const REGION_NAME = { r1: 'Campos de Cinza', r2: 'Floresta dos Enforcados', r3: 'Catacumbas de Sal', r4: 'Vel-Maren', r5: 'O Cadáver' };
const POOL_ICON = { field: '✠', city: '♜', camp: '♨', ruin: '☗', shrine: '✟', night: '☾', story: '✦', quest: '✦' };

const NEXT_LABEL = {
  combat: ['Lutar', 'blood', 'O aço decide agora'],
  death: ['Fim', 'danger', 'Não há volta'],
  event: ['Continuar', 'primary', 'Ainda não acabou'],
  loot: ['Ver o saque', 'primary', 'Pegue o que conseguir carregar'],
  end: ['Seguir', 'primary', null],
};

let lastAnimated = null; // evita repetir animação/sons a cada refresh

function leaveSafely(G) {
  const src = G?.event ? abandonEvent(G) : (G?.expedition ? 'expedition' : 'daily');
  try { flow.eventEnded({ source: src, aborted: true }); }
  catch (e) { reportError(e); go(G?.expedition ? 'map' : 'city', {}, { replace: true }); }
}

function rollLine(r) {
  if (!r.checked) return null;
  const attr = ATTR_LABEL[r.attr] || r.attr || '';
  let verdict = r.ok ? 'Sucesso' : 'Falha';
  let cls = r.ok ? 't-good' : 't-bad';
  if (r.crit) { verdict = 'Sucesso crítico'; cls = 't-ichor'; }
  if (r.fumble) { verdict = 'Desastre'; cls = 't-blood'; }
  return h('div.ev-roll', { class: r.ok ? 'is-ok' : 'is-fail' },
    h('span.ev-roll-die', String(r.roll ?? '?')),
    h('span.ev-roll-txt', h('span.mono.small.muted', `${attr} ${r.chance ?? '?'}% · rolou ${r.roll ?? '?'}`), h('b', { class: cls }, verdict)));
}

function lineKind(l) {
  const k = l?.kind || '';
  if (['good', 'bad', 'warn', 'ichor', 'rot', 'blood', 'dread', 'corr', 'info'].includes(k)) return `t-${k}`;
  const t = String(l?.text || '');
  if (/^\s*\+/.test(t)) return 't-good';
  if (/^\s*[-−]/.test(t)) return 't-bad';
  return '';
}

function render({ main, dock, refresh }) {
  const G = getG();
  if (!G || !G.event || eventIsStale(G)) {
    main.append(h('div.ev-wrap', h('p.muted.center', 'O momento passou.')));
    dock.append(button('Seguir', () => leaveSafely(G), { kind: ['primary', 'wide'] }));
    return;
  }
  if (G.event.stage === 'loot') {
    if (G.pendingLoot) { go('loot', {}, { replace: true }); return; }
    leaveSafely(G);
    return;
  }

  const v = eventView(G);
  const hero = G.hero || {};
  const st = G.event;
  const region = st.ctx?.region;
  const night = isNightHour((G.time || 0) % 24);
  const wrap = h('div.ev-wrap', {
    class: [
      `ev-pool-${v.pool || 'field'}`,
      (hero.dread || 0) >= 75 ? 'ev-dread' : '',
      (hero.corruption || 0) >= 50 ? 'ev-corr' : '',
    ].join(' '),
  });

  const where = [];
  where.push(chip(`${POOL_ICON[v.pool] || '✠'} ${POOL_LABEL[v.pool] || 'Ermo'}`, 'info'));
  if (region && REGION_NAME[region] && v.pool !== 'city') where.push(chip(REGION_NAME[region], 'rot'));
  if (night) where.push(chip('☾ Noite', 'warn'));
  if ((st.chain || 0) > 0) where.push(chip('…continua', ''));
  wrap.append(h('div.ev-where', where));
  wrap.append(h('h2.ev-title', v.title));
  wrap.append(h('div.ev-text', { class: st.stage === 'result' ? 'is-past' : '' }, prose(v.text)));

  if (st.stage === 'choose') {
    const visible = v.options;
    if (!visible.length) {
      wrap.append(h('p.muted', 'Não há nada a fazer aqui.'));
      dock.append(button('Seguir', () => leaveSafely(G), { kind: ['primary', 'wide'] }));
      main.append(wrap);
      return;
    }
    const exclusive = visible.filter((o) => o.exclusive && !o.disabled).length;
    if (exclusive) wrap.append(h('p.ev-hint.small', `◆ ${exclusive === 1 ? 'Uma opção' : `${exclusive} opções`} só sua${exclusive === 1 ? '' : 's'} — pela sua história, itens ou fama.`));
    if (visible.some((o) => o.chance != null)) {
      import('../help.js').then((m) => m.hintOnce?.('testes')).catch(() => {});
    }
    const box = h('div.ev-options');
    for (const o of visible) {
      box.append(button(o.label, () => pick(o.idx, refresh), {
        kind: ['wide', 'left', o.kind].filter(Boolean),
        sub: o.sub || null, disabled: o.disabled, why: o.why,
        icon: o.exclusive ? '◆' : (o.chance != null ? '⚄' : null),
      }));
    }
    dock.append(box);
  } else {
    const r = st.result || {};
    const res = h('div.ev-result', { class: r.checked ? (r.ok ? 'is-ok' : 'is-fail') : '' });
    res.append(h('div.ev-chosen', h('span.muted.small', 'Você escolheu'), h('div', r.label || '')));
    const rl = rollLine(r);
    if (rl) res.append(rl);
    if (r.text) res.append(h('div.ev-outcome', prose(r.text)));
    const lines = (r.lines || []).filter((l) => l && l.text);
    if (lines.length) {
      res.append(h('ul.ev-lines', lines.map((l) => h('li', { class: lineKind(l) }, l.text))));
    }
    wrap.append(res);
    const step = nextStep(G);
    const [label, kind, sub] = NEXT_LABEL[step] || NEXT_LABEL.end;
    dock.append(button(label, () => cont(), { kind: [kind, 'wide'], sub, sound: step === 'combat' ? 'hit_heavy' : (step === 'death' ? 'death' : 'tap') }));
    if (lastAnimated !== `${st.id}:${G.time}:${r.idx}`) {
      lastAnimated = `${st.id}:${G.time}:${r.idx}`;
      if (r.checked && !r.ok) wrap.classList.add('fx-shake');
      setTimeout(() => scrollToBottom(), 30);
    }
  }
  main.append(wrap);
}

function pick(idx, refresh) {
  const G = getG();
  if (!G?.event || G.event.stage !== 'choose') return;
  let r;
  try { r = choose(G, idx); }
  catch (e) { reportError(e); refresh(); return; }
  haptic(r.checked && !r.ok ? 30 : 12);
  if (r.sfx) sfx(r.sfx);
  else if (r.crit) sfx('crit');
  else if (r.fumble) sfx('scream');
  else if (r.checked && !r.ok) sfx('hit');
  else if ((r.pending || []).some((p) => p.type === 'combat')) sfx('dread');
  else if ((r.lines || []).some((l) => l.kind === 'corr')) sfx('corrupt');
  else if ((r.lines || []).some((l) => l.kind === 'ichor')) sfx('ichor');
  // Se o herói morreu/transformou durante os efeitos, outro sistema já navegou.
  const G2 = getG();
  if (G2?.event && G2.event.stage === 'result') refresh();
}

function cont() {
  const G = getG();
  if (!G) return;
  try { finishEvent(G); }
  catch (e) {
    reportError(e);
    leaveSafely(G);
  }
}

export default [
  {
    id: 'event',
    hud: true,
    render,
    onEnter() {
      const G = getG();
      const v = G?.event ? eventView(G) : null;
      if (v?.sfx && G.event.stage === 'choose') sfx(v.sfx);
    },
  },
];

export function init() {
  installEventHooks((id, params = {}, opts = {}) => go(id, params, opts));
}
