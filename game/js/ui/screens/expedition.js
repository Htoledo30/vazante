// Telas de expedição (Área C): partida ('travel'), mapa de nós ('map'), acampamento ('camp') e lugares ('node').
import { h, button, bar, chip, section, kv, prose, grid, tabs, clear } from '../dom.js';
import { go, refresh, sheet, modal, toastMsg, layoutEls, currentScreen } from '../app.js';
import { getG } from '../../core/state.js';
import { save } from '../../core/save.js';
import { sfx } from '../../core/bus.js';
import * as EX from '../../systems/expedition.js';
import * as CAMP from '../../systems/camp.js';
import { REGIONS, REGION_ORDER, NODE_TYPES } from '../../data/regions.js';
import { helpButton, hintOnce } from '../help.js';

const svgNS = 'http://www.w3.org/2000/svg';
function S(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

function linesEl(lines) {
  return h('div.ex-lines', (lines || []).filter((l) => l && l.text).map((l) => h('div.ex-line', { class: `t-${l.kind || 'info'}` }, l.text)));
}

/** Segue o resultado de um sistema: morte (o fluxo assume), navegação, linhas. */
function follow(res, { stay = 'map' } = {}) {
  const G = getG();
  if (!res) return;
  if (res.why && res.ok === false) { toastMsg(res.why, 'warn'); refresh(); return; }
  if (res.died) return; // heroDied já navegou
  if (G.campaign?.ended) { go('ending', {}, { replace: true }); return; }
  const nav = res.nav;
  if (nav?.screen) go(nav.screen, nav.params || {}, { replace: true });
  else if (stay) refresh();
}

function fieldBar(G) {
  const fs = EX.fieldStatus(G);
  if (!fs) return null;
  return h('div.ex-field',
    h('div.ex-field-row',
      h('b', fs.regionName), h('span.spacer'),
      h('span.small', { class: fs.night ? 't-dread' : '' }, `${fs.night ? '☾ noite' : '☀ dia'} · ${String(fs.hour).padStart(2, '0')}h`)),
    h('div.ex-field-row.row-wrap',
      chip(`${fs.lit ? '🔥' : '◌'} ${fs.torchLit && fs.light > 0 ? `${fs.light}h` : 'apagada'} +${fs.torches} tocha(s)`, fs.lit ? 'warn' : fs.dark ? 'bad' : 'info', 'Luz: no escuro você perde Pavor por hora, é emboscado mais e não vê os caminhos.'),
      chip(`🍖 ${fs.rations} · ${fs.hungerLabel}`, fs.hungerLevel >= 2 ? 'bad' : fs.hungerLevel === 1 ? 'warn' : 'good', 'Uma ração a cada 12h. Come sozinho se tiver.'),
      chip(`⚖ ${fs.load.load}/${fs.load.max}`, fs.load.overloaded ? 'bad' : '', 'Peso acima da capacidade: viagens mais lentas.'),
      chip(`⚠ emboscada ${fs.ambush}%`, fs.ambush >= 30 ? 'bad' : 'info', 'Chance de emboscada por viagem agora.'),
      fs.flesh ? chip('☣ carne do deus', 'corr', 'Cada hora aqui corrompe.') : null));
}

// =====================================================================================
// PARTIDA
// =====================================================================================
const tv = { region: null, from: 'entry' };

const travelScreen = {
  id: 'travel',
  onEnter(params) { if (params?.region) tv.region = params.region; },
  render({ main, dock }) {
    const G = getG();
    if (!G?.hero) { dock.append(button('Voltar', () => go('city'), { kind: 'wide' })); return; }
    if (G.expedition) { go('map', {}, { replace: true }); return; }
    const sums = REGION_ORDER.map((id) => EX.regionSummary(G, id));
    if (!tv.region || !sums.find((s) => s.id === tv.region && s.unlocked)) tv.region = (sums.filter((s) => s.unlocked).pop() || sums[0]).id;
    main.append(h('h2', 'O Portão de Valdrem'));
    main.append(h('p.small.muted', 'Escolha para onde ir. Cada hora conta: a Chaga não espera. ', helpButton('expedicao')));
    main.append(h('div.ex-regions', sums.map((s) => h('button.ex-region', {
      type: 'button', class: [s.id === tv.region ? 'is-selected' : '', s.unlocked ? '' : 'is-locked'].join(' '),
      on: { click: () => { if (!s.unlocked) { toastMsg(s.why || 'Bloqueada.', 'warn'); return; } tv.region = s.id; tv.from = 'entry'; refresh(); } },
    },
    h('div.row', h('b', s.name), h('span.spacer'), h('span.small', s.unlocked ? `${s.travelHours}h de estrada` : '🔒')),
    h('div.small.muted', s.unlocked ? s.desc : s.why),
    s.unlocked ? h('div.row.row-wrap.small',
      chip(`mapa ${s.known}/${s.total}`, 'info'),
      s.bossDead ? chip(`${s.bossName} morto`, 'good') : chip(s.bossName, 'blood'),
      s.nests ? chip(`${s.nests} ninho(s)${s.maxGrowth >= 3 ? ' TRANSBORDANDO' : ''}`, 'rot') : null,
      s.carcasses ? chip(`${s.carcasses} carcaça(s) sua(s)`, 'warn') : null,
      s.shortcuts ? chip(`${s.shortcuts} passagem(ns)`, 'good') : null) : null))));

    const sc = EX.supplyCheck(G, tv.region);
    main.append(section('Suprimentos',
      grid([kv('Tochas', `${sc.torches} (~${sc.torchHours}h de luz)`), kv('Rações', `${sc.rations} (~${Math.max(0, Math.round(sc.foodHours))}h)`), kv('Bandagens', sc.bandages), kv('Carga', `${sc.load.load}/${sc.load.max}`, sc.load.overloaded ? 'bad' : ''), kv('Vida', `${sc.hp}/${sc.hpMax}`), kv('Pavor', sc.dread)], 2),
      sc.warn.length ? h('div.ex-warn', sc.warn.map((w) => h('div.small', { class: `t-${w.kind}` }, `• ${w.text}`))) : h('div.small.t-good', 'Tudo em ordem. Na medida do possível.')));
    const starts = EX.startOptions(G, tv.region);
    if (starts.length > 1) {
      main.append(section('Por onde', h('div.stack', starts.map((s) => button(s.label, () => { tv.from = s.id; refresh(); },
        { kind: ['left', tv.from === s.id ? 'primary' : ''].filter(Boolean), sub: `${s.hours}h${s.depth ? ` · começa na profundidade ${s.depth}` : ''}` })))));
    }
    const can = EX.canStartExpedition(G, tv.region, { from: tv.from });
    dock.append(h('div.dock-row',
      button('Cidade', () => go('city'), { kind: 'ghost' }),
      button('Ficha', () => go('sheet', { tab: 'inv' }), { kind: 'ghost' }),
      button(`Partir`, async () => {
        if (sc.warn.some((w) => w.kind === 'bad')) {
          const ok = await import('./shell.js').then((m) => m.confirmRisky(`Partir mesmo assim?\n\n${sc.warn.filter((w) => w.kind === 'bad').map((w) => w.text).join('\n')}`, { title: 'Partir' }));
          if (!ok) return;
        }
        const r = EX.startExpedition(G, tv.region, { from: tv.from });
        if (!r.ok) { toastMsg(r.why || 'Não dá para partir.', 'warn'); return; }
        sfx('door');
        follow(r);
      }, { kind: 'primary', disabled: !can.ok, why: can.why, sub: `${(starts.find((s) => s.id === tv.from) || starts[0]).hours}h de viagem` })));
  },
};

// =====================================================================================
// MAPA
// =====================================================================================
let sel = null;
let logOpen = false;

function drawMap(G) {
  const exp = G.expedition;
  const mv = EX.mapView(G, exp.region);
  const pal = mv.palette || {};
  // recorta o mapa ao que já foi visto (com folga), para não sobrar um vazio enorme
  const ys = mv.nodes.map((n) => n.y);
  const y0 = Math.max(0, Math.min(...ys) - 12);
  const y1 = Math.min(mv.h, Math.max(...ys) + 12);
  const vh = Math.max(60, y1 - y0);
  const vy = Math.max(0, Math.min(y0, mv.h - vh));
  const svg = S('svg', { viewBox: `0 ${vy} ${mv.w} ${vh}`, class: 'ex-svg', preserveAspectRatio: 'xMidYMin meet', role: 'img', 'aria-label': 'Mapa da região' });
  svg.append(S('rect', { x: 0, y: 0, width: mv.w, height: mv.h, fill: pal.bg || '#15110e' }));
  const pos = Object.fromEntries(mv.nodes.map((n) => [n.id, n]));
  for (const e of mv.edges) {
    const a = pos[e.a], b = pos[e.b];
    if (!a || !b) continue;
    const near = (a.current && b.adjacent) || (b.current && a.adjacent);
    svg.append(S('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `ex-edge${e.walked ? ' is-walked' : ''}${near ? ' is-near' : ''}${e.hazard ? ' is-hazard' : ''}`, stroke: e.walked ? (pal.glow || '#c96a2a') : (pal.edge || '#5d4a38') }));
  }
  for (const n of mv.nodes) {
    const t = n.type ? NODE_TYPES[n.type] : null;
    const cls = ['ex-node', n.current ? 'is-current' : '', n.adjacent ? 'is-adj' : '', n.cleared ? 'is-cleared' : '', n.known ? '' : 'is-unknown',
      n.dead ? 'is-dead' : '', sel === n.id ? 'is-sel' : '', n.type ? `t-${n.type}` : ''].filter(Boolean).join(' ');
    const g = S('g', { class: cls, transform: `translate(${n.x} ${n.y})`, 'data-id': n.id });
    g.append(S('circle', { r: 7.5, class: 'ex-hit' }));
    g.append(S('circle', { r: 5.2, class: 'ex-dot' }));
    g.append(S('text', { class: 'ex-icon', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.3 }, t ? t.icon : '?'));
    if (n.carcass) g.append(S('text', { class: 'ex-mark', x: 5, y: -5, 'text-anchor': 'middle' }, '☠'));
    if (n.nestGrowth) g.append(S('text', { class: 'ex-mark', x: -5.5, y: -5, 'text-anchor': 'middle' }, String(n.nestGrowth)));
    if (n.shortcut) g.append(S('text', { class: 'ex-mark', x: 5.5, y: 6.5, 'text-anchor': 'middle' }, '⇅'));
    g.addEventListener('click', () => { sel = n.id; sfx('tap'); refresh(); });
    svg.append(g);
  }
  return svg;
}

function nodePanel(G) {
  const exp = G.expedition;
  if (!sel || !G.world.regions[exp.region].map.nodes[sel]) sel = null;
  if (!sel) {
    const here = EX.nodeName(G, exp.region, exp.node);
    const t = NODE_TYPES[EX.nodeType(G, exp.region, exp.node)];
    return h('div.panel.ex-sel', h('div.small.muted', 'Você está em'), h('b', `${t?.icon || ''} ${here}`), h('div.small.muted', 'Toque num lugar ligado ao seu (anel claro) para ver o caminho.'));
  }
  const info = EX.moveInfo(G, sel);
  const t = info.type ? NODE_TYPES[info.type] : null;
  return h('div.panel.ex-sel',
    h('div.row', h('b', `${t?.icon || '?'} ${info.name}`), h('span.spacer'), info.cleared ? chip('limpo', 'good') : info.visited ? chip('visitado', 'info') : null),
    h('div.small.muted', t ? t.desc : 'Você não sabe o que há lá. A luz mostraria.'),
    info.adjacent ? h('div.small', `Caminho: ${info.edge?.name} · ${info.hours}h · emboscada ${info.ambush}%`) : null,
    info.hazard ? h('div.small.t-warn', `Perigo: ${info.hazard.name} — ${info.hazard.text} (${info.hazard.check.attr.toUpperCase()} ${info.hazard.chance}%)`) : null,
    info.threat ? h('div.small.t-bad', `Você viu: ${info.threat.n} inimigo(s)${info.threat.elite ? ', um deles grande' : ''}.`) : null,
    info.carcass ? h('div.small.t-blood', `Aqui jaz ${info.carcass.name}.`) : null);
}

const mapScreen = {
  id: 'map',
  render({ main, dock }) {
    const G = getG();
    const exp = G?.expedition;
    if (!exp) { main.append(prose('Você não está no Ermo.')); dock.append(button('Cidade', () => go('city', {}, { replace: true }), { kind: ['primary', 'wide'] })); return; }
    if (exp.camping) exp.camping = false;
    main.append(fieldBar(G));
    const wrap = h('div.ex-map-wrap', drawMap(G));
    main.append(wrap);
    main.append(nodePanel(G));
    const log = EX.expeditionLog(G).slice(logOpen ? -40 : -5);
    main.append(h('div.ex-log', { class: logOpen ? 'is-open' : '', on: { click: () => { logOpen = !logOpen; refresh(); } } },
      log.map((l) => h('div.ex-log-line', { class: `t-${l.kind || 'info'}` }, l.text)),
      h('div.small.muted', logOpen ? 'Toque para recolher' : 'Toque para ver mais')));

    // centraliza o nó atual
    setTimeout(() => {
      const el = layoutEls();
      const cur = el?.main?.querySelector('.ex-node.is-current');
      if (cur && !mapScreen.scrolled) { cur.scrollIntoView({ block: 'center' }); mapScreen.scrolled = true; }
    }, 30);

    const info = sel ? EX.moveInfo(G, sel) : null;
    const feats = EX.nodeFeatures(G, exp.node);
    const row1 = h('div.dock-row');
    if (info && info.adjacent) {
      row1.append(button(`Ir: ${info.name}`, () => {
        const r = EX.moveTo(G, sel);
        if (!r.ok) { toastMsg(r.why || 'Não dá.', 'warn'); return; }
        sel = null; mapScreen.scrolled = false;
        follow(r);
      }, { kind: 'primary', disabled: info.disabled, why: info.why, sub: `${info.hours}h · emboscada ${info.ambush}%` }));
    } else row1.append(button('Escolha um caminho', null, { kind: 'ghost', disabled: true, why: 'Toque num lugar ligado ao seu no mapa.' }));
    if (feats.length) row1.append(button('Explorar aqui', () => go('node', { id: exp.node }), { kind: 'blood', sub: feats.map(featName).join(', ') }));
    dock.append(row1);
    const fs = EX.fieldStatus(G);
    dock.append(h('div.dock-row',
      button('Acampar', () => go('camp'), { kind: 'small', sub: 'descansar' }),
      button(exp.torchLit ? 'Apagar' : 'Tocha', () => { const r = EX.toggleTorch(G); if (r.ok === false) toastMsg(r.why || 'Sem tochas.', 'warn'); save(); refresh(); },
        { kind: 'small', sub: exp.torchLit ? `${fs.light}h` : `${fs.torches} sobrando` }),
      button('Comer', () => { const r = EX.eatNow(G); if (!r.ok) toastMsg(r.why, 'warn'); else toastMsg('Você come. A fome cede.', 'good'); save(); refresh(); }, { kind: 'small', sub: `${fs.rations} ração`, disabled: !fs.rations, why: 'Sem rações.' }),
      button('Ficha', () => go('sheet'), { kind: 'small' }),
      button('Voltar', () => returnSheet(G), { kind: 'small', sub: 'à cidade' })));
    hintOnce('expedicao');
    if (fs.dark && !fs.lit) hintOnce('luz');
    if (fs.hungerLevel >= 1) hintOnce('fome');
  },
};

const FEAT_NAMES = { stalk: 'inimigos à vista', passage: 'passagem', ruin: 'ruína', shrine: 'santuário', merchant: 'mercador', vein: 'veio de Icor', nest: 'ninho', boss: 'covil', campsite: 'abrigo', carcass: 'carcaça' };
const featName = (f) => FEAT_NAMES[f] || f;

function returnSheet(G) {
  const can = EX.canReturn(G);
  if (!can.ok) { toastMsg(can.why, 'warn'); return; }
  const opts = EX.exitOptions(G);
  const sh = sheet({
    title: 'Voltar a Valdrem',
    body: h('div',
      h('p.small.muted', 'Você refaz o caminho conhecido. Emboscadas ainda podem acontecer no trajeto.'),
      h('div.stack', opts.map((o) => button(`${o.kind === 'passage' ? 'Passagem: ' : 'Entrada: '}${o.name}`, () => {
        sh.close();
        const r = EX.returnToCity(G, o.id);
        if (r.done && r.summary) {
          const s = r.summary;
          setTimeout(() => modal({ title: 'De volta a Valdrem', body: h('div', kv('Horas fora', s.hours), kv('Icor', `${s.ichor >= 0 ? '+' : ''}${s.ichor}`), kv('Moedas', `${s.coin >= 0 ? '+' : ''}${s.coin}`), kv('Lugares', s.nodes), kv('Lutas', `${s.wins}/${s.fights}`), s.nests ? kv('Ninhos destruídos', s.nests) : null), buttons: [{ label: 'Ok', kind: 'primary' }] }), 200);
        }
        follow(r);
      }, { kind: 'left', sub: `${o.steps} passo(s) · ${o.walk}h + ${o.road}h de estrada · risco ${o.risk}%` })))),
    buttons: [{ label: 'Ficar', kind: 'ghost' }],
  });
}

// =====================================================================================
// ACAMPAMENTO
// =====================================================================================
const cp = { hours: 8, fire: true, watch: false, cook: true, pray: false, last: null };

const campScreen = {
  id: 'camp',
  render({ main, dock }) {
    const G = getG();
    const exp = G?.expedition;
    if (!exp) { dock.append(button('Cidade', () => go('city', {}, { replace: true }), { kind: 'wide' })); return; }
    exp.camping = true;
    const o = CAMP.campOptions(G);
    if (!o.fire.ok) cp.fire = false;
    if (!o.cook.ok) cp.cook = false;
    const plan = CAMP.campPlan(G, cp);
    main.append(fieldBar(G));
    main.append(h('h2', `Acampar — ${EX.nodeName(G, exp.region, exp.node)}`));
    main.append(h('p.small.muted', o.safeSite ? 'Lugar defensável: menos emboscadas.' : 'Terreno aberto.', ' ', helpButton('acampar')));
    const tog = (k, label, sub, ok = true, why = '') => button(`${cp[k] ? '☑' : '☐'} ${label}`, () => { cp[k] = !cp[k]; refresh(); }, { kind: ['left', cp[k] ? 'primary' : ''].filter(Boolean), sub, disabled: !ok, why });
    main.append(section('Plano',
      h('div.grid.grid-2',
        button('4 horas', () => { cp.hours = 4; refresh(); }, { kind: cp.hours === 4 ? 'primary' : 'ghost', sub: 'cochilo' }),
        button('8 horas', () => { cp.hours = 8; refresh(); }, { kind: cp.hours === 8 ? 'primary' : 'ghost', sub: 'noite inteira' })),
      h('div.stack',
        tog('fire', 'Fogueira', 'cura mais, afasta o escuro, atrai olhares (gasta sebo ou tocha)', o.fire.ok, o.fire.why),
        tog('cook', 'Cozinhar', 'ração + ervas no fogo: mata a fome melhor, cura', o.cook.ok && cp.fire, o.cook.ok ? 'Precisa de fogueira.' : o.cook.why),
        tog('watch', 'Dormir em vigia', 'metade da emboscada, metade do descanso'),
        tog('pray', 'Rezar', 'teste de VON contra o Pavor'))));
    main.append(section('Previsão',
      grid([kv('Emboscada', `${plan.ambush}%`, plan.ambush >= 30 ? 'bad' : ''), kv('Cura', `+${plan.heal}`), kv('Pavor', `${plan.dread}`), kv('Duração', `${plan.hours}h`)], 2),
      plan.warnings.length ? h('div.ex-warn', plan.warnings.map((w) => h('div.small.t-warn', `• ${w}`))) : null));
    if (cp.last) main.append(section('Última noite', linesEl(cp.last)));
    const wounds = (G.hero.wounds || []).filter((w) => !w.treated || w.infected);
    dock.append(h('div.dock-row',
      button('Levantar', () => { CAMP.breakCamp(G); cp.last = null; go('map', {}, { replace: true }); }, { kind: 'ghost' }),
      button('Feridas', () => go('sheet', { tab: 'corpo' }), { kind: 'ghost', badge: wounds.length || null }),
      button(`Acampar ${cp.hours}h`, () => {
        const r = CAMP.campAt(G, cp);
        if (r.ok === false) { toastMsg(r.why, 'warn'); return; }
        cp.last = r.lines;
        sfx('camp');
        follow(r, { stay: 'camp' });
      }, { kind: 'primary', sub: `emboscada ${plan.ambush}%` })));
    hintOnce('acampar');
  },
};

// =====================================================================================
// LUGAR (nó)
// =====================================================================================
const nodeScreen = {
  id: 'node',
  render({ main, dock }) {
    const G = getG();
    const exp = G?.expedition;
    if (!exp) { dock.append(button('Cidade', () => go('city', {}, { replace: true }), { kind: 'wide' })); return; }
    const nid = exp.node;
    const feats = EX.nodeFeatures(G, nid);
    const t = NODE_TYPES[EX.nodeType(G, exp.region, nid)];
    main.append(fieldBar(G));
    main.append(h('h2', `${t?.icon || ''} ${EX.nodeName(G, exp.region, nid)}`));
    if (!feats.length) main.append(prose('Não há mais nada aqui.'));
    for (const f of feats) {
      const fn = FEATURES[f];
      if (fn) main.append(fn(G));
    }
    const log = EX.expeditionLog(G).slice(-4);
    if (log.length) main.append(h('div.ex-log', log.map((l) => h('div.ex-log-line', { class: `t-${l.kind || 'info'}` }, l.text))));
    const canLeave = !feats.includes('stalk') && !(feats.includes('carcass') && exp.carcassDone?.[nid]);
    dock.append(h('div.dock-row',
      button('Ficha', () => go('sheet'), { kind: 'ghost' }),
      button('Voltar ao mapa', () => go('map', {}, { replace: true }), { kind: 'primary', disabled: !canLeave, why: feats.includes('stalk') ? 'Decida: atacar, passar escondido ou recuar.' : 'Decida o que fazer com o corpo.' })));
  },
};

const act = (fn) => () => { const G = getG(); const r = fn(G); follow(r, { stay: 'node' }); };

const FEATURES = {
  stalk(G) {
    const v = EX.stalkView(G);
    return section('Você os vê primeiro',
      h('p.small', `${v.n} inimigo(s)${v.elite ? ', um deles enorme' : ''}. ${v.text}`),
      h('div.stack',
        button('Atacar primeiro', act(EX.stalkAttack), { kind: 'blood', sub: 'emboscada sua: eles começam desprevenidos' }),
        button('Passar escondido', act(EX.stalkSneak), { sub: `1h · DES ${v.sneak.chance}% · falha: emboscada deles` }),
        v.canBack ? button('Recuar por onde veio', () => { const G2 = getG(); const r = EX.moveTo(G2, G2.expedition.prev, { retreat: true }); follow(r); }, { kind: 'ghost' }) : null));
  },
  passage(G) {
    return section('Passagem aberta', h('p.small', 'Daqui se volta direto para Valdrem — e a Casa pode sair por aqui nas próximas expedições.'),
      button('Voltar a Valdrem por aqui', () => returnSheet(G), { kind: 'primary' }));
  },
  campsite() {
    return section('Abrigo', h('p.small', 'Paredes, uma porta, um lugar para as costas. Acampar aqui é bem mais seguro.'), button('Acampar aqui', () => go('camp'), { kind: 'primary' }));
  },
  ruin(G) {
    const v = EX.ruinView(G);
    return section('Ruína',
      v.trap ? h('div.small.t-warn', `Armadilha: ${v.trap.name}. ${v.trap.text}${v.disarmed ? ' (desarmada)' : ''}`) : v.noTrap ? h('div.small.t-good', 'Sem armadilhas.') : h('div.small.muted', 'Você não sabe se há armadilhas.'),
      h('div.stack', v.opts.map((o) => button(o.label, act((G2) => EX.ruinAct(G2, o.id)), { kind: o.kind, sub: o.sub, disabled: o.disabled, why: o.why }))),
      helpButton('itens'));
  },
  shrine(G) {
    const v = EX.shrineView(G);
    return section(v.rotten ? 'Santuário tomado pela Chaga' : 'Santuário',
      h('div.stack', v.rites.map((r) => button(r.name, act((G2) => EX.shrineRite(G2, r.id)), { kind: ['left', r.rot ? 'blood' : ''].filter(Boolean), sub: `${r.desc} · ${r.sub}`, disabled: r.disabled, why: r.why })),
        v.canListen ? button('Escutar o altar', act(EX.shrineListen), { kind: 'ghost', sub: 'algo pode responder' }) : null));
  },
  merchant(G) {
    const v = EX.merchantView(G);
    if (!v) return null;
    return section(`${v.name} · bolsa ${v.purse}`,
      v.inspected === 'trap' ? h('div.small.t-bad', 'É uma isca. Gente armada na mata.') : v.inspected === 'honest' ? h('div.small.t-good', 'Parece honesto.') : null,
      !v.inspect.done ? button('Avaliar o mercador', act(EX.merchantInspect), { kind: 'ghost', sub: `AST ${v.inspect.chance}%` }) : null,
      h('div.small.muted', 'Comprar'),
      h('div.stack', v.stock.map((s) => button(s.name, act((G2) => EX.merchantBuy(G2, s.idx)), { kind: 'left', sub: `${s.price} moedas`, disabled: s.disabled, why: s.why }))),
      v.sellables.length ? h('details.ex-sell', h('summary.small', `Vender (${v.sellables.length})`), h('div.stack', v.sellables.map((s) => button(`${s.name}${s.n > 1 ? ` ×${s.n}` : ''}`, act((G2) => EX.merchantSell(G2, s.uid)), { kind: ['left', 'small'], sub: `${s.price} moedas`, disabled: s.disabled, why: s.why })))) : null,
      button('Roubar a carroça', async () => { const ok = await import('./shell.js').then((m) => m.confirmRisky('Atacar o mercador? Ele tem guardas. A Guilda vai saber.', { title: 'Roubar' })); if (ok) act(EX.merchantRob)(); }, { kind: 'danger', sub: 'luta · Guilda −5' }));
  },
  vein(G) {
    const v = EX.veinView(G);
    return section(`Veio de Icor · ${v.left} sangria(s) restante(s)`,
      h('p.small.muted', 'Cada sangria faz barulho e cheiro. Quanto mais você colhe, mais coisas vêm.'),
      h('div.stack', v.opts.map((o) => button(o.label, act((G2) => EX.veinHarvest(G2, o.id)), { kind: o.kind, sub: o.sub, disabled: o.disabled, why: o.why }))));
  },
  nest(G) {
    const v = EX.nestView(G);
    return section(`Ninho · crescimento ${v.growth}/5`,
      h('p.small', v.text), h('p.small.muted', `${v.n} criatura(s). Destruir: Chaga −3. Ignorado, cresce e transborda.`),
      h('div.stack',
        button('Atacar o ninho', act((G2) => EX.nestAssault(G2, {})), { kind: 'blood' }),
        button('Queimar primeiro', act((G2) => EX.nestAssault(G2, { burn: true })), { sub: 'menos inimigos, você ataca primeiro', disabled: v.burn.disabled, why: v.burn.why })));
  },
  boss(G) {
    const v = EX.bossView(G);
    return section(v.name,
      h('p', v.text),
      v.escorts ? h('p.small.t-warn', `Não está só: ${v.escorts} a acompanha(m).`) : null,
      v.warn.length ? h('div.ex-warn', v.warn.map((w) => h('div.small.t-warn', `• ${w}`))) : null,
      button(`Enfrentar ${v.name}`, async () => { const ok = await import('./shell.js').then((m) => m.confirmRisky(`Enfrentar ${v.name}? Não há fuga.`, { title: 'Covil' })); if (ok) act(EX.bossFight)(); }, { kind: ['blood', 'wide'] }));
  },
  carcass(G) {
    const v = EX.carcassView(G);
    const exp = G.expedition;
    if (!v && exp.carcassDone?.[exp.node] == null) return null;
    if (exp.carcassDone?.[exp.node] != null) {
      return section('O corpo',
        h('p.small', 'O que fazer com o que sobrou?'),
        h('div.stack',
          button('Enterrar', act((G2) => EX.carcassRite(G2, 'bury')), { sub: '2h · −15 Pavor' }),
          button('Queimar', act((G2) => EX.carcassRite(G2, 'burn')), { sub: '1h · −8 Pavor · nada levanta daqui', disabled: !v?.canBurn && !(exp.light > 0), why: 'Sem fogo.' }),
          button('Deixar', act((G2) => EX.carcassRite(G2, 'leave')), { kind: 'ghost', sub: 'corpos aqui não ficam quietos' })));
    }
    return section(`Carcaça: ${v.name}`,
      h('p.small', `${v.name}, nível ${v.level}. ${v.cause || ''}`),
      v.guarded === 'aberration' ? h('p.small.t-blood', 'O corpo não está quieto. Ele se mexe. Veste o que você deu a ele.') : v.guarded === 'scavengers' ? h('p.small.t-bad', 'Algo está comendo o corpo.') : null,
      h('p.small.muted', `${v.items.length} item(ns)${v.coin ? `, ${v.coin} moedas` : ''}${v.ichor ? `, ${v.ichor} Icor` : ''}.`),
      button(v.guarded ? 'Aproximar-se (luta)' : 'Recuperar', act(EX.carcassApproach), { kind: v.guarded ? 'blood' : 'primary' }));
  },
};

export default [travelScreen, mapScreen, campScreen, nodeScreen];

export function init() {
  EX.registerHooks({ go: (screen, params = {}, opts = { replace: true }) => go(screen, params, opts) });
}
