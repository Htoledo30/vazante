// ICOR — sistema de itens (Área A): instâncias, inventário, equipar, usar, valor, descrição.
// Puro (sem DOM). Instância: { uid, id, q, dur?, n, ench, mods?, name?, coat? }.
import { ITEMS, QUALITY, SCALE_COEF, PROPS, ENCHANTS, STACK_TYPES, CLASS_NAMES, DTYPE_NAMES, TYPE_NAMES, SLOT_NAMES } from '../data/items.js';
import { uid as mkUid, clamp } from '../core/util.js';
import { derive } from './character.js';
import { applyEffects, checkCond, describeCond, describeEffects } from './effects.js';
import { WOUNDS } from '../data/wounds.js';
import { MUTATIONS } from '../data/mutations.js';
import { TRAIT_LIST } from '../data/traits.js';
import { getG } from '../core/state.js';

export const EQUIP_SLOTS = ['main', 'off', 'cabeca', 'tronco', 'bracos', 'pernas', 'amuleto1', 'amuleto2'];

// ------------------------------------------------------------ definições / instâncias
export function itemDef(x) {
  if (!x) return null;
  if (typeof x === 'string') return ITEMS[x] || null;
  return ITEMS[x.id] || null;
}

export function isStackable(defOrId) {
  const d = typeof defOrId === 'string' ? ITEMS[defOrId] : defOrId;
  return !!d && (d.stack || STACK_TYPES.includes(d.type));
}

/** Cria instância. q: 0..3 (só equipamento usa). n: pilha. */
export function makeItem(id, { q = 1, n = 1, ench = null, name = null } = {}) {
  const def = ITEMS[id];
  if (!def) { console.warn('[items] id desconhecido:', id); return null; }
  const equipLike = ['weapon', 'armor', 'offhand'].includes(def.type);
  const qq = equipLike ? clamp(Math.round(q), 0, 3) : 1;
  const inst = { uid: mkUid('i'), id, q: qq, n: Math.max(1, Math.round(n)), ench: ench || null };
  if (def.dur) inst.dur = Math.max(1, Math.round(def.dur * QUALITY[qq].durMult));
  if (name) inst.name = name;
  return inst;
}

export function maxDur(inst) {
  const def = itemDef(inst);
  if (!def?.dur) return 0;
  return Math.max(1, Math.round(def.dur * QUALITY[inst.q ?? 1].durMult));
}
export const isBroken = (inst) => !!inst && inst.dur != null && inst.dur <= 0;

export function itemName(inst) {
  if (!inst) return '—';
  const def = itemDef(inst);
  if (!def) return `??? (${inst.id})`;
  let s = inst.name || def.name;
  const qn = QUALITY[inst.q ?? 1]?.name;
  if (qn && ['weapon', 'armor', 'offhand'].includes(def.type)) s += ` · ${qn}`;
  if (inst.ench && ENCHANTS[inst.ench]) s += ` ✦ ${ENCHANTS[inst.ench].name.replace('Unção de ', '').replace('Unção ', '')}`;
  if (isBroken(inst)) s += ' (quebrado)';
  return s;
}

// ------------------------------------------------------------ inventário
export function weightOf(inst) {
  const def = itemDef(inst);
  if (!def) return 0;
  return (def.weight || 0) * (inst.n || 1);
}

export function totalWeight(hero) {
  let w = 0;
  for (const it of hero.inv || []) w += weightOf(it);
  for (const s of EQUIP_SLOTS) if (hero.equip?.[s]) w += weightOf(hero.equip[s]);
  return Math.round(w * 10) / 10;
}

/** Adiciona respeitando pilhas. Peso pode exceder (fica sobrecarregado). */
export function addItem(hero, inst) {
  if (!hero || !inst) return { ok: false, reason: 'Item inválido.' };
  const def = itemDef(inst);
  if (!def) return { ok: false, reason: 'Item desconhecido.' };
  hero.inv = hero.inv || [];
  if (isStackable(def)) {
    const same = hero.inv.find((x) => x.id === inst.id && !x.name && !inst.name);
    if (same) { same.n = (same.n || 1) + (inst.n || 1); return { ok: true, stacked: true, inst: same }; }
  }
  hero.inv.push(inst);
  return { ok: true, inst };
}

