// Valdrem: serviços, lojas, preços, cura, ritos, Icor, taverna, antro, casa, muralha (Área D).
// Toda ação retorna { ok, reason?, lines:[{text,kind}] } e já avança o tempo quando custa horas.
import { clamp } from '../core/util.js';
import { R, makeRng } from '../core/rng.js';
import * as CH from './character.js';
import * as IT from './items.js';
import * as LO from './loot.js';
import * as W from './wounds.js';
import * as CK from './checks.js';
import * as EV from './events.js';
import * as ITD from '../data/items.js';
import * as WD from '../data/wounds.js';
import * as CP from '../data/companions.js';
import {
  SERVICES, QUALITY_UP, ENCHANT_EXTRA, ENCHANT_WHERE, RECIPES, BARBER, PENANCES, BLESSINGS, OFFERING, WALL, TRAINING,
  ICHOR_MARKET, MAPS, LOAN, DRINK, RUMOR_COST, GAMBLE, RUMORS, ANTRO, REST, FIXED_STOCK, SHOPS, DAWN_EVENT_PCT,
} from '../data/city.js';
import { FACTIONS } from '../data/factions.js';
import { day, hour, isNight, hoursUntil, journal, counter, advanceTime, addChaga, heroDread, heroCorruption } from './time.js';
import { addRep, isHostile, repBuyMult, repSellMult } from './factions.js';
import { applyD, bossCount, itemDefOf, heroCount, addTempTrait, hasTrait, evalCond, mapReveal, fragmentTo } from './campaign.js';
import { addDefense } from './siege.js';
import { openRegions } from './contracts.js';
import { upgradeLevel } from './lineage.js';

const ok = (lines = [], extra = {}) => ({ ok: true, lines, ...extra });
const no = (reason) => ({ ok: false, reason, lines: [] });

// ------------------------------------------------------------------ herói derivado
export function derived(G) {
  try { return CH.derive ? CH.derive(G.hero) : null; } catch (e) { console.error(e); return null; }
}
export function hpMax(G) { return derived(G)?.hpMax || (30 + (G.hero?.attrs?.vig || 3) * 6 + (G.hero?.level || 1) * 3); }
export const priceMod = (G) => derived(G)?.mods?.price || 0;
export function healHero(G, n) {
  const h = G.hero;
  if (!h || n <= 0) return 0;
  const max = hpMax(G);
  const before = h.hp;
  if (CH.heal) CH.heal(h, n); else h.hp = Math.min(max, (h.hp || 0) + n);
  if (h.hp > max) h.hp = max;
  return h.hp - before;
}
/** Dano fora de combate (A trata morte). Retorna { died, lines }. */
export function hurtHero(G, n, why) {
  if (CH.damageHero) {
    const r = CH.damageHero(G, n, why) || {};
    return { died: !!r.died, lines: [{ text: `−${n} Vida (${why})`, kind: 'bad' }] };
  }
  G.hero.hp = Math.max(1, (G.hero.hp || 0) - n);
  return { died: false, lines: [{ text: `−${n} Vida (${why})`, kind: 'bad' }] };
}

/** Avança o tempo na cidade. */
export const cityTime = (G, hours) => advanceTime(G, hours, { where: 'city' });

// ------------------------------------------------------------------ serviços: estado
function inHours(h, [a, b]) { return a < b ? h >= a && h < b : h >= a || h < b; }

/** { visible, open, reason, lost, hostile, opensIn } */
export function serviceStatus(G, id) {
  const s = SERVICES[id];
  if (!s) return { visible: false, open: false };
  if (s.hidden && !G.city.unlocked?.[id]) return { visible: false, open: false, reason: 'Oculto' };
  if ((G.city.lostDistricts || []).includes(id)) return { visible: true, open: false, lost: true, reason: 'Destruído no cerco' };
  if (s.faction && id !== 'muralha' && isHostile(G, s.faction)) return { visible: true, open: false, hostile: true, reason: `${FACTIONS[s.faction].short} não te atende` };
  const ban = G.city.bans?.[id];
  if (ban && day(G) <= ban) return { visible: true, open: false, reason: `Barrado até o dia ${ban}` };
  if (s.hours && !inHours(hour(G), s.hours)) {
    return { visible: true, open: false, reason: `Fechado — abre às ${s.hours[0]}h`, opensIn: hoursUntil(G, s.hours[0]) };
  }
  return { visible: true, open: true };
}

/** Espera até um horário (ex.: abrir a loja). */
export function waitHours(G, n) {
  if (!(n > 0)) return no('Nada a esperar');
  return ok(cityTime(G, n));
}

// ------------------------------------------------------------------ itens: utilidades
export function itemName(inst) {
  try { if (IT.itemName) return IT.itemName(inst); } catch { /* ignore */ }
  return inst?.name || itemDefOf(inst?.id)?.name || inst?.id || '?';
}
export function unitValue(inst) {
  const one = { ...inst, n: 1 };
  try { if (IT.itemValue) return Math.max(0, IT.itemValue(one)); } catch { /* ignore */ }
  const def = itemDefOf(inst.id);
  const q = ITD.QUALITY?.[inst.q ?? 1]?.price ?? 1;
  return Math.round((def?.value || 1) * q);
}
const isStack = (inst) => (ITD.STACK_TYPES || ['consumable', 'material', 'ammo']).includes(itemDefOf(inst.id)?.type) && !inst.ench && !inst.mods && !inst.name;

function makeInst(G, id, n = 1, q = 1) {
  if (IT.makeItem) return IT.makeItem(id, { n, q });
  return { uid: `d${G.uidSeq = (G.uidSeq || 0) + 1}`, id, q, n, dur: itemDefOf(id)?.dur || 0, ench: null };
}
function giveInst(G, inst) {
  if (IT.addItem) return IT.addItem(G.hero, inst) || { ok: true };
  (G.hero.inv = G.hero.inv || []).push(inst);
  return { ok: true };
}
/** Remove n unidades de uma instância da mochila pelo uid. Retorna a unidade removida (cópia) ou null. */
function takeUnits(G, uid, n = 1) {
  const inv = G.hero.inv || [];
  const i = inv.findIndex((x) => x.uid === uid);
  if (i < 0) return null;
  const inst = inv[i];
  if ((inst.n || 1) > n) {
    inst.n -= n;
    return { ...inst, uid: `d${G.uidSeq = (G.uidSeq || 0) + 1}`, n };
  }
  inv.splice(i, 1);
  return inst;
}
const findInv = (G, uid) => (G.hero.inv || []).find((x) => x.uid === uid) || null;
export function findHeroItem(G, uid) {
  const h = G.hero;
  return findInv(G, uid) || Object.values(h.equip || {}).find((x) => x && x.uid === uid) || null;
}
function hasMats(G, mats = []) {
  const miss = mats.filter(([id, n]) => heroCount(G, id) < n);
  return miss.length ? `Falta: ${miss.map(([id, n]) => `${n}× ${itemDefOf(id)?.name || id}`).join(', ')}` : '';
}
function payMats(G, mats = []) {
  for (const [id, n] of mats) { if (IT.removeItem) IT.removeItem(G.hero, id, n); }
}
export function matsText(mats = []) { return mats.map(([id, n]) => `${n}× ${itemDefOf(id)?.name || id}`).join(', '); }
function payCoin(G, n) { G.hero.coin = (G.hero.coin || 0) - n; }

// ------------------------------------------------------------------ lojas
export const shopTier = (G) => clamp(1 + bossCount(G), 1, 5);

