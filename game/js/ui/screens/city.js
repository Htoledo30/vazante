// Telas de Valdrem e da campanha (Área D): introdução, hub da cidade, serviços, herdeiros, cerco, Coração, final, diário, facções.
import { h, button, bar, chip, section, kv, prose, grid, tabs, clear } from '../dom.js';
import { go, back, refresh, modal, sheet, toastMsg, clearHistory, currentScreen } from '../app.js';
import { getG } from '../../core/state.js';
import { save, wipe } from '../../core/save.js';
import { sfx } from '../../core/bus.js';
import * as flow from '../../systems/flow.js';
import * as CT from '../../systems/city.js';
import * as TM from '../../systems/time.js';
import * as FA from '../../systems/factions.js';
import * as CO from '../../systems/contracts.js';
import * as SG from '../../systems/siege.js';
import * as LN from '../../systems/lineage.js';
import * as CP from '../../systems/campaign.js';
import * as IT from '../../systems/items.js';
import * as CH from '../../systems/character.js';
import * as EV from '../../systems/events.js';
import { startCombat } from '../../systems/combat/index.js';
import { SERVICES, SERVICE_ORDER, HOUSE_UPGRADES, PENANCES, BLESSINGS, BARBER } from '../../data/city.js';
import { FACTIONS, FACTION_IDS, QUESTLINES, REP_TIERS } from '../../data/factions.js';
import { INTRO, LEGACIES, ENDINGS, FRAGMENTS, BOSS_NAMES } from '../../data/story.js';
import { BACKGROUNDS } from '../../data/backgrounds.js';
import { TRAITS } from '../../data/traits.js';
import { REGION_NAMES } from '../../data/contracts.js';
import { helpButton, hintOnce } from '../help.js';
import { itemSheet } from './character.js';

// ------------------------------------------------------------------ utilidades de UI
function linesEl(lines) {
  return h('div.ct-lines', (lines || []).filter((l) => l && l.text).map((l) => h('div.ct-line', { class: `t-${l.kind || 'info'}` }, l.text)));
}
function showLines(title, lines, after) {
  if (!lines?.length) { after?.(); return; }
  modal({ title, body: linesEl(lines), buttons: [{ label: 'Ok', kind: 'primary', onClick: after }], onClose: after ? undefined : undefined });
}

/** Resultado de uma ação da cidade: avisa, salva, redesenha e trata interrupções (morte, cerco, evento...). */
function done(res, title = '') {
  const G = getG();
  if (!res) return;
  if (res.ok === false) { toastMsg(res.reason || res.why || 'Não dá.', 'warn'); sfx('deny'); return; }
  save();
  if (res.died || G.hero?.dead) return; // fluxo de morte assume
  if (G.campaign.ended) { go('ending', {}, { replace: true }); return; }
  const interrupt = CT.cityInterrupt(G);
  if (res.pending?.some((p) => p.type === 'loot') && G.pendingLoot) { G.pendingLoot.source = 'city'; showLines(title, res.lines, () => go('loot')); return; }
  if ((G.hero?.mutationPending || 0) > 0) { showLines(title, res.lines, () => go('mutation')); return; }
  refresh();
  showLines(title, res.lines, () => { if (interrupt) go('city', {}, { replace: true }); });
}

const hours = (n) => (n >= 24 ? `${Math.round(n / 24 * 10) / 10} dia(s)` : `${n}h`);
const repLabel = (v) => { let t = REP_TIERS[0]; for (const x of REP_TIERS) if (v >= x.min) t = x; return t; };

// =====================================================================================
// INTRODUÇÃO
// =====================================================================================
const intro = { step: 0, house: null, legacy: null, sugg: null };

const introScreen = {
  id: 'intro',
  hud: false,
  onEnter() { intro.step = 0; intro.house = null; intro.legacy = null; intro.sugg = null; },
  render({ main, dock }) {
    const G = getG();
    if (!G) { go('title', {}, { replace: true }); return; }
    if (G.hero) { go('city', {}, { replace: true }); return; }
    const S = INTRO[intro.step] || INTRO[INTRO.length - 1];
    if (!intro.sugg) intro.sugg = CP.suggestHouseNames(undefined, 4);
    if (!intro.house) intro.house = intro.sugg[0];
    if (!intro.legacy) intro.legacy = LEGACIES[0].id;
    const house = intro.house || G.lineage.house;
    main.append(h('div.ct-intro', h('div.ct-intro-step.small.muted', `${intro.step + 1}/${INTRO.length}`), h('h1.ct-intro-title', S.title),
      prose(S.text.replace(/\{house\}/g, house))));
    if (S.kind === 'house') {
      main.append(h('div.ct-house',
        h('div.grid.grid-2', intro.sugg.map((n) => button(`Casa ${n}`, () => { intro.house = n; refresh(); }, { kind: intro.house === n ? 'primary' : 'ghost' }))),
        h('input.ch-name-input', { type: 'text', placeholder: 'Ou escreva um nome', maxLength: 24, value: intro.house && !intro.sugg.includes(intro.house) ? intro.house : '',
          on: { change: (e) => { const v = String(e.target.value || '').trim(); if (v) { intro.house = v; refresh(); } } } })));
    }
    if (S.kind === 'legacy') {
      main.append(h('div.stack', LEGACIES.map((L) => button(L.name, () => { intro.legacy = L.id; refresh(); }, { kind: ['left', intro.legacy === L.id ? 'primary' : ''].filter(Boolean), sub: L.desc }))));
    }
    const canNext = S.kind === 'house' ? !!intro.house : S.kind === 'legacy' ? !!intro.legacy : true;
    dock.append(h('div.dock-row',
      intro.step > 0 ? button('Voltar', () => { intro.step -= 1; refresh(); }, { kind: 'ghost' }) : button('Título', () => go('title'), { kind: 'ghost' }),
      button(S.btn || 'Continuar', () => {
        if (S.kind === 'house') CP.setHouse(G, intro.house);
        if (S.kind === 'legacy') CP.setLegacy(G, intro.legacy);
        if (S.kind === 'go' || intro.step >= INTRO.length - 1) {
          G.campaign.flags.introDone = true;
          save();
          go('create', { fresh: true }, { replace: true });
          return;
        }
        intro.step += 1;
        save();
        refresh({ scrollTop: true });
      }, { kind: 'primary', disabled: !canNext, why: S.kind === 'house' ? 'Escolha um nome.' : 'Escolha um legado.' })));
  },
};

// =====================================================================================
// HUB DA CIDADE
// =====================================================================================
function checkCityFlow(G) {
  if (G.campaign.ended) { go('ending', {}, { replace: true }); return true; }
  if ((!G.hero || G.hero.dead) && G.lineage.heirs?.length) { go('heirs', {}, { replace: true }); return true; }
  if (!G.hero) { go('create', { fresh: true }, { replace: true }); return true; }
  if (G.combat) { go('combat', {}, { replace: true }); return true; }
  if (G.event) { go('event', {}, { replace: true }); return true; }
  if (G.pendingLoot && ((G.pendingLoot.items || []).length || G.pendingLoot.coin || G.pendingLoot.ichor)) { go('loot', {}, { replace: true }); return true; }
  if (G.expedition) { go('map', {}, { replace: true }); return true; }
  if (G.campaign.pendingSiege?.ready || G.campaign.pendingSiege?.fight) { go('siege', {}, { replace: true }); return true; }
  return false;
}

function maybeDawn(G) {
  const id = CT.dawnEvent(G);
  if (!id) return false;
  try {
    EV.startEvent(G, id, { source: 'daily' });
    save();
    go('event', {}, { replace: true });
    return true;
  } catch (e) { console.error(e); return false; }
}