export function countItem(hero, id, { equipped = false } = {}) {
  if (!hero) return 0;
  let n = 0;
  for (const it of hero.inv || []) if (it.id === id) n += it.n || 1;
  if (equipped) for (const s of EQUIP_SLOTS) if (hero.equip?.[s]?.id === id) n += hero.equip[s].n || 1;
  return n;
}
export const hasItem = (hero, id, n = 1) => countItem(hero, id) >= n;

/** Remove n unidades de um id do inventário (não mexe no equipado). Tudo ou nada. */
export function removeItem(hero, id, n = 1) {
  if (countItem(hero, id) < n) return false;
  let left = n;
  for (let i = hero.inv.length - 1; i >= 0 && left > 0; i--) {
    const it = hero.inv[i];
    if (it.id !== id) continue;
    const take = Math.min(left, it.n || 1);
    it.n = (it.n || 1) - take;
    left -= take;
    if (it.n <= 0) hero.inv.splice(i, 1);
  }
  return true;
}

/** Remove uma instância (ou n dela) pelo uid. Retorna a instância removida (cópia com n) ou null. */
export function removeInst(hero, uid, n = null) {
  const i = (hero.inv || []).findIndex((x) => x.uid === uid);
  if (i < 0) return null;
  const it = hero.inv[i];
  const take = n == null ? (it.n || 1) : Math.min(n, it.n || 1);
  if (take >= (it.n || 1)) { hero.inv.splice(i, 1); return it; }
  it.n -= take;
  return { ...it, uid: mkUid('i'), n: take };
}

export function findInst(hero, uid) {
  if (!hero) return null;
  const inv = (hero.inv || []).find((x) => x.uid === uid);
  if (inv) return { inst: inv, where: 'inv' };
  for (const s of EQUIP_SLOTS) if (hero.equip?.[s]?.uid === uid) return { inst: hero.equip[s], where: s };
  return null;
}

// ------------------------------------------------------------ equipar
function lostSet(hero) {
  const s = new Set();
  for (const w of hero.wounds || []) {
    const d = WOUNDS[w.id];
    if (d?.loses) s.add(d.loses === true ? w.part : d.loses);
  }
  return s;
}

/** Slot natural de um item. */
export function slotFor(def, hero, pref) {
  if (!def) return null;
  if (def.type === 'weapon') {
    if (pref === 'off') return 'off';
    return 'main';
  }
  if (def.type === 'armor') return def.slot;
  if (def.type === 'offhand') return 'off';
  if (def.type === 'trinket') {
    if (pref === 'amuleto1' || pref === 'amuleto2') return pref;
    if (!hero?.equip?.amuleto1) return 'amuleto1';
    if (!hero?.equip?.amuleto2) return 'amuleto2';
    return 'amuleto1';
  }
  return null;
}

/** Pode equipar? Retorna { ok, reason, slot, displaces:[slots] } sem mudar nada. */
export function canEquip(hero, uid, pref) {
  if (globalCombatLock(hero)) return { ok: false, reason: 'Em combate, troque de arma pela ação do combate.' };
  const f = findInst(hero, uid);
  if (!f) return { ok: false, reason: 'Item não está na mochila.' };
  if (f.where !== 'inv') return { ok: false, reason: 'Já equipado.' };
  const inst = f.inst;
  const def = itemDef(inst);
  if (!def) return { ok: false, reason: 'Item desconhecido.' };
  if (def.type === 'prosthetic' || def.prosthetic) return canFitProsthetic(hero, inst);
  const slot = slotFor(def, hero, pref);
  if (!slot) return { ok: false, reason: 'Isso não se equipa.' };
  const D = derive(hero);
  const lost = lostSet(hero);
  const muts = mutationFlags(hero);
  const displaces = [];
  if (hero.equip?.[slot]) displaces.push(slot);
  const curMain = hero.equip?.main ? itemDef(hero.equip.main) : null;
  if (slot === 'main') {
    if (lost.has('bracoD') && lost.has('bracoE')) return { ok: false, reason: 'Sem mãos para empunhar.' };
    if (def.hands === 2 && !D.canTwoHand) return { ok: false, reason: 'Precisa das duas mãos firmes.' };
    if (def.ranged && muts.has('noRanged')) return { ok: false, reason: 'Suas mãos não armam uma besta.' };
    if (def.hands === 2 && hero.equip?.off) displaces.push('off');
    if (hero.equip?.main && isCursed(hero.equip.main)) return { ok: false, reason: 'A arma maldita não sai da sua mão.' };
  }
  if (slot === 'off') {
    if (def.type === 'weapon') {
      const light = def.props?.includes('leve') || def.cls === 'adaga';
      if (!light) return { ok: false, reason: 'Só armas leves (adaga, espada curta) na mão secundária.' };
      if (def.hands === 2) return { ok: false, reason: 'Arma de duas mãos.' };
    }
    if (def.kind === 'shield' && !D.canShield) return { ok: false, reason: muts.has('noShield') ? 'Esse braço não segura mais escudo.' : 'Sem braço para o escudo.' };
    if (def.kind !== 'shield' && lost.has('bracoE') && !(hero.prosthetics?.bracoE && def.kind === 'torch')) return { ok: false, reason: 'Sem a mão secundária.' };
    if (curMain && curMain.hands === 2) displaces.push('main');
    if (curMain && hero.equip?.main && isCursed(hero.equip.main) && curMain.hands === 2) return { ok: false, reason: 'A arma maldita ocupa as duas mãos.' };
  }
  if (slot === 'cabeca' && muts.has('noHelm') && (def.heavy || 0) >= 1) return { ok: false, reason: 'A coroa de osso não deixa o elmo entrar.' };
  if (slot === 'tronco' && muts.has('noHeavyTronco') && (def.heavy || 0) >= 2) return { ok: false, reason: 'A espinha dupla não cabe nessa armadura.' };
  return { ok: true, slot, displaces: [...new Set(displaces)] };
}

