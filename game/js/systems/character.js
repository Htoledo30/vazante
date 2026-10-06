// ICOR — personagem (Área A): criação, derive(), nível, Pavor, Corrupção, mutações, dano/cura fora de combate.
// Puro (sem DOM). derive() é chamado o tempo todo: sem alocação pesada, sem RNG.
import { ITEMS, QUALITY, SCALE_COEF, ENCHANTS, UNARMED } from '../data/items.js';
import { BACKGROUNDS, BACKGROUND_LIST } from '../data/backgrounds.js';
import { TALENTS, TALENT_LIST } from '../data/talents.js';
import { MUTATIONS, MUTATION_LIST } from '../data/mutations.js';
import { TRAITS, HEIR_TRAITS, COLLAPSE_TRAITS } from '../data/traits.js';
import { WOUNDS } from '../data/wounds.js';
import { makeItem, addItem, equip, itemDef, totalWeight, isBroken, prostheticDef, unequip, EQUIP_SLOTS } from './items.js';
import { woundMods, woundFlags } from './wounds.js';
import { R } from '../core/rng.js';
import { getG } from '../core/state.js';
import { uid, clamp } from '../core/util.js';
import { randomName } from './names.js';
import * as flow from './flow.js';
import { applyEffects } from './effects.js';

export const ATTRS = ['for', 'des', 'vig', 'von', 'ast'];
export const ATTR_NAMES = { for: 'Força', des: 'Destreza', vig: 'Vigor', von: 'Vontade', ast: 'Astúcia' };
export const ATTR_SHORT = { for: 'FOR', des: 'DES', vig: 'VIG', von: 'VON', ast: 'AST' };
export const ATTR_DESC = {
  for: 'Dano de armas pesadas, carga, quebrar e empurrar.',
  des: 'Precisão, esquiva, armas leves, velocidade.',
  vig: 'Vida, Fôlego, resistir a sangramento, infecção e fome.',
  von: 'Resistir ao Pavor e à Corrupção, ritos, intimidar.',
  ast: 'Ler intenções, achar armadilhas e saque, negociar.',
};
export const CREATE_POINTS = 4;
export const CREATE_MAX = 6;
export const ATTR_MAX = 10;
export const LEVEL_MAX = 20;

// ============================================================ criação
/** attrs = atributos FINAIS (3 base + origem + pontos). Equipa o kit da origem, Vida cheia. */
export function createHero({ name, bg, attrs, gen = 1, traits = [], sex } = {}) {
  const B = BACKGROUNDS[bg] || BACKGROUND_LIST[0];
  const a = {};
  for (const k of ATTRS) a[k] = clamp(Math.round(attrs?.[k] ?? (3 + (B.attrs[k] || 0))), 1, ATTR_MAX);
  const hero = {
    uid: uid('h'), name: name || 'Sem Nome', gen, bg: B.id, sex: sex || B.sex || 'm',
    attrs: a, level: 1, ichorDrunk: 0,
    talents: [], traits: [...new Set([B.trait, ...traits].filter((t) => TRAITS[t]))], mutations: [],
    hp: 1, dread: 0, corruption: B.startCorruption || 0,
    wounds: [], prosthetics: { bracoD: null, bracoE: null, pernas: null, cabeca: null },
    mastery: { ...(B.mastery || {}) }, techniques: [],
    equip: { main: null, off: null, cabeca: null, tronco: null, bracos: null, pernas: null, amuleto1: null, amuleto2: null },
    inv: [], coin: B.kit.coin || 0, ichor: B.kit.ichor || 0, companion: null, hunger: 0,
    stats: { kills: 0, executions: 0, severed: 0, expeditions: 0, daysAlive: 0 },
    flags: { corrTier: Math.floor((B.startCorruption || 0) / 25) },
    mutationPending: 0,
  };
  for (const [id, q] of B.kit.equip || []) {
    const it = makeItem(id, { q });
    if (!it) continue;
    addItem(hero, it);
    const r = equip(hero, it.uid);
    if (!r.ok) { /* fica na mochila */ }
  }
  for (const [id, n, q] of B.kit.inv || []) { const it = makeItem(id, { n, q: q ?? 1 }); if (it) addItem(hero, it); }
  hero.hp = derive(hero).hpMax;
  return hero;
}

/** Aplica efeitos de origem no mundo (reputação etc.) uma única vez. Chame após G.hero = createHero(...). */
export function initHeroInWorld(G) {
  const hero = G?.hero;
  if (!hero || hero.flags?.worldInit) return [];
  hero.flags.worldInit = true;
  const now = G.time ?? 0;
  for (const t of hero.traits) if (TRAITS[t]?.addiction) hero.flags[`lastUse_${t}`] = now;
  const B = BACKGROUNDS[hero.bg];
  if (!B?.onCreate?.length) return [];
  return applyEffects(G, B.onCreate, { source: 'origin' }).lines;
}

