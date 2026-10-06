// Motor de eventos narrativos (Área E).
// Lógica pura (sem DOM). A navegação é injetada pela UI via installEventHooks(nav).
//
// Formato do evento (data/events/*.js):
// { id, pool:'field'|'city'|'camp'|'ruin'|'shrine'|'night', region:['r1']|'any', tags:[], w:1,
//   once?, cond?, cooldown? (dias), sfx?, title, text,
//   options:[ { label, cond?, hideIfNot?, cost?:[efeitos], check?:{attr,diff,bonus?,mods?:[{cond,n,label}]},
//               kind?, tag?, hint?, sfx?,
//               success:{text,effects}, fail?:{text,effects}, crit?:{text,effects}, fumble?:{text,effects} } ] }
//
// Estado persistido: G.event = { id, ctx, stage:'choose'|'result'|'loot', result, heroUid, day }
import { R } from '../core/rng.js';
import { save } from '../core/save.js';
import { timeOf, isNightHour } from '../core/util.js';
import * as flow from './flow.js';
import { applyEffects, checkCond, describeCond, describeEffects } from './effects.js';
import { checkChance, rollCheck, diffLabel } from './checks.js';
import { startCombat } from './combat/index.js';
import { ENEMIES } from '../data/enemies.js';
import EVENTS_LIST from '../data/events/index.js';

export const EVENTS = EVENTS_LIST;
const BY_ID = new Map();
for (const e of EVENTS) if (e && e.id) BY_ID.set(e.id, e);
export const getEvent = (id) => BY_ID.get(id) || null;

export const ATTR_LABEL = { for: 'FOR', des: 'DES', vig: 'VIG', von: 'VON', ast: 'AST' };
export const ATTR_NAME = { for: 'Força', des: 'Destreza', vig: 'Vigor', von: 'Vontade', ast: 'Astúcia' };
export const POOL_LABEL = {
  field: 'Ermo', city: 'Valdrem', camp: 'Acampamento', ruin: 'Ruína', shrine: 'Santuário', night: 'Noite', story: 'Crônica', quest: 'Missão',
};
const DEFAULT_COOLDOWN = { field: 5, city: 6, camp: 3, night: 3, ruin: 3, shrine: 4 };
const FALLBACK_ENEMY = { r1: 'saqueador', r2: 'desertor', r3: 'zelote', r4: 'bebedor', r5: 'bebedor' };

// ---------------- navegação injetada ----------------
let nav = () => {};
/** A UI chama isto no init: nav(screenId, params). Também registra os ganchos de fluxo da Área E. */
export function installEventHooks(navFn) {
  if (typeof navFn === 'function') nav = navFn;
  // Saque gerado por evento: ao terminar a tela de saque, o evento termina de verdade.
  flow.setHook('lootDone:event', (G) => {
    const src = G.event?.ctx?.source || 'expedition';
    const id = G.event?.id;
    if (G.pendingLoot) G.pendingLoot = null;
    G.event = null;
    flow.eventEnded({ source: src, id, after: 'loot' });
  });
  // Eventos diários da cidade (source 'daily') que viram combate.
  flow.setHook('combatEnd:daily', (G, outcome) => afterEventCombat(G, outcome, 'daily'));
  flow.setHook('lootDone:daily', (G) => {
    if (G.pendingLoot) G.pendingLoot = null;
    flow.eventEnded({ source: 'daily', after: 'combat' });
  });
  // Combates com context.source === 'event' (caso algum sistema use essa fonte).
  flow.setHook('combatEnd:event', (G, outcome) => afterEventCombat(G, outcome, G.combat?.context?.eventSource || 'expedition'));
}

function afterEventCombat(G, outcome, src) {
  const res = outcome?.result;
  if (res === 'lose' || !G.hero) return; // morte já tratada por heroDied (B)
  if (G.pendingLoot && G.pendingLoot.items?.length) {
    G.pendingLoot.source = src === 'daily' ? 'daily' : G.pendingLoot.source;
    nav('loot');
    return;
  }
  if (G.pendingLoot) G.pendingLoot = null;
  flow.eventEnded({ source: src, after: 'combat', result: res });
}

// ---------------- utilidades ----------------
const dayOf = (G) => timeOf(G.time || 0).day;
const isNight = (G) => isNightHour((G.time || 0) % 24);

