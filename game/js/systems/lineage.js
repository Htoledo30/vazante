// Linhagem: morte do herói, cadáver no mundo, herdeiros, relíquia, baú, cofre e melhorias da Casa (Área D).
import { clamp, clone } from '../core/util.js';
import { R } from '../core/rng.js';
import * as CH from './character.js';
import * as IT from './items.js';
import * as NM from './names.js';
import * as BG from '../data/backgrounds.js';
import { HOUSE_UPGRADES, STASH_SIZE } from '../data/city.js';
import { FRAGMENTS } from '../data/story.js';
import { day, journal, addChaga, counter } from './time.js';
import { applyHouseToHero, itemDefOf, traitName, endCampaign } from './campaign.js';
import { REGION_NAMES } from '../data/contracts.js';

export const ATTRS = ['for', 'des', 'vig', 'von', 'ast'];

// ------------------------------------------------------------------ itens do herói
/** Todas as instâncias que o herói carrega (equipadas + mochila). */
export function heroItems(hero) {
  if (!hero) return [];
  return [...Object.values(hero.equip || {}).filter(Boolean), ...(hero.inv || [])];
}

// ------------------------------------------------------------------ morte
/**
 * Gancho heroDeath (puro). info: { region, nodeId, killer, corrupted }.
 * Registra o morto, deixa o cadáver (região ou cidade), Chaga +3, −1 em algo da Casa, gera 3 herdeiros.
 * Retorna { lines, heirs }.
 */
export function onHeroDeath(G, cause = 'Morte', info = {}) {
  const h = G.hero;
  const lines = [];
  if (!h || h.dead) return { lines, heirs: G.lineage.heirs || [] };
  h.dead = true;
  h.hp = 0;
  const region = info.region || G.expedition?.region || G.combat?.context?.region || null;
  const inField = !!region && (!!G.expedition || !!info.region) && G.combat?.context?.source !== 'siege';
  const nodeId = info.nodeId ?? G.expedition?.node ?? null;
  const corrupted = !!info.corrupted || (h.corruption || 0) >= 100 || /transforma/i.test(cause);

  // relíquia volta para a Casa pelo sangue
  let items = heroItems(h).map((x) => clone(x));
  const hl = G.lineage.heirloom;
  if (hl) {
    const idx = items.findIndex((x) => x.uid === hl.uid);
    if (idx >= 0) {
      const inst = items.splice(idx, 1)[0];
      G.lineage.heirloom = ascendHeirloom(G, inst);
      lines.push({ text: `A relíquia volta para a Casa: ${G.lineage.heirloom.name || inst.id}.`, kind: 'ichor' });
    } else {
      G.lineage.heirloom = null;
      lines.push({ text: 'A relíquia da Casa se perdeu com ele.', kind: 'bad' });
    }
  }

  const uid = `dead_${G.lineage.generation}_${day(G)}_${(G.lineage.dead || []).length}`;
  const dead = {
    uid, name: h.name, gen: h.gen || G.lineage.generation, bg: h.bg, level: h.level || 1, cause,
    day: day(G), region: inField ? region : 'cidade', nodeId: inField ? nodeId : null, corrupted,
    killer: info.killer || null, items: items.map((x) => ({ id: x.id, name: x.name || null, q: x.q })), recovered: false,
    coin: h.coin || 0, ichor: h.ichor || 0, daysAlive: h.stats?.daysAlive || 0, kills: h.stats?.kills || 0,
  };
  G.lineage.dead = G.lineage.dead || [];
  G.lineage.dead.push(dead);

  // fragmentos carregados ficam no cadáver
  for (const f of Object.values(FRAGMENTS)) {
    if (items.some((x) => x.id === f.item) && G.campaign.fragments?.[f.id] === 'held') G.campaign.fragments[f.id] = inField ? 'carcass' : 'held';
  }

  if (inField) {
    const st = G.world.regions[region] || (G.world.regions[region] = {});
    st.carcasses = st.carcasses || [];
    st.carcasses.push({
      uid, region, nodeId, name: h.name, gen: dead.gen, level: dead.level, corrupted,
      items, coin: h.coin || 0, ichor: h.ichor || 0, day: day(G), recovered: false,
      enemy: corrupted ? 'aberracao' : null,
    });
    lines.push({ text: corrupted
      ? `O corpo de ${h.name} se levanta em ${REGION_NAMES[region] || region}. Não é mais ${h.name}.`
      : `O corpo de ${h.name} ficou em ${REGION_NAMES[region] || region}, com tudo o que carregava.`, kind: 'bad' });
  } else {
    // morreu na cidade: tudo vai para o baú (sem limite — a família recolhe)
    G.lineage.stash = G.lineage.stash || [];
    for (const it of items) G.lineage.stash.push(it);
    G.lineage.coffer = (G.lineage.coffer || 0) + (h.coin || 0);
    if (h.ichor) G.lineage.stashIchor = (G.lineage.stashIchor || 0) + h.ichor;
    lines.push({ text: `A família recolhe o corpo de ${h.name}. Os pertences vão para o baú.`, kind: '' });
    dead.recovered = true;
  }
  h.equip = {};
  h.inv = [];
  h.coin = 0;
  h.ichor = 0;

  // cidade e Casa
  lines.push(...addChaga(G, 3, `Luto pela Casa ${G.lineage.house}`));
  G.city.morale = clamp((G.city.morale ?? 50) - 5, 0, 100);
  lines.push(...housePenalty(G));
  counter(G, 'deaths');
  journal(G, `${h.name} (${dead.gen}ª geração) morreu: ${cause}${inField ? ` em ${REGION_NAMES[region] || region}` : ''}.`);

  G.lineage.generation = (G.lineage.generation || 1) + 1;
  G.expedition = null;
  G.lineage.heirs = rollHeirs(G);
  if (!G.lineage.heirs.length) {
    endCampaign(G, 'extinct');
  }
  return { lines, heirs: G.lineage.heirs };
}