/** Candidato a herdeiro (D usa). */
export function rollHeir(G, rng = R) {
  const B = rng.pick(BACKGROUND_LIST);
  const attrs = {};
  for (const k of ATTRS) attrs[k] = 3 + (B.attrs[k] || 0);
  let pts = CREATE_POINTS;
  let guard = 50;
  while (pts > 0 && guard-- > 0) {
    const k = rng.pick(ATTRS);
    if (attrs[k] < CREATE_MAX) { attrs[k]++; pts--; }
  }
  const traits = [];
  const nT = rng.weighted([[0, 3], [1, 5], [2, 2]]);
  const pool = HEIR_TRAITS.slice();
  for (let i = 0; i < nT && pool.length; i++) {
    const t = pool.splice(Math.floor(rng.float() * pool.length), 1)[0];
    // juramentos e vícios não se acumulam em excesso
    if (TRAITS[t]?.kind === 'juramento' && traits.some((x) => TRAITS[x]?.kind === 'juramento')) continue;
    traits.push(t);
  }
  if ((G?.lineage?.dead?.length || 0) > 0 && rng.chance(25) && !traits.includes('memoria_morto')) traits.push('memoria_morto');
  const sex = B.sex === 'f' ? (rng.chance(80) ? 'f' : 'm') : (rng.chance(80) ? 'm' : 'f');
  const gen = (G?.lineage?.generation || 1) + 1;
  return { name: randomName(rng, sex), bg: B.id, attrs, traits, sex, gen };
}

// ============================================================ derive
const PART_LIST = ['cabeca', 'tronco', 'bracoD', 'bracoE', 'pernas'];
const SLOT_PARTS = { cabeca: ['cabeca'], tronco: ['tronco'], bracos: ['bracoD', 'bracoE'], pernas: ['pernas'] };

function addMods(dst, src, mult = 1) {
  if (!src) return;
  for (const k in src) dst[k] = (dst[k] || 0) + src[k] * mult;
}

function evalWhen(w, c) {
  if (!w) return true;
  if (w.twoHand && !c.twoHand) return false;
  if (w.shield && !c.shield) return false;
  if (w.ranged && !c.ranged) return false;
  if (w.noOffhand && c.offKind !== 'none') return false;
  if (w.unarmed && !c.unarmed) return false;
  if (w.torch && c.offKind !== 'torch') return false;
  if (w.cls && !w.cls.includes(c.cls)) return false;
  if (w.maxHeavy != null && c.heavy > w.maxHeavy) return false;
  if (w.dreadMin != null && c.dread < w.dreadMin) return false;
  if (w.corrMin != null && c.corr < w.corrMin) return false;
  if (w.region && c.region !== w.region) return false;
  if (w.hpBelow != null) return false; // só em combate (B)
  return true;
}

function weaponDamage(def, inst, attrs, extraMult = 1) {
  const q = QUALITY[inst?.q ?? 1] || QUALITY[1];
  const broken = inst && isBroken(inst) ? 0.5 : 1;
  let bonus = 0;
  for (const a in def.scale || {}) bonus += (attrs[a] || 0) * (SCALE_COEF[def.scale[a]] || 0);
  const m = q.mult * broken * extraMult;
  return [Math.max(1, Math.round(def.dmg[0] * m + bonus)), Math.max(1, Math.round(def.dmg[1] * m + bonus))];
}

