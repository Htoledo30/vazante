// ICOR — Expedição (Área C).
// Lógica pura (sem DOM). A navegação é injetada pela UI com registerHooks({ go }).
//
// Estado (JSON puro):
//   G.expedition = { id, region, node, prev, path:[], light /*horas*/, torchLit, hoursOut, startTime,
//                    cleared:{}, visited:{}, content:{nodeId:{...}}, log:[], pendingCombat, pendingMove,
//                    afterLoot, alert, campCount:{}, stalk, retreat, lastCamp, stats:{...}, ... }
//   G.world.regions[id] = { map, seen:[], discovered:[], visitedEver:[], nests:{}, shortcuts:{}, overrides:{},
//                           expeditions, bossDead, sprouted, carcasses? }
//
// Ganchos registrados: combatEnd:expedition, combatEnd:camp, eventEnd:expedition, eventEnd:camp, lootDone:expedition.
import { R } from '../core/rng.js';
import { clamp, clone, uid, timeOf, isNightHour } from '../core/util.js';
import { save } from '../core/save.js';
import { emit, sfx } from '../core/bus.js';
import * as flow from './flow.js';
import {
  REGIONS, REGION_ORDER, NODE_TYPES, TORCH_HOURS, TALLOW_HOURS, MEAL_HOURS, SHRINE_RITES, ROT_RITES, nextRegion,
} from '../data/regions.js';
import { ENCOUNTERS, BOSS_ENCOUNTERS, NEST_ENCOUNTERS } from '../data/encounters.js';
import { genRegionMap, edgeOf, shortestPath, hopDistances, validateMap, MAP_VERSION } from './mapgen.js';
// Outras áreas por namespace: um nome ausente vira fallback em vez de quebrar o carregamento.
import * as CH from './character.js';
import * as IT from './items.js';
import * as EF from './effects.js';
import * as CK from './checks.js';
import * as LT from './loot.js';
import * as CB from './combat/index.js';
import * as EV from './events.js';
import * as TM from './time.js';
import * as CP from './campaign.js';

// ======================================================================
// Adaptadores (A/B/D/E) — nunca lançam
// ======================================================================
const asLines = (x) => (Array.isArray(x) ? x : x?.lines || []).map((l) => (typeof l === 'string' ? { text: l, kind: '' } : l));

export function heroD(G) {
  try { if (CH.derive && G.hero) return CH.derive(G.hero) || {}; } catch (e) { console.error('[exp] derive', e); }
  const a = { for: 3, des: 3, vig: 3, von: 3, ast: 3, ...(G.hero?.attrs || {}) };
  return { attrs: a, hpMax: 30 + a.vig * 6, carryMax: 20 + a.for * 4, load: 0, overloaded: false, mods: {}, offhand: { kind: 'none' } };
}
export const modOf = (D, k) => Number(D?.mods?.[k]) || 0;
const attrOf = (D, G, a) => Number(D?.attrs?.[a] ?? G.hero?.attrs?.[a] ?? 3);

export function countOf(G, id) {
  const h = G.hero;
  if (!h) return 0;
  try { if (IT.countItem) return IT.countItem(h, id) || 0; } catch { /* */ }
  return (h.inv || []).filter((i) => i && i.id === id).reduce((s, i) => s + (i.n || 1), 0);
}
export function takeItem(G, id, n = 1) {
  const h = G.hero;
  if (!h || countOf(G, id) < n) return false;
  try { if (IT.removeItem) return IT.removeItem(h, id, n) !== false; } catch { /* */ }
  let left = n;
  for (const inst of [...(h.inv || [])]) {
    if (inst.id !== id || left <= 0) continue;
    const k = Math.min(left, inst.n || 1);
    inst.n = (inst.n || 1) - k; left -= k;
    if (inst.n <= 0) h.inv.splice(h.inv.indexOf(inst), 1);
  }
  return left <= 0;
}
export function makeInst(id, opts = {}) {
  try { if (IT.makeItem) return IT.makeItem(id, opts); } catch (e) { console.error('[exp] makeItem', id, e); }
  return { uid: uid('i'), id, q: opts.q ?? 1, n: opts.n ?? 1, dur: 100, ench: null };
}
export function giveInst(G, inst) {
  const h = G.hero;
  if (!h || !inst) return;
  try { if (IT.addItem) { IT.addItem(h, inst); return; } } catch (e) { console.error('[exp] addItem', e); }
  (h.inv = h.inv || []).push(inst);
}
export function defOf(instOrId) {
  try { if (IT.itemDef) return IT.itemDef(instOrId) || null; } catch { /* */ }
  return null;
}
export function nameOf(inst) {
  try { if (IT.itemName) return IT.itemName(inst); } catch { /* */ }
  return defOf(inst)?.name || inst?.name || inst?.id || '?';
}
export function valueOf(inst) {
  try { if (IT.itemValue) return Math.max(0, Number(IT.itemValue(inst)) || 0); } catch { /* */ }
  return (defOf(inst)?.value || 1) * (inst?.n || 1);
}
function unitValue(inst) { return valueOf({ ...inst, n: 1 }); }

export function chanceOf(G, check) {
  try { if (CK.checkChance) return Math.round(CK.checkChance(G, check)); } catch { /* */ }
  const D = heroD(G);
  return clamp(35 + attrOf(D, G, check.attr) * 8 + (check.bonus || 0) - (check.diff || 0), 5, 95);
}
export function roll(G, check) {
  try { if (CK.rollCheck) return CK.rollCheck(G, check); } catch { /* */ }
  const chance = chanceOf(G, check);
  const r = R.int(1, 100);
  return { ok: r <= chance, roll: r, chance, crit: r <= chance / 5, fumble: r > 95 };
}

function dread(G, n, why) {
  if (!n || !G.hero) return [];
  try { if (CH.addDread) return asLines(CH.addDread(G, n, why)); } catch (e) { console.error(e); }
  G.hero.dread = clamp((G.hero.dread || 0) + n, 0, 100);
  return [{ text: `${n > 0 ? '+' : ''}${n} Pavor (${why})`, kind: n > 0 ? 'dread' : 'good' }];
}
function corrupt(G, n, why) {
  if (!n || !G.hero) return { lines: [], transformed: false };
  try {
    if (CH.addCorruption) { const r = CH.addCorruption(G, n, why) || {}; return { lines: asLines(r), transformed: !!r.transformed }; }
  } catch (e) { console.error(e); }
  G.hero.corruption = clamp((G.hero.corruption || 0) + n, 0, 100);
  return { lines: [{ text: `+${n} Corrupção (${why})`, kind: 'corr' }], transformed: G.hero.corruption >= 100 };
}
function hurt(G, n, why) {
  if (!n || !G.hero) return { lines: [], died: false };
  try {
    if (CH.damageHero) { const r = CH.damageHero(G, n, why) || {}; return { lines: asLines(r), died: !!r.died || heroDead(G) }; }
  } catch (e) { console.error(e); }
  G.hero.hp = Math.max(0, (G.hero.hp || 0) - n);
  return { lines: [{ text: `−${n} Vida (${why})`, kind: 'bad' }], died: G.hero.hp <= 0 };
}
function healHero(G, n) {
  if (!n || !G.hero) return 0;
  const before = G.hero.hp;
  try { if (CH.heal) { CH.heal(G.hero, n); return G.hero.hp - before; } } catch (e) { console.error(e); }
  const max = heroD(G).hpMax || 60;
  G.hero.hp = Math.min(max, (G.hero.hp || 0) + n);
  return G.hero.hp - before;
}
function advance(G, hours) {
  if (!(hours > 0)) return [];
  try { if (TM.advanceTime) return asLines(TM.advanceTime(G, hours, { where: 'field' })); } catch (e) { console.error('[exp] advanceTime', e); }
  G.time = (G.time || 0) + hours;
  return [];
}
function chaga(G, n, why) {
  try { if (TM.addChaga) return asLines(TM.addChaga(G, n, why)); } catch (e) { console.error(e); }
  G.chaga = clamp((G.chaga || 0) + n, 0, 100);
  return [{ text: `Chaga ${n > 0 ? '+' : ''}${n} — ${why}`, kind: n > 0 ? 'rot' : 'good' }];
}
function journal(G, text) {
  try { if (TM.journal) { TM.journal(G, text); return; } } catch { /* */ }
  const j = G.campaign.journal || (G.campaign.journal = []);
  j.push({ day: dayOf(G), text });
}
function applyA(G, effects, ctx) {
  if (!effects?.length) return { lines: [], pending: [] };
  try {
    if (CP.applyD) { const r = CP.applyD(G, effects, ctx) || {}; return { lines: asLines(r), pending: r.pending || [] }; }
    if (EF.applyEffects) { const r = EF.applyEffects(G, effects, ctx) || {}; return { lines: asLines(r), pending: r.pending || [] }; }
  } catch (e) { console.error('[exp] applyEffects', e); }
  return { lines: [], pending: [] };
}
function condOk(G, cond) {
  if (!cond) return true;
  try { if (EF.checkCond) return !!EF.checkCond(G, cond); } catch { /* */ }
  if (cond.ichor != null) return (G.hero?.ichor || 0) >= cond.ichor;
  if (cond.coin != null) return (G.hero?.coin || 0) >= cond.coin;
  if (cond.has) return countOf(G, cond.has) >= (cond.n || 1);
  return true;
}

export const heroDead = (G) => !G.hero || G.hero.dead || (G.hero.hp != null && G.hero.hp <= 0);
export const dayOf = (G) => timeOf(G.time || 0).day;
export const hourOf = (G) => ((G.time || 0) % 24 + 24) % 24;
export const isNight = (G) => isNightHour(Math.floor(hourOf(G)));

// ======================================================================
// Navegação injetada + ganchos
// ======================================================================
let navFn = () => {};
/** A UI chama no init: registerHooks({ go(screen, params, opts) }). */
export function registerHooks(nav = {}) {
  if (typeof nav.go === 'function') navFn = nav.go;
  flow.setHook('combatEnd:expedition', (G, outcome) => follow(onCombatEnd(G, outcome)));
  flow.setHook('combatEnd:camp', (G, outcome) => follow(onCombatEnd(G, outcome)));
  flow.setHook('eventEnd:expedition', (G, info) => follow(onEventEnd(G, info)));
  flow.setHook('eventEnd:camp', (G, info) => follow(onCampEventEnd(G, info)));
  flow.setHook('lootDone:expedition', (G) => follow(onLootDone(G)));
}
/** Executa uma navegação devolvida pelos sistemas ({screen, params}). */
export function follow(res) {
  const nav = res && (res.nav || (res.screen ? res : null));
  if (!nav || !nav.screen) return res;
  try { navFn(nav.screen, nav.params || {}, nav.opts || { replace: true }); } catch (e) { console.error('[exp] nav', e); }
  return res;
}

// ======================================================================
// Registro
// ======================================================================
export function addLog(G, text, kind = '') {
  const exp = G.expedition;
  if (!text) return;
  const e = { t: G.time, text, kind };
  if (exp) { exp.log.push(e); if (exp.log.length > 80) exp.log.splice(0, exp.log.length - 80); }
  emit('log', e);
}
function pushLines(G, lines, out) {
  for (const l of lines || []) {
    if (!l || !l.text) continue;
    out.push(l);
    addLog(G, l.text, l.kind);
  }
}
export function expeditionLog(G) { return G.expedition?.log || []; }

// ======================================================================
// Regiões, mapa, névoa
// ======================================================================
const addU = (arr, v) => { if (!arr.includes(v)) arr.push(v); };

export function regionUnlocked(G, id) {
  const reg = REGIONS[id];
  if (!reg) return false;
  if (!reg.unlock) return true;
  if (G.world?.regions?.[id]?.unlocked) return true;
  if (G.city?.unlocked?.[id]) return true;
  if (reg.unlock.boss && G.campaign?.bosses?.[reg.unlock.boss]) return true;
  return false;
}
export function lockReason(G, id) {
  const reg = REGIONS[id];
  if (!reg?.unlock?.boss) return '';
  const prev = REGIONS[reg.unlock.boss];
  return `Mate ${prev.bossName} (${prev.name}).`;
}

/** Garante o estado persistente da região (mapa gerado uma vez com a seed da campanha). */
export function ensureRegion(G, id) {
  if (!REGIONS[id]) throw new Error(`Região desconhecida: ${id}`);
  G.world = G.world || { regions: {}, bestiary: {} };
  G.world.regions = G.world.regions || {};
  const rs = G.world.regions[id] || (G.world.regions[id] = {});
  if (!rs.map || rs.map.v !== MAP_VERSION || validateMap(rs.map).length) rs.map = genRegionMap(G.seed ?? 1, id);
  const map = rs.map;
  rs.seen = rs.seen || [];
  rs.discovered = rs.discovered || [];
  rs.visitedEver = rs.visitedEver || [];
  rs.nests = rs.nests || {};
  rs.shortcuts = rs.shortcuts || {};
  rs.overrides = rs.overrides || {};
  rs.expeditions = rs.expeditions || 0;
  rs.sprouted = rs.sprouted || 0;
  if (regionUnlocked(G, id)) rs.unlocked = true;
  for (const nid of [map.entry, map.boss, ...map.nodes[map.entry].links]) addU(rs.seen, nid);
  addU(rs.discovered, map.entry);
  addU(rs.discovered, map.boss);
  for (const n of Object.values(map.nodes)) {
    if (n.type === 'nest' && !rs.nests[n.id]) rs.nests[n.id] = { born: dayOf(G), growth: 0, destroyed: false, spilled: 0 };
  }
  return rs;
}
export const regionState = ensureRegion;

/** Tipo efetivo do nó (ninhos podem brotar sobre outros tipos). */
export function nodeType(G, rid, nid) {
  const rs = G.world?.regions?.[rid];
  if (!rs?.map?.nodes?.[nid]) return null;
  return rs.overrides?.[nid] || rs.map.nodes[nid].type;
}
export function nodeName(G, rid, nid) {
  const rs = G.world?.regions?.[rid];
  const n = rs?.map?.nodes?.[nid];
  if (!n) return '?';
  if (rs.overrides?.[nid] === 'nest') return REGIONS[rid].nestName;
  return n.name;
}
export function isSeen(G, rid, nid) {
  const rs = G.world?.regions?.[rid];
  return !!rs && (rs.seen.includes(nid) || rs.discovered.includes(nid));
}
export function isDiscovered(G, rid, nid) {
  return !!G.world?.regions?.[rid]?.discovered?.includes(nid);
}
function see(G, rid, nid) { addU(ensureRegion(G, rid).seen, nid); }
function discover(G, rid, nid) { const rs = ensureRegion(G, rid); addU(rs.seen, nid); addU(rs.discovered, nid); }