function threatModal(G) {
  const t = G.city.threat;
  if (!t || threatModal.open) return;
  threatModal.open = true;
  const fl = CT.fleeHuntersView(G);
  const br = CT.bribeView(G);
  modal({
    title: `Caçadores: ${FACTIONS[t.f]?.short || ''}`,
    body: prose(t.text || FACTIONS[t.f]?.hunterText || 'Eles vieram por você.'),
    dismissable: false,
    onClose: () => { threatModal.open = false; },
    buttons: [
      { label: 'Lutar', kind: 'blood', onClick: () => { const spec = CT.threatSpec(G); startCombat(G, spec); save(); go('combat'); } },
      { label: 'Correr pelos becos', sub: `DES ${fl.chance}%`, onClick: () => {
        const r = CT.fleeHunters(G);
        save();
        if (r.escaped) { refresh(); showLines('Fuga', r.lines); }
        else { const spec = CT.threatSpec(G, { ambushed: true }); startCombat(G, spec); save(); showLines('Encurralado', r.lines, () => go('combat')); }
      } },
      br ? { label: br.cost ? `Pagar ${br.cost}` : 'Pagar', disabled: !br.can, why: br.why, onClick: () => done(CT.bribeHunters(G), 'Suborno') } : null,
    ].filter(Boolean),
  });
}

const cityScreen = {
  id: 'city',
  onEnter(params) {
    const G = getG();
    if (G?.campaign) CP.syncCampaign(G);
    if (params?.fromExpedition) hintOnce('cidade');
  },
  render({ main, dock }) {
    const G = getG();
    if (!G) { go('title', {}, { replace: true }); return; }
    if (checkCityFlow(G)) return;
    if (maybeDawn(G)) return;
    const t = TM.day(G);
    const hr = TM.hour(G);
    const rate = TM.chagaRate(G);
    const ps = SG.siegeWarning(G);
    main.append(h('div.ct-head',
      h('div.row', h('h2.ct-title', 'Valdrem'), h('span.spacer'), h('span.small.muted', `Dia ${t}, ${String(hr).padStart(2, '0')}h · Casa ${G.lineage.house}`)),
      h('div.ct-chaga', h('div.row.small', h('span.t-rot', `Chaga ${Math.round(G.chaga)}/100`), h('span.spacer'), h('span.muted', `+${rate.total}/dia`), helpButton('chaga')), bar(G.chaga, 100, 'chaga', '')),
      h('div.row.row-wrap.small',
        chip(`Muralha ${G.city.defense}`, G.city.defense >= 50 ? 'good' : 'warn', 'Força da muralha nos cercos.'),
        chip(`Moral ${G.city.morale ?? 50}`, (G.city.morale ?? 50) >= 50 ? 'info' : 'bad', 'Moral baixa: preços altos, Chaga mais rápida.'),
        chip(CP.actFor(G).title, 'info'))));

    // avisos
    const alerts = [];
    if (G.campaign.heartPending && CP.heartReady(G)) alerts.push(h('div.panel.ct-alert.is-gold', h('b', 'O Coração do deus'), h('div.small', 'Você chegou ao Coração. Decida o fim.'), button('Ir ao Coração', () => go('heart'), { kind: ['blood', 'wide'] })));
    if (ps) alerts.push(h('div.panel.ct-alert.is-bad', h('b', `CERCO: ${ps.name}`), h('div.small', ps.daysLeft > 0 ? `Chega em ${ps.daysLeft} dia(s). Invista na muralha ou esteja aqui para lutar.` : 'A horda está na muralha.'), helpButton('cerco')));
    if (G.city.threat) { alerts.push(h('div.panel.ct-alert.is-bad', h('b', 'Caçadores na rua'), button('Enfrentar', () => threatModal(G), { kind: 'blood' }))); setTimeout(() => threatModal(G), 50); }
    const ready = CO.contractsReady(G);
    if (ready.length) alerts.push(h('div.panel.ct-alert.is-good', h('b', `${ready.length} contrato(s) cumprido(s)`), h('div.small', 'Entregue no Quartel ou na Guilda.')));
    const qr = FA.questsReady(G);
    if (qr.length) alerts.push(h('div.panel.ct-alert.is-good', h('b', 'Missão pronta para entregar'), h('div.small', qr.map((f) => FACTIONS[f].short).join(', '))));
    if (CH.canLevelUp(G.hero)) alerts.push(h('div.panel.ct-alert.is-gold', h('b', 'Icor suficiente para subir de nível'), button('Beber Icor', () => go('levelup'), { kind: ['blood', 'small'] })));
    const loan = CT.loanView(G);
    if (loan.open) alerts.push(h('div.panel.ct-alert', h('b', `Dívida: ${loan.owe} moedas`), h('div.small', `Vence no dia ${loan.dueDay}.`)));
    if (G.lastExpedition && G.lastExpedition.day === t) {
      const s = G.lastExpedition;
      alerts.push(h('div.panel.ct-alert', h('div.small.muted', `Volta de ${s.regionName}: ${s.hours}h fora, ${s.ichor >= 0 ? '+' : ''}${s.ichor} Icor, ${s.coin >= 0 ? '+' : ''}${s.coin} moedas${s.bossDead ? ', chefe morto' : ''}.`)));
    }
    main.append(...alerts);

    // serviços
    const cards = [];
    for (const id of SERVICE_ORDER) {
      const s = SERVICES[id];
      const st = CT.serviceStatus(G, id);
      if (!st.visible) continue;
      cards.push(h('button.ct-svc', {
        type: 'button', class: st.open ? '' : st.lost ? 'is-lost' : 'is-closed',
        on: { click: () => { if (id === 'portao') { go('travel'); return; } if (st.lost) { toastMsg(st.reason, 'warn'); return; } go('svc', { id }); } },
      },
      h('div.ct-svc-ico', s.icon),
      h('div.ct-svc-body', h('div.ct-svc-name', s.name), h('div.small.muted', st.open ? (s.who || s.district) : st.reason))));
    }
    main.append(h('div.ct-svcs', cards));
    const sv = CT.sleepView(G);
    dock.append(h('div.dock-row',
      button('Ficha', () => go('sheet'), { kind: 'ghost' }),
      button('Dormir', async () => {
        const ok = await import('./shell.js').then((m) => m.confirmRisky(`Dormir até as 8h (${sv.hours}h)? ${sv.newDay ? 'Um novo dia: a Chaga avança.' : ''}`, { title: 'Dormir' }));
        if (!ok) return;
        sfx('camp');
        done(CT.sleep(G), 'Noite em casa');
      }, { kind: 'ghost', sub: `${sv.hours}h` }),
      button('Portão', () => go('travel'), { kind: 'primary', sub: 'ir ao Ermo' })));
    hintOnce('cidade');
  },
};

// =====================================================================================
// SERVIÇOS
// =====================================================================================
const svcTab = {};

function shopList(G, svc) {
  const stock = CT.ensureStock(G, svc);
  if (!stock.length) return h('p.small.muted', 'Nada à venda agora. Reabastece a cada 3 dias.');
  return h('div.stack', stock.map((inst) => {
    const p = CT.buyPrice(G, svc, inst);
    return h('div.ct-shop-row',
      button(`${CT.itemName(inst)}${(inst.n || 1) > 1 ? ` (${inst.n})` : ''}`, () => done(CT.buy(G, svc, inst.uid), 'Compra'), { kind: 'left', sub: `${p} moedas`, disabled: (G.hero.coin || 0) < p, why: `Custa ${p} moedas.` }),
      button('i', () => sheet({ title: CT.itemName(inst), body: h('div', IT.describeItem(inst).map((l) => h('div.small', l))), buttons: [{ label: 'Fechar', kind: 'ghost' }] }), { kind: ['ghost', 'small'] }));
  }));
}

function sellList(G, svc) {
  const inv = G.hero.inv || [];
  const rows = inv.map((inst) => ({ inst, why: CT.sellProblem(G, svc, inst), p: CT.sellPrice(G, svc, inst) })).filter((r) => !r.why);
  if (!rows.length) return h('p.small.muted', 'Nada que este lugar compre. (Desequipe antes de vender.)');
  return h('div.stack', rows.map(({ inst, p }) => button(`${CT.itemName(inst)}${(inst.n || 1) > 1 ? ` ×${inst.n}` : ''}`, () => done(CT.sell(G, svc, inst.uid, 1), 'Venda'), { kind: 'left', sub: `+${p} moedas${(inst.n || 1) > 1 ? ' (cada)' : ''}` })));
}