function seenMap(G) {
  G.campaign = G.campaign || {};
  G.campaign.flags = G.campaign.flags || {};
  G.campaign.counters = G.campaign.counters || {};
  return G.campaign;
}
export function timesSeen(G, id) { return seenMap(G).counters[`ev:${id}`] || 0; }
export function lastSeenDay(G, id) { const v = seenMap(G).flags[`ev:${id}`]; return typeof v === 'number' ? v : (v ? 1 : 0); }

function safeCond(G, cond) {
  if (!cond) return true;
  try { return !!checkCond(G, cond); } catch (e) { console.warn('[events] cond inválida', cond, e); return false; }
}
function safeDescCond(cond) {
  try { return describeCond(cond) || ''; } catch { return ''; }
}
function safeDescEff(effects) {
  if (!effects || !effects.length) return '';
  try { return describeEffects(effects) || ''; } catch { return ''; }
}

function regionMatch(ev, region) {
  if (!region) return true;
  if (!ev.region || ev.region === 'any') return true;
  const list = Array.isArray(ev.region) ? ev.region : [ev.region];
  return list.includes(region) || list.includes('any');
}

function poolMatch(ev, pool, G) {
  if (ev.pool === pool) return true;
  // à noite, a estrada também puxa eventos noturnos
  if (pool === 'field' && ev.pool === 'night' && isNight(G)) return true;
  if (pool === 'camp' && ev.pool === 'night' && isNight(G)) return true;
  return false;
}

/** Evento elegível agora (once/cooldown/cond e pelo menos uma opção disponível). */
export function eligible(G, ev, { ignoreCooldown = false } = {}) {
  const seen = timesSeen(G, ev.id);
  if (ev.once && seen > 0) return false;
  if (!ignoreCooldown && seen > 0) {
    const cd = ev.cooldown ?? DEFAULT_COOLDOWN[ev.pool] ?? 4;
    if (dayOf(G) - lastSeenDay(G, ev.id) < cd) return false;
  }
  if (!safeCond(G, ev.cond)) return false;
  return ev.options.some((o) => safeCond(G, o.cond) && !costProblem(G, o.cost));
}

/**
 * Sorteia um evento do pool. Respeita once, cond, peso e cooldown (dias, guardado em G.campaign.flags['ev:<id>']).
 * tags: eventos que compartilham tags com o nó recebem peso dobrado.
 */
export function pickEvent(G, { pool = 'field', region, tags = [], exclude = [] } = {}) {
  if (!G) return null;
  const night = isNight(G);
  const build = (ignoreCooldown) => EVENTS.filter((ev) => (ev.w ?? 1) > 0 && poolMatch(ev, pool, G) && regionMatch(ev, region)
    && !exclude.includes(ev.id) && eligible(G, ev, { ignoreCooldown }));
  let list = build(false);
  if (!list.length) list = build(true);
  if (!list.length) return null;
  const weighted = list.map((ev) => {
    let w = ev.w ?? 1;
    if (tags.length && (ev.tags || []).some((t) => tags.includes(t))) w *= 2;
    if (ev.pool === 'night' && pool !== 'night') w *= 0.6;
    if (night && (ev.tags || []).includes('noite')) w *= 1.5;
    if (timesSeen(G, ev.id) > 0) w *= 0.45; // prefere o inédito
    if (Array.isArray(ev.region) && region && ev.region.includes(region)) w *= 1.25; // regional > genérico
    return [ev.id, w];
  });
  return R.weighted(weighted);
}

/** Inicia o evento: G.event = { id, ctx, stage:'choose', result:null }. */
export function startEvent(G, id, ctx = {}) {
  const ev = getEvent(id);
  if (!ev) throw new Error(`Evento inexistente: ${id}`);
  const c = { source: 'expedition', ...ctx };
  if (!c.region && G.expedition?.region) c.region = G.expedition.region;
  if (!c.nodeId && G.expedition?.node && c.source === 'expedition') c.nodeId = G.expedition.node;
  c.pool = c.pool || ev.pool;
  const camp = seenMap(G);
  camp.flags[`ev:${id}`] = dayOf(G);
  camp.counters[`ev:${id}`] = (camp.counters[`ev:${id}`] || 0) + 1;
  G.event = { id, ctx: c, stage: 'choose', result: null, heroUid: G.hero?.uid ?? null, day: dayOf(G), chain: (ctx.chain || 0) };
  save();
  return G.event;
}