/** Revela n nós desconhecidos, os mais próximos primeiro. Retorna quantos. (op 'reveal') */
export function revealNodes(G, n = 1, rid) {
  rid = rid || G.expedition?.region;
  if (!rid || !REGIONS[rid] || n <= 0) return 0;
  const rs = ensureRegion(G, rid);
  const from = G.expedition?.region === rid ? G.expedition.node : rs.map.entry;
  const dist = hopDistances(rs.map, from);
  const cand = Object.keys(rs.map.nodes).filter((id) => !rs.discovered.includes(id))
    .sort((a, b) => (dist[a] ?? 99) - (dist[b] ?? 99) || (a < b ? -1 : 1));
  const add = cand.slice(0, n);
  for (const id of add) discover(G, rid, id);
  return add.length;
}

// ======================================================================
// Luz, escuridão, fome, peso
// ======================================================================
export function isDarkAt(G, rid, absHour) {
  const reg = REGIONS[rid];
  if (!reg) return false;
  const h = Math.floor(((absHour % 24) + 24) % 24);
  const mode = reg.env?.light || 'open';
  if (mode === 'always') return true;
  if (mode === 'glow') return false;
  if (isNightHour(h)) return true;
  if (mode === 'canopy') return !(h >= 10 && h < 16);
  return false;
}
/** Está escuro AGORA na região da expedição (independente de tocha)? */
export function isDarkNow(G) { return !!G.expedition && isDarkAt(G, G.expedition.region, G.time); }
/** O herói enxerga agora? (sem escuridão ou com tocha acesa e queimando) */
export function isLit(G) {
  const exp = G.expedition;
  if (!exp) return true;
  if (!isDarkNow(G)) return true;
  return !!exp.torchLit && exp.light > 0;
}
export function torchHours(G) {
  const D = heroD(G);
  const eff = modOf(D, 'light_eff') + (D.offhand?.kind === 'torch' || D.offhand?.light ? 20 : 0);
  return Math.round(TORCH_HOURS * (1 + eff / 100) * 10) / 10;
}
/** Acende uma tocha nova do inventário. */
export function lightTorch(G, { force = false } = {}) {
  const exp = G.expedition;
  if (!exp) return { ok: false, why: 'Fora de expedição.' };
  if (!force && exp.light > 0.5) { exp.torchLit = true; return { ok: true, lines: [{ text: 'A tocha volta a queimar.', kind: '' }] }; }
  if (!takeItem(G, 'tocha', 1)) return { ok: false, why: 'Sem tochas.' };
  exp.light = Math.max(0, exp.light) + torchHours(G);
  exp.torchLit = true;
  sfx('fire');
  return { ok: true, lines: [{ text: 'Você acende uma tocha.', kind: 'info' }] };
}
/** Reforça a chama com sebo (+3h). */
export function feedTorch(G) {
  const exp = G.expedition;
  if (!exp) return { ok: false, why: 'Fora de expedição.' };
  if (!(exp.light > 0)) return { ok: false, why: 'Não há chama acesa para alimentar.' };
  if (!takeItem(G, 'sebo', 1)) return { ok: false, why: 'Sem sebo.' };
  exp.light += TALLOW_HOURS;
  return { ok: true, lines: [{ text: `Sebo na tocha: +${TALLOW_HOURS}h de luz. Fede.`, kind: 'info' }] };
}
export function toggleTorch(G) {
  const exp = G.expedition;
  if (!exp) return { ok: false };
  exp.torchLit = !exp.torchLit;
  if (exp.torchLit && !(exp.light > 0)) {
    const r = lightTorch(G, { force: true });
    if (!r.ok) { exp.torchLit = false; return r; }
    return r;
  }
  return { ok: true, lines: [{ text: exp.torchLit ? 'Tocha acesa.' : 'Você abafa a tocha. A escuridão encosta.', kind: '' }] };
}
/** op 'light' (A pode chamar): +h horas de luz (ou −h). */
export function gainLight(G, h) {
  const exp = G.expedition;
  if (!exp) return [];
  exp.light = Math.max(0, (exp.light || 0) + h);
  if (h > 0) exp.torchLit = true;
  if (exp.light <= 0) return [{ text: 'A luz se apaga.', kind: 'bad' }];
  return [{ text: `+${h}h de luz`, kind: 'info' }];
}
/** op 'food' (A pode chamar): n>0 dá rações, n<0 tira rações. */
export function gainFood(G, n) {
  if (!n || !G.hero) return [];
  if (n > 0) { giveInst(G, makeInst('racao', { n })); return [{ text: `+${n} ração`, kind: 'good' }]; }
  const k = Math.min(-n, countOf(G, 'racao'));
  if (k > 0) takeItem(G, 'racao', k);
  return [{ text: `−${k} ração`, kind: 'bad' }];
}
/** Refeição: zera parte da fome. (op 'eat' de A pode chamar isto) */
export function eat(G, { cooked = false } = {}) {
  const h = G.hero;
  if (!h) return [];
  const D = heroD(G);
  const per = MEAL_HOURS * (1 + modOf(D, 'food_eff') / 100) + (cooked ? 6 : 0);
  h.hunger = Math.round(((h.hunger || 0) - per) * 10) / 10;
  if (h.hunger < (cooked ? -6 : 0)) h.hunger = cooked ? -6 : 0;
  return [{ text: cooked ? 'Comida quente. O corpo agradece.' : 'Você mastiga uma ração.', kind: 'good' }];
}
export function eatNow(G) {
  if (!takeItem(G, 'racao', 1)) return { ok: false, why: 'Sem rações.' };
  return { ok: true, lines: eat(G) };
}

export const HUNGER_LEVELS = [
  { lvl: 0, label: 'Alimentado', kind: 'good' },
  { lvl: 1, label: 'Com fome', kind: 'warn', note: 'Descanso cura metade.' },
  { lvl: 2, label: 'Faminto', kind: 'bad', note: 'Perde Vida com o tempo. −Fôlego.' },
  { lvl: 3, label: 'Inanição', kind: 'bad', note: 'Perde Vida e sanidade a cada hora.' },
];
export function hungerLevel(G) {
  const hu = G.hero?.hunger || 0;
  return hu >= 36 ? 3 : hu >= 24 ? 2 : hu >= MEAL_HOURS ? 1 : 0;
}
/** Penalidades de campo para o combate (B pode ler). */
export function fieldCombatMods(G) {
  const lvl = hungerLevel(G);
  const ld = loadInfo(G);
  return {
    staminaMax: (lvl >= 2 ? -2 : 0) + (ld.ratio > 1 ? -2 : 0),
    staminaRegen: lvl >= 1 ? -1 : 0,
    acc: lvl >= 3 ? -10 : 0,
    hunger: lvl, overloaded: ld.ratio > 1,
  };
}

export function loadInfo(G) {
  const D = heroD(G);
  let load = Number(D.load);
  if (!Number.isFinite(load)) {
    try { load = IT.totalWeight ? IT.totalWeight(G.hero) : 0; } catch { load = 0; }
  }
  const max = Math.max(1, Number(D.carryMax) || 30);
  const ratio = load / max;
  const mult = ratio > 1.3 ? 2 : ratio > 1 ? 1.5 : 1;
  return { load: Math.round(load * 10) / 10, max, ratio, mult, blocked: ratio >= 1.6, overloaded: ratio > 1 };
}

function legWounded(G) {
  return (G.hero?.wounds || []).some((w) => w && w.part === 'pernas' && (w.days > 0 || w.days === -1) && !w.healed);
}

// ======================================================================
// Passagem do tempo no campo
// ======================================================================
/**
 * Passa horas no Ermo: luz (tocha), escuridão (Pavor), fome (ração a cada 12h), carne do deus (Corrupção), alerta,
 * e o relógio global (advanceTime de D). opts.mode: 'travel'|'camp'|'work'|'road'; opts.fire: fogueira acesa.
 * Retorna { lines, died }.
 */
export function passHours(G, hours, opts = {}) {
  const exp = G.expedition;
  const h = G.hero;
  const out = [];
  hours = Math.max(0, Math.round(hours));
  if (!hours || !h) return { lines: out, died: heroDead(G) };
  const mode = opts.mode || 'travel';
  const D = heroD(G);
  const reg = exp ? REGIONS[exp.region] : null;
  let darkH = 0, darkNightH = 0, starve = 0, flesh = 0;
  const notes = [];

  for (let i = 0; i < hours; i++) {
    const t = (G.time || 0) + i;
    const dark = exp && mode !== 'road' ? isDarkAt(G, exp.region, t) : false;
    if (dark && !opts.fire) {
      let lit = false;
      if (exp.torchLit && mode !== 'camp') {
        if (!(exp.light > 0) && countOf(G, 'tocha') > 0) {
          takeItem(G, 'tocha', 1);
          exp.light = (exp.light > 0 ? exp.light : 0) + torchHours(G);
          notes.push({ text: 'Você acende outra tocha.', kind: 'info' });
        }
        if (exp.light > 0) { exp.light = Math.max(0, Math.round((exp.light - 1) * 10) / 10); lit = true; }
        if (!(exp.light > 0) && countOf(G, 'tocha') === 0 && !exp.warnedNoTorch) {
          exp.warnedNoTorch = true;
          notes.push({ text: 'A última tocha morre. Você está no escuro.', kind: 'bad' });
        }
      }
      if (!lit) { darkH++; if (isNightHour(Math.floor(t % 24))) darkNightH++; }
    }
    // fome
    h.hunger = Math.round(((h.hunger || 0) + 1) * 10) / 10;
    if (h.hunger >= MEAL_HOURS) {
      if (countOf(G, 'racao') > 0 && (exp ? exp.autoEat !== false : true)) {
        takeItem(G, 'racao', 1);
        eat(G);
        notes.push({ text: 'Você come uma ração andando.', kind: '' });
      } else if (h.hunger >= 24) {
        starve += h.hunger >= 36 ? 1 : 0.34;
      }
    }
    if (reg?.env?.flesh && mode !== 'road') flesh += reg.env.flesh;
    if (exp) exp.alert = Math.max(0, (exp.alert || 0) - (mode === 'camp' ? 4 : 3));
  }
  pushLines(G, notes, out);

  if (darkH > 0 && exp) {
    const per = mode === 'camp' ? 1 : 2;
    const red = modOf(D, 'dark') / 50;
    const n = Math.max(0, Math.round(darkH * Math.max(0, per - red) + darkNightH * (mode === 'camp' ? 0.5 : 1)));
    if (n > 0) pushLines(G, dread(G, n, 'escuridão'), out);
    if (mode !== 'camp' && R.chance(25)) addLog(G, R.pick(reg.ambient?.dark || ['Escuro.']), 'dread');
  }
  if (starve > 0 && exp) {
    exp.starveCarry = (exp.starveCarry || 0) + starve;
    const dmg = Math.floor(exp.starveCarry);
    exp.starveCarry -= dmg;
    if (dmg > 0) {
      const r = hurt(G, dmg, 'fome');
      pushLines(G, [{ text: `A fome come você por dentro: −${dmg} Vida.`, kind: 'bad' }], out);
      if (hungerLevel(G) >= 3) pushLines(G, dread(G, Math.ceil(dmg / 2), 'inanição'), out);
      if (r.died) return { lines: out, died: dieOnce(G, 'Fome') };
    }
  } else if (starve > 0) {
    const r = hurt(G, Math.floor(starve), 'fome');
    if (r.died) return { lines: out, died: dieOnce(G, 'Fome') };
  }
  if (flesh > 0 && exp) {
    exp.fleshCarry = (exp.fleshCarry || 0) + flesh * (1 - clamp(modOf(D, 'corrResist'), 0, 90) / 100);
    const n = Math.floor(exp.fleshCarry);
    exp.fleshCarry -= n;
    if (n > 0) {
      const r = corrupt(G, n, 'o ar do deus');
      pushLines(G, r.lines, out);
      if (r.transformed || heroDead(G)) { if (exp) exp.dead = true; return { lines: out, died: true }; }
    }
  }
  if (exp) exp.hoursOut = (exp.hoursOut || 0) + hours;
  pushLines(G, advance(G, hours), out);
  if (heroDead(G)) return { lines: out, died: dieOnce(G, 'Ferimentos') };
  if (G.campaign?.ended) return { lines: out, died: false, ended: true };
  return { lines: out, died: false };
}

/** Chama flow.heroDied uma única vez por expedição. */
export function dieOnce(G, cause) {
  const exp = G.expedition;
  if (exp?.dead) return true;
  if (exp) exp.dead = true;
  if (G.hero && G.hero.hp > 0 && !G.hero.dead) G.hero.hp = 0;
  addLog(G, `Morto: ${cause}.`, 'bad');
  try { flow.heroDied(cause, { region: exp?.region, nodeId: exp?.node, killer: cause, source: 'expedition' }); } catch (e) { console.error(e); }
  return true;
}

// ======================================================================
// Encontros
// ======================================================================
/**
 * Escolhe um encontro da região. opts: { ambush, night, dark, extra:[ids] }.
 * Retorna { encId, enemies, text }.
 */
export function pickEncounter(G, rid, opts = {}, rng = R) {
  const reg = REGIONS[rid];
  const cg = G.chaga || 0;
  const night = opts.night ?? isNight(G);
  const alwaysDark = reg.env?.light === 'always';
  const dark = !!opts.dark;
  const ok = (e) => (!e.minChaga || cg >= e.minChaga) && (!e.maxChaga || cg <= e.maxChaga)
    && (!e.night || night || alwaysDark) && (!e.day || !night) && (!opts.ambush || e.ambush);
  let list = (ENCOUNTERS[rid] || []).filter(ok);
  if (!list.length) list = (ENCOUNTERS[rid] || []).filter((e) => !e.minChaga || cg >= e.minChaga);
  if (!list.length) list = ENCOUNTERS[rid] || [];
  const enc = rng.weighted(list.map((e) => [e, (e.w || 1) * (dark && e.dark ? 2 : 1) * (night && e.night ? 1.5 : 1)]));
  const enemies = clone(enc.enemies);
  // escalada pela Chaga e pela noite
  if (cg >= 50 && rng.chance(cg - 30)) enemies.push(rng.pick(reg.fodder));
  if (night && rng.chance(15)) enemies.push(rng.pick(reg.fodder));
  for (const x of opts.extra || []) enemies.push(x);
  if (cg >= 75) {
    const i = enemies.findIndex((e) => typeof e === 'string');
    if (i >= 0) enemies[i] = { id: enemies[i], elite: true };
  }
  return { encId: enc.id, enemies: enemies.slice(0, 5), text: enc.text || '' };
}
export function enemyCount(enc) { return (enc?.enemies || []).length; }
export function hasElite(enc) { return (enc?.enemies || []).some((e) => typeof e === 'object' && e.elite); }