/** Equipa da mochila. pref: 'off' para arma leve na mão secundária, 'amuleto2'... */
export function equip(hero, uid, pref) {
  const chk = canEquip(hero, uid, pref);
  if (!chk.ok) return chk;
  const f = findInst(hero, uid);
  const def = itemDef(f.inst);
  if (def.type === 'prosthetic' || def.prosthetic) return fitProsthetic(hero, uid);
  const inst = removeInst(hero, uid);
  for (const s of chk.displaces) {
    const old = hero.equip[s];
    if (old) { hero.equip[s] = null; hero.inv.push(old); }
  }
  hero.equip[chk.slot] = inst;
  return { ok: true, slot: chk.slot };
}

export const isCursed = (inst) => !!itemDef(inst)?.props?.includes('maldita') && !inst?.uncursed;

export function unequip(hero, slot, { force = false } = {}) {
  if (!force && globalCombatLock(hero)) return { ok: false, reason: 'Em combate.' };
  const inst = hero.equip?.[slot];
  if (!inst) return { ok: false, reason: 'Vazio.' };
  if (!force && isCursed(inst)) return { ok: false, reason: 'A lâmina não solta sua mão. Só o Templo tira.' };
  hero.equip[slot] = null;
  hero.inv.push(inst);
  return { ok: true, inst };
}

/** D (templo) usa: quebra a maldição (o item continua com as propriedades, mas sai da mão). */
export function uncurse(inst) { if (inst) inst.uncursed = true; return !!inst; }

function globalCombatLock(hero) {
  // Herói em combate ativo: equipamento só muda por ação de combate (B).
  const G = getG();
  return !!(G && G.hero === hero && G.combat && !G.combat.result && !G.combat.allowEquip);
}

function mutationFlags(hero) {
  const s = new Set();
  for (const id of hero.mutations || []) for (const f of (MUTATIONS[id]?.flags || [])) s.add(f);
  return s;
}

// ------------------------------------------------------------ próteses
const PROSTHETIC_PART = { braco: ['bracoD', 'bracoE'], pernas: ['pernas'], olho: ['olho'] };

export function canFitProsthetic(hero, inst) {
  const def = itemDef(inst);
  const kind = def?.prosthetic;
  if (!kind) return { ok: false, reason: 'Não é prótese.' };
  const lost = lostSet(hero);
  const parts = PROSTHETIC_PART[kind].filter((p) => lost.has(p));
  if (!parts.length) return { ok: false, reason: kind === 'olho' ? 'Você ainda tem os olhos.' : 'Você não perdeu esse membro.' };
  if (kind === 'olho' && (hero.wounds || []).some((w) => w.id === 'orbita_aberta')) return { ok: false, reason: 'A órbita ainda está aberta. Espere fechar.' };
  if ((hero.wounds || []).some((w) => w.id === 'coto_aberto' && parts.includes(w.part))) return { ok: false, reason: 'O coto ainda está aberto. Cauterize ou espere fechar.' };
  return { ok: true, slot: 'protese', parts };
}