/** "−1 em algo da casa": melhoria rebaixada ou item valioso do baú levado por credores. */
function housePenalty(G) {
  const ups = Object.entries(G.lineage.upgrades || {}).filter(([, v]) => v > 0);
  if (ups.length && R.chance(50)) {
    const [k] = R.pick(ups);
    G.lineage.upgrades[k] -= 1;
    return [{ text: `No velório, a Casa vendeu o que pôde: ${HOUSE_UPGRADES[k]?.name || k} perde um nível.`, kind: 'bad' }];
  }
  const st = G.lineage.stash || [];
  if (st.length) {
    let best = 0;
    st.forEach((x, i) => { if (valueOf(x) > valueOf(st[best])) best = i; });
    const it = st.splice(best, 1)[0];
    return [{ text: `Credores levaram do baú: ${it.name || itemDefOf(it.id)?.name || it.id}.`, kind: 'bad' }];
  }
  if ((G.lineage.coffer || 0) > 0) {
    const n = Math.ceil(G.lineage.coffer * 0.3);
    G.lineage.coffer -= n;
    return [{ text: `O enterro custou ${n} moedas do cofre.`, kind: 'bad' }];
  }
  return [];
}

function valueOf(inst) {
  try { return IT.itemValue ? IT.itemValue(inst) : (itemDefOf(inst.id)?.value || 0); } catch { return 0; }
}

// ------------------------------------------------------------------ herdeiros
function fallbackHeir(rng) {
  const bgs = BG.BACKGROUNDS ? Object.keys(BG.BACKGROUNDS) : ['desertor'];
  const attrs = { for: 3, des: 3, vig: 3, von: 3, ast: 3 };
  for (let i = 0; i < 5; i++) attrs[rng.pick(ATTRS)] += 1;
  return { name: NM.randomName ? NM.randomName(rng) : rng.pick(['Edda', 'Ivo', 'Magda', 'Tor', 'Wil']), bg: rng.pick(bgs), attrs, traits: [] };
}

/** Bônus de treino da Casa aplicado aos atributos (+1 por nível nos dois maiores). */
function applyTraining(attrs, lvl) {
  const out = { ...attrs };
  for (let i = 0; i < lvl; i++) {
    const order = ATTRS.slice().sort((a, b) => out[b] - out[a]);
    const k = order[i % 2];
    out[k] = Math.min(8, out[k] + 1);
  }
  return out;
}

export function rollHeirs(G, n = 3) {
  const out = [];
  const train = G.lineage.upgrades?.treino || 0;
  for (let i = 0; i < n; i++) {
    let c;
    try { c = CH.rollHeir ? CH.rollHeir(G, R) : null; } catch (e) { console.error(e); }
    c = c || fallbackHeir(R);
    const base = { ...c.attrs };
    c = { ...c, attrs: applyTraining(c.attrs, train), baseAttrs: base, traits: c.traits || [] };
    if (out.some((o) => o.name === c.name)) c.name = `${c.name} ${['II', 'o Moço', 'a Moça', 'Filho', 'Filha'][i] || ''}`.trim();
    out.push(c);
  }
  return out;
}

export function bgName(id) { return BG.BACKGROUNDS?.[id]?.name || id; }
export function bgDesc(id) { return BG.BACKGROUNDS?.[id]?.desc || ''; }