// ---------------- custos ----------------
function itemCount(hero, id) {
  if (!hero) return 0;
  let n = 0;
  for (const it of hero.inv || []) if (it && it.id === id) n += it.n || 1;
  for (const it of Object.values(hero.equip || {})) if (it && it.id === id) n += it.n || 1;
  return n;
}

/** Retorna texto do problema se o custo não puder ser pago; senão ''. */
export function costProblem(G, cost) {
  if (!cost || !cost.length) return '';
  const hero = G.hero || {};
  for (const e of cost) {
    const n = e.n ?? 1;
    if (e.op === 'take' && itemCount(hero, e.id) < n) return `Falta: ${safeDescCond({ has: e.id, n }) || e.id}`;
    if (e.op === 'coin' && n < 0 && (hero.coin || 0) < -n) return `Faltam moedas (${-n})`;
    if (e.op === 'ichor' && n < 0 && (hero.ichor || 0) < -n) return `Falta Icor (${-n})`;
    if ((e.op === 'hp') && n < 0 && (hero.hp || 0) <= -n) return 'Vida insuficiente';
    if (e.op === 'food' && n < 0 && G.expedition && itemCount(hero, 'racao') < -n) return `Faltam rações (${-n})`;
    if (e.op === 'light' && n < 0 && G.expedition && (G.expedition.light || 0) < -n) return 'Luz insuficiente';
  }
  return '';
}

// ---------------- testes ----------------
function checkBonus(G, check) {
  let bonus = check.bonus || 0;
  const notes = [];
  for (const m of check.mods || []) {
    if (safeCond(G, m.cond)) { bonus += m.n; notes.push(`${m.n > 0 ? '+' : ''}${m.n} ${m.label || ''}`.trim()); }
  }
  return { bonus, notes };
}

export function optionChance(G, check) {
  const { bonus, notes } = checkBonus(G, check);
  let chance;
  try { chance = checkChance(G, { attr: check.attr, diff: check.diff || 0, bonus }); }
  catch { chance = Math.max(5, Math.min(95, 35 + ((G.hero?.attrs?.[check.attr]) || 3) * 8 + bonus - (check.diff || 0))); }
  return { chance: Math.round(chance), bonus, notes };
}

function safeDiffLabel(d) {
  try { return diffLabel(d || 0); } catch { return ({ 0: 'Fácil', 20: 'Média', 40: 'Difícil', 60: 'Brutal' })[d || 0] || 'Teste'; }
}

function fillText(G, s) {
  if (!s) return '';
  const hero = G.hero || {};
  return String(s)
    .replace(/\{nome\}/g, hero.name || 'Carniceiro')
    .replace(/\{casa\}/g, G.lineage?.house || 'sua casa')
    .replace(/\{dia\}/g, String(dayOf(G)));
}

// ---------------- visão ----------------
/** Opções visíveis com rótulo, sub (chance%, custos, requisitos), disabled/why. */
export function eventView(G) {
  const st = G.event;
  if (!st) return null;
  const ev = getEvent(st.id);
  if (!ev) return { title: '…', text: 'O momento passou.', options: [], missing: true };
  const options = [];
  ev.options.forEach((o, idx) => {
    const condOk = safeCond(G, o.cond);
    if (!condOk && o.hideIfNot) return;
    const subs = [];
    let chance = null;
    if (o.check) {
      const c = optionChance(G, o.check);
      chance = c.chance;
      subs.push(`${c.chance}% · ${ATTR_LABEL[o.check.attr] || o.check.attr} ${safeDiffLabel(o.check.diff)}${c.notes.length ? ` (${c.notes.join(', ')})` : ''}`);
    }
    if (o.cost?.length) { const d = safeDescEff(o.cost); if (d) subs.push(`Custo: ${d}`); }
    if (o.cond && condOk) { const d = o.tag || safeDescCond(o.cond); if (d) subs.unshift(`◆ ${d}`); }
    else if (o.tag) subs.unshift(`◆ ${o.tag}`);
    if (o.hint) subs.push(o.hint);
    let disabled = false;
    let why = '';
    if (!condOk) { disabled = true; why = `Requer: ${o.tag || safeDescCond(o.cond) || 'condição não cumprida'}`; }
    else {
      const p = costProblem(G, o.cost);
      if (p) { disabled = true; why = p; }
    }
    options.push({
      idx, label: fillText(G, o.label), sub: subs.join(' · '), disabled, why,
      kind: o.kind || (o.check && chance != null && chance < 35 ? 'danger' : undefined),
      chance, exclusive: !!(o.cond && condOk),
    });
  });
  return {
    id: ev.id, title: fillText(G, ev.title), text: fillText(G, ev.text), pool: ev.pool,
    stage: st.stage, result: st.result, options, sfx: ev.sfx, art: ev.art,
  };
}