function recipeList(G, svc) {
  const rs = CT.recipesAt(G, svc);
  if (!rs.length) return h('p.small.muted', 'Nenhuma receita aqui.');
  return h('div.stack', rs.map((v) => button(`${v.outN}× ${v.name}`, () => done(CT.craft(G, v.id), 'Fabricar'), { kind: 'left', sub: `${CT.matsText(v.r.in)}${v.r.coin ? ` + ${v.r.coin} moedas` : ''}${v.r.ichor ? ` + ${v.r.ichor} Icor` : ''} · ${v.hours}h${v.dbl ? ' · dose dupla (AST)' : ''}`, disabled: !v.can, why: v.why })));
}

function equipAndInv(G) { return [...Object.values(G.hero.equip || {}).filter(Boolean), ...(G.hero.inv || [])]; }

function questPanel(G, f) {
  const v = FA.questView(G, f);
  const F = FACTIONS[f];
  if (v.state === 'done') return section(`Missões: ${F.short}`, h('p.small.t-good', 'Você fez tudo que eles pediram.'));
  const def = v.def;
  const els = [h('div.small.muted', `Etapa ${v.step + 1}/${v.total}`), h('b', def.title), h('p.small', def.brief), h('div.small', `Objetivo: ${FA.objectiveText(def.obj)}`)];
  if (v.state === 'locked') els.push(h('div.small.t-warn', `Indisponível: ${v.why}`));
  if (v.state === 'available') els.push(button('Aceitar missão', () => done(FA.startQuest(G, f), F.short), { kind: 'primary' }));
  if (v.state === 'active') {
    els.push(h('div.small.t-info', v.progress.label), bar(v.progress.cur, v.progress.need, 'xp', ''));
    els.push(h('div.row', button('Entregar', () => done(FA.turnInQuest(G, f), def.title), { kind: 'primary', disabled: !v.progress.done, why: 'Objetivo incompleto.' }),
      button('Abandonar', async () => { const ok = await import('./shell.js').then((m) => m.confirmRisky('Abandonar a missão? Custa reputação.', { title: 'Abandonar' })); if (ok) { const l = FA.abandonQuest(G, f); save(); refresh(); showLines('Missão', l); } }, { kind: ['ghost', 'small'] })));
  }
  return section(`Missões: ${F.short} · ${repLabel(FA.rep(G, f)).label} (${FA.rep(G, f)})`, ...els);
}

function fragmentPanel(G, f) {
  const held = Object.values(FRAGMENTS).filter((x) => CP.fragState(G, x.id) === 'held' && CP.fragmentLocation(G, x.id));
  if (!held.length) return null;
  return section('Fragmentos do deus', h('p.small.muted', `${FACTIONS[f].short} quer os pedaços. Entregar dá muita reputação e decide o fim. Guardar dá poder — e corrompe.`),
    ...held.map((x) => button(`Entregar: ${x.name}`, async () => {
      const ok = await import('./shell.js').then((m) => m.confirmRisky(`Entregar o ${x.name} a ${FACTIONS[f].name}? Não há volta.`, { title: 'Fragmento' }));
      if (!ok) return;
      const r = CP.fragmentTo(G, x.id, f);
      done(r.ok ? { ok: true, lines: r.lines } : { ok: false, reason: r.reason }, x.name);
    }, { kind: 'blood' })));
}

function contractsPanel(G, giver) {
  CO.refreshOffers(G, giver);
  const active = CO.contractsOf(G, giver, 'active');
  const offers = CO.contractsOf(G, giver, 'offer');
  const els = [h('p.small.muted', 'Contratos têm prazo. Falhar custa reputação. ', helpButton('contratos'))];
  for (const c of active) {
    const p = CO.contractProgress(G, c);
    els.push(h('div.panel.ct-contract', h('b', c.title), h('div.small', c.desc), h('div.small.t-info', `${p.label} · prazo: dia ${c.deadline} · ${CO.rewardText(c)}`),
      h('div.row', button('Entregar', () => done(CO.turnInContract(G, c.uid), c.title), { kind: 'primary', disabled: !p.done, why: 'Ainda não.' }),
        c.kind === 'escort' && !p.done ? button('Seguir com a carroça', () => escortGo(G, c.uid), { kind: 'blood' }) : null,
        button('Desistir', async () => { const ok = await import('./shell.js').then((m) => m.confirmRisky('Desistir do contrato? Custa reputação.', { title: 'Desistir' })); if (ok) { const l = CO.abandonContract(G, c.uid); save(); refresh(); showLines('Contrato', l); } }, { kind: ['ghost', 'small'] }))));
  }
  if (!offers.length && !active.length) els.push(h('p.small.muted', 'Nenhum contrato no quadro. Volte em alguns dias.'));
  for (const c of offers) {
    els.push(h('div.panel.ct-contract', h('b', c.title), h('div.small', c.desc), h('div.small.muted', `${REGION_NAMES[c.region] || ''} · ${c.days} dias · ${CO.rewardText(c)}`),
      button('Aceitar', () => {
        const r = CO.acceptContract(G, c.uid);
        if (!r.ok) { toastMsg(r.reason, 'warn'); return; }
        save();
        if (r.escort) { showLines(c.title, r.lines, () => escortGo(G, c.uid)); return; }
        refresh(); showLines(c.title, r.lines);
      }, { kind: 'primary' })));
  }
  return section('Contratos', ...els);
}

function escortGo(G, uid) {
  const spec = CO.escortSpec(G, uid);
  if (!spec) return;
  startCombat(G, spec);
  save();
  go('combat');
}

const SVC_TABS = {
  ferreiro: [['comprar', 'Comprar'], ['vender', 'Vender'], ['reparar', 'Reparar'], ['forjar', 'Forjar'], ['ungir', 'Ungir'], ['fabricar', 'Fabricar']],
  barbeiro: [['feridas', 'Feridas'], ['proteses', 'Próteses'], ['costura', 'Costura'], ['sangria', 'Sangria']],
  boticario: [['comprar', 'Comprar'], ['vender', 'Vender'], ['fabricar', 'Fabricar']],
  templo: [['ritos', 'Ritos'], ['bencaos', 'Bênçãos'], ['loja', 'Loja'], ['missoes', 'Missões']],
  quartel: [['contratos', 'Contratos'], ['treino', 'Treino'], ['loja', 'Arsenal'], ['missoes', 'Missões']],
  guilda: [['icor', 'Icor'], ['comprar', 'Comprar'], ['vender', 'Vender'], ['mapas', 'Mapas'], ['contratos', 'Contratos'], ['missoes', 'Missões']],
  taverna: [['beber', 'Beber'], ['sequazes', 'Sequazes'], ['jogo', 'Dados'], ['loja', 'Balcão']],
  antro: [['ritos', 'Ritos'], ['ungir', 'Ungir'], ['loja', 'Loja'], ['missoes', 'Missões']],
  casa: [['casa', 'Casa'], ['bau', 'Baú'], ['melhorias', 'Melhorias'], ['linhagem', 'Linhagem']],
  muralha: [['muralha', 'Muralha']],
};

