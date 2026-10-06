// Adaptador para as APIs da Área A (personagem, itens, feridas, saque, efeitos).
// Importa por namespace: se um nome mudar, o combate cai num substituto seguro em vez de quebrar.
import * as character from '../character.js';
import * as woundsSys from '../wounds.js';
import * as itemsSys from '../items.js';
import * as lootSys from '../loot.js';
import * as effectsSys from '../effects.js';
import { clamp } from '../../core/util.js';
import { R } from '../../core/rng.js';

const PARTS = ['cabeca', 'tronco', 'bracoD', 'bracoE', 'pernas'];
const ZERO = () => ({ corte: 0, perf: 0, impacto: 0, fogo: 0, icor: 0 });

/** Arma "desarmado" padrão. */
function fistWeapon(attrs) {
  const f = attrs?.for ?? 3;
  return { inst: null, def: null, cls: 'desarmado', hands: 1, dmg: [2 + Math.round(f * 0.4), 4 + Math.round(f * 0.7)], dtype: 'impacto', time: 80, stam: 1, reach: 0, ranged: false, crit: 5, props: [] };
}

function fallbackDerive(hero) {
  const a = { for: 3, des: 3, vig: 3, von: 3, ast: 3, ...(hero?.attrs || {}) };
  const armor = Object.fromEntries(PARTS.map((p) => [p, ZERO()]));
  return {
    attrs: a, hpMax: 30 + a.vig * 6 + (hero?.level || 1) * 3, staminaMax: 6 + a.vig, staminaRegen: 3,
    acc: a.des * 3, eva: a.des * 3, crit: 5, speed: 0, armor, dreadResist: a.von * 3, corrResist: a.von * 2,
    bleedResist: a.vig * 2, infectResist: a.vig * 2, checkBonus: {}, intentDetail: a.ast >= 6 ? 2 : a.ast >= 4 ? 1 : 0,
    canTwoHand: true, canShield: true, canFlee: true, lostParts: [], weapon: fistWeapon(a),
    offhand: { inst: null, def: null, kind: 'none', block: 0, stamBlock: 0, light: false }, mods: {}, tags: [],
  };
}

/** derive() do herói, normalizado para o que o combate precisa. Nunca lança. */
export function heroD(G) {
  const hero = G.hero;
  let D = null;
  try { D = character.derive ? character.derive(hero) : null; } catch (e) { console.error('[combat] derive falhou', e); }
  if (!D) D = fallbackDerive(hero);
  const out = { ...D };
  out.attrs = { for: 3, des: 3, vig: 3, von: 3, ast: 3, ...(D.attrs || hero?.attrs || {}) };
  out.mods = D.mods || {};
  out.hpMax = Math.max(1, D.hpMax || 40);
  out.staminaMax = Math.max(1, D.staminaMax ?? 6 + out.attrs.vig);
  out.staminaRegen = D.staminaRegen ?? 3;
  out.acc = Number(D.acc) || 0;
  out.eva = Number(D.eva) || 0;
  out.crit = Number(D.crit) || 0;
  out.speed = Number(D.speed) || 0;
  out.lostParts = D.lostParts || [];
  out.intentDetail = clamp((D.intentDetail ?? 0), 0, 2);
  const armor = {};
  for (const p of PARTS) armor[p] = { ...ZERO(), ...(D.armor?.[p] || {}) };
  out.armor = armor;
  let w = D.weapon;
  if (!w || !w.dmg) w = fistWeapon(out.attrs);
  out.weapon = {
    inst: w.inst || null, def: w.def || null, cls: w.cls || 'desarmado', hands: w.hands || 1,
    dmg: [Math.max(1, Math.round(w.dmg[0])), Math.max(1, Math.round(w.dmg[1]))], dtype: w.dtype || 'impacto',
    time: w.time || 100, stam: w.stam ?? 2, reach: w.reach ?? 0, ranged: !!w.ranged || w.cls === 'besta', crit: w.crit ?? 5,
    props: w.props || [], name: w.inst ? itemName(w.inst) : (w.def?.name || (w.cls === 'desarmado' ? 'Punhos' : 'Arma')),
  };
  const o = D.offhand || {};
  out.offhand = { inst: o.inst || null, def: o.def || null, kind: o.kind || 'none', block: o.block || 0, stamBlock: o.stamBlock ?? 2, light: !!o.light,
    name: o.inst ? itemName(o.inst) : (o.def?.name || '') };
  return out;
}

export function itemDef(instOrId) {
  try { if (itemsSys.itemDef) return itemsSys.itemDef(instOrId) || null; } catch { /* */ }
  return null;
}

export function itemName(inst) {
  try { if (itemsSys.itemName) return itemsSys.itemName(inst); } catch { /* */ }
  return itemDef(inst)?.name || inst?.name || inst?.id || '?';
}