/** Escolhe o herdeiro idx. Cria o herói e aplica Casa, relíquia e armeiro. */
export function chooseHeir(G, idx) {
  const c = G.lineage.heirs?.[idx];
  if (!c) return { ok: false, reason: 'Herdeiro inválido', lines: [] };
  const gen = G.lineage.generation;
  let hero;
  if (CH.createHero) hero = CH.createHero({ name: c.name, bg: c.bg, attrs: c.attrs, gen });
  else hero = { uid: `h${gen}`, name: c.name, bg: c.bg, gen, attrs: { ...c.attrs }, level: 1, ichorDrunk: 0, talents: [], traits: [], mutations: [], hp: 40, dread: 0, corruption: 0, wounds: [], prosthetics: {}, mastery: {}, techniques: [], equip: {}, inv: [], coin: 0, ichor: 0, companion: null, hunger: 0, stats: { kills: 0, executions: 0, severed: 0, expeditions: 0, daysAlive: 0 }, flags: {} };
  hero.gen = gen;
  hero.traits = [...new Set([...(hero.traits || []), ...(c.traits || [])])];
  hero.flags = hero.flags || {};
  applyHouseToHero(G, hero);
  const lines = [];
  // armeiro nível 2: arma inicial Boa
  if ((G.lineage.upgrades?.armeiro || 0) >= 2 && hero.equip?.main && (hero.equip.main.q ?? 1) < 2) {
    hero.equip.main.q = 2;
    lines.push({ text: 'O armeiro da Casa afiou a arma do herdeiro (Boa).', kind: 'good' });
  }
  // relíquia
  if (G.lineage.heirloom) {
    const inst = clone(G.lineage.heirloom);
    if (IT.addItem) IT.addItem(hero, inst); else (hero.inv = hero.inv || []).push(inst);
    lines.push({ text: `Herdou: ${inst.name || itemDefOf(inst.id)?.name || inst.id}.`, kind: 'ichor' });
  }
  // capela nível 1+: o herdeiro começa menos assustado com a morte do parente
  hero.dread = clamp((hero.dread || 0) + ((G.lineage.upgrades?.capela || 0) ? 5 : 15), 0, 100);
  G.hero = hero;
  G.lineage.heirs = null;
  G.combat = null;
  G.event = null;
  G.pendingLoot = null;
  G.expedition = null;
  journal(G, `${hero.name} (${bgName(hero.bg)}) assume a Casa ${G.lineage.house}. ${gen}ª geração.`);
  return { ok: true, lines };
}

// ------------------------------------------------------------------ relíquia
function ascendHeirloom(G, inst) {
  const x = clone(inst);
  x.heirGen = (x.heirGen || 0) + 1;
  if ((x.q ?? 1) < 3) x.q = (x.q ?? 1) + 1;
  else { x.mods = { ...(x.mods || {}) }; x.mods.crit = Math.min(10, (x.mods.crit || 0) + 2); }
  const base = x.name || itemDefOf(x.id)?.name || x.id;
  if (!/ da Casa /.test(base)) x.name = `${base} da Casa ${G.lineage.house}`;
  return x;
}

export const HEIRLOOM_COST = { ichor: 1 };

/** Consagrar um item (arma/armadura/mão secundária/amuleto) como relíquia da Casa. */
export function setHeirloom(G, uid) {
  const h = G.hero;
  const inst = heroItems(h).find((x) => x.uid === uid);
  if (!inst) return { ok: false, reason: 'Item não encontrado', lines: [] };
  const def = itemDefOf(inst.id);
  if (def && !['weapon', 'armor', 'offhand', 'trinket'].includes(def.type)) return { ok: false, reason: 'Só armas, armaduras e amuletos', lines: [] };
  if ((h.ichor || 0) < HEIRLOOM_COST.ichor) return { ok: false, reason: `Custa ${HEIRLOOM_COST.ichor} Icor`, lines: [] };
  h.ichor -= HEIRLOOM_COST.ichor;
  G.lineage.heirloom = clone(inst);
  journal(G, `Consagrei ${inst.name || def?.name || inst.id} como relíquia da Casa.`);
  return { ok: true, lines: [{ text: 'Sangue de Icor na lâmina, o nome da Casa gravado. Se você morrer, ela volta.', kind: 'ichor' }] };
}
export const isHeirloom = (G, inst) => !!inst && G.lineage.heirloom?.uid === inst.uid;

// ------------------------------------------------------------------ baú e cofre
export const stashCap = (G) => STASH_SIZE[G.lineage.upgrades?.bau || 0];
export const stashUsed = (G) => (G.lineage.stash || []).length;