/** Derivados do herói. Ver contrato em ARCHITECTURE.md (Área A). */
export function derive(hero) {
  const mods = {};
  const tags = new Set();
  const G = getG();
  const eq = hero.equip || {};
  const traits = hero.traits || [];
  const talents = hero.talents || [];
  const muts = hero.mutations || [];

  // ---- flags estruturais (feridas + mutações)
  const wf = woundFlags(hero);
  const flags = new Set(wf.flags);
  const lost = new Set(wf.lost);
  for (const id of muts) { const m = MUTATIONS[id]; if (m) { for (const f of m.flags) flags.add(f); for (const t of m.tags) tags.add(t); } }
  for (const id of talents) { const t = TALENTS[id]; if (t) for (const x of t.tags) tags.add(x); }
  for (const id of traits) { const t = TRAITS[id]; if (t) for (const x of t.tags) tags.add(x); }

  const pr = hero.prosthetics || {};
  const hookD = lost.has('bracoD') ? prostheticDef(pr.bracoD) : null;
  const hookE = lost.has('bracoE') ? prostheticDef(pr.bracoE) : null;
  const armD = !lost.has('bracoD');
  const armE = !lost.has('bracoE');
  const canTwoHand = armD && (armE || !!hookE) && !flags.has('noTwoHand');
  const canShield = (armE && !flags.has('noShield')) || flags.has('shieldAlways');
  const canFlee = !flags.has('noFlee') && (!lost.has('pernas') || !!pr.pernas);
  const ambi = tags.has('ambidestro');

  // ---- arma
  let wInst = null; let wDef = UNARMED; let badHand = false; let unusable = null;
  const mainInst = eq.main; const mainDef = mainInst ? itemDef(mainInst) : null;
  if (mainDef) {
    if (mainDef.hands === 2 && !canTwoHand) unusable = 'Precisa das duas mãos.';
    else if (mainDef.ranged && flags.has('noRanged')) unusable = 'Não consegue armar.';
    else if (armD) { wInst = mainInst; wDef = mainDef; }
    else if (armE && mainDef.hands === 1) { wInst = mainInst; wDef = mainDef; badHand = !ambi; }
    else unusable = 'Sem mão para empunhar.';
  }
  if (!wInst) {
    const hook = hookD || hookE;
    if (hook) { wDef = hook; wInst = null; } else { wDef = UNARMED; }
    if (unusable) tags.add('arma_inutil');
  }
  const twoHandUse = wDef.hands === 2;
  // ---- mão secundária
  let oInst = null; let oDef = null; let offKind = 'none';
  const offRaw = eq.off; const offRawDef = offRaw ? itemDef(offRaw) : null;
  const leftBusy = badHand || twoHandUse;
  if (offRawDef && !leftBusy) {
    const k = offRawDef.type === 'weapon' ? 'weapon' : offRawDef.kind;
    let ok = false;
    if (k === 'shield') ok = canShield;
    else if (k === 'torch') ok = armE || !!hookE;
    else ok = armE;
    if (ok) { oInst = offRaw; oDef = offRawDef; offKind = k; }
  }
  if (!oDef && !leftBusy && hookE && wDef !== hookE) { oDef = hookE; offKind = 'weapon'; }
  if (!oDef && badHand && hookD) { oDef = hookD; offKind = 'weapon'; }

  // ---- peso de armadura
  let heavy = 0;
  for (const s of ['cabeca', 'tronco', 'bracos', 'pernas']) { const d = eq[s] ? itemDef(eq[s]) : null; if (d) heavy += d.heavy || 0; }
  if (oDef?.heavy) heavy += oDef.heavy;
  const heavyEff = tags.has('heavy_half') ? Math.floor(heavy / 2) : heavy;

  const ctx = {
    twoHand: twoHandUse, shield: offKind === 'shield', ranged: !!wDef.ranged, offKind, cls: wDef.cls,
    unarmed: wDef.cls === 'desarmado', heavy, dread: hero.dread || 0, corr: hero.corruption || 0,
    region: G?.expedition?.region || null,
  };

  // ---- mods de equipamento
  if (wDef.mods) addMods(mods, wDef.mods);
  if (wInst?.mods) addMods(mods, wInst.mods);
  if (wInst?.ench && ENCHANTS[wInst.ench]) { addMods(mods, ENCHANTS[wInst.ench].mods); for (const t of ENCHANTS[wInst.ench].tags || []) tags.add(t); }
  if (oDef?.mods) addMods(mods, oDef.mods);
  if (oInst?.mods) addMods(mods, oInst.mods);
  for (const s of ['cabeca', 'tronco', 'bracos', 'pernas', 'amuleto1', 'amuleto2']) {
    const inst = eq[s]; if (!inst) continue;
    const d = itemDef(inst); if (!d) continue;
    if (d.mods) addMods(mods, d.mods, isBroken(inst) ? 0.5 : 1);
    if (inst.mods) addMods(mods, inst.mods);
    if (d.tags) for (const t of d.tags) tags.add(t);
    if (inst.ench && ENCHANTS[inst.ench]) addMods(mods, ENCHANTS[inst.ench].mods);
  }
  // ---- traços
  for (const id of traits) {
    const t = TRAITS[id]; if (!t) continue;
    addMods(mods, t.mods);
    if (t.when && t.whenMods && evalWhen(t.when, ctx)) addMods(mods, t.whenMods);
    if (t.addiction && hero.flags?.[`craving_${id}`]) { addMods(mods, t.addiction.craving); tags.add('fissura'); }
  }
  // ---- talentos
  let halve = false;
  for (const id of talents) {
    const t = TALENTS[id]; if (!t) continue;
    addMods(mods, t.mods);
    if (t.when && t.whenMods && evalWhen(t.when, ctx)) addMods(mods, t.whenMods);
    if (t.special?.halveWoundPenalty) halve = true;
    if (t.special?.perMutation) addMods(mods, t.special.perMutation, muts.length);
    if (t.special?.perPermWound) addMods(mods, t.special.perPermWound, lost.size);
  }
  // ---- mutações
  for (const id of muts) addMods(mods, MUTATIONS[id]?.mods);
  // ---- feridas
  const wm = woundMods(hero);
  const woundMult = tags.has('ignore_pain') ? 0 : halve ? 0.5 : 1;
  for (const k in wm) { const v = wm[k]; mods[k] = (mods[k] || 0) + (v < 0 ? v * woundMult : v); }
  // ---- membros perdidos e próteses
  if (lost.has('pernas')) {
    const pd = pr.pernas ? prostheticDef(pr.pernas) : null;
    if (!pd) addMods(mods, { eva: -25, speed: -20, travel: -60 });
    else if (pd.id === 'perna_ferro') addMods(mods, { eva: -6, speed: -5, travel: -15, armor_pernas: 3 });
    else addMods(mods, { eva: -10, speed: -10, travel: -30 });
  }
  if (lost.has('olho') && pr.cabeca) {
    const od = prostheticDef(pr.cabeca);
    if (od?.id === 'olho_icor') addMods(mods, { intent: 2, acc: 4, corrResist: -10 });
    else addMods(mods, { check_von: 5 });
  }
  if (badHand) addMods(mods, { acc: -15, parry: -20 });
  // ---- requisito da arma
  const baseAttrs = hero.attrs || {};
  const attrs = {};
  for (const a of ATTRS) attrs[a] = clamp(Math.round((baseAttrs[a] || 1) + (mods[a] || 0)), 1, 12);
  let reqFail = false;
  if (wDef.req) for (const a in wDef.req) if (attrs[a] < wDef.req[a]) reqFail = true;
  if (reqFail) { addMods(mods, { acc: -15 }); tags.add('req_falha'); }

  // ---- fome / pavor / corrupção
  const hunger = hero.hunger || 0;
  let hungerPen = 0;
  if (hunger > 48) { hungerPen = 2; addMods(mods, { acc: -10, staminaMax: -2, staminaRegen: -1, hpMaxPct: -10 }); tags.add('esfomeado'); }
  else if (hunger > 24) { hungerPen = 1; addMods(mods, { acc: -5, staminaMax: -1 }); tags.add('faminto'); }
  const dread = hero.dread || 0;
  if (dread >= 75) { mods.acc = (mods.acc || 0) - 10; tags.add('aterrorizado'); }
  else if (dread >= 50) { mods.acc = (mods.acc || 0) - 5; tags.add('abalado'); }
  if ((hero.corruption || 0) >= 50) tags.add('corrompido');
  if (hero.corruption >= 75) tags.add('quase_perdido');

  // ---- recursos
  const level = hero.level || 1;
  const hpMax = Math.max(10, Math.round((36 + attrs.vig * 7 + level * 4 + (mods.hpMax || 0)) * (1 + (mods.hpMaxPct || 0) / 100)));
  const load = totalWeight(hero);
  const carryMax = Math.max(10, Math.round(20 + attrs.for * 4 + (mods.carry || 0)));
  const overloaded = load > carryMax;
  if (overloaded) tags.add('sobrecarregado');
  const mula = tags.has('mula');
  const staminaMax = Math.max(2, Math.round(6 + attrs.vig + (mods.staminaMax || 0) - (overloaded && !mula ? 2 : 0)));
  const staminaRegen = Math.max(1, Math.round(3 + (mods.staminaRegen || 0) - Math.floor(heavyEff / 2) - (overloaded && !mula ? 1 : 0)));
  const acc = Math.round(60 + attrs.des * 3 + (mods.acc || 0));
  const eva = Math.round(5 + attrs.des * 2 + (mods.eva || 0) - heavyEff * 3 - (overloaded ? 10 : 0));
  const speed = Math.round((mods.speed || 0) + (attrs.des - 5) * 2 - heavyEff * 2 - (overloaded ? 10 : 0));

  // ---- armadura por parte
  const armor = {};
  const aAll = mods.armor_all || 0;
  for (const p of PART_LIST) {
    const extra = aAll + (mods[`armor_${p}`] || 0);
    armor[p] = { corte: extra, perf: extra, impacto: extra, fogo: Math.round(extra / 2) };
  }
  for (const s in SLOT_PARTS) {
    const inst = eq[s]; if (!inst) continue;
    const d = itemDef(inst); if (!d?.armor) continue;
    const m = (QUALITY[inst.q ?? 1]?.mult || 1) * (isBroken(inst) ? 0.5 : 1);
    const en = inst.ench ? ENCHANTS[inst.ench] : null;
    for (const p of SLOT_PARTS[s]) {
      const A = armor[p];
      A.corte += d.armor.corte * m + (en?.armorBonus || 0);
      A.perf += d.armor.perf * m + (en?.armorBonus || 0);
      A.impacto += d.armor.impacto * m + (en?.armorBonus || 0);
      A.fogo += d.armor.fogo * m + (en?.armorBonus || 0) + (en?.armorFire || 0);
    }
  }
  for (const p of PART_LIST) for (const k in armor[p]) armor[p][k] = Math.max(0, Math.round(armor[p][k]));

  // ---- arma final
  let wMult = 1;
  if (wDef.props?.includes('versatil') && offKind === 'none' && canTwoHand && !badHand) { wMult = 1.2; tags.add('versatil_2maos'); }
  const weapon = {
    inst: wInst, def: wDef, cls: wDef.cls, hands: wDef.hands, dmg: weaponDamage(wDef, wInst, attrs, wMult), dtype: wDef.dtype,
    time: wDef.time, stam: (wDef.stam || 1) + (reqFail ? 2 : 0), reach: wDef.reach || 0, ranged: !!wDef.ranged, crit: wDef.crit || 0,
    props: wDef.props || [], ench: wInst?.ench || null, extraDmg: wInst?.ench ? ENCHANTS[wInst.ench]?.extraDmg || null : null,
    coat: wInst?.coat || null, badHand, reqFail, unusable, prosthetic: !!wDef.prosthetic,
  };
  const offhand = {
    inst: oInst, def: oDef, kind: offKind,
    block: offKind === 'shield' ? Math.round((oDef.block || 0) * (QUALITY[oInst?.q ?? 1]?.mult || 1) * (oInst && isBroken(oInst) ? 0.5 : 1)) : 0,
    stamBlock: offKind === 'shield' ? (oDef.stamBlock || 2) : 0,
    light: !!oDef?.light,
    dmg: oDef?.dmg ? weaponDamage(oDef, oInst, attrs) : null, dtype: oDef?.dtype || null, props: oDef?.props || [],
  };

  const intentBase = attrs.ast >= 7 ? 2 : attrs.ast >= 4 ? 1 : 0;
  const dreadPenCheck = dread >= 75 ? 10 : 0;
  const checkBonus = {};
  for (const a of ATTRS) checkBonus[a] = (mods[`check_${a}`] || 0) - (hungerPen === 2 ? 5 : 0) - (a === 'von' ? dreadPenCheck : 0);

  return {
    attrs, hpMax, staminaMax, staminaRegen, carryMax, load, overloaded,
    acc, eva, crit: weapon.crit + (mods.crit || 0) + Math.floor(attrs.ast / 3), speed, armor,
    dreadResist: clamp(Math.round(attrs.von * 4 + (mods.dreadResist || 0)), -50, 85),
    corrResist: clamp(Math.round(attrs.von * 3 + (mods.corrResist || 0)), -50, 75),
    bleedResist: clamp(Math.round(attrs.vig * 3 + (mods.bleedResist || 0)), -50, 90),
    infectResist: clamp(Math.round(attrs.vig * 3 + (mods.infectResist || 0)), -50, 90),
    fireResist: clamp(Math.round(mods.fireResist || 0), -50, 80),
    poisonResist: clamp(Math.round(attrs.vig * 2 + (mods.poisonResist || 0)), -50, 90),
    checkBonus, intentDetail: clamp(intentBase + (mods.intent || 0), 0, 2),
    canTwoHand, canShield, canFlee, lostParts: [...lost],
    heavy, weapon, offhand, mods, tags: [...tags],
  };
}