/** Inimigos do ninho conforme o crescimento. */
export function nestEnemies(G, rid, nid) {
  const ne = NEST_ENCOUNTERS[rid];
  const st = G.world.regions[rid].nests[nid] || { growth: 0 };
  const g = clamp(st.growth || 0, 0, 5);
  const list = [...ne.base, { id: ne.elite, elite: true }];
  for (let i = 0; i < g; i++) list.push(ne.grow[Math.min(ne.grow.length - 1, Math.floor(i / 2))]);
  return list.slice(0, 5 + (g >= 4 ? 1 : 0));
}
export function bossEnemies(G, rid) {
  const be = BOSS_ENCOUNTERS[rid];
  const list = [...be.enemies];
  for (const [min, id] of be.escorts || []) if ((G.chaga || 0) >= min) list.push(id);
  return list;
}

// ======================================================================
// Ninhos, carcaças
// ======================================================================
/** Ninhos crescem com os dias ignorados; ao transbordar, alimentam a Chaga. A Chaga alta faz brotar ninhos novos. */
export function tickNests(G) {
  const lines = [];
  const today = dayOf(G);
  for (const [rid, rs] of Object.entries(G.world?.regions || {})) {
    if (!rs?.map || !REGIONS[rid]) continue;
    for (const [nid, st] of Object.entries(rs.nests || {})) {
      if (!st || st.destroyed) continue;
      const g = clamp(Math.floor((today - (st.born || today)) / 6), 0, 5);
      if (g > (st.growth || 0)) st.growth = g;
      if (st.growth >= 3 && (st.spilled || 0) < 1) {
        st.spilled = 1;
        lines.push({ text: `O ${nodeName(G, rid, nid)} (${REGIONS[rid].short}) transborda.`, kind: 'rot' }, ...chaga(G, 1, 'Ninho ignorado'));
      }
      if (st.growth >= 5 && (st.spilled || 0) < 2) {
        st.spilled = 2;
        lines.push({ text: `O ${nodeName(G, rid, nid)} (${REGIONS[rid].short}) pariu uma horda.`, kind: 'rot' }, ...chaga(G, 2, 'Ninho ignorado'));
      }
    }
    // brotar ninhos novos com a Chaga alta
    const want = ((G.chaga || 0) >= 45 ? 1 : 0) + ((G.chaga || 0) >= 75 ? 1 : 0);
    while ((rs.sprouted || 0) < want) {
      const cands = Object.values(rs.map.nodes).filter((n) => n.depth >= 2 && (n.type === 'combat' || n.type === 'event')
        && !rs.overrides[n.id] && n.id !== G.expedition?.node).map((n) => n.id).sort();
      rs.sprouted = (rs.sprouted || 0) + 1;
      if (!cands.length) break;
      const nid = R.pick(cands);
      rs.overrides[nid] = 'nest';
      rs.nests[nid] = { born: today, growth: 0, destroyed: false, spilled: 0, sprout: true };
      lines.push({ text: `A Chaga brotou um ninho em ${REGIONS[rid].name}.`, kind: 'rot' });
    }
  }
  return lines;
}

export function liveNests(G, rid) {
  const rs = G.world?.regions?.[rid];
  return Object.entries(rs?.nests || {}).filter(([, s]) => s && !s.destroyed).map(([id, s]) => ({ id, ...s }));
}

function destroyNest(G, rid, nid) {
  const rs = ensureRegion(G, rid);
  const st = rs.nests[nid] || (rs.nests[nid] = { born: dayOf(G), growth: 0 });
  if (st.destroyed) return [];
  st.destroyed = true;
  st.destroyedDay = dayOf(G);
  const c = G.campaign.counters || (G.campaign.counters = {});
  c[`nests_destroyed_${rid}`] = (c[`nests_destroyed_${rid}`] || 0) + 1;
  c.nests_destroyed = (c.nests_destroyed || 0) + 1;
  const lines = [{ text: `${nodeName(G, rid, nid)} destruído. A terra para de pulsar aqui.`, kind: 'good' }, ...chaga(G, -3, 'Ninho destruído')];
  journal(G, `Destruí um ninho em ${REGIONS[rid].name}.`);
  queueLoot(G, rollLootSpec(G, REGIONS[rid].nestLoot, REGIONS[rid].lootTier), 'Restos do ninho');
  return lines;
}

/**
 * Carcaças de herdeiros na região. Lê G.lineage.dead (registro canônico de D) e G.world.regions[r].carcasses (se D usar).
 * Retorna [{ key, src, idx, name, level, corrupted, items, coin, ichor, nodeId, cause, risen }].
 */
export function carcassesIn(G, rid) {
  const rs = G.world?.regions?.[rid];
  if (!rs?.map) return [];
  const out = [];
  const fixNode = (nid, i) => {
    if (nid && rs.map.nodes[nid]) return nid;
    const ids = rs.map.nodes[rs.map.entry].links;
    return ids[i % ids.length];
  };
  const worldList = Array.isArray(rs.carcasses) ? rs.carcasses : Object.values(rs.carcasses || {});
  const lineageUids = new Set((G.lineage?.dead || []).map((d) => d?.uid).filter(Boolean));
  (G.lineage?.dead || []).forEach((d, i) => {
    if (!d || d.region !== rid) return;
    const pending = !d.recovered || (d.risen && !d.risenSlain);
    if (!pending) return;
    const w = d.uid ? worldList.find((c) => c && c.uid === d.uid) : null;
    const items = d.recovered ? [] : (w?.items?.length ? w.items : (d.items || []).map((x) => makeInst(x.id, { q: x.q ?? 1 })).filter(Boolean));
    out.push({ key: `d${i}`, src: 'lineage', idx: i, name: d.name || 'Herdeiro', level: d.level || 1, corrupted: !!d.corrupted,
      items, coin: d.recovered ? 0 : (d.coin || 0), ichor: d.recovered ? 0 : (d.ichor || 0),
      nodeId: fixNode(w?.nodeId ?? d.nodeId, i), cause: d.cause || '', risen: !!d.risen, slain: !!d.guardSlain, worldUid: d.uid || null });
  });
  worldList.forEach((c, i) => {
    if (!c || c.recovered) return;
    if (c.uid && lineageUids.has(c.uid)) return;
    if (out.some((o) => o.nodeId === c.nodeId && o.name === c.name)) return;
    out.push({ key: `w${i}`, src: 'world', idx: i, name: c.name || 'Herdeiro', level: c.level || 1, corrupted: !!c.corrupted,
      items: c.items || [], coin: c.coin || 0, ichor: c.ichor || 0, nodeId: fixNode(c.nodeId, i), cause: c.cause || '', risen: false, slain: !!c.guardSlain });
  });
  return out;
}
export function carcassAt(G, rid, nid) { return carcassesIn(G, rid).find((c) => c.nodeId === nid) || null; }
function carcassRecord(G, rid, c) {
  if (c.src === 'lineage') return G.lineage.dead[c.idx];
  const rs = G.world.regions[rid];
  return (Array.isArray(rs.carcasses) ? rs.carcasses : Object.values(rs.carcasses || {}))[c.idx];
}

// ======================================================================
// Saque
// ======================================================================
/** Rola uma especificação {rolls, coin, ichor, table} — itens por loot.js (A), moedas/Icor aqui. */
export function rollLootSpec(G, spec, tier, { bonusRolls = 0 } = {}) {
  if (!spec) return { items: [], coin: 0, ichor: 0 };
  const D = heroD(G);
  const table = (spec.table || []).map(([id, w, a, b]) => {
    const row = [String(id).replace(/:T$/, `:${tier}`), w];
    if (a != null) row.push(a, b ?? a);
    return row;
  });
  const items = [];
  const rolls = Math.max(1, (spec.rolls || 1) + bonusRolls + (R.chance(modOf(D, 'loot')) ? 1 : 0));
  for (let i = 0; i < rolls; i++) {
    let res = null;
    try { if (LT.rollLoot) res = LT.rollLoot(G, table, { tier, bonus: modOf(D, 'loot'), rolls: 1 }); } catch (e) { console.error('[exp] rollLoot', e); }
    if (res?.items) items.push(...res.items);
    else {
      const plain = table.filter((r) => !String(r[0]).startsWith('@'));
      if (plain.length) { const row = R.weighted(plain.map((r) => [r, r[1]])); items.push(makeInst(row[0], { n: row[2] ? R.int(row[2], row[3]) : 1 })); }
    }
  }
  const reg = G.expedition ? REGIONS[G.expedition.region] : null;
  const coin = spec.coin ? Math.round(R.range(spec.coin) * (1 + modOf(D, 'loot') / 100)) : 0;
  const ichorBase = spec.ichor ? R.range(spec.ichor) : 0;
  const ichor = ichorBase > 0 ? Math.round(ichorBase * (1 + modOf(D, 'ichor_find') / 100) * (isNight(G) ? 1.25 : 1) * (reg ? Math.sqrt(reg.ichorMult) : 1)) : 0;
  return { items, coin, ichor };
}
/** Junta saque em G.pendingLoot (source 'expedition'). Retorna true se há algo. */
export function queueLoot(G, loot, title) {
  if (!loot) return false;
  const items = (loot.items || []).filter(Boolean);
  const coin = loot.coin || 0, ichor = loot.ichor || 0;
  if (!items.length && !coin && !ichor) return false;
  const pl = G.pendingLoot;
  if (pl) {
    pl.items = [...(pl.items || []), ...items];
    pl.coin = (pl.coin || 0) + coin;
    pl.ichor = (pl.ichor || 0) + ichor;
    if (title && !String(pl.title || '').includes(title)) pl.title = pl.title ? `${pl.title} · ${title}` : title;
    if (!pl.source || pl.source === 'combat') pl.source = 'expedition';
  } else {
    G.pendingLoot = { items, coin, ichor, source: 'expedition', title: title || 'Saque' };
  }
  if (G.expedition) { G.expedition.stats.ichor += ichor; G.expedition.stats.coin += coin; }
  return true;
}
const hasPendingLoot = (G) => !!(G.pendingLoot && ((G.pendingLoot.items || []).length || G.pendingLoot.coin || G.pendingLoot.ichor));

// ======================================================================
// Efeitos de campo (ops da Área C tratadas aqui; resto → A/D)
// ======================================================================
/** Aplica efeitos tratando 'light', 'food', 'reveal', 'time' (com o relógio do campo) e 'loot' com spec. */
export function applyFieldEffects(G, effects, ctx = {}) {
  const out = { lines: [], pending: [] };
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    const r = applyA(G, batch, { source: 'expedition', region: G.expedition?.region, nodeId: G.expedition?.node, ...ctx });
    out.lines.push(...r.lines); out.pending.push(...r.pending);
    batch = [];
  };
  for (const e of effects || []) {
    if (!e) continue;
    switch (e.op) {
      case 'light': flush(); if (e.h <= -99) { if (G.expedition) G.expedition.light = 0; out.lines.push({ text: 'A água apaga sua tocha.', kind: 'bad' }); } else out.lines.push(...gainLight(G, e.h)); break;
      case 'food': flush(); out.lines.push(...gainFood(G, e.n)); break;
      case 'reveal': { flush(); const k = revealNodes(G, e.n || 1); out.lines.push({ text: k ? `Você entende o terreno: ${k} lugar(es) revelado(s).` : 'Nada de novo.', kind: 'info' }); break; }
      case 'time': { flush(); const r = passHours(G, e.h, { mode: 'work' }); out.lines.push(...r.lines); if (r.died) out.pending.push({ type: 'death', cause: 'Ermo', handled: true }); break; }
      default: batch.push(e);
    }
  }
  flush();
  return out;
}
/** Descrição curta de efeitos (UI). */
export function describeFx(effects) {
  const parts = [];
  for (const e of effects || []) {
    switch (e.op) {
      case 'hp': parts.push(`${e.n > 0 ? '+' : ''}${e.n} Vida`); break;
      case 'heal': parts.push(`+${e.n} Vida`); break;
      case 'dread': parts.push(`${e.n > 0 ? '+' : ''}${e.n} Pavor`); break;
      case 'corruption': parts.push(`${e.n > 0 ? '+' : ''}${e.n} Corrupção`); break;
      case 'ichor': parts.push(`${e.n > 0 ? '+' : ''}${e.n} Icor`); break;
      case 'coin': parts.push(`${e.n > 0 ? '+' : ''}${e.n} moedas`); break;
      case 'healWounds': parts.push(`cura ${e.n || 'todas as'} ferida(s) leve(s)`); break;
      case 'reveal': parts.push(`revela ${e.n} lugar(es)`); break;
      case 'item': parts.push(`+${e.n || 1} ${defOf(e.id)?.name || e.id}`); break;
      case 'take': parts.push(`−${e.n || 1} ${defOf(e.id)?.name || e.id}`); break;
      case 'rep': parts.push(`reputação ${e.f} ${e.n > 0 ? '+' : ''}${e.n}`); break;
      case 'time': parts.push(`${e.h}h`); break;
      case 'light': parts.push(e.h <= -99 ? 'apaga a tocha' : `${e.h > 0 ? '+' : ''}${e.h}h luz`); break;
      case 'wound': parts.push(`ferida (${e.part || 'aleatória'})`); break;
      default: break;
    }
  }
  return parts.join(', ');
}

/** Processa pending de efeitos (combate/evento/morte/saque). Retorna nav. */
function handlePending(G, pending, kind = 'event') {
  if (!pending?.length) return null;
  const death = pending.find((p) => p.type === 'death');
  if (death) { if (!death.handled) dieOnce(G, death.cause || 'Ermo'); return { died: true }; }
  const cb = pending.find((p) => p.type === 'combat');
  if (cb) {
    const spec = cb.spec || cb;
    return beginCombat(G, { enemies: spec.enemies, kind, nodeId: G.expedition.node, ambush: spec.ambush || null, boss: !!spec.boss, text: spec.text, onWin: spec.onWin, onFlee: spec.onFlee });
  }
  const ev = pending.find((p) => p.type === 'event');
  if (ev && EV.startEvent) {
    try { EV.startEvent(G, ev.id, { source: 'expedition', nodeId: G.expedition.node, region: G.expedition.region }); return { nav: { screen: 'event' } }; } catch (e) { console.error(e); }
  }
  if (hasPendingLoot(G)) return { nav: { screen: 'loot' } };
  return null;
}