/** Estoque atual (reabastece a cada 3 dias com shopStock de A + estoque fixo). */
export function ensureStock(G, svc) {
  const shop = SHOPS[svc];
  if (!shop) return [];
  if (shop.needFlag && !G.campaign.flags[shop.needFlag]) {
    // quartel sem arsenal: só estoque fixo
  }
  G.city.stock = G.city.stock || {};
  G.city.stockDays = G.city.stockDays || {};
  const d = day(G);
  const last = G.city.stockDays[svc];
  if (G.city.stock[svc] && last != null && d - last < 3) return G.city.stock[svc];
  let items = [];
  const useShop = shop.shop && (!shop.needFlag || G.campaign.flags[shop.needFlag]);
  if (useShop && LO.shopStock) {
    try { items = (LO.shopStock(G, shop.shop, shopTier(G)) || []).slice(); } catch (e) { console.error(e); }
  }
  for (const [id, n, q] of FIXED_STOCK[svc] || []) if (itemDefOf(id)) items.push(makeInst(G, id, n, q ?? 1));
  G.city.stock[svc] = items;
  G.city.stockDays[svc] = d;
  G.city.stockDay = d;
  return items;
}

function moraleMult(G) {
  const m = G.city.morale ?? 50;
  return m < 25 ? 1.2 : m < 40 ? 1.1 : m > 75 ? 0.95 : 1;
}
const svcFaction = (svc) => SERVICES[svc]?.faction || null;

export function buyPrice(G, svc, inst) {
  const base = unitValue(inst);
  const mult = repBuyMult(G, svcFaction(svc)) * moraleMult(G) * (1 - clamp(priceMod(G), -50, 40) / 100) * (svc === 'quartel' ? 0.85 : 1);
  return Math.max(1, Math.ceil(base * mult));
}
export function sellPrice(G, svc, inst) {
  const base = unitValue(inst);
  const mult = 0.4 * repSellMult(G, svcFaction(svc)) * (1 + clamp(priceMod(G), -50, 40) / 200);
  return Math.max(0, Math.floor(base * mult));
}

/** Pode vender este item aqui? '' = sim; senão o motivo. */
export function sellProblem(G, svc, inst) {
  const def = itemDefOf(inst.id);
  if (!def) return 'Ninguém sabe o que é isso';
  if (def.quest || def.relic || /^fragmento_/.test(inst.id)) return 'Ninguém aqui ousa comprar isso';
  if (G.lineage.heirloom?.uid === inst.uid) return 'É a relíquia da Casa';
  const buys = SERVICES[svc]?.buys || [];
  if (!buys.includes(def.type)) return `${SERVICES[svc].name} não compra isso`;
  return '';
}

export function buy(G, svc, uid) {
  const st = serviceStatus(G, svc);
  if (!st.open) return no(st.reason);
  const stock = ensureStock(G, svc);
  const i = stock.findIndex((x) => x.uid === uid);
  if (i < 0) return no('Já foi vendido');
  const src = stock[i];
  const price = buyPrice(G, svc, src);
  if ((G.hero.coin || 0) < price) return no(`Custa ${price} moedas`);
  let inst;
  if ((src.n || 1) > 1) { src.n -= 1; inst = { ...src, n: 1, uid: `d${G.uidSeq = (G.uidSeq || 0) + 1}` }; }
  else { stock.splice(i, 1); inst = src; }
  const r = giveInst(G, inst);
  if (r && r.ok === false) { if (inst !== src) src.n += 1; else stock.splice(i, 0, src); return no(r.reason || 'Não cabe'); }
  payCoin(G, price);
  return ok([{ text: `Comprou ${itemName(inst)} (−${price})`, kind: '' }]);
}

export function sell(G, svc, uid, n = 1) {
  const st = serviceStatus(G, svc);
  if (!st.open) return no(st.reason);
  const inst = findInv(G, uid);
  if (!inst) return no('Desequipe antes de vender');
  const prob = sellProblem(G, svc, inst);
  if (prob) return no(prob);
  n = Math.min(n, inst.n || 1);
  const price = sellPrice(G, svc, inst) * n;
  const unit = takeUnits(G, uid, n);
  G.hero.coin = (G.hero.coin || 0) + price;
  const stock = ensureStock(G, svc);
  const same = isStack(unit) && stock.find((x) => x.id === unit.id && isStack(x) && (x.q ?? 1) === (unit.q ?? 1));
  if (same) same.n = (same.n || 1) + n; else stock.push(unit);
  if (stock.length > 30) stock.shift();
  return ok([{ text: `Vendeu ${n > 1 ? `${n}× ` : ''}${itemName(unit)} (+${price})`, kind: 'good' }]);
}

// ------------------------------------------------------------------ ferreiro
export function maxDur(inst) {
  if (inst.durMax) return inst.durMax;
  const def = itemDefOf(inst.id);
  const m = ITD.QUALITY?.[inst.q ?? 1]?.durMult ?? 1;
  return Math.round((def?.dur || 0) * m);
}
export function repairQuote(G, inst) {
  const max = maxDur(inst);
  if (!max || inst.dur == null || inst.dur >= max) return null;
  let cost;
  try { cost = IT.repairCost ? IT.repairCost(inst) : null; } catch { cost = null; }
  if (cost == null) cost = Math.max(2, Math.ceil(((max - inst.dur) / max) * unitValue(inst) * 0.35));
  cost = Math.max(1, Math.ceil(cost * repBuyMult(G, 'guilda')));
  return { cost, hours: Math.max(1, Math.ceil((max - inst.dur) / 25)) };
}
export function repair(G, uid, { free = false } = {}) {
  const inst = findHeroItem(G, uid);
  if (!inst) return no('Item não encontrado');
  const q = repairQuote(G, inst);
  if (!q) return no('Não precisa de reparo');
  if (!free && (G.hero.coin || 0) < q.cost) return no(`Custa ${q.cost} moedas`);
  if (!free) payCoin(G, q.cost);
  inst.dur = maxDur(inst);
  return ok([{ text: `${itemName(inst)} reparado${free ? ' (armeiro da Casa)' : ` (−${q.cost})`}.`, kind: 'good' }, ...cityTime(G, q.hours)]);
}

const UPGRADABLE = ['weapon', 'armor', 'offhand'];
export function upgradeQuote(G, inst) {
  const def = itemDefOf(inst.id);
  if (!def || !UPGRADABLE.includes(def.type)) return { can: false, why: 'Não se forja isso' };
  if (def.rarity === 'unico' || inst.unique) return { can: false, why: 'Peça única: o ferreiro não ousa' };
  const qc = inst.q ?? 1;
  if (qc >= 3) return { can: false, why: 'Já é obra-prima' };
  const c = QUALITY_UP[qc];
  const coin = Math.ceil(c.coin * (1 + (def.tier || 1) * 0.25) * repBuyMult(G, 'guilda'));
  const miss = hasMats(G, c.mats);
  const why = miss || ((G.hero.coin || 0) < coin ? `Custa ${coin} moedas` : '');
  return { can: !why, why, coin, mats: c.mats, hours: c.hours, next: qc + 1 };
}
export function upgradeItem(G, uid) {
  const st = serviceStatus(G, 'ferreiro');
  if (!st.open) return no(st.reason);
  const inst = findHeroItem(G, uid);
  if (!inst) return no('Item não encontrado');
  const qv = upgradeQuote(G, inst);
  if (!qv.can) return no(qv.why);
  payCoin(G, qv.coin);
  payMats(G, qv.mats);
  const ratio = maxDur(inst) ? (inst.dur ?? maxDur(inst)) / maxDur(inst) : 1;
  inst.q = qv.next;
  if (inst.dur != null) inst.dur = Math.round(maxDur(inst) * Math.max(ratio, 0.75));
  const qn = ITD.QUALITY?.[inst.q]?.name || ['enferrujado', 'comum', 'bom', 'obra-prima'][inst.q];
  return ok([{ text: `Brun martela a noite toda. ${itemName(inst)} agora é ${qn}.`, kind: 'good' }, ...cityTime(G, qv.hours)]);
}