export function prostheticKey(part) { return part === 'olho' ? 'cabeca' : part; }

/** Encaixa uma prótese da mochila. Antiga volta para a mochila (se for item). */
export function fitProsthetic(hero, uid, part) {
  const f = findInst(hero, uid);
  if (!f) return { ok: false, reason: 'Item não está na mochila.' };
  const chk = canFitProsthetic(hero, f.inst);
  if (!chk.ok) return chk;
  const p = part && chk.parts.includes(part) ? part : (chk.parts.find((x) => !hero.prosthetics?.[prostheticKey(x)]) || chk.parts[0]);
  const key = prostheticKey(p);
  hero.prosthetics = hero.prosthetics || {};
  const old = hero.prosthetics[key];
  removeInst(hero, uid, 1);
  if (old) {
    const oldId = PROSTHETIC_ALIAS[old] || old;
    const back = makeItem(oldId);
    if (back) addItem(hero, back);
  }
  hero.prosthetics[key] = f.inst.id;
  return { ok: true, slot: key, part: p };
}

export const PROSTHETIC_ALIAS = { gancho: 'gancho_protese' };
export function prostheticDef(val) {
  if (!val) return null;
  return ITEMS[PROSTHETIC_ALIAS[val] || val] || null;
}

// ------------------------------------------------------------ usar
/** Pode usar fora de combate? */
export function canUseItem(G, inst) {
  const hero = G?.hero;
  const def = itemDef(inst);
  if (!hero || !def) return { ok: false, reason: 'Item inválido.' };
  if (def.type === 'tome') {
    if ((hero.techniques || []).includes(def.teaches)) return { ok: false, reason: 'Você já sabe isso.' };
    return { ok: true };
  }
  if (!def.use || !def.use.field) return { ok: false, reason: def.use?.combat ? 'Só em combate.' : 'Não se usa assim.' };
  if (G.combat && !G.combat.result) return { ok: false, reason: 'Em combate, use pela ação de Itens.' };
  if (def.use.cond && !checkCond(G, def.use.cond)) return { ok: false, reason: describeCond(def.use.cond) || 'Não agora.' };
  for (const e of def.use.effects || []) {
    if (e.op === 'treat' && !e.soft) {
      if (!bestWoundFor(hero, e.method) && e.method !== 'bandagem') return { ok: false, reason: TREAT_NONE[e.method] || 'Nenhuma ferida para isso.' };
    }
    if (e.op === 'cure') {
      if (e.what === 'infeccao' && !(hero.wounds || []).some((w) => w.infected)) return { ok: false, reason: 'Nenhuma ferida infeccionada.' };
      if (e.what === 'sangramento' && !(hero.wounds || []).some((w) => w.bleeding && !w.treated)) return { ok: false, reason: 'Nada sangrando.' };
      if (e.what === 'chaga' && !(hero.wounds || []).some((w) => WOUNDS[w.id]?.corrPerDay && !w.salted) && (hero.corruption || 0) <= 0) return { ok: false, reason: 'Nenhuma Chaga para salgar.' };
    }
    if (e.op === 'coat' && !hero.equip?.main) return { ok: false, reason: 'Sem arma para untar.' };
    if (e.op === 'woundDays' && !(hero.wounds || []).some((w) => w.days > 0)) return { ok: false, reason: 'Nenhuma ferida curando.' };
  }
  return { ok: true };
}
const TREAT_NONE = { tala: 'Nenhuma fratura para imobilizar.', ferro_quente: 'Nada para cauterizar.', unguento: 'Nada para untar.' };

/** Ferida mais urgente que aceita o método (sem tratamento ainda). */
export function bestWoundFor(hero, method) {
  const list = (hero.wounds || []).filter((w) => {
    const d = WOUNDS[w.id];
    if (!d || !d.treat.includes(method)) return false;
    if (method === 'bandagem') return !w.treated || w.bleeding;
    if (method === 'ferro_quente') return w.bleeding || w.infected || !w.treated;
    if (method === 'tala') return !(w.treatedBy || []).includes('tala');
    if (method === 'unguento') return !(w.treatedBy || []).includes('unguento');
    return !w.treated;
  });
  list.sort((a, b) => score(b) - score(a));
  return list[0] || null;
  function score(w) {
    const d = WOUNDS[w.id];
    return (w.infected ? 50 : 0) + (w.bleeding ? 20 + d.bleed * 5 : 0) + d.sev * 10;
  }
}