// ---------------- resolução de marcadores ----------------
// Eventos genéricos ('any') usam: tier 'R' / tokens '@weapon:R' (tier da região) e inimigos por papel '%fera', '%morto'...
export const ROLES = {
  fera: { r1: 'cao_chaga', r2: 'lobo_tendao', r3: 'carnical', r4: 'enguia_icor', r5: 'filho_icor' },
  morto: { r1: 'lavrador_oco', r2: 'enforcado', r3: 'esqueleto_placas', r4: 'afogado', r5: 'anticorpo' },
  humano: { r1: 'saqueador', r2: 'cacador_cabecas', r3: 'sacerdote_renegado', r4: 'pescador', r5: 'bebedor_ascendido' },
  atirador: { r1: 'besteiro', r2: 'cacador_cabecas', r3: 'sacerdote_renegado', r4: 'pescador', r5: 'bebedor_ascendido' },
  elite: { r1: 'ceifeiro', r2: 'cervo_podre', r3: 'guardiao_sal', r4: 'cavaleiro_mare', r5: 'anjo_carne' },
  enxame: { r1: 'corvos', r2: 'corvos', r3: 'verme_ossos', r4: 'caranguejo_ossario', r5: 'verme_divino' },
};
const ROLE_FALLBACK = { fera: 'cao_chaga', morto: 'lavrador_oco', humano: 'desertor', atirador: 'besteiro', elite: 'ceifeiro', enxame: 'corvos' };

export function regionTier(G, region) {
  const m = /^r([1-5])$/.exec(region || '');
  if (m) return Number(m[1]);
  const bosses = Object.values(G?.campaign?.bosses || {}).filter(Boolean).length;
  return Math.max(1, Math.min(5, 1 + bosses));
}

function resolveEnemy(id, region) {
  if (typeof id !== 'string' || id[0] !== '%') return id;
  const role = id.slice(1);
  return ROLES[role]?.[region] || ROLES[role]?.r1 || ROLE_FALLBACK[role] || 'saqueador';
}

/** Copia profunda dos efeitos trocando marcadores de tier/papel pelos valores da região. */
export function resolveEffects(G, effects, ctx = {}) {
  if (!effects || !effects.length) return [];
  const region = /^r[1-5]$/.test(ctx.region || '') ? ctx.region : 'r1';
  const tier = regionTier(G, ctx.region);
  const fixTok = (s) => (typeof s === 'string' && s.startsWith('@') ? s.replace(/:R$/, `:${tier}`) : s);
  const walk = (e) => {
    if (Array.isArray(e)) return e.map(walk);
    if (!e || typeof e !== 'object') return fixTok(e);
    const o = {};
    for (const [k, v] of Object.entries(e)) o[k] = walk(v);
    if (o.op === 'loot' && (o.tier === 'R' || o.tier == null)) o.tier = tier;
    if (o.op === 'combat' && Array.isArray(o.enemies)) {
      o.enemies = o.enemies.map((x) => (typeof x === 'string' ? resolveEnemy(x, region) : { ...x, id: resolveEnemy(x.id, region) }));
    }
    return o;
  };
  return walk(effects);
}

// ---------------- escolha ----------------
function mergeOut(into, out) {
  if (!out) return;
  for (const l of out.lines || []) into.lines.push(typeof l === 'string' ? { text: l, kind: '' } : l);
  for (const p of out.pending || []) into.pending.push(p);
}