/** Unções disponíveis num serviço para um item. */
export function enchantOptions(G, svc, inst) {
  const E = ITD.ENCHANTS || {};
  const def = itemDefOf(inst.id);
  const kind = def?.type === 'weapon' ? 'weapon' : def?.type === 'armor' ? 'armor' : null;
  return (ENCHANT_WHERE[svc] || []).filter((id) => E[id] && E[id].applies === kind).map((id) => {
    const e = E[id];
    const extra = ENCHANT_EXTRA[id] || { mats: [], hours: 3 };
    const coin = Math.ceil((e.cost?.coin || 0) * repBuyMult(G, svcFaction(svc)));
    const ichor = e.cost?.ichor || 0;
    const miss = hasMats(G, extra.mats);
    let why = miss;
    if (!why && (G.hero.coin || 0) < coin) why = `Custa ${coin} moedas`;
    if (!why && (G.hero.ichor || 0) < ichor) why = `Custa ${ichor} Icor`;
    if (!why && inst.ench === id) why = 'Já tem esta unção';
    return { id, name: e.name, desc: e.desc, coin, ichor, mats: extra.mats, hours: extra.hours, can: !why, why, replaces: inst.ench && inst.ench !== id ? inst.ench : null };
  });
}
export function anoint(G, svc, uid, enchId) {
  const st = serviceStatus(G, svc);
  if (!st.open) return no(st.reason);
  const inst = findHeroItem(G, uid);
  if (!inst) return no('Item não encontrado');
  const opt = enchantOptions(G, svc, inst).find((o) => o.id === enchId);
  if (!opt) return no('Unção indisponível aqui');
  if (!opt.can) return no(opt.why);
  payCoin(G, opt.coin);
  G.hero.ichor -= opt.ichor;
  payMats(G, opt.mats);
  let done = false;
  if (IT.anoint) {
    try {
      const r = IT.anoint(G.hero, uid, enchId, { free: true });
      done = r !== false && r?.ok !== false;
    } catch (e) { console.error(e); }
  }
  if (!done || inst.ench !== enchId) inst.ench = enchId;
  const lines = [{ text: `${opt.name}: ${itemName(inst)}.`, kind: 'ichor' }];
  const corr = ITD.ENCHANTS?.[enchId]?.corrOnUse;
  if (corr) lines.push(...heroCorruption(G, corr, 'unção de Icor').lines);
  lines.push(...cityTime(G, opt.hours));
  return ok(lines);
}

// ------------------------------------------------------------------ receitas
export function recipesAt(G, svc) {
  return RECIPES.filter((r) => r.where === svc && itemDefOf(r.out[0])).map((r) => recipeView(G, r));
}
export function recipeView(G, r) {
  let why = hasMats(G, r.in);
  if (!why && (G.hero.coin || 0) < (r.coin || 0)) why = `Custa ${r.coin} moedas`;
  if (!why && (G.hero.ichor || 0) < (r.ichor || 0)) why = `Custa ${r.ichor} Icor`;
  if (!why && r.need && !evalCond(G, r.need)) why = 'A Sutura não ensina isso a você';
  const ast = derived(G)?.attrs?.ast ?? G.hero.attrs?.ast ?? 3;
  const dbl = r.ast && ast >= r.ast;
  const outN = r.out[1] * (dbl ? 2 : 1);
  return { id: r.id, r, can: !why, why, outN, dbl, name: itemDefOf(r.out[0])?.name || r.out[0], hours: r.hours };
}
export function craft(G, recipeId) {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r) return no('Receita desconhecida');
  const st = serviceStatus(G, r.where);
  if (!st.open) return no(st.reason);
  const v = recipeView(G, r);
  if (!v.can) return no(v.why);
  payMats(G, r.in);
  if (r.coin) payCoin(G, r.coin);
  if (r.ichor) G.hero.ichor -= r.ichor;
  let n = v.outN;
  const lines = [];
  if (r.risk && R.chance(r.risk.pct)) { n = Math.max(1, n - 1); lines.push({ text: 'Parte estragou. Fede.', kind: 'warn' }); }
  giveInst(G, makeInst(G, r.out[0], n));
  lines.unshift({ text: `Fabricou ${n}× ${v.name}${v.dbl ? ' (Astúcia: dose dupla)' : ''}.`, kind: 'good' });
  lines.push(...cityTime(G, r.hours));
  return ok(lines);
}

// ------------------------------------------------------------------ barbeiro
function woundDef(w) { return WD.WOUNDS?.[w.id] || null; }
export function woundName(w) {
  try { if (W.describeWound) return W.describeWound(w).name; } catch { /* ignore */ }
  return woundDef(w)?.name || w.id;
}
const nightMult = (G) => (isNight(G) ? BARBER.nightMult : 1);

/** Opções do barbeiro para cada ferida: [{ w, name, days, options:[{method, label, coin, hours, can, why, desc}] }]. */
export function barberOptions(G) {
  const h = G.hero;
  const out = [];
  for (const w of h.wounds || []) {
    const def = woundDef(w) || { treat: ['cirurgia'], sev: 1 };
    const treat = def.treat || [];
    const opts = [];
    const nm = nightMult(G);
    if (treat.includes('cirurgia') && w.days !== 0 && !w.surgery) {
      const days = w.days > 0 ? w.days : 10;
      const coin = Math.ceil((BARBER.baseCoin + BARBER.perDay * days + (w.infected ? BARBER.infectedExtra : 0)) * nm);
      const hours = (def.sev || 1) >= 3 ? 48 : (def.sev || 1) >= 2 ? 24 : 8;
      const why = (h.coin || 0) < coin ? `Custa ${coin} moedas` : '';
      opts.push({ method: 'cirurgia', label: 'Cirurgia', coin, hours, can: !why, why,
        desc: w.days === -1 ? 'Limpa e fecha. A perda fica.' : 'Limpa, costura. Cura na metade do tempo; mata infecção.' });
    }
    if (treat.includes('amputar')) {
      const coin = Math.ceil(BARBER.amputateCoin * nm);
      const why = (h.coin || 0) < coin ? `Custa ${coin} moedas` : '';
      opts.push({ method: 'amputar', label: 'Amputar', coin, hours: 24, can: !why, why, danger: true,
        desc: 'Serra o membro e a podridão junto. Para sempre.' });
    }
    if (opts.length) out.push({ w, name: woundName(w), days: w.days, infected: !!w.infected, sev: def.sev || 1, options: opts });
  }
  return out;
}

export function barberTreat(G, woundUid, method) {
  const st = serviceStatus(G, 'barbeiro');
  if (!st.open) return no(st.reason);
  const entry = barberOptions(G).find((x) => x.w.uid === woundUid);
  const opt = entry?.options.find((o) => o.method === method);
  if (!opt) return no('Tratamento indisponível');
  const free = method === 'cirurgia' && G.campaign.flags.sutura_cura_gratis && !isHostile(G, 'sutura');
  const coin = free ? 0 : opt.coin;
  if ((G.hero.coin || 0) < coin) return no(`Custa ${coin} moedas`);
  payCoin(G, coin);
  const lines = [];
  if (free) lines.push({ text: 'A enfermaria da Sutura paga o barbeiro.', kind: 'good' });
  let tl = [];
  try { tl = W.treatWound ? W.treatWound(G, woundUid, method) : null; } catch (e) { console.error(e); }
  if (!W.treatWound) {
    const h = G.hero;
    if (method === 'cirurgia') { const w = h.wounds.find((x) => x.uid === woundUid); if (w) { w.days = w.days > 0 ? Math.ceil(w.days / 2) : w.days; w.infected = false; w.treated = true; } }
    else h.wounds = h.wounds.filter((x) => x.uid !== woundUid);
  }
  const w = (G.hero.wounds || []).find((x) => x.uid === woundUid);
  if (w && method === 'cirurgia') w.surgery = true;
  lines.push(...(Array.isArray(tl) ? tl : tl?.lines || []).map((l) => (typeof l === 'string' ? { text: l, kind: '' } : l)));
  if (method === 'amputar') { lines.push(...heroDread(G, 12, 'a serra')); counter(G, 'amputations'); journal(G, `${G.hero.name} perdeu um membro na serra de Odo.`); }
  lines.unshift({ text: method === 'amputar' ? 'Odo amarra o torniquete e pega a serra. Você ouve o osso antes de sentir.' : 'Odo lava a ferida com aguardente e costura sem pressa.', kind: '' });
  lines.push(...cityTime(G, opt.hours));
  return ok(lines);
}

