// ICOR — saque e estoque de lojas (Área A).
// Tabelas: [[idOuToken, peso, nMin?, nMax?], ...]. Tokens: @weapon:T @armor:T @offhand:T @trinket:T @consumable:T @material:T @any:T (T = tier 1..5).
import { R } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { ITEM_LIST, ITEMS } from '../data/items.js';
import { makeItem, isStackable } from './items.js';
import { getG } from '../core/state.js';

const TOKEN = /^@(weapon|armor|offhand|trinket|consumable|material|any):([1-5]|R|T)$/;
const EXCLUDE_TYPES = new Set(['key', 'tome', 'prosthetic']);

/** Qualidade aleatória ponderada pelo tier (tier alto = mais boas forjas e obras-primas). */
export function rollQuality(tier = 1, rng = R) {
  const t = clamp(tier, 1, 5);
  return rng.weighted([[0, Math.max(4, 32 - t * 6)], [1, 52], [2, 12 + t * 3], [3, 1 + t * 1.5]]);
}

function regionNow() { return getG()?.expedition?.region || null; }

/** Candidatos de um tipo para um tier: tiers próximos pesam mais; únicos só raramente (e da região). */
function candidates({ type, cls, slot, tier = 1, allowUnique = true }) {
  const t = clamp(tier, 1, 5);
  const region = regionNow();
  const out = [];
  for (const d of ITEM_LIST) {
    if (!d || d.quest || d.relic || EXCLUDE_TYPES.has(d.type) || d.id === 'desarmado') continue;
    if (d.prosthetic) continue;
    if (type && type !== 'any' && d.type !== type) continue;
    if (type === 'any' && ['ammo'].includes(d.type) && R.chance(50)) continue;
    if (cls && d.cls !== cls) continue;
    if (slot && d.slot !== slot) continue;
    const dt = d.tier || 1;
    if (dt > t + (type === 'material' ? 0 : 0)) continue;
    let w = dt === t ? 4 : dt === t - 1 ? 3 : dt === t - 2 ? 1.2 : 0.3;
    if (d.rarity === 'unico') {
      if (!allowUnique) continue;
      w = d.region && d.region === region ? 0.5 : 0.08;
    } else if (d.rarity === 'raro') w *= 0.45;
    if (d.region && d.region !== region && d.rarity !== 'unico') w *= 0.5;
    out.push([d, w]);
  }
  return out;
}

/** Item aleatório. opts: { type, cls, tier, slot, q }. */
export function randomItem(G, opts = {}) {
  const list = candidates(opts);
  if (!list.length) return null;
  const def = R.weighted(list);
  if (!def) return null;
  const q = opts.q ?? (['weapon', 'armor', 'offhand'].includes(def.type) ? rollQuality(opts.tier || def.tier || 1) : 1);
  let n = 1;
  if (def.type === 'ammo') n = R.int(3, 8);
  else if (def.type === 'material') n = R.int(1, def.tier >= 4 ? 1 : 3);
  return makeItem(def.id, { q, n });
}

function resolveTier(tok, tier) {
  if (tok === 'R' || tok === 'T') return clamp(tier || 1, 1, 5);
  return clamp(Number(tok) || 1, 1, 5);
}

/** Uma rolagem de uma linha da tabela. */
function rollRow(G, row, tier) {
  const [id, , a, b] = row;
  const m = TOKEN.exec(String(id));
  if (m) return randomItem(G, { type: m[1], tier: resolveTier(m[2], tier) });
  if (!ITEMS[id]) { console.warn('[loot] item desconhecido', id); return null; }
  const n = a != null ? R.int(a, b ?? a) : 1;
  const def = ITEMS[id];
  const q = ['weapon', 'armor', 'offhand'].includes(def.type) ? rollQuality(tier || def.tier || 1) : 1;
  if (isStackable(def)) return makeItem(id, { n, q });
  return makeItem(id, { q });
}

/**
 * Rola uma tabela de saque. opts: { tier=1, bonus=0 (% de rolagem extra), rolls=table.rolls||1 }.
 * Retorna { items, coin: 0, ichor: 0 } (moedas/Icor ficam com quem chama).
 */
export function rollLoot(G, table, opts = {}) {
  const items = [];
  if (!Array.isArray(table) || !table.length) return { items, coin: 0, ichor: 0 };
  const tier = opts.tier || 1;
  let rolls = opts.rolls ?? table.rolls ?? 1;
  if (opts.bonus && R.chance(opts.bonus)) rolls += 1;
  const rows = table.filter((r) => Array.isArray(r) && r[0] && (r[1] ?? 1) > 0);
  for (let i = 0; i < rolls && rows.length; i++) {
    const row = R.weighted(rows.map((r) => [r, r[1] ?? 1]));
    const inst = rollRow(G, row, tier);
    if (inst) mergeInto(items, inst);
  }
  return { items, coin: 0, ichor: 0 };
}

function mergeInto(list, inst) {
  if (isStackable(ITEMS[inst.id]) && !inst.name) {
    const same = list.find((x) => x.id === inst.id && !x.name);
    if (same) { same.n = (same.n || 1) + (inst.n || 1); return; }
  }
  list.push(inst);
}

// ------------------------------------------------------------ lojas
const SHOP_PLAN = {
  ferreiro: [['weapon', 4], ['armor', 4], ['offhand', 2]],
  boticario: [['consumable', 6], ['material', 2]],
  guilda: [['material', 3], ['trinket', 2], ['consumable', 2], ['weapon', 1]],
};
const SHOP_BASICS = {
  ferreiro: [['faca_arremesso', 4], ['virote', 10], ['oleo', 2]],
  boticario: [['bandagem', 5], ['tala', 2], ['unguento', 2], ['raiz_amarga', 2], ['tonico', 2], ['racao', 4], ['tocha', 4]],
  guilda: [['tocha', 4], ['racao', 6], ['sebo', 3], ['bandagem', 2]],
};

/** Estoque de uma loja da cidade (D chama a cada reabastecimento). */
export function shopStock(G, serviceId, tier = 1) {
  const plan = SHOP_PLAN[serviceId] || [['consumable', 4]];
  const out = [];
  for (const [id, n] of SHOP_BASICS[serviceId] || []) if (ITEMS[id]) mergeInto(out, makeItem(id, { n }));
  for (const [type, n] of plan) {
    for (let i = 0; i < n; i++) {
      // lojas trabalham um tier abaixo do Ermo, com chance de algo melhor
      const t = clamp(tier - (R.chance(65) ? 0 : 1) + (R.chance(12) ? 1 : 0), 1, 5);
      let inst = null;
      for (let k = 0; k < 4 && !inst; k++) {
        const cand = randomItem(G, { type, tier: t, allowUnique: false });
        if (cand && (isStackable(ITEMS[cand.id]) || !out.some((x) => x.id === cand.id))) inst = cand;
      }
      if (!inst) continue;
      if (['weapon', 'armor', 'offhand'].includes(ITEMS[inst.id]?.type)) inst.q = Math.max(1, Math.min(inst.q, R.chance(15) ? 2 : 1));
      if (ITEMS[inst.id]?.type === 'consumable') inst.n = Math.max(inst.n || 1, R.int(1, 3));
      mergeInto(out, inst);
    }
  }
  return out;
}