/** Usa um item da mochila fora de combate. */
export function useItem(G, uid, { inCombat = false } = {}) {
  const hero = G?.hero;
  const f = findInst(hero, uid);
  if (!f || f.where !== 'inv') return { ok: false, reason: 'Item não está na mochila.', lines: [], pending: [] };
  const inst = f.inst;
  const def = itemDef(inst);
  if (inCombat) return { ok: false, reason: 'Uso em combate é tratado pelo combate (def.use.combat).', lines: [], pending: [] };
  const chk = canUseItem(G, inst);
  if (!chk.ok) return { ok: false, reason: chk.reason, lines: [], pending: [] };
  if (def.type === 'tome') {
    const res = applyEffects(G, [{ op: 'learn', id: def.teaches }], { source: 'item', item: inst });
    removeInst(hero, uid, 1);
    return { ok: true, lines: res.lines, pending: res.pending };
  }
  const res = applyEffects(G, def.use.effects || [], { source: 'item', item: inst, itemId: def.id });
  removeInst(hero, uid, 1);
  markAddictionUse(G, def.id);
  return { ok: true, lines: [{ text: `Usou ${def.name}.`, kind: 'info' }, ...res.lines], pending: res.pending };
}

/** Marca consumo para vícios (traços com addiction.items). */
export function markAddictionUse(G, itemId) {
  const hero = G?.hero;
  if (!hero) return;
  const map = ADDICT_ITEMS[itemId];
  if (!map) return;
  hero.flags = hero.flags || {};
  for (const tid of map) {
    if (!(hero.traits || []).includes(tid)) continue;
    hero.flags[`lastUse_${tid}`] = G.time ?? 0;
    if (hero.flags[`craving_${tid}`]) delete hero.flags[`craving_${tid}`];
  }
}
const ADDICT_ITEMS = {};
for (const t of TRAIT_LIST) for (const it of t.addiction?.items || []) (ADDICT_ITEMS[it] = ADDICT_ITEMS[it] || []).push(t.id);

// ------------------------------------------------------------ durabilidade / valor
export function degrade(inst, n = 1) {
  if (!inst || inst.dur == null) return false;
  inst.dur = Math.max(0, inst.dur - n);
  return inst.dur === 0;
}

export function repair(inst) { if (inst && inst.dur != null) inst.dur = maxDur(inst); }

/** Valor-base em moedas (preço de compra antes de reputação). Venda: D decide (ex.: 40%). */
export function itemValue(inst) {
  const def = itemDef(inst);
  if (!def) return 0;
  let v = def.value || 0;
  if (['weapon', 'armor', 'offhand'].includes(def.type)) {
    v *= QUALITY[inst.q ?? 1].price;
    const md = maxDur(inst);
    if (md) v *= 0.5 + 0.5 * ((inst.dur ?? md) / md);
    if (inst.ench) v += 40;
  }
  return Math.max(0, Math.round(v * (inst.n || 1)));
}

export function repairCost(inst) {
  const def = itemDef(inst);
  const md = maxDur(inst);
  if (!def || !md || inst.dur == null || inst.dur >= md) return 0;
  const miss = 1 - inst.dur / md;
  return Math.max(1, Math.round(miss * (def.value || 10) * 0.35 * QUALITY[inst.q ?? 1].price + (inst.dur === 0 ? 5 : 0)));
}

// ------------------------------------------------------------ unção
export function canAnoint(inst, enchId) {
  const def = itemDef(inst);
  const e = ENCHANTS[enchId];
  if (!def || !e) return { ok: false, reason: 'Inválido.' };
  if (e.applies === 'weapon' && !(def.type === 'weapon' || (def.type === 'offhand' && def.kind === 'weapon'))) return { ok: false, reason: 'Só em armas.' };
  if (e.applies === 'armor' && !(def.type === 'armor' || (def.type === 'offhand' && def.kind === 'shield'))) return { ok: false, reason: 'Só em armaduras e escudos.' };
  if (inst.ench === enchId) return { ok: false, reason: 'Já tem essa unção.' };
  return { ok: true };
}
/** Aplica unção (custo cobrado por quem chama — ver ENCHANTS[id].cost). Retorna { ok, corruption } */
export function anoint(inst, enchId) {
  const c = canAnoint(inst, enchId);
  if (!c.ok) return c;
  inst.ench = enchId;
  return { ok: true, corruption: ENCHANTS[enchId].corrOnUse || 0 };
}