/** Partes perdidas sem prótese. */
export function prostheticOptions(G) {
  const h = G.hero;
  const D = derived(G);
  const lost = new Set(D?.lostParts || []);
  for (const w of h.wounds || []) {
    const def = woundDef(w);
    if (def?.loses || (def?.treat || []).includes('protese')) lost.add(w.part);
  }
  const out = [];
  for (const [kind, p] of Object.entries(BARBER.prosthetics)) {
    for (const part of p.part) {
      const partKey = part === 'cabeca' ? 'olho' : part;
      if (!lost.has(part) && !lost.has(partKey)) continue;
      if (h.prosthetics?.[part]) continue;
      const coin = Math.ceil(p.coin * repBuyMult(G, null));
      let why = hasMats(G, p.mats);
      if (!why && (h.coin || 0) < coin) why = `Custa ${coin} moedas`;
      out.push({ kind, part, name: p.name, desc: p.desc, coin, mats: p.mats, days: p.days, can: !why, why });
    }
  }
  return out;
}

const PROSTHETIC_ITEM = { gancho: 'gancho_protese', perna_pau: 'perna_pau', olho_vidro: 'olho_vidro' };
export function fitProsthetic(G, kind, part) {
  const st = serviceStatus(G, 'barbeiro');
  if (!st.open) return no(st.reason);
  const opt = prostheticOptions(G).find((o) => o.kind === kind && o.part === part);
  if (!opt) return no('Nada a encaixar');
  if (!opt.can) return no(opt.why);
  payCoin(G, opt.coin);
  payMats(G, opt.mats);
  const h = G.hero;
  h.prosthetics = h.prosthetics || {};
  const w = (h.wounds || []).find((x) => x.part === part && (woundDef(x)?.loses || (woundDef(x)?.treat || []).includes('protese')));
  const itemId = PROSTHETIC_ITEM[kind];
  let lines = [];
  if (w && W.treatWound) {
    try { const r = W.treatWound(G, w.uid, 'protese', { kind, item: itemId }); lines = (Array.isArray(r) ? r : r?.lines || []).map((l) => (typeof l === 'string' ? { text: l, kind: '' } : l)); } catch (e) { console.error(e); }
  }
  if (!h.prosthetics[part]) h.prosthetics[part] = kind;
  // o gancho é arma: entra na mochila para equipar na mão da arma (se A ainda não deu)
  if (kind === 'gancho' && itemDefOf('gancho_protese') && !heroCount(G, 'gancho_protese') && h.equip?.main?.id !== 'gancho_protese') {
    giveInst(G, makeInst(G, 'gancho_protese'));
    lines.push({ text: 'O gancho é arma: equipe-o na ficha.', kind: 'info' });
  }
  journal(G, `${h.name} ganhou ${opt.name.toLowerCase()}.`);
  return ok([{ text: `Odo encaixa: ${opt.name}. ${opt.desc}`, kind: 'good' }, ...lines, ...cityTime(G, opt.days * 24)]);
}

export function bloodletting(G) {
  const st = serviceStatus(G, 'barbeiro');
  if (!st.open) return no(st.reason);
  const b = BARBER.bloodletting;
  const h = G.hero;
  if ((h.corruption || 0) <= 0) return no('Não há Icor podre para tirar');
  if (hasTrait(G, 'sangrado')) return no('Ainda fraco da última sangria');
  const coin = Math.ceil(b.coin * nightMult(G));
  if ((h.coin || 0) < coin) return no(`Custa ${coin} moedas`);
  payCoin(G, coin);
  const lines = [{ text: 'Sanguessugas no pescoço. Saem gordas e douradas.', kind: '' }];
  lines.push(...heroCorruption(G, b.corruption, 'sangria').lines);
  lines.push(...addTempTrait(G, 'sangrado', b.days));
  const max = hpMax(G);
  if (h.hp > max) h.hp = max;
  lines.push(...cityTime(G, b.hours));
  return ok(lines);
}

/** Costura rápida: recupera Vida por moedas. */
export function sutureQuote(G) {
  const max = hpMax(G);
  const miss = Math.max(0, max - (G.hero.hp || 0));
  const n = Math.min(miss, 40);
  const coin = Math.ceil((n / 10) * BARBER.suture.coinPer10 * nightMult(G));
  return { n, coin, hours: Math.max(1, Math.ceil(n / 10) * BARBER.suture.hoursPer10) };
}
export function suture(G) {
  const st = serviceStatus(G, 'barbeiro');
  if (!st.open) return no(st.reason);
  const q = sutureQuote(G);
  if (q.n <= 0) return no('Você está inteiro');
  if ((G.hero.coin || 0) < q.coin) return no(`Custa ${q.coin} moedas`);
  payCoin(G, q.coin);
  const got = healHero(G, q.n);
  return ok([{ text: `Pontos e emplastro. +${got} Vida.`, kind: 'good' }, ...cityTime(G, q.hours)]);
}

// ------------------------------------------------------------------ templo
export function penanceView(G, p) {
  const h = G.hero;
  let why = '';
  if ((h.coin || 0) < (p.coin || 0)) why = `Custa ${p.coin} moedas`;
  if (!why && p.minRep && (G.factions.sutura || 0) < p.minRep) why = `Exige Sutura ${p.minRep}`;
  if (!why && p.hp && (h.hp || 0) <= -p.hp + 1) why = 'Fraco demais para o chicote';
  return { ...p, can: !why, why };
}
export function penance(G, id) {
  const st = serviceStatus(G, 'templo');
  if (!st.open) return no(st.reason);
  const p = PENANCES.find((x) => x.id === id);
  if (!p) return no('Rito desconhecido');
  const v = penanceView(G, p);
  if (!v.can) return no(v.why);
  if (p.coin) payCoin(G, p.coin);
  const lines = [{ text: p.desc, kind: '' }];
  if (p.hp) { const r = hurtHero(G, -p.hp, 'flagelo'); lines.push(...r.lines); if (r.died) return ok(lines, { died: true }); }
  if (p.wound) lines.push(...applyD(G, [{ op: 'wound', ...p.wound }], { source: 'city' }).lines);
  if (p.dread) lines.push(...heroDread(G, p.dread, p.name));
  if (p.corruption) lines.push(...heroCorruption(G, p.corruption, p.name).lines);
  if (p.hunger && G.hero) G.hero.hunger = (G.hero.hunger || 0) + p.hunger;
  if (p.rep) lines.push(...addRep(G, 'sutura', p.rep));
  lines.push(...cityTime(G, p.hours));
  return ok(lines);
}

export function offeringView(G) {
  const today = day(G);
  const done = G.city.offeredDay === today;
  let why = done ? 'O altar já bebeu hoje' : '';
  if (!why && (G.hero.ichor || 0) < OFFERING.ichor) why = `Exige ${OFFERING.ichor} Icor`;
  return { ...OFFERING, can: !why, why };
}
export function offerIchor(G) {
  const st = serviceStatus(G, 'templo');
  if (!st.open) return no(st.reason);
  const v = offeringView(G);
  if (!v.can) return no(v.why);
  G.hero.ichor -= OFFERING.ichor;
  G.city.offeredDay = day(G);
  counter(G, 'ichorOffered', OFFERING.ichor);
  const lines = [{ text: 'O Icor escorre pela agulha de pedra até a terra. Longe, algo para de crescer.', kind: 'ichor' }];
  lines.push(...addChaga(G, OFFERING.chaga, 'Oferenda à Sutura'));
  lines.push(...addRep(G, 'sutura', OFFERING.rep));
  lines.push(...cityTime(G, 1));
  return ok(lines);
}