function canStack(a, b) {
  return a.id === b.id && !a.ench && !b.ench && !a.mods && !b.mods && !a.name && !b.name && (a.q ?? 1) === (b.q ?? 1)
    && ['consumable', 'material', 'ammo'].includes(itemDefOf(a.id)?.type);
}

export function deposit(G, uid) {
  const h = G.hero;
  const i = (h.inv || []).findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, reason: 'Desequipe antes de guardar' };
  const inst = h.inv[i];
  const st = G.lineage.stash || (G.lineage.stash = []);
  const same = st.find((x) => canStack(x, inst));
  if (!same && st.length >= stashCap(G)) return { ok: false, reason: 'Baú cheio' };
  h.inv.splice(i, 1);
  if (same) same.n = (same.n || 1) + (inst.n || 1);
  else st.push(inst);
  return { ok: true };
}

export function withdraw(G, uid) {
  const st = G.lineage.stash || [];
  const i = st.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, reason: 'Não está no baú' };
  const inst = st.splice(i, 1)[0];
  if (IT.addItem) {
    const r = IT.addItem(G.hero, inst);
    if (r && r.ok === false) { st.splice(i, 0, inst); return { ok: false, reason: r.reason || 'Não cabe' }; }
  } else (G.hero.inv = G.hero.inv || []).push(inst);
  return { ok: true };
}

export function depositCoin(G, n) {
  n = Math.min(n, G.hero.coin || 0);
  if (n <= 0) return 0;
  G.hero.coin -= n;
  G.lineage.coffer = (G.lineage.coffer || 0) + n;
  return n;
}
export function withdrawCoin(G, n) {
  n = Math.min(n, G.lineage.coffer || 0);
  if (n <= 0) return 0;
  G.lineage.coffer -= n;
  G.hero.coin = (G.hero.coin || 0) + n;
  return n;
}
export function withdrawIchor(G) {
  const n = G.lineage.stashIchor || 0;
  if (!n) return 0;
  G.lineage.stashIchor = 0;
  G.hero.ichor = (G.hero.ichor || 0) + n;
  return n;
}

// ------------------------------------------------------------------ melhorias
export function upgradeLevel(G, id) { return G.lineage.upgrades?.[id] || 0; }
export function upgradeCost(G, id) {
  const u = HOUSE_UPGRADES[id];
  const lv = upgradeLevel(G, id);
  return lv >= u.max ? null : u.costs[lv];
}
export function buyUpgrade(G, id) {
  const u = HOUSE_UPGRADES[id];
  if (!u) return { ok: false, reason: 'Melhoria desconhecida', lines: [] };
  const cost = upgradeCost(G, id);
  if (cost == null) return { ok: false, reason: 'Nível máximo', lines: [] };
  const total = (G.hero.coin || 0) + (G.lineage.coffer || 0);
  if (total < cost) return { ok: false, reason: `Faltam ${cost - total} moedas`, lines: [] };
  // paga do bolso e completa com o cofre
  const fromHero = Math.min(G.hero.coin || 0, cost);
  G.hero.coin -= fromHero;
  G.lineage.coffer -= cost - fromHero;
  G.lineage.upgrades = G.lineage.upgrades || {};
  G.lineage.upgrades[id] = upgradeLevel(G, id) + 1;
  journal(G, `A Casa construiu: ${u.name} (nível ${G.lineage.upgrades[id]}).`);
  return { ok: true, lines: [{ text: `${u.name} — nível ${G.lineage.upgrades[id]}`, kind: 'good' }] };
}

// ------------------------------------------------------------------ carcaças (para C)
/**
 * C chama ao saquear um nó Carcaça. Move itens/moedas/Icor para G.pendingLoot e marca recuperado.
 * Retorna a carcaça (ou null).
 */
export function recoverCarcass(G, region, uid, { source = 'expedition' } = {}) {
  const st = G.world.regions?.[region];
  const c = st?.carcasses?.find((x) => x.uid === uid);
  if (!c || c.recovered) return null;
  c.recovered = true;
  const dead = (G.lineage.dead || []).find((d) => d.uid === uid);
  if (dead) dead.recovered = true;
  if (c.contract) G.campaign.flags[`carcass_${c.uid}`] = true;
  G.pendingLoot = { items: c.items || [], coin: c.coin || 0, ichor: c.ichor || 0, source, title: c.npc ? `Carcaça de ${c.name}` : `O corpo de ${c.name}` };
  c.items = [];
  if (!c.npc) journal(G, `Encontrei o corpo de ${c.name}.`);
  return c;
}

export function carcassesIn(G, region) { return (G.world.regions?.[region]?.carcasses || []).filter((c) => !c.recovered); }
export { traitName };