// ======================================================================
// Conteúdo por expedição (renovado a cada saída; estrutura persiste)
// ======================================================================
function rollContent(G, rid) {
  const rs = ensureRegion(G, rid);
  const reg = REGIONS[rid];
  const cg = G.chaga || 0;
  const content = {};
  const pressured = new Set();
  for (const n of liveNests(G, rid)) if ((n.growth || 0) >= 2) for (const l of rs.map.nodes[n.id].links) pressured.add(l);
  const riteIds = Object.keys(SHRINE_RITES);
  for (const id of Object.keys(rs.map.nodes).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
    const t = nodeType(G, rid, id);
    const c = {};
    const extra = pressured.has(id) ? [reg.nestEnemy] : [];
    switch (t) {
      case 'combat':
        c.enc = pickEncounter(G, rid, { night: false, extra });
        c.encNight = pickEncounter(G, rid, { night: true, extra });
        break;
      case 'event': {
        const inf = clamp((cg - 20) / 2.5, 0, 30) + (pressured.has(id) ? 20 : 0);
        if (R.chance(inf)) c.infested = pickEncounter(G, rid, { extra });
        break;
      }
      case 'ruin':
        c.trap = R.chance(50 + reg.tier * 6) ? R.pick(reg.traps).id : null;
        c.trapKnown = false; c.disarmed = false; c.searched = false; c.inspected = 0;
        c.deep = R.chance(45); c.deepDone = false;
        c.guardian = R.chance(15 + cg / 4) ? pickEncounter(G, rid, {}) : null;
        break;
      case 'shrine': {
        const pool = R.shuffle(riteIds).slice(0, 3);
        c.rotten = cg >= 50 && R.chance(30 + (cg - 50));
        if (c.rotten) pool[2] = R.pick(Object.keys(ROT_RITES));
        c.rites = pool; c.used = {}; c.heard = false;
        break;
      }
      case 'merchant': c.merchant = rollMerchant(G, rid); break;
      case 'vein': c.left = R.int(2, 3) + (reg.tier >= 3 ? 1 : 0); c.heat = 0; break;
      case 'camp': c.cache = R.chance(30) ? R.pick(['racao', 'tocha', 'bandagem', 'sebo', 'aguardente']) : null; break;
      default: break;
    }
    const carc = carcassAt(G, rid, id);
    if (carc) {
      const rec = carcassRecord(G, rid, carc);
      // corpos deixados sem enterro podem levantar
      if (rec && rec.unburied && !rec.corrupted && !rec.risen && R.chance(20 + cg / 3)) { rec.risen = true; rec.corrupted = true; }
      c.scavengers = !carc.corrupted && R.chance(25 + cg / 4) ? clone(reg.carcassScavengers) : null;
    }
    content[id] = c;
  }
  return content;
}

function rollMerchant(G, rid) {
  const reg = REGIONS[rid];
  const D = heroD(G);
  const stock = [];
  const add = (inst) => {
    if (!inst) return;
    const base = unitValue(inst) || 1;
    const scarce = ['tocha', 'racao', 'bandagem'].includes(inst.id) ? 1.25 : 1;
    const price = Math.max(2, Math.ceil(base * reg.merchant.markup * scarce * (1 - clamp(modOf(D, 'price'), 0, 50) / 100)));
    stock.push({ inst, price });
  };
  add(makeInst('tocha', { n: 1 }));
  add(makeInst('racao', { n: 1 }));
  if (R.chance(60)) add(makeInst('bandagem', { n: 1 }));
  const tries = [['consumable', 2], ['material', 1], [R.pick(['weapon', 'armor', 'offhand', 'trinket']), 1]];
  for (const [type, n] of tries) {
    for (let i = 0; i < n; i++) {
      try { if (LT.randomItem) add(LT.randomItem(G, { type, tier: reg.lootTier })); } catch (e) { console.error('[exp] randomItem', e); }
    }
  }
  return { stock, purse: R.range(reg.merchant.purse), ambush: R.chance(10 + (G.chaga || 0) / 5), inspected: null, gone: false, met: false, robbed: false };
}

// ======================================================================
// Início da expedição
// ======================================================================
export function startOptions(G, rid) {
  const rs = G.world?.regions?.[rid];
  const out = [{ id: 'entry', kind: 'entry', label: 'Pela estrada', hours: REGIONS[rid].travelHours }];
  for (const nid of Object.keys(rs?.shortcuts || {})) {
    if (!rs.shortcuts[nid] || !rs.map?.nodes?.[nid]) continue;
    out.push({ id: nid, kind: 'passage', label: `Pela ${nodeName(G, rid, nid)}`, hours: REGIONS[rid].travelHours + 2, depth: rs.map.nodes[nid].depth });
  }
  return out;
}

export function canStartExpedition(G, rid, opts = {}) {
  if (!G?.hero) return { ok: false, why: 'Sem herói.' };
  if (heroDead(G)) return { ok: false, why: 'O herói está morto.' };
  if (G.campaign?.ended) return { ok: false, why: 'A campanha acabou.' };
  if (G.expedition) return { ok: false, why: 'Já está em expedição.' };
  if (!REGIONS[rid]) return { ok: false, why: 'Região desconhecida.' };
  if (!regionUnlocked(G, rid)) return { ok: false, why: lockReason(G, rid) || 'Bloqueada.' };
  if (loadInfo(G).blocked) return { ok: false, why: 'Peso demais para sair do portão. Largue algo.' };
  if (opts.from && opts.from !== 'entry' && !G.world.regions[rid]?.shortcuts?.[opts.from]) return { ok: false, why: 'Passagem não aberta.' };
  return { ok: true };
}

/** Checklist de suprimentos para a tela de partida. */
export function supplyCheck(G, rid) {
  const reg = REGIONS[rid];
  const h = G.hero;
  const D = heroD(G);
  const torches = countOf(G, 'tocha'), rations = countOf(G, 'racao'), bandages = countOf(G, 'bandagem');
  const ld = loadInfo(G);
  const hpMax = D.hpMax || 60;
  const warn = [];
  const darkMode = reg.env?.light;
  const needT = darkMode === 'always' ? 4 : darkMode === 'canopy' ? 3 : 2;
  if (torches === 0) warn.push({ text: darkMode === 'always' ? 'Sem tochas nas Catacumbas é morte certa.' : 'Sem tochas: a noite vai te comer vivo.', kind: 'bad' });
  else if (torches < needT) warn.push({ text: `Poucas tochas para ${reg.short} (sugerido: ${needT}+).`, kind: 'warn' });
  const needR = Math.ceil((reg.travelHours * 2 + 24) / MEAL_HOURS);
  if (rations === 0) warn.push({ text: 'Sem rações. A fome chega em horas.', kind: 'bad' });
  else if (rations < needR) warn.push({ text: `Rações para ~${rations * MEAL_HOURS}h. Ida e volta custam ${reg.travelHours * 2}h.`, kind: 'warn' });
  if (bandages === 0) warn.push({ text: 'Sem bandagens: um corte vira infecção.', kind: 'warn' });
  if ((h.hp || 0) < hpMax * 0.6) warn.push({ text: 'Você sai ferido.', kind: 'warn' });
  if ((h.dread || 0) >= 50) warn.push({ text: 'Pavor alto antes de sair.', kind: 'warn' });
  if (ld.overloaded) warn.push({ text: `Sobrecarga (${ld.load}/${ld.max}): viagens ×${ld.mult}, menos Fôlego.`, kind: 'bad' });
  const infected = (h.wounds || []).filter((w) => w.infected).length;
  if (infected) warn.push({ text: `${infected} ferida(s) infeccionada(s).`, kind: 'bad' });
  if (reg.env?.flesh) warn.push({ text: 'O ar dentro do deus corrompe a cada hora.', kind: 'warn' });
  if (reg.env?.water) warn.push({ text: 'Canais: peso e armadura pesada afogam. A água apaga tochas.', kind: 'warn' });
  return {
    torches, torchHours: Math.round(torches * torchHours(G)), rations, foodHours: rations * MEAL_HOURS - (h.hunger || 0) + MEAL_HOURS,
    bandages, load: ld, warn, hp: h.hp, hpMax, dread: h.dread || 0,
  };
}

/** Parte da cidade para a região. opts.from: 'entry' | nodeId de passagem aberta. Retorna { ok, lines, died, nav }. */
export function startExpedition(G, rid, opts = {}) {
  const can = canStartExpedition(G, rid, opts);
  if (!can.ok) return { ok: false, why: can.why, lines: [] };
  const rs = ensureRegion(G, rid);
  rs.unlocked = true;
  const reg = REGIONS[rid];
  const out = [];
  const pre = tickNests(G);
  const fromPassage = opts.from && opts.from !== 'entry' ? opts.from : null;
  const start = fromPassage || rs.map.entry;
  const h = G.hero;
  h.hunger = h.hunger || 0;
  G.expedition = {
    id: uid('x'), region: rid, node: start, prev: null, path: [start],
    light: 0, torchLit: true, autoEat: true, hoursOut: 0, startTime: G.time,
    cleared: { [start]: true }, visited: { [start]: true }, content: {}, log: [],
    pendingCombat: null, pendingMove: null, afterLoot: null, alert: 0, campCount: {}, stalk: null, retreat: null, lastCamp: null,
    starveCarry: 0, fleshCarry: 0, startedFrom: fromPassage ? 'passage' : 'entry', warnedNoTorch: false, dead: false,
    stats: { ichor: 0, coin: 0, nodes: 0, ambushes: 0, fights: 0, wins: 0, nests: 0, startIchor: h.ichor || 0, startCoin: h.coin || 0, startHp: h.hp },
    ambushRisk: 0,
  };
  const exp = G.expedition;
  if (rs.bossDead) exp.cleared[rs.map.boss] = true;
  exp.content = rollContent(G, rid);
  pushLines(G, pre, out);
  const travel = reg.travelHours + (fromPassage ? 2 : 0);
  addLog(G, `Partida de Valdrem para ${reg.name}. ${travel}h de estrada.`, 'info');
  const r = passHours(G, travel, { mode: 'road' });
  out.push(...r.lines);
  if (r.died) return { ok: true, lines: out, died: true };
  if (r.ended) return { ok: true, lines: out, ended: true };
  if (fromPassage) addLog(G, `Você sai pela ${nodeName(G, rid, start)}. O caminho de volta está aberto.`, 'info');
  addLog(G, R.pick(reg.ambient.arrive), '');
  if (isNight(G) && reg.ambient.night?.length) addLog(G, R.pick(reg.ambient.night), 'dread');
  addU(rs.visitedEver, start);
  revealAround(G, start);
  exp.ambushRisk = ambushChance(G, {});
  save();
  return { ok: true, lines: out, nav: { screen: 'map' } };
}

// ======================================================================
// Movimento
// ======================================================================
/** Horas para percorrer a aresta from→to com as condições atuais. */
export function edgeHours(G, from, to) {
  const exp = G.expedition;
  const rs = G.world.regions[exp.region];
  const e = edgeOf(rs.map, from, to);
  if (!e) return null;
  const D = heroD(G);
  let m = loadInfo(G).mult;
  if (!isLit(G)) m *= 1.25;
  if (legWounded(G)) m *= 1.25;
  if (G.hero?.prosthetics?.pernas) m *= 1.15;
  if (REGIONS[exp.region].env?.water && e.terrain === 'canal' && isNight(G)) m *= 1.5;
  m *= 1 - clamp(modOf(D, 'travel'), -50, 60) / 100;
  return Math.max(1, Math.round(e.h * m));
}

/** Chance de emboscada (%). opts: { to, camp, safeSite, fire, watch, hours } */
export function ambushChance(G, opts = {}) {
  const exp = G.expedition;
  if (!exp) return 0;
  const reg = REGIONS[exp.region];
  const D = heroD(G);
  const camp = !!opts.camp;
  let c = camp ? reg.campAmbush : reg.ambushBase;
  if (isNight(G)) c += camp ? 8 : 10;
  const lit = camp ? (opts.fire || !isDarkNow(G)) : isLit(G);
  if (!lit) c += camp ? 8 : 15;
  c += (exp.alert || 0) * 0.35;
  c += (G.chaga || 0) / 8;
  if (loadInfo(G).overloaded) c += 5;
  if (!camp && opts.to && exp.cleared[opts.to]) c *= 0.6;
  if (camp) {
    if (opts.fire) c += 8;
    if (opts.watch) c *= 0.5;
    if (opts.safeSite) c *= 0.5;
    c += (exp.campCount[exp.node] || 0) * 8;
    if (opts.hours) c *= opts.hours >= 8 ? 1 : opts.hours >= 4 ? 0.65 : 0.4;
  }
  c *= 1 - clamp(modOf(D, 'ambush'), 0, 80) / 100;
  c -= modOf(D, 'stealth');
  return clamp(Math.round(c), 2, 75);
}

function hazardInfo(G, edge) {
  if (!edge?.hazard) return null;
  const reg = REGIONS[G.expedition.region];
  const hz = reg.hazards?.[edge.hazard];
  if (!hz) return null;
  const D = heroD(G);
  const heavyPenalty = hz.heavy ? ((loadInfo(G).overloaded ? 20 : 0) + Math.max(0, (D.armorHeavy ?? heavyArmor(G)) * 5)) : 0;
  const check = { attr: hz.check.attr, diff: (hz.check.diff || 0) + heavyPenalty };
  return { id: edge.hazard, name: hz.name, text: hz.text, check, chance: chanceOf(G, check), douse: !!hz.douse, heavyPenalty };
}
function heavyArmor(G) {
  let s = 0;
  for (const inst of Object.values(G.hero?.equip || {})) { const d = inst && defOf(inst); if (d?.heavy) s += d.heavy; }
  return s;
}

export function canMove(G) {
  const exp = G.expedition;
  if (!exp) return { ok: false, why: 'Fora de expedição.' };
  if (heroDead(G)) return { ok: false, why: 'Morto.' };
  if (G.combat) return { ok: false, why: 'Em combate.' };
  if (G.event) return { ok: false, why: 'Há um evento em andamento.' };
  if (hasPendingLoot(G)) return { ok: false, why: 'Saque pendente.' };
  if (loadInfo(G).blocked) return { ok: false, why: 'Peso demais para andar. Largue algo na Ficha.' };
  return { ok: true };
}

/** Informação de um movimento possível do nó atual para `to`. */
export function moveInfo(G, to) {
  const exp = G.expedition;
  const rid = exp.region;
  const rs = G.world.regions[rid];
  const node = rs.map.nodes[to];
  if (!node) return null;
  const adjacent = rs.map.nodes[exp.node].links.includes(to);
  const known = isDiscovered(G, rid, to);
  const type = known ? nodeType(G, rid, to) : null;
  const info = {
    id: to, name: known ? nodeName(G, rid, to) : (isSeen(G, rid, to) ? 'Lugar desconhecido' : '???'),
    type, known, adjacent, cleared: !!exp.cleared[to], visited: !!exp.visited[to],
    carcass: known ? carcassAt(G, rid, to) : null,
    disabled: false, why: '',
  };
  if (adjacent) {
    const e = edgeOf(rs.map, exp.node, to);
    info.edge = { terrain: e.terrain, name: e.name };
    info.hours = edgeHours(G, exp.node, to);
    info.ambush = ambushChance(G, { to });
    info.hazard = hazardInfo(G, e);
    if (type === 'combat' && !info.cleared && exp.content[to]) {
      const enc = isNight(G) ? exp.content[to].encNight : exp.content[to].enc;
      if (exp.scouted?.[to] && enc) info.threat = { n: enemyCount(enc), elite: hasElite(enc) };
    }
  }
  const cm = canMove(G);
  if (!cm.ok) { info.disabled = true; info.why = cm.why; }
  else if (!adjacent) { info.disabled = true; info.why = to === exp.node ? 'Você está aqui.' : 'Longe demais: escolha um lugar ligado ao seu.'; }
  else if (exp.stalk && exp.stalk === exp.node && to !== exp.prev) { info.disabled = true; info.why = 'Inimigos à frente: ataque, esgueire-se ou recue.'; }
  return info;
}
export function availableMoves(G) {
  const exp = G.expedition;
  if (!exp) return [];
  return G.world.regions[exp.region].map.nodes[exp.node].links.map((id) => moveInfo(G, id));
}