const svcScreen = {
  id: 'svc',
  render({ main, dock, params }) {
    const G = getG();
    const id = params?.id;
    const s = SERVICES[id];
    if (!G?.hero || !s) { go('city', {}, { replace: true }); return; }
    if (checkCityFlow(G)) return;
    const st = CT.serviceStatus(G, id);
    main.append(h('div.ct-svc-head', h('div.ct-svc-ico.big', s.icon), h('div', h('h2', s.name), h('div.small.muted', `${s.who ? `${s.who} · ` : ''}${s.district}`))));
    main.append(h('p.small.ct-svc-desc', s.desc));
    if (!st.open) {
      main.append(h('div.panel.t-warn', st.reason));
      const row = h('div.dock-row', button('Voltar', () => go('city', {}, { replace: true }), { kind: 'ghost' }));
      if (st.opensIn) row.append(button(`Esperar ${st.opensIn}h`, () => done(CT.waitHours(G, st.opensIn), 'Espera'), { kind: 'primary' }));
      dock.append(row);
      return;
    }
    const tl = SVC_TABS[id] || [];
    const cur = svcTab[id] && tl.some(([k]) => k === svcTab[id]) ? svcTab[id] : tl[0]?.[0];
    if (tl.length > 1) main.append(tabs(tl.map(([k, l]) => ({ id: k, label: l })), cur, (k) => { svcTab[id] = k; refresh({ scrollTop: true }); }));
    const R = RENDER[id]?.[cur];
    if (R) R(G, main);
    main.append(h('div.ct-purse.small.muted', `Bolso: ${G.hero.coin || 0} moedas · ${G.hero.ichor || 0} Icor`));
    dock.append(h('div.dock-row', button('Voltar à rua', () => go('city', {}, { replace: true }), { kind: 'ghost' }), button('Ficha', () => go('sheet'), { kind: 'ghost' })));
  },
};