export function countItem(hero, id) {
  try { if (itemsSys.countItem) return itemsSys.countItem(hero, id); } catch { /* */ }
  return (hero.inv || []).filter((i) => i.id === id).reduce((s, i) => s + (i.n || 1), 0);
}

export function removeItem(hero, id, n = 1) {
  try { if (itemsSys.removeItem) return itemsSys.removeItem(hero, id, n); } catch { /* */ }
  let left = n;
  for (const inst of [...(hero.inv || [])]) {
    if (inst.id !== id || left <= 0) continue;
    const take = Math.min(left, inst.n || 1);
    inst.n = (inst.n || 1) - take;
    left -= take;
    if (inst.n <= 0) hero.inv.splice(hero.inv.indexOf(inst), 1);
  }
  return left === 0;
}

/** Remove 1 unidade de uma instância específica (por uid). */
export function consumeInst(hero, uid) {
  const inst = (hero.inv || []).find((i) => i.uid === uid);
  if (!inst) return false;
  if ((inst.n || 1) > 1) { inst.n -= 1; return true; }
  hero.inv.splice(hero.inv.indexOf(inst), 1);
  return true;
}

export function equipItem(hero, uid) {
  try { if (itemsSys.equip) return itemsSys.equip(hero, uid); } catch (e) { return { ok: false, reason: e.message }; }
  const inst = hero.inv.find((i) => i.uid === uid);
  if (!inst) return { ok: false, reason: 'Item não encontrado.' };
  const prev = hero.equip.main;
  hero.inv.splice(hero.inv.indexOf(inst), 1);
  hero.equip.main = inst;
  if (prev) hero.inv.push(prev);
  return { ok: true };
}

export function makeItem(id, opts) {
  try { if (itemsSys.makeItem) return itemsSys.makeItem(id, opts); } catch { /* */ }
  return { uid: `i${Math.floor(R.float() * 1e9)}`, id, q: opts?.q ?? 1, n: opts?.n ?? 1 };
}

/** Ferida no herói (A). Fallback: registra uma ferida genérica. */
export function inflictWound(G, part, dtype, sev) {
  try {
    if (woundsSys.inflictWound) return woundsSys.inflictWound(G, { part, dtype, sev });
  } catch (e) { console.error('[combat] inflictWound falhou', e); }
  const w = { uid: `w${G.uidSeq = (G.uidSeq || 0) + 1}`, id: `ferida_${dtype}_${sev}`, part, days: sev * 3, infected: false, treated: false };
  (G.hero.wounds ||= []).push(w);
  return w;
}

export function describeWound(w) {
  try { if (woundsSys.describeWound) return woundsSys.describeWound(w); } catch { /* */ }
  return { name: w?.id || 'Ferida', effect: '', days: w?.days };
}

/** Pavor no herói (A). Retorna { lines, collapse }. */
export function addDread(G, n, why) {
  if (!n) return { lines: [], collapse: false };
  try { if (character.addDread) return character.addDread(G, n, why) || { lines: [], collapse: false }; } catch (e) { console.error(e); }
  const D = heroD(G);
  const v = n > 0 ? Math.round(n * (1 - (D.dreadResist || 0) / 100)) : n;
  G.hero.dread = clamp((G.hero.dread || 0) + v, 0, 100);
  return { lines: [], collapse: G.hero.dread >= 100 };
}

export function addCorruption(G, n, why) {
  if (!n) return { lines: [], mutationPending: false, transformed: false };
  try { if (character.addCorruption) return character.addCorruption(G, n, why) || { lines: [] }; } catch (e) { console.error(e); }
  G.hero.corruption = clamp((G.hero.corruption || 0) + n, 0, 100);
  return { lines: [], transformed: G.hero.corruption >= 100 };
}

/** Rola uma tabela de saque (A). Fallback: ignora tokens, sorteia ids diretos. */
export function rollLoot(G, table, opts = {}) {
  try { if (lootSys.rollLoot) return lootSys.rollLoot(G, table, opts) || { items: [] }; } catch (e) { console.error('[combat] rollLoot falhou', e); }
  const items = [];
  const rolls = table.rolls ?? 1;
  const plain = table.filter((r) => !String(r[0]).startsWith('@'));
  for (let i = 0; i < rolls && plain.length; i++) {
    const row = R.weighted(plain.map((r) => [r, r[1]]));
    items.push(makeItem(row[0], { n: row[2] ? R.int(row[2], row[3] || row[2]) : 1 }));
  }
  return { items, coin: 0, ichor: 0 };
}

export function applyEffects(G, effects, ctx = {}) {
  if (!effects || !effects.length) return { lines: [], pending: [] };
  try { if (effectsSys.applyEffects) return effectsSys.applyEffects(G, effects, ctx) || { lines: [], pending: [] }; } catch (e) { console.error('[combat] applyEffects falhou', e); }
  return { lines: [], pending: [] };
}