export function blessingView(G, b) {
  let why = '';
  if ((G.factions.sutura || 0) < b.minRep) why = `Exige Sutura ${b.minRep}`;
  if (!why && (G.hero.coin || 0) < b.coin) why = `Custa ${b.coin} moedas`;
  const active = G.hero.flags?.tempTraits?.[b.id];
  if (!why && active && active > day(G)) why = `Ativa até o dia ${active}`;
  return { ...b, can: !why, why };
}
export function bless(G, id) {
  const st = serviceStatus(G, 'templo');
  if (!st.open) return no(st.reason);
  const b = BLESSINGS.find((x) => x.id === id);
  if (!b) return no('Bênção desconhecida');
  const v = blessingView(G, b);
  if (!v.can) return no(v.why);
  // só uma bênção por vez
  for (const o of BLESSINGS) if (o.id !== id && G.hero.flags?.tempTraits?.[o.id]) { delete G.hero.flags.tempTraits[o.id]; G.hero.traits = G.hero.traits.filter((t) => t !== o.id); }
  payCoin(G, b.coin);
  const lines = [{ text: `A Madre unge sua testa. ${b.desc}`, kind: 'good' }, ...addTempTrait(G, b.id, b.days), ...addRep(G, 'sutura', 1, { cross: false })];
  lines.push(...cityTime(G, 2));
  return ok(lines);
}

/** Arma maldita (prop 'maldita'): só o Templo tira. */
export function cursedEquipped(G) {
  return Object.entries(G.hero.equip || {}).filter(([, inst]) => inst && (itemDefOf(inst.id)?.props || []).includes('maldita') && !inst.exorcised);
}
export const EXORCISM = { coin: 45, hours: 6, dread: 10 };
export function exorcise(G, slot) {
  const st = serviceStatus(G, 'templo');
  if (!st.open) return no(st.reason);
  const inst = G.hero.equip?.[slot];
  if (!inst) return no('Nada ali');
  if ((G.hero.coin || 0) < EXORCISM.coin) return no(`Custa ${EXORCISM.coin} moedas`);
  payCoin(G, EXORCISM.coin);
  inst.exorcised = true;
  G.hero.equip[slot] = null;
  (G.hero.inv = G.hero.inv || []).push(inst);
  const lines = [{ text: 'Três freiras arrancam seus dedos da empunhadura, um por um. A arma grita.', kind: '' }];
  lines.push(...heroDread(G, EXORCISM.dread, 'exorcismo'));
  lines.push(...cityTime(G, EXORCISM.hours));
  return ok(lines);
}

// ------------------------------------------------------------------ quartel / muralha
export function investView(G) {
  const coin = WALL.investCoin;
  let why = G.city.defense >= WALL.max ? 'A muralha está no limite' : '';
  if (!why && (G.hero.coin || 0) < coin) why = `Custa ${coin} moedas`;
  return { coin, n: WALL.investDefense, can: !why, why };
}
export function investWall(G) {
  const v = investView(G);
  if (!v.can) return no(v.why);
  payCoin(G, v.coin);
  counter(G, 'wallInvested', v.coin);
  const lines = [{ text: 'Pedra, cal e madeira subindo para as ameias.', kind: '' }, ...addDefense(G, v.n), ...addRep(G, 'coroa', 1, { cross: false })];
  lines.push(...cityTime(G, 1));
  return ok(lines);
}
export function laborWall(G) {
  if (G.city.defense >= WALL.max) return no('A muralha está no limite');
  if ((G.hero.hp || 0) <= 10) return no('Ferido demais para carregar pedra');
  const lines = [{ text: 'Um dia carregando pedra com as mãos em carne viva.', kind: '' }];
  lines.push(...addDefense(G, WALL.laborDefense));
  lines.push(...heroDread(G, -6, 'trabalho honesto'));
  lines.push(...addRep(G, 'coroa', 1, { cross: false }));
  G.city.morale = clamp((G.city.morale ?? 50) + 1, 0, 100);
  if (G.hero) G.hero.hunger = (G.hero.hunger || 0) + WALL.laborHunger;
  lines.push(...cityTime(G, WALL.laborHours));
  return ok(lines);
}
/** Vigia noturna nas ameias: combate pequeno. */
export function watchView(G) {
  const hr = hour(G);
  const night = hr >= 20 || hr < 2;
  let why = night ? '' : 'Só à noite (20h–2h)';
  if (!why && G.city.watchDay === day(G)) why = 'Você já vigiou esta noite';
  if (!why && (G.hero.hp || 0) <= 15) why = 'Ferido demais';
  return { can: !why, why, hours: WALL.watchHours };
}
export function watchSpec(G) {
  const v = watchView(G);
  if (!v.can) return null;
  G.city.watchDay = day(G);
  const tier = Math.min(3, 1 + Math.floor(G.chaga / 35));
  const pool = tier >= 3 ? ['horda_oco', 'carnical', 'cao_chaga'] : tier >= 2 ? ['horda_oco', 'lavrador_oco', 'lobo_tendao'] : ['horda_oco', 'lavrador_oco', 'cao_chaga'];
  const n = R.int(2, 3);
  return {
    enemies: Array.from({ length: n }, () => ({ id: R.pick(pool), dist: R.int(1, 2) })),
    region: 'r1', night: true, dark: false, canFlee: true,
    context: { source: 'city', kind: 'watch' },
  };
}
/** Recompensa da vigia (chamada pela UI ao vencer). */
export function watchReward(G) {
  const coin = 12 + R.int(0, 10);
  G.hero.coin = (G.hero.coin || 0) + coin;
  const lines = [{ text: `A sargento Hulda te paga ${coin} moedas e uma caneca.`, kind: 'good' }, ...addDefense(G, 1), ...addRep(G, 'coroa', 2, { cross: false })];
  lines.push(...cityTime(G, WALL.watchHours));
  return lines;
}

export function trainView(G) {
  const D = derived(G);
  const cls = D?.weapon?.cls || itemDefOf(G.hero.equip?.main?.id)?.cls || 'desarmado';
  const done = G.hero.flags?.trained?.[cls] || 0;
  const coin = Math.ceil(TRAINING.coin * (1 + done * 0.5) * repBuyMult(G, 'coroa'));
  let why = done >= TRAINING.maxPerWeapon ? 'O mestre de armas já ensinou o que sabe' : '';
  if (!why && (G.hero.coin || 0) < coin) why = `Custa ${coin} moedas`;
  if (!why && (G.hero.hp || 0) < hpMax(G) * 0.4) why = 'Ferido demais para treinar';
  return { cls, coin, hours: TRAINING.hours, n: TRAINING.mastery, can: !why, why, done };
}
export function train(G) {
  const st = serviceStatus(G, 'quartel');
  if (!st.open) return no(st.reason);
  const v = trainView(G);
  if (!v.can) return no(v.why);
  payCoin(G, v.coin);
  G.hero.flags = G.hero.flags || {};
  G.hero.flags.trained = G.hero.flags.trained || {};
  G.hero.flags.trained[v.cls] = v.done + 1;
  const lines = [{ text: 'Um dia inteiro de golpes no poste, depois no velho mestre. Ele não pega leve.', kind: '' }];
  const r = applyD(G, [{ op: 'mastery', cls: v.cls, n: v.n }], { source: 'city' });
  lines.push(...r.lines);
  if (!r.lines.length) {
    G.hero.mastery = G.hero.mastery || {};
    G.hero.mastery[v.cls] = (G.hero.mastery[v.cls] || 0) + v.n;
    lines.push({ text: `+${v.n} maestria (${v.cls})`, kind: 'good' });
  }
  lines.push(...cityTime(G, v.hours));
  return ok(lines);
}