// ============================================================ nível
export function levelUpCost(hero) {
  const D = derive(hero);
  const base = 6 + (D.mods.level_corr || 0);
  const corruption = Math.max(1, Math.round(base * (1 - D.corrResist / 100)));
  return { ichor: (hero.level || 1) + 1, corruption };
}
export function canLevelUp(hero) {
  if (!hero || (hero.level || 1) >= LEVEL_MAX) return false;
  return (hero.ichor || 0) >= levelUpCost(hero).ichor;
}
export function levelUpBlocker(hero) {
  if (!hero) return 'Sem herói.';
  if (hero.level >= LEVEL_MAX) return 'Nível máximo.';
  const c = levelUpCost(hero);
  if ((hero.ichor || 0) < c.ichor) return `Precisa de ${c.ichor} frascos de Icor (tem ${hero.ichor || 0}).`;
  return null;
}

/** Talentos elegíveis (pré-requisitos cumpridos e ainda não possuídos). */
export function eligibleTalents(hero) {
  const attrs = hero.attrs || {};
  return TALENT_LIST.filter((t) => {
    if ((hero.talents || []).includes(t.id)) return false;
    const r = t.req || {};
    for (const a of ATTRS) if (r[a] && (attrs[a] || 0) < r[a]) return false;
    if (r.level && (hero.level || 1) < r.level) return false;
    if (r.talents && !r.talents.every((x) => hero.talents.includes(x))) return false;
    return true;
  });
}

