// Tela de combate (Área B): linha do tempo, inimigos com intenção e partes, painel do herói, ações no dock,
// mira (ação → inimigo → parte com % e dano), registro, resultado e rendidos.
import { h, button, bar, chip, section, kv, prose, tabs, clear, haptic } from '../dom.js';
import { go, refresh, sheet, modal, toastMsg, layoutEls } from '../app.js';
import { getG } from '../../core/state.js';
import { save } from '../../core/save.js';
import { sfx } from '../../core/bus.js';
import * as CB from '../../systems/combat/index.js';
import { heroD } from '../../systems/combat/deps.js';
import { STATUSES } from '../../data/statuses.js';
import { ENEMIES } from '../../data/enemies.js';
import { COMPANIONS } from '../../data/companions.js';
import { helpButton, hintOnce } from '../help.js';

const DIST = ['C.a.C', 'Perto', 'Longe'];
const DIST_CLS = ['d0', 'd1', 'd2'];
const LOG_CLS = { hit: 't-good', crit: 't-ichor', miss: 'muted', bad: 't-bad', crit_bad: 't-blood', kill: 't-blood', blood: 't-blood', good: 't-good', warn: 't-warn', info: '', dread: 't-dread', corr: 't-corr', boss: 't-ichor', ichor: 't-ichor', rot: 't-rot' };

const ui = { cat: 'attack', pending: null, lastEvents: [], showLog: false, desc: false };

function statusChips(a) {
  return (a.statuses || []).filter((s) => STATUSES[s.id]).map((s) => {
    const d = STATUSES[s.id];
    const k = d.kind === 'bad' ? 'bad' : d.kind === 'good' ? 'good' : d.kind === 'stance' ? 'info' : 'warn';
    return chip(`${d.icon || ''}${d.name}${(s.stacks || 1) > 1 ? ` ×${s.stacks}` : ''}`, k, `${d.name}: ${d.desc}`);
  });
}

function enemyKnowledge(G, a) {
  const b = G.world?.bestiary?.[a.def] || {};
  return { kills: b.kills || 0, deep: (b.kills || 0) >= 3 || heroD(G).intentDetail >= 2 };
}

function enemySheet(G, a) {
  const def = ENEMIES[a.def];
  const k = enemyKnowledge(G, a);
  const parts = Object.entries(a.parts).map(([pid, p]) => {
    const broken = p.state === 'destruido' || p.state === 'decepado';
    const arm = p.armor || {};
    return h('div.cb-part-row', { class: broken ? 'is-broken' : '' },
      h('div.row', h('b', p.role === 'swarm' ? 'Bando' : p.name), h('span.spacer'), h('span.small', broken ? (p.state === 'decepado' ? 'DECEPADO' : 'DESTRUÍDO') : p.fractured ? 'fraturado' : p.state === 'ferido' ? 'ferido' : '')),
      broken ? null : bar(p.hp, p.max, 'part'),
      k.deep ? h('div.small.muted', `armadura C${arm.corte || 0} P${arm.perf || 0} I${arm.impacto || 0} F${arm.fogo || 0}`) : null,
      p.desc ? h('div.small.t-info', p.desc) : null);
  });
  sheet({
    title: a.name,
    body: h('div',
      h('p.small', def?.desc || ''),
      h('div.row.row-wrap', (def?.tags || []).map((t) => chip(t, 'info')), (def?.weak || []).map((w) => chip(`fraco: ${w}`, 'good')), (def?.resist || []).map((w) => chip(`resiste: ${w}`, 'bad'))),
      kv('Vida', `${Math.max(0, Math.round(a.hp))}/${a.hpMax}`),
      kv('Distância', DIST[a.dist] || ''),
      a.moraleMax ? kv('Moral', a.morale <= 0 ? 'quebrada' : a.morale < a.moraleMax * 0.4 ? 'vacilando' : 'firme') : kv('Moral', 'não sente medo'),
      kv('Intenção', CB.intentText(G, a)),
      h('div.small.muted', k.deep ? `Bestiário: ${k.kills} morto(s).` : `Mate ${3 - k.kills} mais para conhecer as armaduras (ou tenha AST alta).`),
      h('div.cb-parts', parts)),
    buttons: [{ label: 'Fechar', kind: 'ghost' }],
  });
}