const RENDER = {
  ferreiro: {
    comprar: (G, m) => m.append(shopList(G, 'ferreiro')),
    vender: (G, m) => m.append(sellList(G, 'ferreiro')),
    reparar: (G, m) => {
      const items = equipAndInv(G).map((i) => ({ i, q: CT.repairQuote(G, i) })).filter((x) => x.q);
      if (LN.upgradeLevel(G, 'armeiro') >= 1) m.append(h('p.small.t-good', 'O armeiro da Casa repara de graça (na Casa).'));
      m.append(items.length ? h('div.stack', items.map(({ i, q }) => button(CT.itemName(i), () => done(CT.repair(G, i.uid), 'Reparo'), { kind: 'left', sub: `${i.dur}/${CT.maxDur(i)} · ${q.cost} moedas · ${q.hours}h`, disabled: (G.hero.coin || 0) < q.cost, why: `Custa ${q.cost}.` }))) : h('p.small.muted', 'Nada precisa de reparo.'));
    },
    forjar: (G, m) => {
      m.append(h('p.small.muted', 'Melhorar a qualidade: mais dano/armadura e durabilidade. Precisa de materiais. ', helpButton('qualidade')));
      const items = equipAndInv(G).filter((i) => ['weapon', 'armor', 'offhand'].includes(IT.itemDef(i)?.type));
      m.append(h('div.stack', items.map((i) => { const q = CT.upgradeQuote(G, i); return button(CT.itemName(i), () => done(CT.upgradeItem(G, i.uid), 'Forja'), { kind: 'left', sub: q.can || q.coin ? `${q.coin} moedas + ${CT.matsText(q.mats || [])} · ${hours(q.hours || 0)}` : q.why, disabled: !q.can, why: q.why }); })));
    },
    ungir: (G, m) => anointList(G, m, 'ferreiro'),
    fabricar: (G, m) => m.append(recipeList(G, 'ferreiro')),
  },
  barbeiro: {
    feridas: (G, m) => {
      const opts = CT.barberOptions(G);
      m.append(h('p.small.muted', 'O barbeiro cobra em moedas e em tempo — e o tempo é Chaga. Fora de hora custa mais. ', helpButton('feridas')));
      if (!opts.length) m.append(h('p.small.muted', 'Nenhuma ferida que ele possa tratar.'));
      for (const e of opts) {
        m.append(h('div.panel', h('b', e.name), h('div.small.muted', `${e.days === -1 ? 'permanente' : `${Math.ceil(e.days)} dia(s) para curar`}${e.infected ? ' · infeccionada' : ''}`),
          h('div.stack', e.options.map((o) => button(o.label, async () => {
            if (o.danger) { const ok = await import('./shell.js').then((mm) => mm.confirmRisky(`${o.label}? ${o.desc}`, { title: o.label })); if (!ok) return; }
            done(CT.barberTreat(G, e.w.uid, o.method), o.label);
          }, { kind: ['left', o.danger ? 'danger' : ''].filter(Boolean), sub: `${o.desc} · ${o.coin} moedas · ${hours(o.hours)}`, disabled: !o.can, why: o.why })))));
      }
    },
    proteses: (G, m) => {
      const ps = CT.prostheticOptions(G);
      m.append(ps.length ? h('div.stack', ps.map((p) => button(p.name, () => done(CT.fitProsthetic(G, p.kind, p.part), p.name), { kind: 'left', sub: `${p.desc} · ${p.coin} moedas${p.mats.length ? ` + ${CT.matsText(p.mats)}` : ''} · ${p.days} dia(s)`, disabled: !p.can, why: p.why }))) : h('p.small.muted', 'Você ainda tem tudo no lugar.'));
    },
    costura: (G, m) => {
      const q = CT.sutureQuote(G);
      m.append(button('Costurar e emplastrar', () => done(CT.suture(G), 'Costura'), { kind: 'wide', sub: q.n > 0 ? `+${q.n} Vida · ${q.coin} moedas · ${q.hours}h` : 'Você está inteiro', disabled: q.n <= 0 || (G.hero.coin || 0) < q.coin, why: q.n <= 0 ? 'Nada a costurar.' : `Custa ${q.coin}.` }));
    },
    sangria: (G, m) => {
      const b = BARBER.bloodletting;
      m.append(prose('Sanguessugas puxam o Icor podre das veias. Também levam sangue bom.'),
        button('Sangria', () => done(CT.bloodletting(G), 'Sangria'), { kind: 'wide', sub: `${b.corruption} Corrupção · −15% Vida máx. por ${b.days} dias · ${b.coin} moedas · ${b.hours}h` }));
    },
  },
  boticario: {
    comprar: (G, m) => m.append(shopList(G, 'boticario')),
    vender: (G, m) => m.append(sellList(G, 'boticario')),
    fabricar: (G, m) => { m.append(h('p.small.muted', 'Astúcia alta rende dose dupla.')); m.append(recipeList(G, 'boticario')); },
  },
  templo: {
    ritos: (G, m) => {
      const ov = CT.offeringView(G);
      m.append(section('Oferenda de Icor', h('p.small', `${ov.ichor} frascos no altar: Chaga ${ov.chaga}, Sutura +${ov.rep}. Uma vez por dia.`),
        button('Ofertar', () => done(CT.offerIchor(G), 'Oferenda'), { kind: 'blood', disabled: !ov.can, why: ov.why })));
      m.append(section('Penitência', h('div.stack', PENANCES.map((p) => { const v = CT.penanceView(G, p); return button(p.name, () => done(CT.penance(G, p.id), p.name), { kind: 'left', sub: `${p.desc} · Pavor ${p.dread}${p.corruption ? ` · Corrupção ${p.corruption}` : ''}${p.hp ? ` · ${p.hp} Vida` : ''}${p.coin ? ` · ${p.coin} moedas` : ''} · ${hours(p.hours)}`, disabled: !v.can, why: v.why }); }))));
      const cursed = CT.cursedEquipped(G);
      if (cursed.length) m.append(section('Exorcismo', ...cursed.map(([slot, inst]) => button(`Arrancar ${CT.itemName(inst)}`, () => done(CT.exorcise(G, slot), 'Exorcismo'), { kind: 'danger', sub: `${CT.EXORCISM.coin} moedas · ${CT.EXORCISM.hours}h` }))));
      m.append(fragmentPanel(G, 'sutura'));
    },
    bencaos: (G, m) => m.append(h('div.stack', BLESSINGS.map((b) => { const v = CT.blessingView(G, b); return button(b.name, () => done(CT.bless(G, b.id), b.name), { kind: 'left', sub: `${b.desc} · ${b.days} dias · ${b.coin} moedas${b.minRep ? ` · Sutura ${b.minRep}+` : ''}`, disabled: !v.can, why: v.why }); }))),
    loja: (G, m) => m.append(shopList(G, 'templo')),
    missoes: (G, m) => m.append(questPanel(G, 'sutura')),
  },
  quartel: {
    contratos: (G, m) => m.append(contractsPanel(G, 'quartel')),
    treino: (G, m) => {
      const v = CT.trainView(G);
      m.append(prose(`O mestre de armas treina com a arma que você empunha (${v.cls}). +${v.n} maestria.`),
        button('Treinar', () => done(CT.train(G), 'Treino'), { kind: 'wide', sub: `${v.coin} moedas · ${hours(v.hours)} · ${v.done}/3 sessões`, disabled: !v.can, why: v.why }));
    },
    loja: (G, m) => m.append(G.campaign.flags.coroa_arsenal ? h('p.small.t-good', 'Arsenal aberto para você.') : h('p.small.muted', 'Só munição e tochas — o arsenal abre para quem serve a Coroa.'), shopList(G, 'quartel')),
    missoes: (G, m) => { m.append(questPanel(G, 'coroa')); m.append(fragmentPanel(G, 'coroa')); },
  },
  guilda: {
    icor: (G, m) => {
      const p = CT.ichorPrice(G);
      m.append(section(`Icor hoje: ${p} moedas o frasco (${CT.ichorTrend(G)})`, h('p.small.muted', 'Cada frasco vendido no mesmo dia derruba o preço. ', helpButton('icor')),
        h('div.grid.grid-3', [1, 3, 5].map((n) => button(`Vender ${n}`, () => done(CT.sellIchor(G, n), 'Icor'), { disabled: (G.hero.ichor || 0) < n, why: 'Icor insuficiente.' })))));
      const lv = CT.loanView(G);
      m.append(section('Empréstimo', lv.open || lv.defaulted ? h('div', h('p.small', `Você deve ${lv.owe}.${lv.dueDay ? ` Vence no dia ${lv.dueDay}.` : ' Em atraso.'}`), button('Quitar', () => done(CT.repayLoan(G), 'Dívida'), { kind: 'primary', disabled: !lv.canRepay, why: `Precisa de ${lv.owe}.` }))
        : button(`Pegar ${lv.amount} moedas`, () => done(CT.takeLoan(G), 'Empréstimo'), { kind: 'left', sub: `Devolve ${lv.owe} em ${lv.days} dias. Calote: a Guilda cobra em carne.`, disabled: !lv.can, why: lv.why })));
      m.append(fragmentPanel(G, 'guilda'));
    },
    comprar: (G, m) => m.append(shopList(G, 'guilda')),
    vender: (G, m) => m.append(sellList(G, 'guilda')),
    mapas: (G, m) => {
      m.append(h('p.small.muted', 'Mapas revelam lugares nas regiões que você já pode alcançar.'));
      m.append(h('div.stack', CO.openRegions(G).map((r) => { const v = CT.mapView(G, r); return button(`Mapa: ${REGION_NAMES[r]}`, () => done(CT.buyMap(G, r), 'Mapa'), { kind: 'left', sub: `${v.coin} moedas · +${v.n} lugares${v.total != null ? ` · ${v.known}/${v.total} conhecidos` : ''}`, disabled: !v.can, why: v.why }); })));
    },
    contratos: (G, m) => m.append(contractsPanel(G, 'guilda')),
    missoes: (G, m) => m.append(questPanel(G, 'guilda')),
  },
  taverna: {
    beber: (G, m) => {
      const d = CT.drinkView(G);
      const r = CT.rumorView(G);
      m.append(section('Beber', button('Uma caneca', () => done(CT.drink(G), 'Taverna'), { kind: 'wide', sub: `${d.coin} moedas · Pavor ${d.dread}${d.risk ? ' · risco de vício' : ''}`, disabled: !d.can, why: d.why })));
      m.append(section('Boatos', h('p.small.muted', 'Ouvir custa moedas e tempo. Às vezes vale ouro.'), button('Pagar uma rodada e ouvir', () => done(CT.hearRumor(G), 'Boato'), { kind: 'wide', sub: `${r.coin} moedas · ${r.hours}h`, disabled: !r.can, why: r.why })));
      const log = G.city.rumorLog || [];
      if (log.length) m.append(section('O que você já ouviu', ...log.slice(0, 6).map((x) => h('div.small.muted', `Dia ${x.day}: ${x.text}`))));
    },
    sequazes: (G, m) => {
      const c = G.hero.companion;
      if (c) m.append(section('Seu sequaz', kv(c.name, `${c.hp}/${c.hpMax} · lealdade ${c.loyalty ?? 60}`), button('Dispensar', () => done(CT.dismissCompanion(G), 'Sequaz'), { kind: ['ghost', 'small'] })));
      m.append(h('p.small.muted', 'Sequazes lutam ao seu lado, cobram salário por dia e morrem de verdade.'));
      m.append(h('div.stack', CT.mercsForHire(G).map((x) => button(x.name, () => done(CT.hire(G, x.id), 'Contratar'), { kind: 'left', sub: `${x.desc} · ${x.coin} moedas + ${x.wage}/dia`, disabled: !x.can, why: x.why }))));
    },
    jogo: (G, m) => {
      m.append(prose('Dados de osso. A casa sempre ganha um pouco — a não ser que você trapaceie. Pegos trapaceando apanham.'));
      for (const stake of [5, 20, 50]) {
        const v = CT.gambleView(G, stake), vc = CT.gambleView(G, stake, true);
        m.append(h('div.row', button(`Apostar ${stake}`, () => done(CT.gamble(G, stake), 'Dados'), { sub: `${v.chance}%`, disabled: !v.can, why: v.why }), button(`Trapacear (${stake})`, () => done(CT.gamble(G, stake, true), 'Dados'), { kind: 'danger', sub: `DES ${vc.chance}%`, disabled: !vc.can, why: vc.why })));
      }
    },
    loja: (G, m) => m.append(shopList(G, 'taverna')),
  },
  antro: {
    ritos: (G, m) => {
      const s = CT.sipView(G), mu = CT.mutationView(G), b = CT.bleedOutView(G);
      m.append(section('Gole', button('Beber um frasco sem rito', () => done(CT.sipIchor(G), 'Gole'), { kind: 'blood', sub: `+${s.hp} Vida · Pavor ${s.dread} · +${s.corruption} Corrupção`, disabled: !s.can, why: s.why })));
      m.append(section('Mutação comprada', button('A mesa de pedra', async () => { const ok = await import('./shell.js').then((mm) => mm.confirmRisky('Deixar que injetem o deus no seu osso?', { title: 'Mutação' })); if (ok) done(CT.buyMutation(G), 'Antro'); }, { kind: 'blood', sub: `${mu.ichor} Icor + ${mu.coin} moedas · +${mu.corruption} Corrupção · ganha uma mutação`, disabled: !mu.can, why: mu.why })));
      m.append(section('Vender sangue', button('Deixar que bebam de você', () => done(CT.bleedOut(G), 'Antro'), { sub: `${b.hp} Vida · +${b.coin} moedas · ${b.corruption} Corrupção`, disabled: !b.can, why: b.why })));
      const held = Object.values(FRAGMENTS).filter((x) => CP.fragState(G, x.id) === 'held' && CP.fragmentLocation(G, x.id) === 'hero');
      if (held.length) m.append(section('Devorar o deus', ...held.map((x) => button(`Devorar: ${x.name}`, async () => { const ok = await import('./shell.js').then((mm) => mm.confirmRisky(`Comer o ${x.name}? Muita Corrupção, poder permanente, os Bebedores vão te amar.`, { title: 'Devorar' })); if (ok) done(CT.devourFragment(G, x.id), x.name); }, { kind: 'blood' }))));
    },
    ungir: (G, m) => anointList(G, m, 'antro'),
    loja: (G, m) => m.append(shopList(G, 'antro')),
    missoes: (G, m) => { m.append(questPanel(G, 'bebedores')); m.append(fragmentPanel(G, 'bebedores')); },
  },
  casa: {
    casa: (G, m) => {
      const sv = CT.sleepView(G);
      m.append(section('Descanso',
        button('Dormir até as 8h', () => done(CT.sleep(G), 'Noite em casa'), { kind: 'wide', sub: `${sv.hours}h · cura, −Pavor` }),
        h('div.grid.grid-3', [1, 3, 7].map((d) => button(`${d} dia(s)`, async () => {
          const ok = await import('./shell.js').then((mm) => mm.confirmRisky(`Repousar ${d} dia(s)? A Chaga sobe ~${Math.round(TM.chagaRate(G).total * d)}.`, { title: 'Repouso' }));
          if (ok) done(CT.rest(G, d), 'Repouso');
        }, { sub: 'repouso' })))));
      if (LN.upgradeLevel(G, 'armeiro') >= 1) m.append(button('Armeiro: reparar tudo', () => done(CT.houseRepairAll(G), 'Armeiro'), { kind: 'wide', sub: 'grátis · 2h' }));
      const hl = G.lineage.heirloom;
      m.append(section('Relíquia da Casa', hl ? h('p.small', `${hl.name || IT.itemDef(hl)?.name}: volta para a Casa quando o portador morre — e melhora.`) : h('p.small.muted', 'Consagre um item: ele volta para o herdeiro quando você morrer.'),
        h('div.stack', equipAndInv(G).filter((i) => ['weapon', 'armor', 'offhand', 'trinket'].includes(IT.itemDef(i)?.type) && !LN.isHeirloom(G, i)).slice(0, 8).map((i) => button(`Consagrar ${CT.itemName(i)}`, async () => {
          const ok = await import('./shell.js').then((mm) => mm.confirmRisky(`Consagrar ${CT.itemName(i)} como relíquia? Custa ${LN.HEIRLOOM_COST.ichor} Icor${hl ? ' e substitui a atual' : ''}.`, { title: 'Relíquia' }));
          if (ok) { const r = LN.setHeirloom(G, i.uid); done(r.ok ? { ok: true, lines: r.lines } : { ok: false, reason: r.reason }, 'Relíquia'); }
        }, { kind: ['left', 'small'] })))));
    },
    bau: (G, m) => {
      m.append(section(`Baú ${LN.stashUsed(G)}/${LN.stashCap(G)}`, ...(G.lineage.stash || []).map((i) => button(`${CT.itemName(i)}${(i.n || 1) > 1 ? ` ×${i.n}` : ''}`, () => { const r = LN.withdraw(G, i.uid); if (!r.ok) toastMsg(r.reason, 'warn'); save(); refresh(); }, { kind: ['left', 'small'], sub: 'retirar' }))));
      m.append(section('Guardar', ...(G.hero.inv || []).map((i) => button(`${CT.itemName(i)}${(i.n || 1) > 1 ? ` ×${i.n}` : ''}`, () => { const r = LN.deposit(G, i.uid); if (!r.ok) toastMsg(r.reason, 'warn'); save(); refresh(); }, { kind: ['left', 'small'], sub: 'guardar' }))));
      m.append(section(`Cofre: ${G.lineage.coffer || 0} moedas${G.lineage.stashIchor ? ` · ${G.lineage.stashIchor} Icor` : ''}`,
        h('div.grid.grid-3',
          button('Guardar 20', () => { LN.depositCoin(G, 20); save(); refresh(); }, { disabled: (G.hero.coin || 0) < 1, why: 'Sem moedas.' }),
          button('Tirar 20', () => { LN.withdrawCoin(G, 20); save(); refresh(); }, { disabled: !(G.lineage.coffer > 0), why: 'Cofre vazio.' }),
          button('Tirar Icor', () => { LN.withdrawIchor(G); save(); refresh(); }, { disabled: !(G.lineage.stashIchor > 0), why: 'Nada.' })),
        h('p.small.muted', 'O que fica no baú e no cofre não se perde quando você morre no Ermo.')));
    },
    melhorias: (G, m) => {
      m.append(h('p.small.muted', 'Melhorias permanentes, pagas com moedas do bolso e do cofre. Herdeiros aproveitam.'));
      for (const u of Object.values(HOUSE_UPGRADES)) {
        const lv = LN.upgradeLevel(G, u.id);
        const cost = LN.upgradeCost(G, u.id);
        m.append(h('div.panel', h('div.row', h('b', u.name), h('span.spacer'), h('span.small', `nível ${lv}/${u.max}`)), h('div.small', u.desc), h('div.small.muted', `Agora: ${u.per[lv]}${cost != null ? ` → ${u.per[lv + 1]}` : ''}`),
          cost != null ? button(`Construir (${cost})`, () => { const r = LN.buyUpgrade(G, u.id); done(r.ok ? { ok: true, lines: r.lines } : { ok: false, reason: r.reason }, u.name); }, { kind: 'small', disabled: (G.hero.coin || 0) + (G.lineage.coffer || 0) < cost, why: `Custa ${cost}.` }) : h('div.small.t-good', 'Completo.')));
      }
    },
    linhagem: (G, m) => {
      m.append(section(`Casa ${G.lineage.house} · ${G.lineage.generation}ª geração`, h('p.small.muted', 'Retratos na parede. Cada um morreu por alguma coisa.'), helpButton('linhagem')));
      const dead = (G.lineage.dead || []).slice().reverse();
      if (!dead.length) m.append(h('p.small.muted', 'Ninguém ainda.'));
      for (const d of dead) m.append(h('div.panel.ct-dead', h('b', `${d.name}`), h('span.small.muted', ` · ${BACKGROUNDS[d.bg]?.name || ''} · nível ${d.level}`), h('div.small', `${d.cause} — dia ${d.day}${d.region && d.region !== 'cidade' ? `, ${REGION_NAMES[d.region] || d.region}` : ''}`), h('div.small', { class: d.recovered ? 't-good' : d.corrupted ? 't-corr' : 't-warn' }, d.recovered ? 'Corpo recuperado.' : d.corrupted ? 'Levantou como Aberração.' : 'O corpo ainda está lá, com o que levava.')));
    },
  },
  muralha: {
    muralha: (G, m) => {
      const iv = CT.investView(G);
      const wv = CT.watchView(G);
      const ps = SG.siegeWarning(G);
      m.append(section(`Muralha: ${G.city.defense}/100`, bar(G.city.defense, 100, 'stam', ''), helpButton('cerco')));
      if (ps) {
        const dc = SG.defenseChance(G, { level: ps.level });
        m.append(section(`Cerco: ${ps.name} ${ps.daysLeft > 0 ? `em ${ps.daysLeft} dia(s)` : 'AGORA'}`, h('p.small', `Chance da muralha segurar sozinha: ${dc.pct}%`), ...dc.parts.map((p) => kv(p.label, `${p.v > 0 ? '+' : ''}${p.v}`))));
      }
      m.append(section('Ajudar',
        button('Pagar pedreiros', () => done(CT.investWall(G), 'Muralha'), { kind: 'left', sub: `${iv.coin} moedas → +${iv.n} muralha`, disabled: !iv.can, why: iv.why }),
        button('Carregar pedra (um dia)', () => done(CT.laborWall(G), 'Muralha'), { kind: 'left', sub: '10h · +2 muralha · −Pavor · dá fome' }),
        button('Vigia noturna', () => { const spec = CT.watchSpec(G); if (!spec) { toastMsg(wv.why, 'warn'); return; } startCombat(G, spec); save(); go('combat'); }, { kind: ['left', 'blood'], sub: 'luta nas ameias · paga · +muralha', disabled: !wv.can, why: wv.why })));
    },
  },
};