/** 3 dádivas aleatórias, preferindo estilos que o herói já segue e talentos que destravam cadeias. */
export function talentChoices(hero, rng = R) {
  const pool = eligibleTalents(hero);
  const styles = new Set((hero.talents || []).map((id) => TALENTS[id]?.style));
  const picks = [];
  const usedStyles = new Set();
  let list = pool.map((t) => [t, (styles.has(t.style) ? 2 : 1) + ((t.req?.talents?.length) ? 1.5 : 0)]);
  while (picks.length < 3 && list.length) {
    const t = rng.weighted(list.map(([x, w]) => [x, usedStyles.has(x.style) ? w * 0.35 : w]));
    picks.push(t.id);
    usedStyles.add(t.style);
    list = list.filter(([x]) => x.id !== t.id);
  }
  return picks;
}

/** Oferta persistida (não re-rola ao reabrir a tela). */
export function ensureLevelOffer(hero, rng = R) {
  if (!hero.levelOffer || hero.levelOffer.level !== hero.level || !hero.levelOffer.talents?.length) {
    hero.levelOffer = { level: hero.level, talents: talentChoices(hero, rng) };
  }
  return hero.levelOffer;
}

/** Bebe Icor e sobe de nível. Retorna lines [{text, kind}]. */
export function levelUp(hero, attr, talentId) {
  const lines = [];
  const G = getG();
  if (!canLevelUp(hero)) return [{ text: levelUpBlocker(hero) || 'Não pode subir de nível.', kind: 'bad' }];
  if (!ATTRS.includes(attr)) return [{ text: 'Atributo inválido.', kind: 'bad' }];
  const cost = levelUpCost(hero);
  const before = derive(hero).hpMax;
  hero.ichor -= cost.ichor;
  hero.ichorDrunk = (hero.ichorDrunk || 0) + cost.ichor;
  hero.level = (hero.level || 1) + 1;
  lines.push({ text: `Você bebe ${cost.ichor} frascos de Icor. Nível ${hero.level}.`, kind: 'good' });
  if ((hero.attrs[attr] || 0) < ATTR_MAX) { hero.attrs[attr]++; lines.push({ text: `${ATTR_NAMES[attr]} ${hero.attrs[attr]}.`, kind: 'good' }); }
  else lines.push({ text: `${ATTR_NAMES[attr]} já está no máximo.`, kind: 'warn' });
  if (talentId && TALENTS[talentId] && !hero.talents.includes(talentId)) {
    hero.talents.push(talentId);
    lines.push({ text: `Dádiva: ${TALENTS[talentId].name}.`, kind: 'good' });
  }
  hero.levelOffer = null;
  // juramentos quebrados
  for (const tid of [...hero.traits]) {
    const t = TRAITS[tid];
    if (t?.tags.includes('oath_noichor')) {
      hero.traits = hero.traits.filter((x) => x !== tid);
      if (t.breaksInto && !hero.traits.includes(t.breaksInto)) hero.traits.push(t.breaksInto);
      lines.push({ text: `Você quebrou o ${t.name}. Agora é ${TRAITS[t.breaksInto]?.name || 'perjuro'}.`, kind: 'bad' });
    }
  }
  const after = derive(hero).hpMax;
  hero.hp = Math.min(after, (hero.hp || 0) + Math.max(0, after - before) + Math.round(after * 0.25));
  if (G && G.hero === hero) {
    const r = addCorruption(G, cost.corruption, 'Icor bebido', { raw: true });
    lines.push(...r.lines);
  } else {
    hero.corruption = clamp((hero.corruption || 0) + cost.corruption, 0, 100);
    lines.push({ text: `+${cost.corruption} Corrupção.`, kind: 'bad' });
    checkCorrMilestones(hero, lines);
  }
  return lines;
}