// ------------------------------------------------------------------ guilda
/** Preço do frasco de Icor hoje (oscila por dia; cai a cada venda no mesmo dia). */
export function ichorPrice(G) {
  const d = day(G);
  const rng = makeRng((G.seed ^ (d * 2654435761)) >>> 0);
  const base = ICHOR_MARKET.base + rng.int(-ICHOR_MARKET.spread, ICHOR_MARKET.spread);
  const sold = G.city.ichorSales?.day === d ? G.city.ichorSales.n : 0;
  const p = (base - sold * ICHOR_MARKET.dropPerSale) * repSellMult(G, 'guilda') * (1 + clamp(priceMod(G), -50, 40) / 200);
  return Math.max(ICHOR_MARKET.floor, Math.round(p));
}
export function ichorTrend(G) {
  const d = day(G);
  const rng = makeRng((G.seed ^ (d * 2654435761)) >>> 0);
  const v = rng.int(-ICHOR_MARKET.spread, ICHOR_MARKET.spread);
  return v >= 3 ? 'alta' : v <= -3 ? 'baixa' : 'estável';
}
export function sellIchor(G, n = 1) {
  const st = serviceStatus(G, 'guilda');
  if (!st.open) return no(st.reason);
  n = Math.min(n, G.hero.ichor || 0);
  if (n <= 0) return no('Sem Icor');
  let total = 0;
  const d = day(G);
  for (let i = 0; i < n; i++) {
    total += ichorPrice(G);
    if (G.city.ichorSales?.day !== d) G.city.ichorSales = { day: d, n: 0 };
    G.city.ichorSales.n += 1;
  }
  G.hero.ichor -= n;
  G.hero.coin = (G.hero.coin || 0) + total;
  counter(G, 'ichorSold', n);
  if (!G.campaign.flags.first_ichor) { G.campaign.flags.first_ichor = true; journal(G, 'Vendi o primeiro frasco de Icor à Guilda.'); }
  const lines = [{ text: `Ilse pesa ${n} frasco(s). +${total} moedas.`, kind: 'good' }];
  if (n >= 3) lines.push(...addRep(G, 'guilda', 1, { cross: false }));
  return ok(lines);
}

export function mapView(G, region) {
  const coin = Math.ceil(MAPS.coin * (G.campaign.flags.guilda_mapas ? 0.5 : 1) * (1 + (Number(region.slice(1)) - 1) * 0.3) * repBuyMult(G, 'guilda'));
  const st = G.world.regions?.[region];
  const total = st?.map?.nodes ? Object.keys(st.map.nodes).length : null;
  const known = st?.discovered?.length || 0;
  let why = (G.hero.coin || 0) < coin ? `Custa ${coin} moedas` : '';
  if (!why && total != null && known >= total) why = 'Você já conhece tudo';
  return { region, coin, n: MAPS.nodes, can: !why, why, known, total };
}
export function buyMap(G, region) {
  const st = serviceStatus(G, 'guilda');
  if (!st.open) return no(st.reason);
  if (!openRegions(G).includes(region)) return no('Ninguém volta de lá para desenhar mapas');
  const v = mapView(G, region);
  if (!v.can) return no(v.why);
  payCoin(G, v.coin);
  return ok([{ text: 'Pergaminho manchado, rotas a carvão.', kind: '' }, ...mapReveal(G, region, v.n), ...cityTime(G, 1)]);
}

export function loanView(G) {
  const L = G.city.loan;
  if (L && L.state === 'open') return { open: true, owe: L.owe, dueDay: L.dueDay, canRepay: (G.hero.coin || 0) >= L.owe };
  if (L && L.state === 'defaulted') return { defaulted: true, owe: L.owe, canRepay: (G.hero.coin || 0) >= L.owe };
  const why = (G.factions.guilda || 0) < -20 ? 'A Guilda não confia em você' : '';
  return { open: false, can: !why, why, amount: LOAN.amount, owe: LOAN.owe, days: LOAN.days };
}
export function takeLoan(G) {
  const st = serviceStatus(G, 'guilda');
  if (!st.open) return no(st.reason);
  const v = loanView(G);
  if (v.open || v.defaulted) return no('Você já deve à Guilda');
  if (!v.can) return no(v.why);
  G.city.loan = { amount: LOAN.amount, owe: LOAN.owe, dueDay: day(G) + LOAN.days, state: 'open' };
  G.hero.coin = (G.hero.coin || 0) + LOAN.amount;
  journal(G, `Peguei ${LOAN.amount} moedas com a Guilda. Devo ${LOAN.owe} até o dia ${G.city.loan.dueDay}.`);
  return ok([{ text: `+${LOAN.amount} moedas. Ilse anota seu nome com tinta vermelha.`, kind: 'warn' }]);
}
export function repayLoan(G) {
  const v = loanView(G);
  if (!v.open && !v.defaulted) return no('Nenhuma dívida');
  if (!v.canRepay) return no(`Precisa de ${v.owe} moedas`);
  payCoin(G, v.owe);
  const was = G.city.loan.state;
  G.city.loan.state = 'paid';
  delete G.campaign.flags.guilda_cobranca;
  const lines = [{ text: 'Dívida quitada. Ilse risca seu nome.', kind: 'good' }];
  if (was === 'defaulted') lines.push(...addRep(G, 'guilda', 15, { cross: false }));
  journal(G, 'Quitei a dívida com a Guilda.');
  return ok(lines);
}

// ------------------------------------------------------------------ taverna
export function drinkView(G) {
  const coin = DRINK.coin;
  const why = (G.hero.coin || 0) < coin ? `Custa ${coin} moedas` : '';
  const risk = (G.hero.flags?.drinks || 0) + 1 >= DRINK.addictAt && !hasTrait(G, DRINK.trait);
  return { coin, hours: DRINK.hours, dread: DRINK.dread, can: !why, why, risk };
}
export function drink(G) {
  const st = serviceStatus(G, 'taverna');
  if (!st.open) return no(st.reason);
  const v = drinkView(G);
  if (!v.can) return no(v.why);
  payCoin(G, v.coin);
  const h = G.hero;
  h.flags = h.flags || {};
  h.flags.drinks = (h.flags.drinks || 0) + 1;
  h.flags.lastDrinkDay = day(G);
  const addicted = hasTrait(G, DRINK.trait);
  const lines = [{ text: R.pick(['Aguardente de nabo. Arde até a alma.', 'Greta enche a caneca sem perguntar.', 'Alguém canta sobre a Queda. Você bebe por eles.']), kind: '' }];
  const eff = [{ op: 'drink' }, { op: 'dread', n: DRINK.dread * (addicted ? 2 : 1) }];
  if (v.risk) eff.push({ op: 'addict', id: DRINK.trait, pct: DRINK.addictPct });
  const r = applyD(G, eff, { source: 'city' });
  lines.push(...r.lines);
  if (v.risk && !EFFECT_KNOWS_ADDICT(r) && !hasTrait(G, DRINK.trait) && R.chance(DRINK.addictPct)) {
    h.traits.push(DRINK.trait);
    lines.push({ text: 'Você precisa disso agora. Traço: Alcoólatra.', kind: 'bad' });
  }
  lines.push(...cityTime(G, v.hours));
  return ok(lines);
}
const EFFECT_KNOWS_ADDICT = (r) => (r.lines || []).some((l) => /alco|víci|vici/i.test(l.text || ''));

export function rumorView(G) {
  const why = (G.hero.coin || 0) < RUMOR_COST.coin ? `Custa ${RUMOR_COST.coin} moedas` : '';
  return { ...RUMOR_COST, can: !why, why };
}
export function hearRumor(G) {
  const st = serviceStatus(G, 'taverna');
  if (!st.open) return no(st.reason);
  const v = rumorView(G);
  if (!v.can) return no(v.why);
  payCoin(G, v.coin);
  const heard = G.city.rumorsHeard || (G.city.rumorsHeard = []);
  const pool = RUMORS.filter((r) => evalCond(G, r.cond));
  let fresh = pool.filter((r) => !heard.includes(r.id));
  if (!fresh.length) { G.city.rumorsHeard = []; fresh = pool.filter((r) => !r.effects.length); }
  const r = R.pick(fresh.length ? fresh : pool);
  const lines = [{ text: `“${r.text}”`, kind: 'info' }];
  if (!heard.includes(r.id)) G.city.rumorsHeard.push(r.id);
  if (r.effects.length) lines.push(...applyD(G, r.effects, { source: 'city' }).lines);
  G.city.rumorLog = [{ day: day(G), text: r.text }, ...(G.city.rumorLog || [])].slice(0, 12);
  lines.push(...cityTime(G, v.hours));
  return ok(lines);
}