/** Viaja para um nó vizinho. Retorna { ok, lines, nav, died }. */
export function moveTo(G, to, opts = {}) {
  const exp = G.expedition;
  const info = exp && moveInfo(G, to);
  if (!info) return { ok: false, why: 'Destino inválido.', lines: [] };
  if (info.disabled && !(opts.retreat && info.adjacent && canMove(G).ok)) return { ok: false, why: info.why, lines: [] };
  const rid = exp.region;
  const rs = G.world.regions[rid];
  const from = exp.node;
  const out = [];
  exp.stalk = null;
  sfx('step');
  addLog(G, `→ ${info.name} (${info.hours}h, ${info.edge.name.toLowerCase()}).`, '');
  const r = passHours(G, info.hours, { mode: 'travel' });
  out.push(...r.lines);
  if (r.died) return { ok: true, lines: out, died: true };
  if (r.ended) return { ok: true, lines: out, ended: true };
  // perigo do caminho
  const hz = hazardInfo(G, edgeOf(rs.map, from, to));
  if (hz) {
    const res = roll(G, hz.check);
    if (res.ok) addLog(G, `${hz.name}: você passa. (${hz.check.attr.toUpperCase()} ${res.chance}%)`, 'good');
    else {
      const hzd = REGIONS[rid].hazards[hz.id];
      addLog(G, `${hz.name}: ${hzd.failText || 'falhou.'}`, 'bad');
      const fx = applyFieldEffects(G, hzd.fail);
      pushLines(G, fx.lines, out);
      if (hz.douse && exp.light > 0) { exp.light = 0; addLog(G, 'A água apaga a tocha.', 'bad'); }
      const p = handlePending(G, fx.pending);
      if (p?.died || heroDead(G)) return { ok: true, lines: out, died: dieOnce(G, hz.name) };
    }
  }
  // emboscada no caminho
  const ch = ambushChance(G, { to });
  if (!opts.noAmbush && R.chance(ch)) {
    exp.stats.ambushes++;
    const t = nodeType(G, rid, to);
    if (t === 'combat' && !exp.cleared[to]) {
      addLog(G, 'Eles te viram primeiro.', 'bad');
      exp.prev = from;
      return { ok: true, lines: out, ...arrive(G, to, { ambushed: true }) };
    }
    const enc = pickEncounter(G, rid, { ambush: true, dark: !isLit(G) });
    exp.pendingMove = { from, to };
    addLog(G, `Emboscada! ${enc.text}`, 'bad');
    sfx('scream');
    return { ok: true, lines: out, ...beginCombat(G, { enemies: enc.enemies, kind: 'ambush', nodeId: to, ambush: 'enemy', text: enc.text, extra: { to, from } }) };
  }
  exp.prev = from;
  return { ok: true, lines: out, ...arrive(G, to, opts) };
}

/** Revela vizinhos ao chegar (tipos só com luz) e, com Astúcia, os vizinhos dos vizinhos. */
function revealAround(G, nid) {
  const exp = G.expedition;
  const rid = exp.region;
  const rs = G.world.regions[rid];
  const D = heroD(G);
  const lit = isLit(G);
  discover(G, rid, nid);
  for (const l of rs.map.nodes[nid].links) { if (lit) discover(G, rid, l); else see(G, rid, l); }
  const scout = attrOf(D, G, 'ast') * 4 + modOf(D, 'scout') + (lit ? 10 : -15);
  if (R.chance(scout)) {
    exp.scouted = exp.scouted || {};
    for (const l of rs.map.nodes[nid].links) {
      exp.scouted[l] = true;
      for (const l2 of rs.map.nodes[l].links) { if (lit) discover(G, rid, l2); else see(G, rid, l2); }
    }
  }
}

/** Chegada a um nó: resolve o conteúdo. */
export function arrive(G, to, opts = {}) {
  const exp = G.expedition;
  const rid = exp.region;
  const rs = ensureRegion(G, rid);
  const reg = REGIONS[rid];
  exp.node = to;
  if (exp.path[exp.path.length - 1] !== to) exp.path.push(to);
  if (exp.path.length > 200) exp.path.splice(0, exp.path.length - 200);
  const first = !exp.visited[to];
  exp.visited[to] = true;
  addU(rs.visitedEver, to);
  revealAround(G, to);
  if (first) exp.stats.nodes++;
  exp.ambushRisk = ambushChance(G, {});
  const t = nodeType(G, rid, to);
  const c = exp.content[to] || (exp.content[to] = {});
  const nm = nodeName(G, rid, to);
  if (opts.retreat || exp.cleared[to]) {
    if (opts.retreat) exp.cleared[to] = true;
    save();
    return { nav: { screen: 'map' } };
  }
  switch (t) {
    case 'entry':
      exp.cleared[to] = true;
      addLog(G, 'A entrada. Daqui se volta para Valdrem.', 'info');
      break;
    case 'passage':
      exp.cleared[to] = true;
      if (!rs.shortcuts[to]) {
        rs.shortcuts[to] = true;
        addLog(G, `${nm}: uma passagem para a cidade. Agora está aberta — para você e para a sua casa.`, 'good');
        journal(G, `Abri a passagem ${nm} em ${reg.name}.`);
        sfx('door');
      }
      save();
      return { nav: { screen: 'node', params: { id: to } } };
    case 'camp':
      exp.cleared[to] = true;
      addLog(G, `${nm}: um lugar defensável. Acampar aqui é mais seguro.`, 'info');
      if (c.cache) {
        giveInst(G, makeInst(c.cache, { n: 1 }));
        addLog(G, `Esconderijo de outro carniceiro: +1 ${defOf(c.cache)?.name || c.cache}.`, 'good');
        c.cache = null;
      }
      break;
    case 'combat': {
      const enc = isNight(G) || reg.env?.light === 'always' ? c.encNight || c.enc : c.enc || c.encNight;
      const encounter = enc || pickEncounter(G, rid, {});
      if (!opts.ambushed) {
        const D = heroD(G);
        const spot = clamp(10 + attrOf(D, G, 'ast') * 4 + modOf(D, 'stealth') + (isLit(G) ? 0 : -10) - (exp.alert || 0) / 4, 5, 70);
        if (R.chance(spot)) {
          exp.stalk = to;
          exp.scouted = exp.scouted || {};
          exp.scouted[to] = true;
          addLog(G, `${nm}: você os vê antes de ser visto.`, 'good');
          save();
          return { nav: { screen: 'node', params: { id: to } } };
        }
      }
      return beginCombat(G, { enemies: encounter.enemies, kind: 'node', nodeId: to, ambush: opts.ambushed ? 'enemy' : null, text: encounter.text });
    }
    case 'event': {
      if (c.infested) {
        addLog(G, 'A Chaga chegou aqui antes de você.', 'rot');
        const enc = c.infested;
        c.infested = null;
        return beginCombat(G, { enemies: enc.enemies, kind: 'node', nodeId: to, ambush: opts.ambushed ? 'enemy' : null, text: enc.text });
      }
      let id = null;
      try { if (EV.pickEvent) id = EV.pickEvent(G, { pool: 'field', region: rid, tags: reg.events }); } catch (e) { console.error('[exp] pickEvent', e); }
      if (id && EV.startEvent) {
        try {
          EV.startEvent(G, id, { source: 'expedition', nodeId: to, region: rid });
          return { nav: { screen: 'event' } };
        } catch (e) { console.error('[exp] startEvent', e); }
      }
      exp.cleared[to] = true;
      const found = R.chance(50) ? rollLootSpec(G, { rolls: 1, coin: [1, 8], table: [['racao', 3], ['tocha', 3], ['pano', 2], ['sebo', 2], ['ervas', 2]] }, reg.lootTier) : null;
      if (found && queueLoot(G, found, nm)) { exp.afterLoot = { screen: 'map' }; addLog(G, `${nm}: restos de alguém que não voltou.`, ''); save(); return { nav: { screen: 'loot' } }; }
      addLog(G, `${nm}: silêncio. Só o vento e as moscas.`, '');
      break;
    }
    case 'ruin': case 'shrine': case 'merchant': case 'vein':
      exp.cleared[to] = true;
      addLog(G, `${nm}.`, 'info');
      save();
      return { nav: { screen: 'node', params: { id: to } } };
    case 'nest': {
      const st = rs.nests[to];
      if (st?.destroyed) { exp.cleared[to] = true; addLog(G, `${nm}: só cinzas e ossos queimados.`, ''); break; }
      addLog(G, `${nm}. O fedor chega antes.`, 'rot');
      save();
      return { nav: { screen: 'node', params: { id: to } } };
    }
    case 'boss':
      if (rs.bossDead) { exp.cleared[to] = true; addLog(G, `${nm}: vazio. Só o que você deixou.`, ''); break; }
      addLog(G, `${nm}. ${reg.bossName} está aqui.`, 'blood');
      sfx('bell');
      save();
      return { nav: { screen: 'node', params: { id: to } } };
    default:
      exp.cleared[to] = true;
  }
  const carc = carcassAt(G, rid, to);
  if (carc) {
    addLog(G, `Aqui jaz ${carc.name}.`, 'blood');
    save();
    return { nav: { screen: 'node', params: { id: to } } };
  }
  save();
  return { nav: { screen: 'map' } };
}

/** Recursos explorável no nó atual (para a tela 'node' e o botão Explorar). */
export function nodeFeatures(G, nid) {
  const exp = G.expedition;
  if (!exp) return [];
  nid = nid || exp.node;
  const rid = exp.region;
  const rs = G.world.regions[rid];
  const t = nodeType(G, rid, nid);
  const c = exp.content[nid] || {};
  const f = [];
  if (exp.stalk === nid) f.push('stalk');
  if (t === 'passage' && rs.shortcuts[nid]) f.push('passage');
  if (t === 'ruin') f.push('ruin');
  if (t === 'shrine') f.push('shrine');
  if (t === 'merchant' && c.merchant && !c.merchant.gone) f.push('merchant');
  if (t === 'vein' && (c.left || 0) > 0) f.push('vein');
  if (t === 'nest' && !rs.nests[nid]?.destroyed) f.push('nest');
  if (t === 'boss' && !rs.bossDead) f.push('boss');
  if (t === 'camp') f.push('campsite');
  if (carcassAt(G, rid, nid) && (exp.cleared[nid] || ['ruin', 'shrine', 'merchant', 'vein', 'passage', 'camp', 'entry'].includes(t))) f.push('carcass');
  return f;
}

// ======================================================================
// Combate (B)
// ======================================================================
/** Inicia combate a partir da expedição. Guarda o contexto em exp.pendingCombat. */
export function beginCombat(G, { enemies, kind, nodeId, ambush = null, boss = false, text = '', extra = {}, onWin, onFlee }) {
  const exp = G.expedition;
  exp.pendingCombat = { kind, nodeId: nodeId || exp.node, from: exp.node, ...extra };
  exp.stats.fights++;
  exp.alert = Math.min(100, (exp.alert || 0) + 10);
  const lit = isLit(G);
  const spec = {
    enemies: (enemies || []).slice(0, 6), region: exp.region, ambush, dark: !lit, night: isNight(G), boss, canFlee: true, text,
    context: { source: 'expedition', nodeId: nodeId || exp.node, region: exp.region, kind, boss, canFlee: true },
    onWin: onWin || [], onFlee: onFlee || [],
  };
  if (text) addLog(G, text, 'blood');
  try {
    if (!CB.startCombat) throw new Error('startCombat indisponível');
    CB.startCombat(G, spec);
  } catch (e) {
    console.error('[exp] startCombat', e);
    exp.pendingCombat = null;
    addLog(G, `(combate indisponível: ${e.message})`, 'bad');
    save();
    return { nav: { screen: 'map' }, error: e.message };
  }
  save();
  return { nav: { screen: 'combat' } };
}