// ------------------------------------------------------------------ partes / execução da ação
function doAct(G, input) {
  const before = G.hero.hp;
  const r = CB.act(G, input);
  if (!r.ok) { toastMsg(r.why || 'Não dá.', 'warn'); return; }
  ui.pending = null;
  ui.lastEvents = r.events || [];
  const hurt = (G.hero?.hp ?? before) < before;
  if (hurt) haptic(25);
  refresh();
}

function choosePart(G, action, target) {
  const t = CB.targetsFor(G, action.id).find((x) => x.uid === target.uid);
  if (!t) return;
  if (action.target !== 'part' || t.parts.length <= 1) {
    doAct(G, { action: action.id, target: target.uid, part: t.parts[0]?.id });
    return;
  }
  const sh = sheet({
    title: `${action.label} → ${t.name}`,
    body: h('div.cb-part-pick', t.parts.map((p) => {
      const broken = false;
      return button(p.name, () => { sh.close(); doAct(G, { action: action.id, target: target.uid, part: p.id }); },
        { kind: ['left', p.hit < 35 ? 'ghost' : ''].filter(Boolean), sub: `${p.hit}% acerto · ${p.est[0]}–${p.est[1]} dano${p.crit ? ` · crít ${p.crit}%` : ''}${p.notes?.length ? ` · ${p.notes.join(', ')}` : ''}${p.state === 'ferido' ? ' · ferido' : ''}${p.fractured ? ' · fraturado' : ''}${p.desc ? ` · ${p.desc}` : ''}`, disabled: broken });
    })),
    buttons: [{ label: 'Cancelar', kind: 'ghost' }],
  });
}

function onEnemyTap(G, a) {
  const p = ui.pending;
  if (!p) { enemySheet(G, a); return; }
  const t = CB.targetsFor(G, p.id).find((x) => x.uid === a.uid);
  if (!t || !t.valid) { toastMsg(t?.why || 'Alvo inválido.', 'warn'); sfx('deny'); return; }
  if (p.target === 'enemy' || p.id === 'avancar' || p.id.startsWith('item:')) { doAct(G, { action: p.id, target: a.uid, part: t.parts?.[0]?.id }); return; }
  choosePart(G, p, a);
}

function selectAction(G, a) {
  if (a.disabled) { toastMsg(a.why || 'Indisponível.', 'warn'); return; }
  if (a.target === 'part' || a.target === 'enemy') {
    const valid = CB.targetsFor(G, a.id).filter((t) => t.valid);
    if (!valid.length) { toastMsg('Nenhum alvo válido.', 'warn'); return; }
    if (valid.length === 1) {
      const enemy = G.combat.actors.find((x) => x.uid === valid[0].uid);
      if (a.target === 'enemy' || a.id === 'avancar' || a.id.startsWith('item:')) { doAct(G, { action: a.id, target: enemy.uid, part: valid[0].parts?.[0]?.id }); return; }
      choosePart(G, a, enemy);
      return;
    }
    ui.pending = a;
    refresh();
    return;
  }
  if (a.id === 'fugir') {
    import('./shell.js').then((m) => m.confirmRisky(`Fugir? ${a.sub || ''}`, { title: 'Fugir' })).then((ok) => { if (ok) doAct(G, { action: a.id }); });
    return;
  }
  doAct(G, { action: a.id });
}