export function gambleView(G, stake, cheat = false) {
  let why = (G.hero.coin || 0) < stake ? `Precisa de ${stake} moedas` : '';
  let chance = GAMBLE.winPct;
  if (cheat) {
    try { chance = CK.checkChance ? CK.checkChance(G, { attr: GAMBLE.cheat.attr, diff: GAMBLE.cheat.diff }) : clamp(35 + (G.hero.attrs?.des || 3) * 8 - GAMBLE.cheat.diff, 5, 95); }
    catch { chance = 40; }
  }
  if (!why && G.city.gambleDay === day(G) && (G.city.gambleN || 0) >= 5) why = 'A mesa fechou para você hoje';
  return { stake, chance, can: !why, why, cheat };
}
export function gamble(G, stake, cheat = false) {
  const st = serviceStatus(G, 'taverna');
  if (!st.open) return no(st.reason);
  const v = gambleView(G, stake, cheat);
  if (!v.can) return no(v.why);
  if (G.city.gambleDay !== day(G)) { G.city.gambleDay = day(G); G.city.gambleN = 0; }
  G.city.gambleN += 1;
  const lines = [];
  const roll = R.int(1, 100);
  if (roll <= v.chance) {
    G.hero.coin += stake;
    lines.push({ text: cheat ? `O osso viciado cai certo. +${stake} moedas.` : `Os ossos sorriem para você. +${stake} moedas.`, kind: 'good' });
  } else if (cheat) {
    payCoin(G, stake);
    lines.push({ text: 'Um carroceiro vê o osso na sua manga. Eles te arrastam para o beco.', kind: 'bad' });
    const r = hurtHero(G, 8 + R.int(0, 8), 'surra');
    lines.push(...r.lines);
    if (r.died) return ok(lines, { died: true });
    lines.push(...heroDread(G, 6, 'humilhação'));
    G.city.bans = G.city.bans || {};
    G.city.bans.taverna = day(G) + 3;
    lines.push({ text: 'Greta te barra da taverna por 3 dias.', kind: 'bad' });
  } else {
    payCoin(G, stake);
    lines.push({ text: `Os ossos riem de você. −${stake} moedas.`, kind: 'bad' });
  }
  lines.push(...cityTime(G, 1));
  return ok(lines);
}

/** Sequazes à venda na taverna (rotação a cada 3 dias). */
export function mercsForHire(G) {
  const all = Object.values(CP.COMPANIONS || {});
  if (!all.length) return [];
  const d = Math.floor(day(G) / 3);
  const rng = makeRng((G.seed ^ (d * 40503)) >>> 0);
  const picks = rng.shuffle(all).slice(0, 3);
  return picks.map((c) => {
    const coin = Math.ceil((c.hireCost || 50) * (1 - clamp(priceMod(G), -50, 40) / 100));
    const hiredToday = G.city.hired?.[d]?.includes(c.id);
    let why = hiredToday ? 'Já contratado' : '';
    if (!why && (G.hero.coin || 0) < coin) why = `Custa ${coin} moedas`;
    return { id: c.id, name: c.name, desc: c.desc, coin, wage: c.wage || 0, hp: c.hp, can: !why, why };
  });
}
export function hire(G, id) {
  const st = serviceStatus(G, 'taverna');
  if (!st.open) return no(st.reason);
  const m = mercsForHire(G).find((x) => x.id === id);
  if (!m) return no('Não está mais aqui');
  if (!m.can) return no(m.why);
  payCoin(G, m.coin);
  const lines = [];
  const old = G.hero.companion;
  if (old) lines.push({ text: `${old.name} vai embora sem olhar para trás.`, kind: '' });
  const r = applyD(G, [{ op: 'companion', id }], { source: 'city' });
  if (!G.hero.companion || G.hero.companion.id !== id) G.hero.companion = CP.makeCompanion ? CP.makeCompanion(id) : { id, name: m.name, hp: m.hp, hpMax: m.hp, order: 'atacar', loyalty: 60, kills: 0 };
  const d = Math.floor(day(G) / 3);
  G.city.hired = { [d]: [...(G.city.hired?.[d] || []), id] };
  lines.push({ text: `${m.name} cospe na mão e aperta a sua. Salário: ${m.wage}/dia.`, kind: 'good' }, ...r.lines.filter((l) => !/companheiro|sequaz/i.test(l.text || '')));
  journal(G, `Contratei ${m.name}.`);
  return ok(lines);
}
export function dismissCompanion(G) {
  const c = G.hero.companion;
  if (!c) return no('Ninguém para dispensar');
  G.hero.companion = null;
  return ok([{ text: `${c.name} pega o que é dele e some na Baixa.`, kind: '' }]);
}

// ------------------------------------------------------------------ antro
export function sipView(G) {
  const why = (G.hero.ichor || 0) < ANTRO.sip.ichor ? 'Sem Icor' : '';
  return { ...ANTRO.sip, can: !why, why };
}
export function sipIchor(G) {
  const st = serviceStatus(G, 'antro');
  if (!st.open) return no(st.reason);
  const v = sipView(G);
  if (!v.can) return no(v.why);
  G.hero.ichor -= v.ichor;
  const lines = [{ text: 'Quente e doce. O mundo fica dourado nas bordas.', kind: 'ichor' }];
  const got = healHero(G, v.hp);
  if (got) lines.push({ text: `+${got} Vida`, kind: 'good' });
  lines.push(...heroDread(G, v.dread, 'Icor'));
  lines.push(...heroCorruption(G, v.corruption, 'gole de Icor').lines);
  lines.push(...addRep(G, 'bebedores', 1, { cross: false }));
  if (R.chance(20)) lines.push(...applyD(G, [{ op: 'random', table: [
    { w: 1, text: 'Uma visão: trilhas douradas no Ermo.', effects: [{ op: 'mapReveal', region: R.pick(openRegions(G)), n: 2 }] },
    { w: 1, text: 'Uma visão: seu próprio cadáver, sorrindo.', effects: [{ op: 'dread', n: 8 }] },
  ] }], { source: 'antro' }).lines);
  lines.push(...cityTime(G, v.hours));
  return ok(lines);
}
export function mutationView(G) {
  const m = ANTRO.mutation;
  let why = (G.hero.ichor || 0) < m.ichor ? `Exige ${m.ichor} Icor` : '';
  if (!why && (G.hero.coin || 0) < m.coin) why = `Custa ${m.coin} moedas`;
  if (!why && (G.factions.bebedores || 0) < 0) why = 'O Sem-Pele não confia em você';
  return { ...m, can: !why, why };
}
export function buyMutation(G) {
  const st = serviceStatus(G, 'antro');
  if (!st.open) return no(st.reason);
  const v = mutationView(G);
  if (!v.can) return no(v.why);
  G.hero.ichor -= v.ichor;
  payCoin(G, v.coin);
  const lines = [{ text: 'Eles te amarram na mesa de pedra e injetam o deus direto no osso.', kind: 'corr' }];
  const r = applyD(G, [{ op: 'mutation' }], { source: 'antro' });
  lines.push(...r.lines);
  lines.push(...heroCorruption(G, v.corruption, 'rito do Antro').lines);
  lines.push(...addRep(G, 'bebedores', 3));
  lines.push(...cityTime(G, v.hours));
  return ok(lines, { pending: r.pending });
}
export function bleedOutView(G) {
  const b = ANTRO.bleedOut;
  let why = (G.hero.corruption || 0) < b.minCorruption ? `Exige Corrupção ${b.minCorruption}+` : '';
  if (!why && (G.hero.hp || 0) <= -b.hp + 5) why = 'Fraco demais';
  if (!why && G.city.bledDay && day(G) - G.city.bledDay < 3) why = 'Seu sangue ainda não voltou';
  return { ...b, can: !why, why };
}
export function bleedOut(G) {
  const st = serviceStatus(G, 'antro');
  if (!st.open) return no(st.reason);
  const v = bleedOutView(G);
  if (!v.can) return no(v.why);
  G.city.bledDay = day(G);
  const lines = [{ text: 'Eles bebem do seu braço, um por vez, de olhos fechados.', kind: 'corr' }];
  const r = hurtHero(G, -v.hp, 'sangrado pelos Bebedores');
  lines.push(...r.lines);
  if (r.died) return ok(lines, { died: true });
  G.hero.coin = (G.hero.coin || 0) + v.coin;
  lines.push({ text: `+${v.coin} moedas`, kind: 'good' });
  lines.push(...heroCorruption(G, v.corruption, 'sangue tirado').lines);
  lines.push(...cityTime(G, v.hours));
  return ok(lines);
}
export function devourFragment(G, fid) {
  const st = serviceStatus(G, 'antro');
  if (!st.open) return no(st.reason);
  const r = fragmentTo(G, fid, 'eaten');
  if (!r.ok) return no(r.reason);
  return ok([...r.lines, ...cityTime(G, ANTRO.devour.hours)]);
}