/** Aplica a opção idx. Retorna { text, lines, pending, ok, roll, chance }. */
export function choose(G, idx) {
  const st = G.event;
  if (!st || st.stage !== 'choose') throw new Error('Nenhuma escolha pendente');
  const ev = getEvent(st.id);
  const o = ev?.options?.[idx];
  if (!o) throw new Error(`Opção inválida: ${idx}`);
  if (!safeCond(G, o.cond)) throw new Error('Opção indisponível');
  const prob = costProblem(G, o.cost);
  if (prob) throw new Error(prob);

  const ectx = { source: st.ctx.source, region: st.ctx.region, nodeId: st.ctx.nodeId, eventId: st.id, via: 'event' };
  const out = { lines: [], pending: [] };
  if (o.cost?.length) mergeOut(out, applyEffects(G, resolveEffects(G, o.cost, st.ctx), ectx));

  let branch = o.success;
  let ok = true;
  let roll = null;
  let chance = null;
  let crit = false;
  let fumble = false;
  if (o.check) {
    const { bonus } = checkBonus(G, o.check);
    let r;
    try { r = rollCheck(G, { attr: o.check.attr, diff: o.check.diff || 0, bonus }); }
    catch {
      const c = optionChance(G, o.check).chance;
      const rr = R.int(1, 100);
      r = { ok: rr <= c, roll: rr, chance: c, crit: rr <= c / 5, fumble: rr > 95 };
    }
    ok = !!r.ok; roll = r.roll; chance = r.chance; crit = !!r.crit && ok; fumble = !!r.fumble && !ok;
    if (ok) branch = (crit && o.crit) ? o.crit : o.success;
    else branch = (fumble && o.fumble) ? o.fumble : (o.fail || { text: 'Não deu certo.', effects: [] });
  }
  branch = branch || { text: '', effects: [] };
  // o herói pode ter morrido pelo custo (ex.: sangrar no altar): não aplica o resto
  const deadByCost = out.pending.some((p) => p.type === 'death');
  if (!deadByCost && branch.effects?.length) mergeOut(out, applyEffects(G, resolveEffects(G, branch.effects, st.ctx), ectx));

  const result = {
    idx, label: fillText(G, o.label), text: fillText(G, branch.text || ''), lines: out.lines, pending: out.pending,
    ok, roll, chance, crit, fumble, attr: o.check?.attr || null, checked: !!o.check, sfx: o.sfx || null,
  };
  // o herói pode ter sido substituído (morte por Transformação dentro de applyEffects)
  if (G.event === st) { st.stage = 'result'; st.result = result; }
  save();
  return result;
}

// ---------------- encerramento ----------------
function fixEnemies(list, region) {
  const known = ENEMIES && typeof ENEMIES === 'object' ? ENEMIES : null;
  return (list || []).map((e) => {
    const id = typeof e === 'string' ? e : e?.id;
    if (!known || known[id]) return e;
    const fb = FALLBACK_ENEMY[region] || 'saqueador';
    console.warn(`[events] inimigo desconhecido '${id}', usando '${fb}'`);
    return typeof e === 'string' ? fb : { ...e, id: fb };
  }).filter(Boolean);
}

/** Descrição do que vem depois (para o botão Continuar). */
export function nextStep(G) {
  const pend = G.event?.result?.pending || [];
  if (pend.some((p) => p.type === 'death')) return 'death';
  if (pend.some((p) => p.type === 'combat')) return 'combat';
  if (pend.some((p) => p.type === 'event')) return 'event';
  if (pend.some((p) => p.type === 'loot') || (G.pendingLoot && (G.pendingLoot.items?.length || G.pendingLoot.coin || G.pendingLoot.ichor))) return 'loot';
  return 'end';
}

/**
 * Processa pending: morte → flow.heroDied; combate → startCombat (context.source = ctx.source, onWin/onFlee);
 * evento encadeado → startEvent; saque → tela 'loot' (source 'event'); senão flow.eventEnded({source}).
 */