// ============================================================ Pavor
const COLLAPSE_OUTCOMES = [
  { id: 'trait', w: 40 }, { id: 'drop', w: 25 }, { id: 'selfharm', w: 20 }, { id: 'pray', w: 15 },
];

export function addDread(G, n, why = '') {
  const hero = G?.hero;
  const out = { lines: [], collapse: false, delta: 0 };
  if (!hero || !n) return out;
  let d = n;
  if (n > 0) {
    const D = derive(hero);
    d = Math.round(n * (1 - D.dreadResist / 100));
    if (D.tags.includes('fissura')) d += 2;
  }
  const before = hero.dread || 0;
  hero.dread = clamp(before + d, 0, 100);
  out.delta = hero.dread - before;
  if (out.delta === 0) return out;
  const w = why ? ` (${why})` : '';
  out.lines.push({ text: `${out.delta > 0 ? '+' : ''}${out.delta} Pavor${w}.`, kind: out.delta > 0 ? 'bad' : 'good' });
  if (before < 50 && hero.dread >= 50 && hero.dread < 75) out.lines.push({ text: 'Abalado: as mãos não obedecem direito.', kind: 'warn' });
  if (before < 75 && hero.dread >= 75 && hero.dread < 100) out.lines.push({ text: 'Aterrorizado: a mente quer fugir.', kind: 'bad' });
  if (hero.dread >= 100) {
    out.collapse = true;
    if (G.combat && !G.combat.result) {
      out.lines.push({ text: 'COLAPSO.', kind: 'bad' });
    } else {
      out.lines.push(...collapseOutOfCombat(G));
    }
  }
  return out;
}