function anointList(G, m, svc) {
  m.append(h('p.small.muted', 'Unção: Icor e materiais na arma ou armadura. Dá propriedades. ', helpButton('uncao')));
  const items = equipAndInv(G).filter((i) => ['weapon', 'armor'].includes(IT.itemDef(i)?.type));
  let any = false;
  for (const i of items) {
    const opts = CT.enchantOptions(G, svc, i);
    if (!opts.length) continue;
    any = true;
    m.append(h('div.panel', h('b', CT.itemName(i)), h('div.stack', opts.map((o) => button(o.name, () => done(CT.anoint(G, svc, i.uid, o.id), o.name), { kind: ['left', 'small'], sub: `${o.desc} · ${o.ichor} Icor + ${o.coin} moedas${o.mats.length ? ` + ${CT.matsText(o.mats)}` : ''} · ${o.hours}h${o.replaces ? ' · substitui a atual' : ''}`, disabled: !o.can, why: o.why })))));
  }
  if (!any) m.append(h('p.small.muted', 'Nada que possa ser ungido aqui.'));
}

// =====================================================================================
// CERCO
// =====================================================================================
const siegeScreen = {
  id: 'siege',
  render({ main, dock, params }) {
    const G = getG();
    const ps = G?.campaign?.pendingSiege;
    if (!ps) { go('city', {}, { replace: true }); return; }
    const def = SG.siegeDef(ps.level);
    main.append(h('h2.t-blood', def.name));
    main.append(prose(def.text));
    if (ps.fight) {
      main.append(section(`Onda ${ps.fight.wave + 1}/${ps.fight.waves}: ${SG.waveLabel(G)}`, h('p.small', `Ondas quebradas: ${ps.fight.won}. Entre uma e outra, um soldado cuida de você.`)));
      dock.append(h('div.dock-row',
        button('Descer das ameias', () => { const r = SG.retreatFromWall(G); save(); showLines('O cerco', r.lines, () => go('city', {}, { replace: true })); }, { kind: 'ghost' }),
        button('Próxima onda', () => { const spec = SG.waveSpec(G); startCombat(G, spec); save(); go('combat'); }, { kind: 'blood' })));
      return;
    }
    const dc = SG.defenseChance(G, { level: ps.level });
    main.append(section(`Se você não lutar: ${dc.pct}%`, ...dc.parts.map((p) => kv(p.label, `${p.v > 0 ? '+' : ''}${p.v}`)), h('p.small.muted', `Lutando, cada onda que você quebrar soma +15. Perder custa ${def.lose} distrito(s).`)));
    dock.append(h('div.dock-row',
      button('Confiar na muralha', async () => {
        const ok = await import('./shell.js').then((m) => m.confirmRisky(`Deixar a defesa decidir (${dc.pct}%)?`, { title: 'Cerco' }));
        if (!ok) return;
        const r = SG.resolveByDefense(G, {});
        save();
        showLines(def.name, r.lines, () => go('city', {}, { replace: true }));
      }, { kind: 'ghost', sub: `${dc.pct}%` }),
      button('Subir nas ameias', () => { const spec = SG.beginWallFight(G); startCombat(G, spec); save(); sfx('siege'); go('combat'); }, { kind: 'blood', sub: `${def.waves.length} ondas` })));
    hintOnce('cerco');
  },
};