// ------------------------------------------------------------------ render
function renderTimeline(G) {
  const tl = CB.timeline(G, 7);
  return h('div.cb-timeline', tl.map((s, i) => h('div.cb-tl', { class: `cb-tl-${s.side}${i === 0 ? ' is-now' : ''}` },
    h('span.cb-tl-name', s.side === 'hero' ? 'Você' : s.name.replace(/^Revoada de /, '').slice(0, 12)),
    s.charging ? h('span.cb-tl-charge', '⏳') : null)));
}

function enemyCard(G, a) {
  const c = G.combat;
  const p = ui.pending;
  let tg = null;
  if (p) { const t = CB.targetsFor(G, p.id).find((x) => x.uid === a.uid); tg = t ? (t.valid ? 'valid' : 'invalid') : 'invalid'; }
  const rend = CB.hasStatus(a, 'rendido');
  const int = a.intent;
  const intentCls = !int ? '' : a.flags.charging ? 'is-charging' : int.kind === 'attack' ? 'is-attack' : '';
  return h('button.cb-enemy', {
    type: 'button', data: { uid: a.uid },
    class: [tg === 'valid' ? 'is-target' : '', tg === 'invalid' ? 'is-dim' : '', a.flags.boss ? 'is-boss' : '', a.flags.elite ? 'is-elite' : '', rend ? 'is-rendido' : ''].join(' '),
    on: { click: () => onEnemyTap(G, a) },
  },
  h('div.cb-e-top',
    h('span.cb-dist', { class: DIST_CLS[a.dist] }, DIST[a.dist]),
    h('span.cb-e-name', a.name),
    h('span.cb-e-hp', `${Math.max(0, Math.round(a.hp))}/${a.hpMax}`)),
  bar(Math.max(0, a.hp), a.hpMax, 'hp', ''),
  h('div.cb-intent', { class: intentCls }, h('span.cb-int-ico', int?.icon || (rend ? '🏳' : '·')), h('span', CB.intentText(G, a))),
  h('div.cb-e-st', statusChips(a), brokenParts(a)));
}

function brokenParts(a) {
  return Object.values(a.parts).filter((p) => (p.state === 'destruido' || p.state === 'decepado') && p.role !== 'swarm')
    .map((p) => chip(`${p.state === 'decepado' ? '✂' : '✖'} ${p.name}`, 'blood'));
}

function heroPanel(G) {
  const c = G.combat;
  const ha = CB.heroActor(G);
  const D = heroD(G);
  const al = CB.allyActor(G);
  const col = ha.flags.collapse;
  return h('div.cb-hero', { data: { uid: 'hero' } },
    h('div.row', h('b', G.hero.name), h('span.spacer'), h('span.small.muted', `${D.weapon.name}${D.offhand.kind !== 'none' && D.offhand.name ? ` + ${D.offhand.name}` : ''}`)),
    h('div.cb-hero-bars',
      h('div', h('span.small', `Vida ${G.hero.hp}/${D.hpMax}`), bar(G.hero.hp, D.hpMax, 'hp', '')),
      h('div', h('span.small', `Fôlego ${ha.stamina}/${ha.staminaMax}`), bar(ha.stamina, ha.staminaMax, 'stam', '')),
      h('div', h('span.small', `Pavor ${G.hero.dread || 0}`), bar(G.hero.dread || 0, 100, 'dread', ''))),
    h('div.row.row-wrap', statusChips(ha), col ? chip(`COLAPSO: ${col.kind}`, 'bad') : null,
      ha.flags.charge ? chip('⏳ golpe carregado', 'warn') : null, ha.flags.loaded && D.weapon.ranged ? chip('besta armada', 'info') : null,
      c.env.dark ? chip('escuro', 'warn', 'Sem luz: −precisão.') : null),
    al ? h('div.cb-ally', h('span.small', `${al.name} (${al.flags.order}) ${Math.round(al.hp)}/${al.hpMax}`), bar(al.hp, al.hpMax, 'hp', ''), h('div.row.row-wrap', statusChips(al))) : null);
}