/** Gancho combatEnd:expedition / combatEnd:camp. Retorna { nav }. */
export function onCombatEnd(G, outcome = {}) {
  const exp = G.expedition;
  if (!exp) return { nav: { screen: G.hero && !heroDead(G) ? 'city' : 'title' } };
  const pc = exp.pendingCombat || { kind: 'event', nodeId: exp.node, from: exp.node };
  exp.pendingCombat = null;
  const res = outcome?.result || 'win';
  const rid = exp.region;
  if (res === 'lose' || heroDead(G)) { exp.dead = true; return { nav: null }; }
  if (res === 'fled') {
    exp.alert = Math.min(100, (exp.alert || 0) + 10);
    exp.pendingMove = null;
    exp.stalk = null;
    if (pc.kind === 'ambush') {
      exp.node = pc.from;
      addLog(G, `Você foge de volta para ${nodeName(G, rid, pc.from)}.`, 'warn');
    } else {
      const back = exp.prev && exp.prev !== exp.node ? exp.prev : pc.from !== exp.node ? pc.from : null;
      if (back) {
        exp.node = back;
        exp.path.push(back);
        addLog(G, `Você foge para ${nodeName(G, rid, back)}. ${nodeName(G, rid, pc.nodeId)} continua tomado.`, 'warn');
      } else addLog(G, 'Você foge. Eles não te seguem — por enquanto.', 'warn');
      if (pc.kind === 'camp' && exp.lastCamp) exp.lastCamp.interrupted = true;
    }
    if (hasPendingLoot(G)) { exp.afterLoot = { screen: 'map' }; save(); return { nav: { screen: 'loot' } }; }
    save();
    return { nav: { screen: 'map' } };
  }
  // vitória (ou rendição dos inimigos)
  exp.stats.wins++;
  exp.alert = Math.min(100, (exp.alert || 0) + 5);
  let after = { screen: 'map' };
  switch (pc.kind) {
    case 'ambush':
      exp.pendingMove = null;
      exp.prev = pc.from;
      after = { arrive: pc.to || pc.nodeId };
      addLog(G, 'A emboscada acabou. Você segue caminho.', 'good');
      break;
    case 'node': exp.cleared[pc.nodeId] = true; break;
    case 'nest': {
      exp.cleared[pc.nodeId] = true;
      exp.stats.nests++;
      for (const l of destroyNest(G, rid, pc.nodeId)) addLog(G, l.text, l.kind);
      break;
    }
    case 'boss': {
      exp.cleared[pc.nodeId] = true;
      const r = bossDefeated(G, rid);
      if (r.ended) return { nav: null };
      if (r.nav) after = r.nav;
      break;
    }
    case 'carcass': {
      const c = carcassAt(G, rid, pc.nodeId);
      if (c) {
        const rec = carcassRecord(G, rid, c);
        if (rec) { rec.guardSlain = true; if (rec.risen) rec.risenSlain = true; }
        if (exp.content[pc.nodeId]) exp.content[pc.nodeId].scavengers = null;
        addLog(G, c.corrupted ? `O que restou de ${c.name} finalmente para de se mexer.` : 'Os comedores de carniça estão mortos.', 'good');
      }
      exp.cleared[pc.nodeId] = true;
      after = { screen: 'node', params: { id: pc.nodeId } };
      break;
    }
    case 'ruin': {
      const c = exp.content[pc.nodeId];
      if (c) c.guardian = null;
      if (c && pc.deep) { queueLoot(G, rollLootSpec(G, REGIONS[rid].ruinLoot, Math.min(5, REGIONS[rid].lootTier + 1)), 'Câmara inferior'); }
      after = { screen: 'node', params: { id: pc.nodeId } };
      break;
    }
    case 'vein': after = { screen: 'node', params: { id: pc.nodeId } }; break;
    case 'merchant': {
      const c = exp.content[pc.nodeId]?.merchant;
      if (c && !c.gone) {
        c.gone = true;
        queueLoot(G, { items: c.stock.map((s) => s.inst), coin: c.purse, ichor: 0 }, c.ambush ? 'Carroça do falso mercador' : 'Carroça do mercador');
        addLog(G, c.ambush ? 'O "mercador" e seus capangas estão mortos. A carroça é sua.' : 'O mercador está morto. A carroça é sua. A Guilda não vai gostar.', c.ambush ? 'good' : 'blood');
      }
      after = { screen: 'map' };
      break;
    }
    case 'camp':
      addLog(G, 'Você sobreviveu à noite. O acampamento está desfeito.', 'warn');
      if (exp.lastCamp) exp.lastCamp.interrupted = true;
      after = { screen: 'camp' };
      break;
    default:
      exp.cleared[pc.nodeId || exp.node] = true;
  }
  if (heroDead(G)) return { nav: null };
  if (hasPendingLoot(G)) { exp.afterLoot = after; save(); return { nav: { screen: 'loot' } }; }
  save();
  return afterNav(G, after);
}

function afterNav(G, after) {
  if (!after) return { nav: { screen: 'map' } };
  if (after.arrive) {
    const r = arrive(G, after.arrive, {});
    return r.nav ? r : { nav: { screen: 'map' } };
  }
  return { nav: { screen: after.screen || 'map', params: after.params || {} } };
}

/** Gancho lootDone:expedition. */
export function onLootDone(G) {
  const exp = G.expedition;
  if (!exp) return { nav: { screen: 'city' } };
  const after = exp.afterLoot || { screen: 'map' };
  exp.afterLoot = null;
  if (G.pendingLoot && G.pendingLoot.source === 'expedition') G.pendingLoot = null;
  save();
  return afterNav(G, after);
}

/** Gancho eventEnd:expedition. */
export function onEventEnd(G, info = {}) {
  const exp = G.expedition;
  if (!exp) return { nav: { screen: G.hero ? 'city' : 'title' } };
  if (heroDead(G)) return { nav: null };
  const nid = info.nodeId || exp.node;
  exp.cleared[nid] = true;
  if (hasPendingLoot(G)) { exp.afterLoot = { screen: 'map' }; save(); return { nav: { screen: 'loot' } }; }
  // o nó pode ter algo mais (carcaça)
  save();
  if (nodeFeatures(G, exp.node).includes('carcass')) return { nav: { screen: 'node', params: { id: exp.node } } };
  return { nav: { screen: 'map' } };
}

/** Gancho eventEnd:camp. */
export function onCampEventEnd(G) {
  const exp = G.expedition;
  if (!exp) return { nav: { screen: G.hero ? 'city' : 'title' } };
  if (heroDead(G)) return { nav: null };
  if (hasPendingLoot(G)) { exp.afterLoot = { screen: 'camp' }; save(); return { nav: { screen: 'loot' } }; }
  save();
  return { nav: { screen: 'camp' } };
}

// ======================================================================
// Chefe
// ======================================================================
export function bossView(G) {
  const exp = G.expedition;
  const rid = exp.region;
  const reg = REGIONS[rid];
  const be = BOSS_ENCOUNTERS[rid];
  const enemies = bossEnemies(G, rid);
  const h = G.hero;
  const D = heroD(G);
  const warn = [];
  if ((h.hp || 0) < (D.hpMax || 60) * 0.7) warn.push('Você está ferido.');
  if ((h.dread || 0) >= 50) warn.push('Seu Pavor está alto.');
  if (hungerLevel(G) >= 1) warn.push('Você está com fome.');
  if (!isLit(G)) warn.push('Escuridão: −precisão.');
  return { name: reg.bossName, text: be.text, escorts: enemies.length - 1, warn };
}
export function bossFight(G) {
  const exp = G.expedition;
  const rid = exp.region;
  if (G.world.regions[rid].bossDead) return { nav: { screen: 'map' } };
  return beginCombat(G, { enemies: bossEnemies(G, rid), kind: 'boss', nodeId: exp.node, boss: true, text: BOSS_ENCOUNTERS[rid].text });
}
/** Consequências da vitória sobre o chefe. D (campaign.onBossKilled/syncCampaign) aplica Chaga −12 e o fragmento. */
export function bossDefeated(G, rid) {
  const rs = ensureRegion(G, rid);
  const reg = REGIONS[rid];
  rs.bossDead = true;
  G.campaign.bosses = G.campaign.bosses || {};
  G.campaign.bosses[rid] = true;
  let lines = [];
  try {
    if (CP.onBossKilled) lines = asLines(CP.onBossKilled(G, rid));
    else {
      lines.push(...chaga(G, -12, `${reg.bossName} morto`));
      journal(G, `${reg.bossName} está morto.`);
    }
  } catch (e) { console.error('[exp] onBossKilled', e); }
  for (const l of lines) addLog(G, l.text, l.kind);
  addLog(G, `${reg.bossName} está morto. A região respira.`, 'good');
  const nx = nextRegion(rid);
  if (nx) {
    const ns = ensureRegion(G, nx);
    ns.unlocked = true;
    addLog(G, `Caminho aberto: ${REGIONS[nx].name}.`, 'info');
  }
  sfx('win');
  if (rid === 'r5') {
    G.campaign.heartPending = true;
    return { nav: { screen: 'map' } };
  }
  return { nav: { screen: 'map' } };
}

// ======================================================================
// Espreitar (nó de combate visto antes)
// ======================================================================
export function stalkView(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  const enc = (isNight(G) ? c.encNight : c.enc) || c.enc;
  const D = heroD(G);
  const check = { attr: 'des', diff: 20 + (loadInfo(G).overloaded ? 20 : 0) + heavyArmor(G) * 5, bonus: modOf(D, 'stealth') };
  return { n: enemyCount(enc), elite: hasElite(enc), text: enc?.text || '', sneak: { check, chance: chanceOf(G, check) }, canBack: !!exp.prev };
}
export function stalkAttack(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  const enc = (isNight(G) ? c.encNight : c.enc) || c.enc || pickEncounter(G, exp.region, {});
  exp.stalk = null;
  addLog(G, 'Você ataca primeiro.', 'blood');
  return beginCombat(G, { enemies: enc.enemies, kind: 'node', nodeId: exp.node, ambush: 'hero', text: enc.text });
}
export function stalkSneak(G) {
  const exp = G.expedition;
  const v = stalkView(G);
  const r = passHours(G, 1, { mode: 'work' });
  if (r.died) return { died: true };
  const res = roll(G, v.sneak.check);
  exp.stalk = null;
  if (res.ok) {
    exp.cleared[exp.node] = true;
    addLog(G, `Você passa rente a eles, sem respirar. (DES ${res.chance}%)`, 'good');
    save();
    return { nav: { screen: 'map' } };
  }
  addLog(G, 'Um galho estala. Eles se viram.', 'bad');
  const c = exp.content[exp.node] || {};
  const enc = (isNight(G) ? c.encNight : c.enc) || c.enc || pickEncounter(G, exp.region, {});
  return beginCombat(G, { enemies: enc.enemies, kind: 'node', nodeId: exp.node, ambush: 'enemy', text: enc.text });
}

// ======================================================================
// Ruína
// ======================================================================
function trapDef(G, id) { return REGIONS[G.expedition.region].traps.find((t) => t.id === id) || null; }

export function ruinView(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  const trap = c.trap ? trapDef(G, c.trap) : null;
  const D = heroD(G);
  const inspectCheck = { attr: 'ast', diff: trap ? trap.spot : 20, bonus: modOf(D, 'check_ast') ? 0 : 0 };
  const opts = [];
  const trapLive = trap && !c.disarmed;
  opts.push({ id: 'inspect', label: 'Procurar armadilhas', sub: `1h · AST ${chanceOf(G, inspectCheck)}%`,
    disabled: c.searched || c.trapKnown || c.inspected >= 2, why: c.trapKnown ? 'Você já sabe o que há aqui.' : c.searched ? 'Já vasculhado.' : 'Você já olhou tudo que dava.' });
  if (c.trapKnown && trapLive) {
    const dc = { attr: 'des', diff: trap.disarm };
    opts.push({ id: 'disarm', label: `Desarmar: ${trap.name}`, sub: `1h · DES ${chanceOf(G, dc)}% · falha dispara`, kind: 'danger' });
  }
  const trapRisk = trapLive ? (c.trapKnown ? 35 : null) : 0;
  opts.push({ id: 'search', label: 'Vasculhar tudo', sub: `2h · saque completo${trapRisk === null ? ' · armadilha?' : trapRisk ? ` · ${trapRisk}% de disparar` : ''}`,
    disabled: c.searched, why: 'Já vasculhado.', kind: 'primary' });
  opts.push({ id: 'quick', label: 'Pegar o que estiver à vista', sub: `1h · saque menor${trapRisk === null ? ' · armadilha?' : trapRisk ? ' · 20% de disparar' : ''}`,
    disabled: c.searched, why: 'Já vasculhado.' });
  if (c.deep) {
    opts.push({ id: 'deep', label: 'Descer à câmara inferior', sub: '3h · saque melhor · algo mora lá embaixo', kind: 'blood',
      disabled: !c.searched || c.deepDone, why: c.deepDone ? 'Você já desceu.' : 'Vasculhe em cima primeiro.' });
  }
  return { trap: c.trapKnown ? trap : null, trapKnown: !!c.trapKnown, noTrap: c.trapKnown && !trap, disarmed: !!c.disarmed, searched: !!c.searched, deep: !!c.deep, opts };
}

function springTrap(G, trap, out) {
  addLog(G, `${trap.name}! ${trap.text}`, 'bad');
  sfx('hit_heavy');
  const fx = applyFieldEffects(G, trap.effects);
  pushLines(G, fx.lines, out);
  return handlePending(G, fx.pending);
}

export function ruinAct(G, act) {
  const exp = G.expedition;
  const nid = exp.node;
  const c = exp.content[nid] || (exp.content[nid] = {});
  const reg = REGIONS[exp.region];
  const trap = c.trap ? trapDef(G, c.trap) : null;
  const out = [];
  const spend = (h) => { const r = passHours(G, h, { mode: 'work' }); out.push(...r.lines); return r.died; };
  const stay = () => { save(); return { lines: out, nav: { screen: 'node', params: { id: nid } } }; };
  const lootNow = (spec, title, bonus = 0, tier = reg.lootTier) => {
    if (queueLoot(G, rollLootSpec(G, spec, tier, { bonusRolls: bonus }), title)) {
      exp.afterLoot = { screen: 'node', params: { id: nid } };
      save();
      return { lines: out, nav: { screen: 'loot' } };
    }
    addLog(G, 'Nada que valha o peso.', '');
    return stay();
  };
  switch (act) {
    case 'inspect': {
      if (c.searched || c.trapKnown) return stay();
      if (spend(1)) return { died: true, lines: out };
      c.inspected = (c.inspected || 0) + 1;
      const res = roll(G, { attr: 'ast', diff: trap ? trap.spot : 20 });
      if (res.ok) {
        c.trapKnown = true;
        addLog(G, trap ? `Você encontra: ${trap.name}. ${trap.text}` : 'Nenhuma armadilha. Você tem certeza.', trap ? 'warn' : 'good');
      } else addLog(G, 'Você não vê nada. Isso não quer dizer nada.', '');
      return stay();
    }
    case 'disarm': {
      if (!trap || c.disarmed || !c.trapKnown) return stay();
      if (spend(1)) return { died: true, lines: out };
      const res = roll(G, { attr: 'des', diff: trap.disarm });
      c.disarmed = true;
      if (res.ok) {
        addLog(G, `Desarmada. (DES ${res.chance}%)`, 'good');
        if (trap.salvage) pushLines(G, applyFieldEffects(G, trap.salvage).lines, out);
      } else {
        const p = springTrap(G, trap, out);
        if (p?.died || heroDead(G)) return { died: dieOnce(G, trap.name), lines: out };
      }
      return stay();
    }
    case 'search': case 'quick': {
      if (c.searched) return stay();
      const quick = act === 'quick';
      if (spend(quick ? 1 : 2)) return { died: true, lines: out };
      if (trap && !c.disarmed) {
        const pct = quick ? (c.trapKnown ? 20 : 50) : (c.trapKnown ? 35 : 100);
        if (R.chance(pct)) {
          c.disarmed = true;
          const p = springTrap(G, trap, out);
          if (p?.died || heroDead(G)) return { died: dieOnce(G, trap.name), lines: out };
        }
      }
      if (c.guardian && R.chance(quick ? 40 : 100)) {
        const g = c.guardian;
        addLog(G, 'Algo mora aqui. E acordou.', 'blood');
        return beginCombat(G, { enemies: g.enemies, kind: 'ruin', nodeId: nid, text: g.text });
      }
      c.searched = true;
      exp.alert = Math.min(100, (exp.alert || 0) + (quick ? 3 : 6));
      return lootNow(reg.ruinLoot, nodeName(G, exp.region, nid), quick ? -1 : 0);
    }
    case 'deep': {
      if (!c.deep || c.deepDone || !c.searched) return stay();
      if (spend(3)) return { died: true, lines: out };
      c.deepDone = true;
      pushLines(G, dread(G, 6, 'a câmara inferior'), out);
      let id = null;
      if (R.chance(50)) { try { if (EV.pickEvent) id = EV.pickEvent(G, { pool: 'ruin', region: exp.region, tags: reg.events }); } catch (e) { console.error(e); } }
      if (id && EV.startEvent) {
        try { EV.startEvent(G, id, { source: 'expedition', nodeId: nid, region: exp.region }); return { lines: out, nav: { screen: 'event' } }; } catch (e) { console.error(e); }
      }
      if (R.chance(45)) {
        const enc = pickEncounter(G, exp.region, { dark: true });
        addLog(G, 'Lá embaixo, no escuro, algo esperava.', 'blood');
        return beginCombat(G, { enemies: enc.enemies, kind: 'ruin', nodeId: nid, text: enc.text, extra: { deep: true } });
      }
      return lootNow(reg.ruinLoot, 'Câmara inferior', 0, Math.min(5, reg.lootTier + 1));
    }
    default: return stay();
  }
}