// =====================================================================================
// HERDEIROS
// =====================================================================================
const heirsScreen = {
  id: 'heirs',
  hud: false,
  render({ main, dock, params }) {
    const G = getG();
    if (!G) { go('title', {}, { replace: true }); return; }
    if (G.campaign.ended) { go('ending', {}, { replace: true }); return; }
    const heirs = G.lineage.heirs || [];
    if (!heirs.length) { go(G.hero ? 'city' : 'create', { fresh: true }, { replace: true }); return; }
    const last = (G.lineage.dead || [])[(G.lineage.dead || []).length - 1];
    main.append(h('h2.t-blood', 'O sangue continua'));
    if (last) main.append(h('div.panel.ct-dead', h('b', `${last.name} está morto.`), h('div.small', `${last.cause}. Dia ${last.day}.`),
      h('div.small.muted', last.region && last.region !== 'cidade' ? `O corpo ficou em ${REGION_NAMES[last.region] || last.region}${last.corrupted ? ' — e não ficou quieto' : ', com tudo que levava'}.` : 'A família recolheu o corpo.')));
    if (params?.lines?.length) main.append(linesEl(params.lines));
    main.append(h('p.small.muted', `Casa ${G.lineage.house}, ${G.lineage.generation}ª geração. Escolha quem pega a arma.`));
    heirs.forEach((c, i) => {
      const B = BACKGROUNDS[c.bg];
      main.append(h('div.panel.ct-heir',
        h('div.row', h('b', c.name), h('span.spacer'), h('span.small', B?.name || c.bg)),
        h('div.small.muted', B?.short || ''),
        h('div.row.row-wrap.small', ['for', 'des', 'vig', 'von', 'ast'].map((k) => chip(`${k.toUpperCase()} ${c.attrs[k]}`, 'info'))),
        (c.traits || []).length ? h('div.small', (c.traits || []).map((t) => TRAITS[t]?.name || t).join(' · ')) : null,
        button(`Escolher ${c.name}`, () => {
          const r = LN.chooseHeir(G, i);
          if (!r.ok) { toastMsg(r.reason, 'warn'); return; }
          CP.onHeroCreated(G);
          try { CH.initHeroInWorld(G); } catch (e) { console.error(e); }
          save();
          clearHistory();
          go('city', {}, { replace: true });
          showLines(`${c.name} assume a Casa`, r.lines);
        }, { kind: ['primary', 'wide'] })));
    });
    hintOnce('linhagem');
  },
};

// =====================================================================================
// O CORAÇÃO E O FIM
// =====================================================================================
const heartScreen = {
  id: 'heart',
  hud: false,
  render({ main, dock }) {
    const G = getG();
    if (!G || !CP.heartReady(G)) { go(G?.campaign?.ended ? 'ending' : 'city', {}, { replace: true }); return; }
    main.append(h('h1.t-ichor', 'O Coração'));
    main.append(prose('Ele bate. Cada batida faz o chão de carne tremer, e o Icor escorre pelas paredes como suor. Do lado de fora, Valdrem espera sem saber.\n\nO que você faz com um deus?'));
    for (const o of CP.endingOptions(G)) {
      main.append(h('div.panel.ct-ending-opt', { class: o.available ? '' : 'is-locked' },
        h('b', `${o.icon} ${o.name}`), h('div.small', o.choice), h('div.small.muted', o.req),
        button(o.available ? (o.sacrifice ? 'Escolher (custa sua vida)' : 'Escolher') : 'Indisponível', async () => {
          const ok = await import('./shell.js').then((m) => m.confirmRisky(`${o.choice}? Isso encerra a campanha.`, { title: o.name, always: true }));
          if (!ok) return;
          const r = CP.chooseEnding(G, o.id);
          if (!r.ok) { toastMsg(r.reason, 'warn'); return; }
          save();
          go('ending', {}, { replace: true });
        }, { kind: o.available ? ['blood', 'wide'] : ['ghost', 'wide'], disabled: !o.available, why: o.req })));
    }
    dock.append(button('Ainda não', () => go(G.expedition ? 'map' : 'city', {}, { replace: true }), { kind: ['ghost', 'wide'] }));
  },
};

const endingScreen = {
  id: 'ending',
  hud: false,
  render({ main, dock }) {
    const G = getG();
    const e = G?.campaign?.ended;
    if (!e) { go('title', {}, { replace: true }); return; }
    main.append(h('div.ct-ending', h('div.ct-ending-icon', e.icon || '☠'), h('h1', e.name), prose(e.text)));
    if (e.epilogue?.length) main.append(section('Depois', ...e.epilogue.map((t) => h('p.small', t))));
    const s = e.stats || {};
    main.append(section('A Casa ' + (s.house || G.lineage.house),
      grid([kv('Dia', s.day), kv('Chaga', s.chaga), kv('Gerações', s.generation), kv('Mortos da Casa', s.dead), kv('Inimigos mortos', s.kills), kv('Chefes', s.bosses), kv('Cercos vencidos', s.siegesWon), kv('Distritos perdidos', s.lostDistricts)], 2)));
    dock.append(h('div.dock-row',
      button('Diário', () => go('journal'), { kind: 'ghost' }),
      button('Nova campanha', async () => {
        const ok = await import('./shell.js').then((m) => m.confirmRisky('Começar outra campanha? Esta será apagada.', { title: 'Nova campanha', always: true }));
        if (!ok) return;
        wipe();
        clearHistory();
        import('./shell.js').then((m) => m.startNewCampaign ? m.startNewCampaign() : go('title'));
      }, { kind: 'primary' })));
  },
};