function collapseOutOfCombat(G) {
  const hero = G.hero;
  const lines = [{ text: 'COLAPSO. Algo se parte dentro de você.', kind: 'bad' }];
  const kind = R.weighted(COLLAPSE_OUTCOMES.map((o) => [o.id, o.w]));
  if (kind === 'trait') {
    const pool = COLLAPSE_TRAITS.filter((t) => !hero.traits.includes(t));
    if (pool.length) {
      const t = R.pick(pool);
      hero.traits.push(t);
      lines.push({ text: `Você chora até a voz sumir. Ganhou: ${TRAITS[t].name}.`, kind: 'bad' });
    } else lines.push({ text: 'Você grita até a garganta sangrar.', kind: 'bad' });
  } else if (kind === 'drop') {
    const cand = hero.inv.filter((x) => !itemDef(x)?.quest);
    const lostN = Math.min(cand.length, R.int(1, 2));
    const names = [];
    for (let i = 0; i < lostN; i++) {
      const it = R.pick(cand.filter((x) => hero.inv.includes(x)));
      if (!it) break;
      hero.inv.splice(hero.inv.indexOf(it), 1);
      names.push(itemDef(it)?.name || it.id);
    }
    lines.push({ text: names.length ? `Você corre às cegas e larga: ${names.join(', ')}.` : 'Você corre às cegas até cair.', kind: 'bad' });
  } else if (kind === 'selfharm') {
    const r = damageHero(G, 8, 'colapso');
    lines.push({ text: 'Você arranha o próprio rosto até ver osso. −8 Vida.', kind: 'bad' });
    if (r.died) lines.push({ text: 'E não para mais.', kind: 'bad' });
  } else {
    hero.corruption = clamp((hero.corruption || 0) + 5, 0, 100);
    lines.push({ text: 'Você reza para o deus morto. Ele responde. +5 Corrupção.', kind: 'bad' });
    checkCorrMilestones(hero, lines);
  }
  hero.dread = 70;
  return lines;
}

// ============================================================ Corrupção
function checkCorrMilestones(hero, lines) {
  hero.flags = hero.flags || {};
  const tier = Math.min(3, Math.floor((hero.corruption || 0) / 25));
  let pend = false;
  while ((hero.flags.corrTier || 0) < tier) {
    hero.flags.corrTier = (hero.flags.corrTier || 0) + 1;
    hero.mutationPending = (hero.mutationPending || 0) + 1;
    pend = true;
    lines.push({ text: `Corrupção ${hero.flags.corrTier * 25}: a carne muda. Escolha uma mutação.`, kind: 'warn' });
  }
  return pend;
}

export function addCorruption(G, n, why = '', { raw = false } = {}) {
  const hero = G?.hero;
  const out = { lines: [], mutationPending: false, transformed: false, delta: 0 };
  if (!hero || !n || hero.flags?.dead) return out;
  let d = n;
  if (n > 0 && !raw) {
    const D = derive(hero);
    d = Math.max(1, Math.round(n * (1 - D.corrResist / 100)));
  }
  const before = hero.corruption || 0;
  hero.corruption = clamp(before + d, 0, 100);
  out.delta = hero.corruption - before;
  if (!out.delta) return out;
  const w = why ? ` (${why})` : '';
  out.lines.push({ text: `${out.delta > 0 ? '+' : ''}${out.delta} Corrupção${w}.`, kind: out.delta > 0 ? 'bad' : 'good' });
  out.mutationPending = checkCorrMilestones(hero, out.lines) || (hero.mutationPending || 0) > 0;
  if (hero.corruption >= 100) {
    out.transformed = true;
    hero.flags.dead = true;
    hero.flags.corrupted = true;
    hero.flags.deathCause = 'Transformação';
    out.lines.push({ text: 'Seu corpo se abre como uma flor dourada. Não é mais você.', kind: 'bad' });
    const info = { corrupted: true, region: G.expedition?.region || null, nodeId: G.expedition?.node || null };
    defer(() => flow.heroDied('Transformação', info));
  }
  return out;
}