// ======================================================================
// Santuário
// ======================================================================
export function riteDef(id) { return SHRINE_RITES[id] || ROT_RITES[id] || null; }
export function shrineView(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  const rites = (c.rites || []).map((id) => {
    const r = riteDef(id);
    if (!r) return null;
    let disabled = false, why = '';
    if (c.used?.[id]) { disabled = true; why = 'Já feito nesta visita.'; }
    else if (r.cond && !condOk(G, r.cond)) { disabled = true; why = r.cond.ichor ? 'Precisa de Icor.' : 'Indisponível.'; }
    else if (r.needDead && !(G.lineage?.dead || []).length) { disabled = true; why = 'Sua casa ainda não enterrou ninguém.'; }
    else if (r.cost?.some((e) => e.op === 'hp' && (G.hero.hp || 0) <= -e.n)) { disabled = true; why = 'Isso te mataria.'; }
    const bits = [];
    if (r.hours) bits.push(`${r.hours}h`);
    if (r.cost?.length) bits.push(describeFx(r.cost));
    if (r.check) bits.push(`${r.check.attr.toUpperCase()} ${chanceOf(G, r.check)}%`);
    bits.push(`→ ${describeFx(r.effects) || (r.loot ? 'saque' : '')}${r.loot ? ' + saque' : ''}`);
    return { id, name: r.name, desc: r.desc, sub: bits.join(' · '), disabled, why, rot: !!ROT_RITES[id] };
  }).filter(Boolean);
  return { rotten: !!c.rotten, rites, canListen: !c.heard && !!EV.pickEvent };
}
export function shrineRite(G, riteId) {
  const exp = G.expedition;
  const nid = exp.node;
  const c = exp.content[nid] || {};
  const v = shrineView(G).rites.find((r) => r.id === riteId);
  if (!v || v.disabled) return { ok: false, why: v?.why || 'Indisponível.', lines: [] };
  const r = riteDef(riteId);
  const out = [];
  c.used = c.used || {};
  c.used[riteId] = true;
  if (r.hours) { const t = passHours(G, r.hours, { mode: 'work' }); out.push(...t.lines); if (t.died) return { died: true, lines: out }; }
  if (r.cost?.length) {
    const fx = applyFieldEffects(G, r.cost);
    pushLines(G, fx.lines, out);
    const p = handlePending(G, fx.pending);
    if (p?.died || heroDead(G)) return { died: dieOnce(G, r.name), lines: out };
  }
  let effects = r.effects;
  if (r.check) {
    const res = roll(G, r.check);
    if (!res.ok) { effects = r.fail || []; addLog(G, `${r.name}: a fé não vem. (${r.check.attr.toUpperCase()} ${res.chance}%)`, 'bad'); }
    else addLog(G, `${r.name}: algo escuta. (${r.check.attr.toUpperCase()} ${res.chance}%)`, 'good');
  } else addLog(G, `${r.name}.`, 'info');
  const fx = applyFieldEffects(G, effects);
  pushLines(G, fx.lines, out);
  const p = handlePending(G, fx.pending, 'event');
  if (p?.died || heroDead(G)) return { died: dieOnce(G, r.name), lines: out };
  if (p?.nav) return { ...p, lines: out };
  if (r.loot && queueLoot(G, rollLootSpec(G, r.loot, REGIONS[exp.region].lootTier), r.name)) {
    exp.afterLoot = { screen: 'node', params: { id: nid } };
    save();
    return { lines: out, nav: { screen: 'loot' } };
  }
  sfx(ROT_RITES[riteId] ? 'corrupt' : 'bell');
  save();
  return { ok: true, lines: out, nav: { screen: 'node', params: { id: nid } } };
}
export function shrineListen(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  if (c.heard) return { ok: false, why: 'O santuário já falou.' };
  c.heard = true;
  let id = null;
  try { if (EV.pickEvent) id = EV.pickEvent(G, { pool: 'shrine', region: exp.region, tags: REGIONS[exp.region].events }); } catch (e) { console.error(e); }
  if (id && EV.startEvent) {
    try { EV.startEvent(G, id, { source: 'expedition', nodeId: exp.node, region: exp.region }); save(); return { ok: true, nav: { screen: 'event' } }; } catch (e) { console.error(e); }
  }
  addLog(G, 'Silêncio. O deus deste altar morreu antes do outro.', '');
  save();
  return { ok: true, nav: { screen: 'node', params: { id: exp.node } } };
}

// ======================================================================
// Mercador errante
// ======================================================================
export function sellPrice(G, inst) {
  const D = heroD(G);
  return Math.max(1, Math.floor(unitValue(inst) * 0.35 * (1 + clamp(modOf(D, 'price'), 0, 50) / 200)));
}
export function merchantView(G) {
  const exp = G.expedition;
  const m = exp.content[exp.node]?.merchant;
  if (!m) return null;
  const h = G.hero;
  const inspectCheck = { attr: 'ast', diff: 20 };
  const stock = m.stock.map((s, idx) => ({
    idx, inst: s.inst, name: nameOf(s.inst), price: s.price,
    disabled: m.gone || (h.coin || 0) < s.price, why: m.gone ? 'Ele se foi.' : `Faltam ${s.price - (h.coin || 0)} moedas.`,
  }));
  const sellables = (h.inv || []).filter((i) => {
    const d = defOf(i);
    return d && !['key', 'tome'].includes(d.type) && !String(i.id).startsWith('fragmento_');
  }).map((i) => {
    const p = sellPrice(G, i);
    return { uid: i.uid, name: nameOf(i), n: i.n || 1, price: p, disabled: p > m.purse, why: 'Ele não tem moedas para isso.' };
  });
  return {
    name: nodeName(G, exp.region, exp.node), purse: m.purse, stock, sellables, inspected: m.inspected, gone: m.gone,
    inspect: { check: inspectCheck, chance: chanceOf(G, inspectCheck), done: m.inspected != null },
    suspicious: m.inspected === 'trap',
  };
}
/** Primeiro contato: se for armadilha, o golpe vem agora. */
function merchantSprings(G, m) {
  if (!m.ambush || m.inspected === 'trap' || m.sprung) return null;
  m.sprung = true;
  const reg = REGIONS[G.expedition.region];
  addLog(G, 'Ele sorri. Gente sai de trás da carroça.', 'bad');
  sfx('scream');
  return beginCombat(G, { enemies: clone(reg.merchant.ambushers), kind: 'merchant', nodeId: G.expedition.node, ambush: 'enemy', text: 'Era uma isca. Você é o peixe.' });
}
export function merchantInspect(G) {
  const exp = G.expedition;
  const m = exp.content[exp.node]?.merchant;
  if (!m || m.inspected != null) return { ok: false, why: 'Já avaliado.' };
  const res = roll(G, { attr: 'ast', diff: 20 });
  if (res.ok) {
    m.inspected = m.ambush ? 'trap' : 'honest';
    addLog(G, m.ambush ? 'As mãos dele não têm calo de carroça. Há gente na mata. É uma isca.' : 'Ele está com mais medo de você do que você dele. Honesto, para o Ermo.', m.ambush ? 'warn' : 'good');
  } else {
    m.inspected = 'unknown';
    addLog(G, 'Você não consegue ler esse homem.', '');
  }
  save();
  return { ok: true, nav: { screen: 'node', params: { id: exp.node } } };
}
export function merchantBuy(G, idx) {
  const exp = G.expedition;
  const m = exp.content[exp.node]?.merchant;
  if (!m || m.gone) return { ok: false, why: 'Não há mercador.' };
  const sp = merchantSprings(G, m);
  if (sp) return sp;
  const s = m.stock[idx];
  if (!s) return { ok: false, why: 'Item inválido.' };
  if ((G.hero.coin || 0) < s.price) return { ok: false, why: 'Moedas insuficientes.' };
  G.hero.coin -= s.price;
  m.purse += s.price;
  giveInst(G, s.inst);
  m.stock.splice(idx, 1);
  sfx('coin');
  addLog(G, `Comprou ${nameOf(s.inst)} por ${s.price}.`, '');
  save();
  return { ok: true, nav: { screen: 'node', params: { id: exp.node } } };
}
export function merchantSell(G, itemUid) {
  const exp = G.expedition;
  const m = exp.content[exp.node]?.merchant;
  if (!m || m.gone) return { ok: false, why: 'Não há mercador.' };
  const sp = merchantSprings(G, m);
  if (sp) return sp;
  const inv = G.hero.inv || [];
  const inst = inv.find((i) => i.uid === itemUid);
  if (!inst) return { ok: false, why: 'Item não encontrado.' };
  const price = sellPrice(G, inst);
  if (price > m.purse) return { ok: false, why: 'Ele não tem moedas para isso.' };
  let sold;
  if ((inst.n || 1) > 1) { inst.n -= 1; sold = { ...clone(inst), n: 1, uid: uid('i') }; }
  else { inv.splice(inv.indexOf(inst), 1); sold = inst; }
  m.purse -= price;
  G.hero.coin = (G.hero.coin || 0) + price;
  m.stock.push({ inst: sold, price: Math.ceil(unitValue(sold) * REGIONS[exp.region].merchant.markup) });
  sfx('coin');
  addLog(G, `Vendeu ${nameOf(sold)} por ${price}.`, '');
  save();
  return { ok: true, nav: { screen: 'node', params: { id: exp.node } } };
}
export function merchantRob(G) {
  const exp = G.expedition;
  const m = exp.content[exp.node]?.merchant;
  if (!m || m.gone) return { ok: false, why: 'Não há mercador.' };
  const reg = REGIONS[exp.region];
  if (m.ambush) {
    m.sprung = true;
    addLog(G, 'Você ataca antes da isca fechar.', 'blood');
    return beginCombat(G, { enemies: clone(reg.merchant.ambushers), kind: 'merchant', nodeId: exp.node, ambush: 'hero', text: 'Os capangas saem tarde demais.' });
  }
  applyA(G, [{ op: 'rep', f: 'guilda', n: -5 }], { source: 'expedition' });
  addLog(G, 'Você puxa a arma. O mercador grita pelos guardas.', 'blood');
  return beginCombat(G, { enemies: clone(reg.merchant.guards), kind: 'merchant', nodeId: exp.node, text: 'Guardas pagos para morrer pela carroça.' });
}

// ======================================================================
// Veio de Icor
// ======================================================================
export function veinView(G) {
  const exp = G.expedition;
  const c = exp.content[exp.node] || {};
  const reg = REGIONS[exp.region];
  const D = heroD(G);
  const mult = reg.ichorMult * (isNight(G) ? 1.5 : 1) * (1 + modOf(D, 'ichor_find') / 100);
  const y = (a, b) => [Math.max(1, Math.round(a * mult)), Math.max(1, Math.round(b * mult))];
  const attract = (deep) => clamp(Math.round(15 + (c.heat || 0) * 12 + (isNight(G) ? 10 : 0) + (exp.alert || 0) / 4 + (deep ? 15 : 0)), 5, 90);
  const empty = !(c.left > 0);
  return {
    left: c.left || 0, heat: c.heat || 0, night: isNight(G),
    opts: [
      { id: 'careful', label: 'Colher com cuidado', sub: `2h · +${y(1, 2).join('–')} Icor · ${attract(false)}% atrair algo`, yield: y(1, 2), attract: attract(false), disabled: empty, why: 'O veio secou.' },
      { id: 'deep', label: 'Sangrar fundo', sub: `4h · +${y(2, 4).join('–')} Icor · +3 Corrupção · ${attract(true)}% atrair algo`, yield: y(2, 4), attract: attract(true), disabled: empty, why: 'O veio secou.', kind: 'blood' },
    ],
  };
}
export function veinHarvest(G, mode = 'careful') {
  const exp = G.expedition;
  const nid = exp.node;
  const c = exp.content[nid] || {};
  if (!(c.left > 0)) return { ok: false, why: 'O veio secou.', lines: [] };
  const v = veinView(G);
  const o = v.opts.find((x) => x.id === mode) || v.opts[0];
  const out = [];
  const r = passHours(G, mode === 'deep' ? 4 : 2, { mode: 'work' });
  out.push(...r.lines);
  if (r.died) return { died: true, lines: out };
  const got = R.int(o.yield[0], o.yield[1]);
  G.hero.ichor = (G.hero.ichor || 0) + got;
  exp.stats.ichor += got;
  c.left -= 1;
  c.heat = (c.heat || 0) + 1;
  exp.alert = Math.min(100, (exp.alert || 0) + (mode === 'deep' ? 30 : 15));
  sfx('ichor');
  addLog(G, `+${got} Icor. ${c.left > 0 ? 'O veio ainda pulsa.' : 'O veio seca.'}`, 'ichor');
  if (mode === 'deep') {
    const cr = corrupt(G, 3, 'Icor na pele');
    pushLines(G, cr.lines, out);
    if (cr.transformed || heroDead(G)) return { died: true, lines: out };
  }
  if (R.chance(o.attract)) {
    const enc = pickEncounter(G, exp.region, { ambush: true, dark: !isLit(G) });
    addLog(G, 'O cheiro do Icor trouxe companhia.', 'bad');
    return { lines: out, ...beginCombat(G, { enemies: enc.enemies, kind: 'vein', nodeId: nid, ambush: mode === 'deep' ? 'enemy' : null, text: enc.text }) };
  }
  save();
  return { ok: true, lines: out, nav: { screen: 'node', params: { id: nid } } };
}