// =====================================================================================
// DIÁRIO E FACÇÕES
// =====================================================================================
const journalScreen = {
  id: 'journal',
  render({ main, dock }) {
    const G = getG();
    if (!G) { go('title', {}, { replace: true }); return; }
    main.append(h('h2', `Diário da Casa ${G.lineage.house}`));
    const j = (G.campaign.journal || []).slice().reverse();
    if (!j.length) main.append(h('p.muted', 'Páginas em branco.'));
    let lastDay = null;
    for (const e of j.slice(0, 120)) {
      if (e.day !== lastDay) { main.append(h('div.ct-j-day.small.muted', `Dia ${e.day}`)); lastDay = e.day; }
      main.append(h('div.ct-j-line', e.text));
    }
    const cl = (G.chagaLog || []).slice(-12).reverse();
    if (cl.length) main.append(section('A Chaga', ...cl.map((c) => h('div.small', { class: c.delta > 0 ? 't-rot' : 't-good' }, `Dia ${c.day}: ${c.delta > 0 ? '+' : ''}${c.delta} — ${c.why || ''}`))));
    dock.append(button('Voltar', () => back(G.campaign.ended ? 'ending' : G.expedition ? 'map' : 'city'), { kind: ['ghost', 'wide'] }));
  },
};

const factionsScreen = {
  id: 'factions',
  render({ main, dock }) {
    const G = getG();
    if (!G) { go('title', {}, { replace: true }); return; }
    main.append(h('h2', 'Facções de Valdrem'), h('p.small.muted', 'Agradar uma irrita outras. Hostis (−50) mandam caçadores. ', helpButton('faccoes')));
    for (const f of FACTION_IDS) {
      const F = FACTIONS[f];
      const v = FA.rep(G, f);
      const t = repLabel(v);
      const q = FA.questView(G, f);
      main.append(h('div.panel.ct-fac',
        h('div.row', h('b', `${F.icon} ${F.name}`), h('span.spacer'), chip(`${t.label} ${v}`, t.kind)),
        bar(v + 100, 200, v >= 0 ? 'stam' : 'hp', ''),
        h('div.small', F.desc), h('div.small.muted', `Quer: ${F.want}`), h('div.small.muted', `Líder: ${F.leader} · ${SERVICES[F.service]?.name || ''}`),
        h('div.small.t-info', q.state === 'done' ? 'Linha de missões concluída.' : `Missão ${q.step + 1}/${q.total}: ${q.def?.title || ''} (${q.state === 'active' ? 'ativa' : q.state === 'available' ? 'disponível' : 'bloqueada'})`)));
    }
    const frs = Object.values(FRAGMENTS).map((x) => kv(x.name, (() => { const s = CP.fragState(G, x.id); return s == null ? '—' : s === 'held' ? 'com a Casa' : s === 'eaten' ? 'devorado' : s === 'carcass' ? 'num cadáver' : FACTIONS[s]?.short || s; })()));
    main.append(section('Fragmentos do deus', ...frs));
    dock.append(button('Voltar', () => back(G.expedition ? 'map' : 'city'), { kind: ['ghost', 'wide'] }));
  },
};

// =====================================================================================
export default [introScreen, cityScreen, svcScreen, siegeScreen, heirsScreen, heartScreen, endingScreen, journalScreen, factionsScreen];

export function init() {
  flow.setHook('heroDeath', (G, cause, info) => {
    const r = LN.onHeroDeath(G, cause, info || {});
    G.combat = null;
    G.event = null;
    G.pendingLoot = null;
    save();
    clearHistory();
    if (G.campaign.ended) { go('ending', {}, { replace: true }); return; }
    sfx('death');
    go('heirs', { lines: r.lines }, { replace: true });
  });
  flow.setHook('heroCreated', (G) => {
    const lines = CP.onHeroCreated(G);
    save();
    clearHistory();
    go('city', {}, { replace: true });
    if (lines?.length) setTimeout(() => showLines('A Casa te dá o que pode', lines), 200);
  });
  flow.setHook('campaignEnd', (G, type, info) => {
    CP.endCampaign(G, type, info || {});
    G.combat = null; G.event = null; G.expedition = null;
    save();
    clearHistory();
    go('ending', {}, { replace: true });
  });
  for (const src of ['daily', 'city', 'siege', 'contract']) flow.setHook(`eventEnd:${src}`, (G) => { save(); go('city', {}, { replace: true }); });
  // cerco
  flow.setHook('combatEnd:siege', (G, outcome) => {
    const r = SG.onWaveEnd(G, outcome);
    save();
    const after = () => {
      if (G.pendingLoot && ((G.pendingLoot.items || []).length || G.pendingLoot.coin || G.pendingLoot.ichor)) { G.pendingLoot.source = 'siege'; G.campaign.siegeAfter = r.status; go('loot', {}, { replace: true }); return; }
      if (r.status === 'next') { const heal = SG.betweenWaves(G); save(); go('siege', {}, { replace: true }); showLines('Entre as ondas', heal); return; }
      go('city', {}, { replace: true });
    };
    showLines('A muralha', r.lines, after);
  });
  flow.setHook('lootDone:siege', (G) => {
    G.pendingLoot = null;
    const st = G.campaign.siegeAfter; G.campaign.siegeAfter = null;
    save();
    if (st === 'next' && G.campaign.pendingSiege?.fight) { const heal = SG.betweenWaves(G); save(); go('siege', {}, { replace: true }); showLines('Entre as ondas', heal); return; }
    go('city', {}, { replace: true });
  });
  // vigia e caçadores
  flow.setHook('combatEnd:city', (G, outcome) => {
    const kind = outcome.context?.kind;
    let lines = [];
    if (outcome.result === 'win') {
      if (kind === 'watch') lines = CT.watchReward(G);
      if (kind === 'hunters') lines = CT.huntersDefeated(G);
    } else if (outcome.result === 'fled' && kind === 'hunters') {
      G.city.threat = null;
      lines = [{ text: 'Você foge pelos telhados. Eles vão voltar.', kind: 'warn' }];
    }
    save();
    const next = () => {
      if (G.pendingLoot && ((G.pendingLoot.items || []).length || G.pendingLoot.coin || G.pendingLoot.ichor)) { G.pendingLoot.source = 'city'; go('loot', {}, { replace: true }); return; }
      go('city', {}, { replace: true });
    };
    if (lines.length) showLines(kind === 'watch' ? 'Vigia' : 'Os caçadores', lines, next); else next();
  });
  flow.setHook('lootDone:city', (G) => { G.pendingLoot = null; save(); go('city', {}, { replace: true }); });
  // escolta
  flow.setHook('combatEnd:contract', (G, outcome) => {
    const uid = outcome.context?.contract;
    const r = CO.escortStep(G, uid, outcome);
    save();
    const next = () => {
      if (G.pendingLoot && ((G.pendingLoot.items || []).length || G.pendingLoot.coin || G.pendingLoot.ichor)) { G.pendingLoot.source = 'contract'; G.city.escortNext = r.status === 'next' ? uid : null; go('loot', {}, { replace: true }); return; }
      if (r.status === 'next') { escortGo(G, uid); return; }
      go('city', {}, { replace: true });
    };
    showLines('Escolta', r.lines, next);
  });
  flow.setHook('lootDone:contract', (G) => {
    G.pendingLoot = null;
    const uid = G.city.escortNext; G.city.escortNext = null;
    save();
    if (uid) { escortGo(G, uid); return; }
    go('city', {}, { replace: true });
  });
}