function defer(fn) {
  if (typeof queueMicrotask === 'function') queueMicrotask(fn); else Promise.resolve().then(fn);
}

// ============================================================ mutações
export function mutationChoices(hero, rng = R) {
  const pool = MUTATION_LIST.filter((m) => !(hero.mutations || []).includes(m.id) && (m.minCorr || 0) <= (hero.corruption || 0));
  const out = [];
  const list = pool.slice();
  while (out.length < 2 && list.length) out.push(list.splice(Math.floor(rng.float() * list.length), 1)[0].id);
  return out;
}

export function ensureMutationOffer(hero, rng = R) {
  if ((hero.mutationPending || 0) <= 0) return null;
  if (!hero.mutationOffer?.length) hero.mutationOffer = mutationChoices(hero, rng);
  return hero.mutationOffer;
}

export function applyMutation(hero, id) {
  const m = MUTATIONS[id];
  const lines = [];
  if (!m) return [{ text: 'Mutação desconhecida.', kind: 'bad' }];
  if (!hero.mutations.includes(id)) hero.mutations.push(id);
  hero.mutationPending = Math.max(0, (hero.mutationPending || 0) - 1);
  hero.mutationOffer = null;
  lines.push({ text: `${m.name}. ${m.look}`, kind: 'warn' });
  // equipamento incompatível sai do corpo
  const eq = hero.equip;
  const drop = (slot, why) => { if (eq[slot]) { const r = unequip(hero, slot, { force: true }); if (r.ok) lines.push({ text: `${itemDef(r.inst)?.name} cai: ${why}`, kind: 'warn' }); } };
  if (m.flags.includes('noShield') && eq.off && itemDef(eq.off)?.kind === 'shield') drop('off', 'o braço não segura mais.');
  if (m.flags.includes('noHelm') && eq.cabeca && (itemDef(eq.cabeca)?.heavy || 0) >= 1) drop('cabeca', 'não cabe mais na cabeça.');
  if (m.flags.includes('noHeavyTronco') && eq.tronco && (itemDef(eq.tronco)?.heavy || 0) >= 2) drop('tronco', 'as costas não cabem.');
  if (m.flags.includes('noTwoHand') && eq.main && itemDef(eq.main)?.hands === 2) drop('main', 'as mãos não fecham juntas.');
  if (m.flags.includes('noRanged') && eq.main && itemDef(eq.main)?.ranged) drop('main', 'as garras não armam a besta.');
  const D = derive(hero);
  hero.hp = Math.min(hero.hp, D.hpMax);
  return lines;
}

// ============================================================ Vida fora de combate
export function heal(hero, n) {
  if (!hero || n <= 0) return 0;
  const max = derive(hero).hpMax;
  const before = hero.hp || 0;
  hero.hp = Math.min(max, before + Math.round(n));
  return hero.hp - before;
}

/** Dano fora de combate. Não chama flow: quem chama decide (effects devolve pending death). */
export function damageHero(G, n, why = '') {
  const hero = G?.hero;
  if (!hero || n <= 0) return { died: false, dealt: 0 };
  const before = hero.hp || 0;
  hero.hp = Math.max(0, before - Math.round(n));
  const died = hero.hp <= 0;
  if (died) { hero.flags = hero.flags || {}; hero.flags.deathCause = why || 'Ferimentos'; }
  return { died, dealt: before - hero.hp };
}

// ============================================================ utilidades de exibição
export function heroTitle(hero) {
  const B = BACKGROUNDS[hero.bg];
  return `${hero.name} · ${B?.name || ''} · nível ${hero.level}`;
}

/** Estado curto do herói para HUD/ficha. */
export function heroStatus(hero) {
  const D = derive(hero);
  const st = [];
  if (hero.dread >= 75) st.push(['Aterrorizado', 'bad']); else if (hero.dread >= 50) st.push(['Abalado', 'warn']);
  if (hero.hunger > 48) st.push(['Esfomeado', 'bad']); else if (hero.hunger > 24) st.push(['Faminto', 'warn']);
  if (D.overloaded) st.push(['Sobrecarregado', 'warn']);
  if ((hero.wounds || []).some((w) => w.infected)) st.push(['Infecção', 'rot']);
  if ((hero.wounds || []).some((w) => w.bleeding && !w.treated)) st.push(['Sangrando', 'blood']);
  if (D.tags.includes('fissura')) st.push(['Fissura', 'bad']);
  if ((hero.mutationPending || 0) > 0) st.push(['Mutação pendente', 'corr']);
  return { D, st };
}

export { EQUIP_SLOTS, WOUNDS };