// ------------------------------------------------------------------ casa
/** Dormir em casa até as 8h. */
export function sleepView(G) {
  const hrs = hoursUntil(G, 8) || 24;
  return { hours: hrs, newDay: hour(G) + hrs >= 24 };
}
function restEffects(G, hours) {
  const h = G.hero;
  if (!h || h.dead) return [];
  const lines = [];
  const frac = Math.min(1, hours / 24);
  const got = healHero(G, Math.round(hpMax(G) * REST.sleepHp * frac));
  if (got) lines.push({ text: `+${got} Vida`, kind: 'good' });
  const cap = upgradeLevel(G, 'capela');
  lines.push(...heroDread(G, Math.round((REST.sleepDread - (cap ? 10 : 0)) * frac), 'sono em casa'));
  if (cap >= 2 && (h.corruption || 0) > 0) lines.push(...heroCorruption(G, -2, 'capela dos ancestrais').lines);
  const enf = upgradeLevel(G, 'enfermaria');
  if (enf) for (const w of h.wounds || []) if (w.days > 1) w.days = Math.max(1, w.days - enf);
  if (h.hunger) h.hunger = 0;
  return lines;
}
export function sleep(G) {
  const v = sleepView(G);
  const lines = cityTime(G, v.hours);
  if (G.campaign.ended || G.hero?.dead) return ok(lines);
  return ok([...restEffects(G, v.hours), ...lines]);
}
/** O que interrompe o descanso/ações na cidade (a UI redireciona). */
export function cityInterrupt(G) {
  if (G.campaign.ended) return 'ended';
  if (!G.hero || G.hero.dead || G.lineage.heirs) return 'dead';
  if (G.campaign.pendingSiege?.ready) return 'siege';
  if (G.city.threat) return 'threat';
  if (G.event) return 'event';
  return null;
}
/** Descansar n dias (para no primeiro imprevisto). */
export function rest(G, days) {
  const lines = [];
  let done = 0;
  for (let i = 0; i < days; i++) {
    lines.push(...cityTime(G, 24));
    if (G.campaign.ended || G.hero?.dead) break;
    lines.push(...restEffects(G, 24));
    done++;
    if (cityInterrupt(G)) break;
    // a cada dia de repouso, o amanhecer não gera evento (você está de cama)
    if (i < days - 1) G.city.dawnPending = null;
  }
  return ok([{ text: `${done} dia(s) de repouso.`, kind: '' }, ...lines], { days: done });
}
/** Armeiro da Casa: repara tudo grátis. */
export function houseRepairAll(G) {
  if (upgradeLevel(G, 'armeiro') < 1) return no('A Casa não tem armeiro');
  const items = [...Object.values(G.hero.equip || {}).filter(Boolean), ...(G.hero.inv || [])].filter((x) => repairQuote(G, x));
  if (!items.length) return no('Nada para reparar');
  for (const x of items) x.dur = maxDur(x);
  return ok([{ text: `O armeiro da Casa remenda ${items.length} peça(s).`, kind: 'good' }, ...cityTime(G, 2)]);
}

// ------------------------------------------------------------------ amanhecer / ameaças
/** Ao amanhecer na cidade, às vezes um evento do pool 'city'. Retorna o id (a UI chama startEvent com source 'daily'). */
export function dawnEvent(G) {
  const d = G.city.dawnPending;
  if (!d) return null;
  G.city.dawnPending = null;
  if (G.event || G.combat || G.lineage.heirs || G.campaign.ended) return null;
  if (G.city.lastDailyEventDay === d) return null;
  if (!R.chance(DAWN_EVENT_PCT)) return null;
  let id = null;
  try { id = EV.pickEvent ? EV.pickEvent(G, { pool: 'city' }) : null; } catch (e) { console.error(e); }
  if (!id) return null;
  G.city.lastDailyEventDay = d;
  return id;
}

/** Ameaça de caçadores: spec de combate. */
export function threatSpec(G, { ambushed = false } = {}) {
  const t = G.city.threat;
  if (!t) return null;
  return {
    enemies: t.enemies.map((id, i) => ({ id, dist: i === 0 ? 0 : R.int(0, 2) })),
    region: 'r1', night: isNight(G), dark: false, canFlee: true, ambush: ambushed ? 'enemy' : null,
    context: { source: 'city', kind: 'hunters', faction: t.f },
  };
}
export function fleeHuntersView(G) {
  let chance = 50;
  try { chance = CK.checkChance ? CK.checkChance(G, { attr: 'des', diff: 20 }) : clamp(35 + (G.hero.attrs?.des || 3) * 8 - 20, 5, 95); } catch { /* ignore */ }
  return { chance };
}
/** Correr pelos becos: sucesso = escapa (a ameaça some por ora); falha = combate emboscado. */
export function fleeHunters(G) {
  const { chance } = fleeHuntersView(G);
  const roll = R.int(1, 100);
  if (roll <= chance) {
    G.city.threat = null;
    return { ok: true, escaped: true, lines: [{ text: 'Você some entre varais e açougues. Eles vão voltar.', kind: 'warn' }, ...heroDread(G, 5, 'caçado'), ...cityTime(G, 2)] };
  }
  return { ok: true, escaped: false, lines: [{ text: 'Um beco sem saída. Eles chegam rindo.', kind: 'bad' }] };
}
export function bribeView(G) {
  const t = G.city.threat;
  if (!t) return null;
  const cost = t.f === 'guilda' ? (G.city.loan?.state === 'defaulted' ? G.city.loan.owe : 80) : t.f === 'coroa' ? 100 : null;
  if (cost == null) return { can: false, why: 'Fanáticos não aceitam moedas' };
  return { cost, can: (G.hero.coin || 0) >= cost, why: (G.hero.coin || 0) >= cost ? '' : `Precisa de ${cost} moedas` };
}
export function bribeHunters(G) {
  const v = bribeView(G);
  if (!v?.can) return no(v?.why || 'Sem ameaça');
  const t = G.city.threat;
  payCoin(G, v.cost);
  G.city.threat = null;
  const lines = [{ text: 'Moedas mudam de mão. Eles vão embora — por enquanto.', kind: 'warn' }];
  if (t.f === 'guilda' && G.city.loan?.state === 'defaulted') { G.city.loan.state = 'paid'; delete G.campaign.flags.guilda_cobranca; lines.push({ text: 'Dívida quitada com juros de medo.', kind: '' }); }
  lines.push(...addRep(G, t.f, 8, { cross: false }));
  return ok(lines);
}
/** Depois de vencer os caçadores. */
export function huntersDefeated(G) {
  const t = G.city.threat;
  G.city.threat = null;
  if (!t) return [];
  journal(G, `Matei caçadores da ${FACTIONS[t.f].name} nas ruas de Valdrem.`);
  return [{ text: 'Os corpos ficam no beco. A mensagem também.', kind: '' }, ...addRep(G, t.f, -5, { cross: false })];
}

// ------------------------------------------------------------------ nível
export function canLevel(G) {
  try { return CH.canLevelUp ? !!CH.canLevelUp(G.hero) : false; } catch { return false; }
}
export function levelCost(G) {
  try { return CH.levelUpCost ? CH.levelUpCost(G.hero) : { ichor: (G.hero.level || 1) + 1, corruption: 6 }; } catch { return null; }
}