export function finishEvent(G) {
  const st = G.event;
  if (!st) { flow.eventEnded({ source: 'expedition' }); return 'end'; }
  const ctx = st.ctx || {};
  const pend = st.result?.pending || [];
  const step = nextStep(G);

  if (step === 'death') {
    const p = pend.find((x) => x.type === 'death');
    G.event = null;
    save();
    flow.heroDied(p.cause || 'Morto no Ermo', { region: ctx.region, nodeId: ctx.nodeId, source: 'event', eventId: st.id });
    return 'death';
  }

  if (step === 'combat') {
    const p = pend.find((x) => x.type === 'combat');
    const spec = p.spec || p;
    const region = ctx.region || G.expedition?.region || 'r1';
    const night = isNight(G);
    // saque/eventos que vieram junto do combate não podem se perder: viram recompensa de vitória
    const extraWin = [];
    for (const q of pend) if (q.type === 'event') extraWin.push({ op: 'event', id: q.id });
    const onWin = [...(spec.onWin || []), ...extraWin];
    G.event = null;
    startCombat(G, {
      enemies: fixEnemies(spec.enemies, region),
      region,
      ambush: spec.ambush || null,
      boss: !!spec.boss,
      dark: spec.dark ?? (G.expedition ? !G.expedition.torchLit && !G.expedition.light : false),
      night,
      canFlee: spec.canFlee ?? true,
      text: spec.text,
      context: {
        source: ctx.source || 'expedition', nodeId: ctx.nodeId, region, eventId: st.id, eventSource: ctx.source,
        onWin, onFlee: spec.onFlee || [], boss: !!spec.boss, canFlee: spec.canFlee ?? true,
      },
      onWin,
      onFlee: spec.onFlee || [],
    });
    save();
    nav('combat');
    return 'combat';
  }

  if (step === 'event') {
    const p = pend.find((x) => x.type === 'event');
    if (getEvent(p.id) && (st.chain || 0) < 8) {
      startEvent(G, p.id, { ...ctx, pool: undefined, chain: (st.chain || 0) + 1 });
      nav('event', {}, { replace: true });
      return 'event';
    }
  }

  if (step === 'loot' && G.pendingLoot) {
    G.pendingLoot.source = 'event';
    if (!G.pendingLoot.title) G.pendingLoot.title = getEvent(st.id)?.title || 'Saque';
    st.stage = 'loot';
    save();
    nav('loot');
    return 'loot';
  }

  G.event = null;
  save();
  flow.eventEnded({ source: ctx.source || 'expedition', id: st.id, nodeId: ctx.nodeId });
  return 'end';
}

/** Descarta o evento (ex.: herói trocado, evento removido do jogo). */
export function abandonEvent(G) {
  const src = G.event?.ctx?.source || 'expedition';
  G.event = null;
  save();
  return src;
}

/** O evento salvo ainda pertence ao herói atual? */
export function eventIsStale(G) {
  const st = G.event;
  if (!st) return false;
  if (!getEvent(st.id)) return true;
  if (st.heroUid != null && G.hero && G.hero.uid !== st.heroUid) return true;
  if (!G.hero) return true;
  return false;
}

// ---------------- validação (testes / depuração) ----------------
export const VALID_OPS = ['hp', 'dread', 'corruption', 'coin', 'ichor', 'item', 'take', 'loot', 'wound', 'healWounds', 'trait', 'untrait',
  'mutation', 'rep', 'chaga', 'time', 'light', 'food', 'flag', 'count', 'combat', 'event', 'reveal', 'mastery', 'learn', 'companion',
  'loseCompanion', 'unlock', 'journal', 'log', 'random', 'kill', 'stamina', 'attr', 'heal', 'questStep', 'fragment', 'siegeDefense'];
export const VALID_CONDS = ['has', 'n', 'attr', 'min', 'flag', 'eq', 'notFlag', 'rep', 'coin', 'ichor', 'trait', 'notTrait', 'bg', 'corruption',
  'dread', 'partOk', 'chaga', 'day', 'region', 'night', 'companion', 'level', 'boss', 'service', 'any', 'all', 'not', 'deadCount', 'inExpedition', 'talent', 'mutation', 'hpPct'];
const POOLS = ['field', 'city', 'camp', 'ruin', 'shrine', 'night', 'story', 'quest'];
const ATTRS = ['for', 'des', 'vig', 'von', 'ast'];
const PARTS = ['cabeca', 'tronco', 'bracoD', 'bracoE', 'pernas'];
const DTYPES = ['corte', 'perf', 'impacto', 'fogo', 'icor'];
const FACTIONS = ['sutura', 'coroa', 'guilda', 'bebedores'];