// ------------------------------------------------------------ texto
export const MOD_LABELS = {
  for: ['FOR', ''], des: ['DES', ''], vig: ['VIG', ''], von: ['VON', ''], ast: ['AST', ''],
  hpMax: ['Vida máx.', ''], hpMaxPct: ['Vida máx.', '%'], staminaMax: ['Fôlego máx.', ''], staminaRegen: ['Fôlego por turno', ''], carry: ['carga', ''],
  acc: ['precisão', ''], eva: ['esquiva', ''], crit: ['crítico', '%'], speed: ['velocidade', '%'],
  armor_all: ['armadura (tudo)', ''], armor_cabeca: ['armadura cabeça', ''], armor_tronco: ['armadura tronco', ''], armor_bracoD: ['armadura braço D', ''], armor_bracoE: ['armadura braço E', ''], armor_pernas: ['armadura pernas', ''],
  dmg_all: ['dano', '%'], dmg_corte: ['dano de corte', '%'], dmg_perf: ['dano de perfuração', '%'], dmg_impacto: ['dano de impacto', '%'], dmg_fogo: ['dano de fogo', '%'], dmg_icor: ['dano de Icor', '%'],
  sever: ['decepar', '%'], fracture: ['fraturar', '%'], bleed: ['sangramento causado', '%'],
  parry: ['aparar', ''], block: ['bloqueio', ''], riposte: ['contra-ataque', '%'], dodge: ['esquiva ativa', '%'], execute: ['execução', '%'],
  dreadResist: ['resist. Pavor', '%'], corrResist: ['resist. Corrupção', '%'], bleedResist: ['resist. sangramento', '%'], infectResist: ['resist. infecção', '%'], fireResist: ['resist. fogo', '%'], poisonResist: ['resist. veneno', '%'],
  dread_on_kill: ['Pavor ao matar', ''], dread_on_execute: ['Pavor ao executar', ''], hp_on_kill: ['Vida ao matar', ''], hp_on_execute: ['Vida ao executar', ''],
  regen: ['Vida por turno', ''], lifesteal: ['roubo de vida', '%'], first_strike: ['iniciativa', ''], intent: ['leitura de intenções', ''], unarmed: ['dano desarmado', '%'],
  night_acc: ['precisão à noite', ''], dark: ['visão no escuro', ''], light_eff: ['duração da tocha', '%'], food_eff: ['rendimento da ração', '%'],
  ambush: ['chance de emboscada', '%'], travel: ['velocidade de viagem', '%'], stealth: ['furtividade', ''], scout: ['nós revelados', ''],
  loot: ['saque', '%'], ichor_find: ['Icor encontrado', '%'], price: ['desconto', '%'], heal_rate: ['cura de feridas', '%'], camp_heal: ['cura no acampamento', '%'],
  check_for: ['testes de FOR', ''], check_des: ['testes de DES', ''], check_vig: ['testes de VIG', ''], check_von: ['testes de VON', ''], check_ast: ['testes de AST', ''],
  level_corr: ['Corrupção ao subir de nível', ''],
};
const NEG_GOOD = new Set(['dread_on_kill', 'dread_on_execute', 'ambush', 'level_corr']);

/** mods -> [{ text, good }] */
export function formatMods(mods = {}) {
  const out = [];
  for (const [k, v] of Object.entries(mods)) {
    if (!v) continue;
    const [label, unit] = MOD_LABELS[k] || [k, ''];
    const n = Math.round(v * 10) / 10;
    const s = n > 0 ? `+${n}` : `−${Math.abs(n)}`;
    out.push({ text: `${s}${unit} ${label}`, good: NEG_GOOD.has(k) ? v < 0 : v > 0 });
  }
  return out;
}
export const modsText = (mods) => formatMods(mods).map((m) => m.text).join(', ');

const ATTR_UP = { for: 'FOR', des: 'DES', vig: 'VIG', von: 'VON', ast: 'AST' };