function renderLog(G, full = false) {
  const lines = G.combat.log.slice(full ? -60 : -7);
  return h('div.cb-log', { class: full ? 'is-full' : '', on: { click: () => { ui.showLog = !ui.showLog; refresh(); } } },
    lines.map((l) => h('div.cb-log-line', { class: LOG_CLS[l.kind] || '' }, l.text)),
    h('div.cb-log-more.small.muted', full ? 'Toque para recolher' : 'Toque para ver o registro'));
}

const CATS = [
  { id: 'attack', label: 'Atacar', kinds: ['attack', 'tech'] },
  { id: 'defense', label: 'Defender', kinds: ['defense'] },
  { id: 'move', label: 'Mover', kinds: ['move'] },
  { id: 'item', label: 'Itens', kinds: ['item', 'swap'] },
  { id: 'other', label: 'Outros', kinds: ['other', 'order'] },
];

function renderDock(G, dock) {
  const c = G.combat;
  if (ui.pending) {
    dock.append(h('div.cb-pending', h('span', `${ui.pending.label}: toque num inimigo destacado.`)),
      button('Cancelar', () => { ui.pending = null; refresh(); }, { kind: ['ghost', 'wide'] }));
    return;
  }
  const acts = CB.heroActions(G);
  const counts = Object.fromEntries(CATS.map((k) => [k.id, acts.filter((a) => k.kinds.includes(a.kind) && !a.disabled).length]));
  dock.append(h('div.cb-tabs-row', tabs(CATS.map((k) => ({ id: k.id, label: k.label, badge: k.id === 'item' && counts.item ? counts.item : null })), ui.cat, (id) => { ui.cat = id; refresh(); }),
    button(ui.desc ? '✕' : 'ⓘ', () => { ui.desc = !ui.desc; refresh(); }, { kind: ['ghost', 'small'], title: 'Mostrar o que cada ação faz' })));
  const cat = CATS.find((k) => k.id === ui.cat) || CATS[0];
  const list = acts.filter((a) => cat.kinds.includes(a.kind));
  if (!list.length) { dock.append(h('div.small.muted.center', 'Nada aqui.')); return; }
  const g = h('div.cb-actions', list.map((a) => button(a.label, () => selectAction(G, a), {
    kind: [a.disabled ? '' : a.kind === 'tech' ? 'primary' : a.id === 'fugir' ? 'danger' : ''].filter(Boolean),
    sub: a.disabled ? a.why : (ui.desc && a.desc ? `${a.sub ? `${a.sub} — ` : ''}${a.desc}` : a.sub), disabled: a.disabled, why: a.why,
  })));
  dock.append(g);
}

function renderResult(G, main, dock) {
  const c = G.combat;
  const sum = CB.resultSummary(G);
  const R = c.result;
  const title = R === 'win' ? (c.context.boss ? 'O MONSTRO CAIU' : 'Vitória') : R === 'fled' ? 'Você fugiu' : 'Você morreu';
  main.append(h('div.cb-result', { class: `is-${R}` }, h('h2', title),
    h('div.small', R === 'lose' ? 'O Ermo fica com o seu corpo — e com tudo que você carregava.' : `${sum.killed.length} morto(s). ${c.stats.severed ? `${c.stats.severed} membro(s) decepado(s). ` : ''}${c.stats.executions ? `${c.stats.executions} execução(ões). ` : ''}Dano feito ${c.stats.dmgDealt}, recebido ${c.stats.dmgTaken}.`)));
  if (R === 'win' && sum.surrendered.length) {
    main.append(section('Rendidos', h('p.small.muted', 'Poupar não rende nada agora — talvez depois. Executar rende o saque dele e tira o peso das suas costas. Ou põe.'),
      ...sum.surrendered.map((s) => h('div.row.cb-surr', h('b', s.name), h('span.spacer'),
        button('Poupar', () => { CB.resolveSurrender(G, s.uid, 'spare'); refresh(); }, { kind: ['ghost', 'small'] }),
        button('Executar', () => { CB.resolveSurrender(G, s.uid, 'execute'); sfx('sever'); refresh(); }, { kind: ['blood', 'small'] })))));
  }
  main.append(renderLog(G, true));
  dock.append(button(R === 'lose' ? 'Aceitar' : 'Continuar', () => {
    ui.pending = null; ui.cat = 'attack';
    const out = CB.finishCombat(G);
    if (out?.chainEvent) { go('event', {}, { replace: true }); return; }
    // ganchos navegam; se nenhum navegou, volta para um lugar seguro
    setTimeout(() => {
      const el = layoutEls();
      if (el?.root?.dataset?.screen === 'combat') go(G.expedition ? 'map' : G.hero ? 'city' : 'title', {}, { replace: true });
    }, 0);
  }, { kind: ['primary', 'wide'] }));
}