function validateCond(c, path, errs) {
  if (!c || typeof c !== 'object') { errs.push(`${path}: cond não é objeto`); return; }
  const keys = Object.keys(c);
  if (!keys.length) errs.push(`${path}: cond vazia`);
  for (const k of keys) if (!VALID_CONDS.includes(k)) errs.push(`${path}: chave de cond desconhecida '${k}'`);
  if (c.any) c.any.forEach((x, i) => validateCond(x, `${path}.any[${i}]`, errs));
  if (c.all) c.all.forEach((x, i) => validateCond(x, `${path}.all[${i}]`, errs));
  if (c.not) validateCond(c.not, `${path}.not`, errs);
  if (c.attr && (!ATTRS.includes(c.attr) || typeof c.min !== 'number')) errs.push(`${path}: attr inválido`);
  if (c.rep && !FACTIONS.includes(c.rep.f)) errs.push(`${path}: facção inválida`);
}

function validateEffects(list, path, errs, refs) {
  if (!Array.isArray(list)) { errs.push(`${path}: efeitos não é array`); return; }
  list.forEach((e, i) => {
    const p = `${path}[${i}]`;
    if (!e || !VALID_OPS.includes(e.op)) { errs.push(`${p}: op inválido '${e?.op}'`); return; }
    if (['hp', 'dread', 'corruption', 'coin', 'ichor', 'chaga', 'light', 'food', 'heal', 'siegeDefense'].includes(e.op) && typeof e.n !== 'number') errs.push(`${p}: ${e.op} sem n numérico`);
    if (e.op === 'time' && typeof e.h !== 'number') errs.push(`${p}: time sem h`);
    if ((e.op === 'item' || e.op === 'take') && !e.id) errs.push(`${p}: ${e.op} sem id`);
    if ((e.op === 'item' || e.op === 'take') && e.id && !String(e.id).startsWith('@') && refs.items && !refs.items[e.id]) errs.push(`${p}: item desconhecido '${e.id}'`);
    if (e.op === 'item' && String(e.id).startsWith('@') && !/^@(weapon|armor|offhand|trinket|consumable|material|any):([1-5]|R)$/.test(e.id)) errs.push(`${p}: token de saque inválido '${e.id}'`);
    if (e.op === 'wound') {
      if (e.part && !PARTS.includes(e.part)) errs.push(`${p}: parte inválida '${e.part}'`);
      if (!DTYPES.includes(e.dtype)) errs.push(`${p}: dtype inválido '${e.dtype}'`);
      if (![1, 2, 3].includes(e.sev)) errs.push(`${p}: sev inválida`);
    }
    if (e.op === 'rep' && (!FACTIONS.includes(e.f) || typeof e.n !== 'number')) errs.push(`${p}: rep inválida`);
    if ((e.op === 'trait' || e.op === 'untrait') && !e.id) errs.push(`${p}: traço sem id`);
    if ((e.op === 'trait' || e.op === 'untrait') && e.id && refs.traits && !refs.traits[e.id]) errs.push(`${p}: traço desconhecido '${e.id}'`);
    if (e.op === 'companion' && e.id && refs.companions && !refs.companions[e.id]) errs.push(`${p}: sequaz desconhecido '${e.id}'`);
    if ((e.op === 'flag' || e.op === 'count') && !e.k) errs.push(`${p}: flag sem k`);
    if (e.op === 'event' && refs.events && !refs.events[e.id]) errs.push(`${p}: evento encadeado inexistente '${e.id}'`);
    if (e.op === 'attr' && !ATTRS.includes(e.a)) errs.push(`${p}: attr inválido`);
    if (e.op === 'loot' && !Array.isArray(e.table)) errs.push(`${p}: loot sem table`);
    if (e.op === 'loot' && Array.isArray(e.table)) e.table.forEach((row, j) => {
      const id = Array.isArray(row) ? row[0] : null;
      if (!id) errs.push(`${p}.table[${j}]: linha inválida`);
      else if (!String(id).startsWith('@') && refs.items && !refs.items[id]) errs.push(`${p}.table[${j}]: item desconhecido '${id}'`);
      else if (String(id).startsWith('@') && !/^@(weapon|armor|offhand|trinket|consumable|material|any):([1-5]|R)$/.test(id)) errs.push(`${p}.table[${j}]: token inválido '${id}'`);
    });
    if (e.op === 'combat') {
      if (!Array.isArray(e.enemies) || !e.enemies.length) errs.push(`${p}: combate sem inimigos`);
      for (const en of e.enemies || []) {
        const id = typeof en === 'string' ? en : en?.id;
        if (typeof id === 'string' && id[0] === '%') { if (!ROLES[id.slice(1)]) errs.push(`${p}: papel de inimigo inválido '${id}'`); continue; }
        if (refs.enemyIds && !refs.enemyIds.includes(id)) errs.push(`${p}: inimigo desconhecido '${id}'`);
      }
      if (e.onWin) validateEffects(e.onWin, `${p}.onWin`, errs, refs);
      if (e.onFlee) validateEffects(e.onFlee, `${p}.onFlee`, errs, refs);
      if ((e.onWin || []).some((x) => x.op === 'loot' || x.op === 'combat')) errs.push(`${p}: onWin não deve ter loot/combat`);
    }
    if (e.op === 'random') {
      if (!Array.isArray(e.table) || !e.table.length) errs.push(`${p}: random sem table`);
      (e.table || []).forEach((r, j) => validateEffects(r.effects || [], `${p}.table[${j}]`, errs, refs));
    }
  });
  const nav = list.filter((e) => ['combat', 'event', 'loot', 'kill'].includes(e?.op)).length;
  if (nav > 1) errs.push(`${path}: mais de um efeito de navegação (combat/event/loot/kill)`);
}