/** Linhas de descrição para a folha do item. */
export function describeItem(inst) {
  const def = itemDef(inst);
  if (!def) return ['Item desconhecido.'];
  const L = [];
  const q = inst.q ?? 1;
  const qm = QUALITY[q].mult * (isBroken(inst) ? 0.5 : 1);
  if (def.type === 'weapon' || (def.type === 'offhand' && def.kind === 'weapon')) {
    const cls = CLASS_NAMES[def.cls] || def.cls;
    L.push(`${TYPE_NAMES[def.type]} · ${cls} · ${def.hands === 2 ? 'duas mãos' : 'uma mão'}${def.reach ? ` · alcance ${def.reach}` : ''}`);
    if (def.dmg) L.push(`Dano base ${Math.round(def.dmg[0] * qm)}–${Math.round(def.dmg[1] * qm)} ${DTYPE_NAMES[def.dtype] || def.dtype || ''}`);
    if (def.scale) L.push(`Escala: ${Object.entries(def.scale).map(([a, g]) => `${ATTR_UP[a]} ${g}`).join(', ')}`);
    if (def.time) L.push(`Tempo ${def.time} · Fôlego ${def.stam} · Crítico ${def.crit}%`);
    if (def.req) L.push(`Requer ${Object.entries(def.req).map(([a, v]) => `${ATTR_UP[a]} ${v}`).join(', ')} (sem isso: −15 precisão, +2 Fôlego)`);
  } else if (def.type === 'armor') {
    const a = def.armor;
    L.push(`Armadura · ${SLOT_NAMES[def.slot]} · ${['leve', 'média', 'pesada', 'muito pesada'][def.heavy] || 'leve'}`);
    L.push(`Proteção: corte ${Math.round(a.corte * qm)} · perf ${Math.round(a.perf * qm)} · impacto ${Math.round(a.impacto * qm)} · fogo ${Math.round(a.fogo * qm)}`);
    if (def.heavy) L.push(`Peso de armadura ${def.heavy}: −${def.heavy * 3} esquiva, menos Fôlego por turno`);
  } else if (def.type === 'offhand') {
    if (def.kind === 'shield') L.push(`Escudo · bloqueio ${Math.round(def.block * QUALITY[q].mult * (isBroken(inst) ? 0.5 : 1))}% · ${def.stamBlock} Fôlego por bloqueio`);
    if (def.kind === 'torch') L.push(`Luz na mão${def.dmg ? ` · golpe de fogo ${def.dmg[0]}–${def.dmg[1]}` : ''}`);
  } else if (def.type === 'consumable') {
    const where = [def.use?.field ? 'fora de combate' : null, def.use?.combat ? 'em combate' : null].filter(Boolean).join(' e ');
    L.push(`Consumível · usa-se ${where || 'em situações especiais'}`);
    if (def.use?.effects?.length) L.push(`Efeito: ${describeEffectsSafe(def.use.effects)}`);
    if (def.throw?.dmg) L.push(`Arremesso: ${def.throw.dmg[0]}–${def.throw.dmg[1]} ${DTYPE_NAMES[def.throw.dtype] || ''}${def.throw.area ? ' em área' : ''}`);
  } else if (def.type === 'trinket') {
    L.push(def.relic ? 'Relíquia do deus · equipada: +1 Corrupção por dia' : 'Amuleto');
  } else if (def.type === 'tome') {
    L.push(`Tomo · ensina uma técnica (${def.teaches})`);
  } else if (def.type === 'prosthetic' || def.prosthetic) {
    L.push(`Prótese · ${def.prosthetic === 'braco' ? 'braço' : def.prosthetic}`);
  } else {
    L.push(TYPE_NAMES[def.type] || def.type);
  }
  for (const p of def.props || []) if (PROPS[p]) L.push(PROPS[p]);
  const allMods = { ...(def.mods || {}), ...(inst.mods || {}) };
  if (Object.keys(allMods).length) L.push(modsText(allMods));
  if (inst.ench && ENCHANTS[inst.ench]) L.push(`✦ ${ENCHANTS[inst.ench].name}: ${ENCHANTS[inst.ench].desc}`);
  if (inst.coat) L.push(`Untada: ${inst.coat.kind} (${inst.coat.hits} golpes)`);
  const md = maxDur(inst);
  if (md) L.push(`Durabilidade ${inst.dur ?? md}/${md}${isBroken(inst) ? ' — QUEBRADO: metade do efeito' : ''}`);
  L.push(`Peso ${Math.round(weightOf(inst) * 10) / 10} · Valor ${itemValue(inst)} moedas${def.quest ? ' · item de missão' : ''}`);
  if (def.desc) L.push(def.desc);
  return L;
}

function describeEffectsSafe(effects) {
  try { return describeEffects(effects); } catch { return ''; }
}