function playEvents() {
  const evs = ui.lastEvents;
  ui.lastEvents = [];
  if (!evs.length) return;
  const el = layoutEls();
  if (!el) return;
  let delay = 0;
  for (const e of evs.slice(-14)) {
    if (!e.target) continue;
    const node = el.main.querySelector(`[data-uid="${e.target}"]`);
    if (!node) continue;
    if (e.type === 'hit' || e.type === 'dot') {
      setTimeout(() => {
        node.classList.remove('fx-hit'); void node.offsetWidth; node.classList.add('fx-hit');
        if (e.target === 'hero') { node.classList.remove('fx-shake'); void node.offsetWidth; node.classList.add('fx-shake'); }
        const f = h('span.cb-float', { class: e.crit ? 'is-crit' : e.target === 'hero' ? 'is-hurt' : '' }, `-${e.dmg}`);
        node.append(f);
        setTimeout(() => f.remove(), 900);
      }, delay);
      delay += 90;
    } else if (['sever', 'break', 'death', 'execute'].includes(e.type)) {
      setTimeout(() => { node.classList.add('fx-shake'); }, delay);
    } else if (e.type === 'heal') {
      const f = h('span.cb-float.is-heal', `+${e.n}`);
      node.append(f); setTimeout(() => f.remove(), 900);
    }
  }
}

const combatScreen = {
  id: 'combat',
  hud: false,
  onEnter() { ui.pending = null; ui.showLog = false; },
  render({ main, dock }) {
    const G = getG();
    const c = G?.combat;
    if (!c) {
      main.append(prose('A luta acabou.'));
      dock.append(button('Continuar', () => go(G?.expedition ? 'map' : G?.hero ? 'city' : 'title', {}, { replace: true }), { kind: ['primary', 'wide'] }));
      return;
    }
    if (!c.result && c.turn !== 'hero') { CB.advance(G); save(); }
    main.append(h('div.cb-top',
      h('span.small.muted', `Turno ${c.round}${c.context.boss ? ' · CHEFE' : ''}${c.context.source === 'siege' ? ' · Muralha' : ''}`),
      h('span.spacer'),
      helpButton('combate'),
      button('☰', () => import('./shell.js').then((m) => m.openPauseMenu()), { kind: ['ghost', 'small'], title: 'Menu' })));
    if (c.result) { renderResult(G, main, dock); return; }
    main.append(renderTimeline(G));
    const enemies = c.actors.filter((a) => a.side === 'enemy' && !a.dead && !a.gone);
    main.append(h('div.cb-enemies', enemies.map((a) => enemyCard(G, a))));
    main.append(heroPanel(G));
    main.append(renderLog(G, ui.showLog));
    renderDock(G, dock);
    setTimeout(playEvents, 20);
    hintOnce('combate');
    if (enemies.some((a) => a.intent?.windup || a.flags.charging)) hintOnce('intencoes');
  },
};

export default [combatScreen];
export function init() {}