/** Valida uma lista de eventos. refs: { items, enemyIds, traits, companions, events } (opcionais). */
export function validateEvents(list, refs = {}) {
  const errs = [];
  const ids = new Set();
  const evRefs = { ...refs, events: refs.events || Object.fromEntries(list.map((e) => [e.id, e])) };
  for (const ev of list) {
    const p = `evento ${ev?.id}`;
    if (!ev || !ev.id || !/^[a-z0-9_]+$/.test(ev.id)) { errs.push(`${p}: id inválido`); continue; }
    if (ids.has(ev.id)) errs.push(`${p}: id duplicado`);
    ids.add(ev.id);
    if (!POOLS.includes(ev.pool)) errs.push(`${p}: pool inválido '${ev.pool}'`);
    if (!(ev.region === 'any' || (Array.isArray(ev.region) && ev.region.length))) errs.push(`${p}: region inválida`);
    if (!ev.title || !String(ev.title).trim()) errs.push(`${p}: sem título`);
    if (!ev.text || String(ev.text).trim().length < 20) errs.push(`${p}: texto vazio/curto`);
    if (ev.text && ev.text.length > 520) errs.push(`${p}: texto longo demais (${ev.text.length})`);
    if (ev.cond) validateCond(ev.cond, `${p}.cond`, errs);
    if (!Array.isArray(ev.options) || !ev.options.length) { errs.push(`${p}: sem opções`); continue; }
    let freeExit = false;
    ev.options.forEach((o, i) => {
      const q = `${p}.options[${i}]`;
      if (!o.label || !String(o.label).trim()) errs.push(`${q}: sem rótulo`);
      if (!o.success) errs.push(`${q}: sem success`);
      if (o.success && typeof o.success.text !== 'string') errs.push(`${q}: success sem texto`);
      if (o.cond) validateCond(o.cond, `${q}.cond`, errs);
      if (o.cost) validateEffects(o.cost, `${q}.cost`, errs, evRefs);
      if (o.check) {
        if (!ATTRS.includes(o.check.attr)) errs.push(`${q}: check.attr inválido`);
        if (![0, 20, 40, 60].includes(o.check.diff || 0)) errs.push(`${q}: check.diff inválido`);
        if (!o.fail) errs.push(`${q}: check sem fail`);
        for (const m of o.check.mods || []) { validateCond(m.cond, `${q}.check.mods`, errs); if (typeof m.n !== 'number') errs.push(`${q}: mod sem n`); }
      }
      for (const k of ['success', 'fail', 'crit', 'fumble']) {
        if (!o[k]) continue;
        if (o[k].text != null && typeof o[k].text !== 'string') errs.push(`${q}.${k}: texto inválido`);
        validateEffects(o[k].effects || [], `${q}.${k}`, errs, evRefs);
      }
      if (!o.cond && !(o.cost && o.cost.length)) freeExit = true;
    });
    if (!freeExit) errs.push(`${p}: nenhuma opção livre (sem cond e sem custo) — pode travar o jogador`);
  }
  return errs;
}