// ======================================================================
// Ninho
// ======================================================================
const BURN_ITEMS = ['oleo', 'bomba', 'polvora'];
export function nestView(G) {
  const exp = G.expedition;
  const rid = exp.region;
  const st = G.world.regions[rid].nests[exp.node] || { growth: 0 };
  const ne = NEST_ENCOUNTERS[rid];
  const enemies = nestEnemies(G, rid, exp.node);
  const fuel = BURN_ITEMS.find((id) => countOf(G, id) > 0) || null;
  const flame = (exp.light > 0 && exp.torchLit) || countOf(G, 'tocha') > 0;
  return {
    growth: st.growth || 0, text: ne.text, n: enemies.length, sprout: !!st.sprout,
    burn: { fuel, flame, disabled: !fuel || !flame, why: !fuel ? 'Precisa de óleo, pólvora ou bomba.' : 'Precisa de fogo (tocha).' },
  };
}
export function nestAssault(G, { burn = false } = {}) {
  const exp = G.expedition;
  const rid = exp.region;
  let enemies = nestEnemies(G, rid, exp.node);
  if (burn) {
    const v = nestView(G);
    if (v.burn.disabled) return { ok: false, why: v.burn.why };
    takeItem(G, v.burn.fuel, 1);
    if (!(exp.light > 0)) takeItem(G, 'tocha', 1);
    enemies = enemies.filter((e) => !(typeof e === 'object' && e.elite)).slice(0, Math.max(1, enemies.length - 2));
    exp.alert = Math.min(100, (exp.alert || 0) + 20);
    addLog(G, 'O ninho pega fogo. O que estava dormindo acorda queimando.', 'blood');
    sfx('fire');
  }
  return beginCombat(G, { enemies, kind: 'nest', nodeId: exp.node, ambush: burn ? 'hero' : null, text: NEST_ENCOUNTERS[rid].text });
}

// ======================================================================
// Carcaça
// ======================================================================
export function carcassView(G) {
  const exp = G.expedition;
  const c = carcassAt(G, exp.region, exp.node);
  if (!c) return null;
  const cont = exp.content[exp.node] || {};
  const guarded = (c.corrupted && !c.slain) ? 'aberration' : (cont.scavengers ? 'scavengers' : null);
  return {
    name: c.name, level: c.level, cause: c.cause, corrupted: c.corrupted, risen: c.risen, guarded,
    items: c.items.map((i) => nameOf(i)), coin: c.coin, ichor: c.ichor,
    canBurn: countOf(G, 'tocha') > 0 || countOf(G, 'oleo') > 0 || exp.light > 0,
  };
}
export function carcassApproach(G) {
  const exp = G.expedition;
  const rid = exp.region;
  const c = carcassAt(G, rid, exp.node);
  if (!c) return { nav: { screen: 'map' } };
  const v = carcassView(G);
  if (v.guarded === 'aberration') {
    addLog(G, `O que restou de ${c.name} se levanta. Ainda veste o que você deu a ele.`, 'blood');
    sfx('scream');
    return beginCombat(G, { enemies: [{ id: 'aberracao', elite: true, level: c.level }], kind: 'carcass', nodeId: exp.node, text: `${c.name}, transformado.` });
  }
  if (v.guarded === 'scavengers') {
    const enemies = exp.content[exp.node].scavengers;
    addLog(G, `Algo está comendo ${c.name}.`, 'blood');
    return beginCombat(G, { enemies, kind: 'carcass', nodeId: exp.node, text: 'Comedores de carniça no corpo.' });
  }
  const rec = carcassRecord(G, rid, c);
  if (rec) { rec.recovered = true; rec.recoveredBy = G.hero?.name; rec.recoveredDay = dayOf(G); }
  if (c.worldUid) for (const w of (G.world.regions[rid].carcasses || [])) if (w && w.uid === c.worldUid) w.recovered = true;
  if (rec?.contract || rec?.npc) G.campaign.flags[`carcass_${rec.uid}`] = true;
  const got = queueLoot(G, { items: clone(c.items), coin: c.coin, ichor: c.ichor }, `Carcaça de ${c.name}`);
  pushLines(G, dread(G, 5, `o corpo de ${c.name}`), []);
  journal(G, `Encontrei o corpo de ${c.name}.`);
  exp.carcassDone = exp.carcassDone || {};
  exp.carcassDone[exp.node] = c.key;
  exp.afterLoot = { screen: 'node', params: { id: exp.node, rites: 1 } };
  save();
  if (got) return { nav: { screen: 'loot' } };
  addLog(G, 'Já levaram tudo.', '');
  return { nav: { screen: 'node', params: { id: exp.node, rites: 1 } } };
}
/** Depois de recuperar: enterrar, queimar ou deixar (pode levantar). */
export function carcassRite(G, mode) {
  const exp = G.expedition;
  const rid = exp.region;
  const dead = (G.lineage?.dead || []).find((d, i) => exp.carcassDone?.[exp.node] === `d${i}`);
  const out = [];
  if (mode === 'bury') {
    const r = passHours(G, 2, { mode: 'work' });
    out.push(...r.lines);
    if (r.died) return { died: true, lines: out };
    pushLines(G, dread(G, -15, 'enterrar os seus'), out);
    if (dead) { dead.buried = true; dead.unburied = false; }
    addLog(G, 'Você cava com as mãos. Ele merecia mais. Teve isso.', 'good');
  } else if (mode === 'burn') {
    if (!(exp.light > 0) && !takeItem(G, 'oleo', 1) && !takeItem(G, 'tocha', 1)) return { ok: false, why: 'Sem fogo.' };
    const r = passHours(G, 1, { mode: 'work' });
    out.push(...r.lines);
    if (r.died) return { died: true, lines: out };
    pushLines(G, dread(G, -8, 'fogo nos mortos'), out);
    exp.alert = Math.min(100, (exp.alert || 0) + 10);
    if (dead) { dead.burned = true; dead.unburied = false; }
    addLog(G, 'A fumaça sobe reta. Nada vai levantar daqui.', 'good');
  } else {
    if (dead) dead.unburied = true;
    addLog(G, 'Você deixa o corpo para os corvos. Corpos aqui não ficam quietos.', 'warn');
  }
  if (exp.carcassDone) delete exp.carcassDone[exp.node];
  exp.cleared[exp.node] = true;
  save();
  return { ok: true, lines: out, nav: { screen: 'map' } };
}

// ======================================================================
// Volta à cidade
// ======================================================================
/** Saídas possíveis: entrada e passagens abertas, por caminho já percorrido nesta expedição. */
export function exitOptions(G) {
  const exp = G.expedition;
  if (!exp) return [];
  const rid = exp.region;
  const rs = G.world.regions[rid];
  const reg = REGIONS[rid];
  const targets = [{ id: rs.map.entry, kind: 'entry' }];
  for (const nid of Object.keys(rs.shortcuts || {})) if (rs.shortcuts[nid] && rs.map.nodes[nid]) targets.push({ id: nid, kind: 'passage' });
  const out = [];
  for (const t of targets) {
    let path, walk = 0;
    if (t.id === exp.node) path = [exp.node];
    else {
      const sp = shortestPath(rs.map, exp.node, t.id, { allow: (id) => exp.cleared[id] || exp.visited[id], cost: (e) => e.h });
      if (!sp) continue;
      path = sp.path;
      for (let i = 1; i < path.length; i++) walk += edgeHours(G, path[i - 1], path[i]) || 1;
    }
    const risk = path.length > 1 ? Math.round(ambushChance(G, { to: path[1] })) : 0;
    out.push({ id: t.id, kind: t.kind, name: nodeName(G, rid, t.id), path, walk, road: reg.travelHours, total: walk + reg.travelHours, steps: path.length - 1, risk });
  }
  return out.sort((a, b) => a.total - b.total);
}
export function canReturn(G) {
  const exp = G.expedition;
  if (!exp) return { ok: false, why: 'Fora de expedição.' };
  const cm = canMove(G);
  if (!cm.ok) return cm;
  if (!exitOptions(G).length) return { ok: false, why: 'Nenhum caminho seguro conhecido até a saída.' };
  return { ok: true };
}

/** Volta (andando pelo caminho conhecido). Emboscadas podem interromper. Retorna { lines, nav, done, summary }. */
export function returnToCity(G, exitId) {
  const exp = G.expedition;
  const can = canReturn(G);
  if (!can.ok) return { ok: false, why: can.why, lines: [] };
  const opts = exitOptions(G);
  const plan = opts.find((o) => o.id === exitId) || opts[0];
  const out = [];
  exp.retreat = { exit: plan.id };
  for (let i = 1; i < plan.path.length; i++) {
    const to = plan.path[i];
    const r = moveTo(G, to, { retreat: true });
    out.push(...(r.lines || []));
    if (r.died || r.ended) return { ok: true, lines: out, died: r.died, ended: r.ended };
    if (!r.ok) { exp.retreat = null; return { ok: false, why: r.why, lines: out }; }
    if (r.nav && r.nav.screen !== 'map') return { ok: true, lines: out, nav: r.nav, interrupted: true };
  }
  return finishExpedition(G, out);
}
export function continueRetreat(G) {
  const exp = G.expedition;
  if (!exp?.retreat) return { ok: false, why: 'Sem retirada em andamento.' };
  return returnToCity(G, exp.retreat.exit);
}

function finishExpedition(G, out = []) {
  const exp = G.expedition;
  const rid = exp.region;
  const reg = REGIONS[rid];
  const rs = G.world.regions[rid];
  const via = rs.map.nodes[exp.node]?.type === 'passage' ? 'passage' : 'entry';
  addLog(G, via === 'passage' ? 'Você desce pela passagem. A cidade está do outro lado.' : 'A estrada de volta.', 'info');
  const r = passHours(G, reg.travelHours, { mode: 'road' });
  out.push(...r.lines);
  if (r.died) return { ok: true, lines: out, died: true };
  const h = G.hero;
  const summary = {
    region: rid, regionName: reg.name, hours: Math.round(G.time - exp.startTime), nodes: exp.stats.nodes, fights: exp.stats.fights,
    wins: exp.stats.wins, ambushes: exp.stats.ambushes, nests: exp.stats.nests,
    ichor: (h.ichor || 0) - (exp.stats.startIchor || 0), coin: (h.coin || 0) - (exp.stats.startCoin || 0),
    bossDead: !!rs.bossDead, day: dayOf(G),
  };
  h.stats = h.stats || {};
  h.stats.expeditions = (h.stats.expeditions || 0) + 1;
  rs.expeditions = (rs.expeditions || 0) + 1;
  G.expedition = null;
  if (G.pendingLoot?.source === 'expedition' && !(G.pendingLoot.items || []).length) G.pendingLoot = null;
  out.push(...tickNests(G));
  try { if (TM.logLine) TM.logLine(G, `Voltou de ${reg.name}: ${summary.hours}h, ${sign(summary.ichor)} Icor.`, 'info'); } catch { /* */ }
  G.lastExpedition = summary;
  save();
  return { ok: true, done: true, lines: out, summary, nav: { screen: 'city', params: { fromExpedition: true } } };
}
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

// ======================================================================
// Estado resumido (UI / HUD)
// ======================================================================
export function fieldStatus(G) {
  const exp = G.expedition;
  if (!exp) return null;
  const reg = REGIONS[exp.region];
  const hl = hungerLevel(G);
  const ld = loadInfo(G);
  const torches = countOf(G, 'tocha');
  return {
    region: exp.region, regionName: reg.name, day: dayOf(G), hour: Math.floor(hourOf(G)), night: isNight(G),
    dark: isDarkNow(G), lit: isLit(G), torchLit: !!exp.torchLit, light: Math.round((exp.light || 0) * 10) / 10,
    torches, lightTotal: Math.round(((exp.light || 0) + torches * torchHours(G)) * 10) / 10,
    rations: countOf(G, 'racao'), hunger: Math.max(0, Math.round(G.hero?.hunger || 0)), hungerLevel: hl, hungerLabel: HUNGER_LEVELS[hl].label,
    nextMeal: Math.max(0, Math.round(MEAL_HOURS - (G.hero?.hunger || 0))),
    load: ld, alert: Math.round(exp.alert || 0), ambush: ambushChance(G, {}), hoursOut: exp.hoursOut,
    flesh: reg.env?.flesh || 0, retreat: !!exp.retreat,
  };
}

/** Nós para desenhar (com estado). */
export function mapView(G, rid) {
  rid = rid || G.expedition?.region;
  const rs = ensureRegion(G, rid);
  const exp = G.expedition?.region === rid ? G.expedition : null;
  const nodes = [];
  for (const n of Object.values(rs.map.nodes)) {
    const seen = isSeen(G, rid, n.id);
    if (!seen) continue;
    const known = isDiscovered(G, rid, n.id);
    const t = known ? nodeType(G, rid, n.id) : null;
    nodes.push({
      id: n.id, x: n.x, y: n.y, depth: n.depth, known, type: t, name: known ? nodeName(G, rid, n.id) : '?',
      current: exp?.node === n.id, visited: !!exp?.visited[n.id], visitedEver: rs.visitedEver.includes(n.id), cleared: !!exp?.cleared[n.id],
      adjacent: !!exp && rs.map.nodes[exp.node].links.includes(n.id),
      carcass: known && !!carcassAt(G, rid, n.id), nestGrowth: t === 'nest' ? (rs.nests[n.id]?.growth || 0) : null,
      dead: (t === 'nest' && rs.nests[n.id]?.destroyed) || (t === 'boss' && rs.bossDead),
      shortcut: !!rs.shortcuts[n.id],
    });
  }
  const shown = new Set(nodes.map((n) => n.id));
  const edges = rs.map.edges.filter((e) => shown.has(e.a) && shown.has(e.b)).map((e) => ({
    ...e, walked: !!exp && pathHas(exp.path, e.a, e.b),
  }));
  return { w: rs.map.w, h: rs.map.h, nodes, edges, entry: rs.map.entry, boss: rs.map.boss, palette: REGIONS[rid].palette };
}
function pathHas(path, a, b) {
  for (let i = 1; i < path.length; i++) if ((path[i - 1] === a && path[i] === b) || (path[i - 1] === b && path[i] === a)) return true;
  return false;
}

/** Conhecimento da região (tela de partida). */
export function regionSummary(G, rid) {
  const reg = REGIONS[rid];
  const rs = G.world?.regions?.[rid];
  const total = rs?.map ? Object.keys(rs.map.nodes).length : reg.nodeCount;
  return {
    id: rid, name: reg.name, desc: reg.desc, tier: reg.tier, travelHours: reg.travelHours, unlocked: regionUnlocked(G, rid), why: lockReason(G, rid),
    known: rs ? rs.discovered.length : 0, total, bossDead: !!rs?.bossDead || !!G.campaign?.bosses?.[rid], bossName: reg.bossName,
    nests: rs ? liveNests(G, rid).length : null, maxGrowth: rs ? Math.max(0, ...liveNests(G, rid).map((n) => n.growth || 0)) : 0,
    shortcuts: rs ? Object.keys(rs.shortcuts || {}).filter((k) => rs.shortcuts[k]).length : 0,
    carcasses: rs ? carcassesIn(G, rid).length : (G.lineage?.dead || []).filter((d) => d.region === rid && !d.recovered).length,
    expeditions: rs?.expeditions || 0, env: reg.env, dark: reg.env?.light,
  };
}

export { REGIONS, REGION_ORDER, NODE_TYPES };
