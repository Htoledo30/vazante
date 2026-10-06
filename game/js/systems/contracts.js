// Contratos rastreáveis do Quartel e da Guilda (Área D).
// G.city.contracts = [ { uid, tpl, giver, kind, title, desc, region, targets, item, n, base, deadline, reward, state, ... } ]
// state: 'offer' | 'active' | 'done' | 'failed'
import { clamp, uid as mkUid } from '../core/util.js';
import { R } from '../core/rng.js';
import * as EN from '../data/enemies.js';
import * as EX from './expedition.js';
import * as IT from './items.js';
import * as LO from './loot.js';
import { CONTRACT_TEMPLATES, CONTRACT_LIMITS, ENEMY_POOLS, POOL_NAMES, REGION_NAMES } from '../data/contracts.js';
import { HOUSE_NAMES } from '../data/story.js';
import { day, journal, counter, advanceTime } from './time.js';
import { addRep } from './factions.js';
import { killsOf, nestsDestroyed, itemDefOf, heroCount, applyD, bossCount } from './campaign.js';
import { addDefense } from './siege.js';

const GIVER_FACTION = { quartel: 'coroa', guilda: 'guilda' };
const NPC_FIRST = ['Bertil', 'Joana Torta', 'Ulf', 'Maren', 'Osk', 'Teodora', 'Vasco Sem-Nariz', 'Ida', 'Rurik', 'Lena Cinza'];

export const contractsOf = (G, giver, state) => (G.city.contracts || []).filter((c) => (!giver || c.giver === giver) && (!state || c.state === state));
export const activeContracts = (G) => contractsOf(G, null, 'active');

/** Regiões acessíveis (r1 sempre; as seguintes conforme chefes). */
export function openRegions(G) {
  const out = ['r1'];
  const b = G.campaign.bosses || {};
  if (b.r1) out.push('r2');
  if (b.r2) out.push('r3');
  if (b.r3) out.push('r4');
  if (b.r4) out.push('r5');
  return out;
}

const enemyOk = (id) => !EN.ENEMIES || !!EN.ENEMIES[id];

function fill(str, map) { return str.replace(/\{(\w+)\}/g, (_, k) => (map[k] ?? `{${k}}`)); }

function pickTargets(tpl, region) {
  const pools = ENEMY_POOLS[region] || {};
  if (tpl.fixed) return { ids: tpl.fixed.filter(enemyOk), poolName: 'desertores' };
  let key = tpl.pool;
  if (key === 'any') key = R.pick(Object.keys(pools).filter((k) => k !== 'elite' && (pools[k] || []).some(enemyOk)));
  const ids = (pools[key] || []).filter(enemyOk);
  return { ids, poolName: POOL_NAMES[key] || key || 'criaturas' };
}

/** Gera um contrato a partir de um modelo (ou null se impossível agora). */
export function makeContract(G, tpl) {
  const regions = openRegions(G);
  let region = tpl.region || R.pick(regions.slice(-2));
  if (!regions.includes(region)) return null;
  const d = day(G);
  const n = R.range(tpl.n);
  const c = {
    uid: mkUid('ct'), tpl: tpl.id, giver: tpl.giver, kind: tpl.kind, region, n,
    targets: [], item: null, base: 0, offeredDay: d, deadline: 0, days: R.range(tpl.days),
    reward: { coin: R.range(tpl.coin), rep: tpl.rep || 0 },
    state: 'offer',
  };
  // dificuldade por região: paga mais quanto mais fundo
  const tier = Number(region.slice(1)) || 1;
  c.reward.coin = Math.round(c.reward.coin * (1 + (tier - 1) * 0.35));
  if (tpl.ichor) c.reward.ichor = R.range(tpl.ichor);
  if (tpl.item) c.reward.item = tpl.item.replace('+1', String(Math.min(5, tier + 1))).replace('+0', String(tier));
  if (tpl.defense) c.reward.defense = tpl.defense;
  if (tpl.morale) c.reward.morale = tpl.morale;
  const map = { region: REGION_NAMES[region], n: String(n) };
  switch (tpl.kind) {
    case 'hunt': {
      const t = pickTargets(tpl, region);
      if (!t.ids.length) return null;
      c.targets = t.ids;
      map.pool = t.poolName;
      break;
    }
    case 'bring': {
      const opts = tpl.items.filter((id) => !ITEMS_KNOWN() || itemDefOf(id));
      if (!opts.length) return null;
      c.item = R.pick(opts);
      map.item = itemDefOf(c.item)?.name || c.item;
      break;
    }
    case 'nest': break;
    case 'carcass': {
      map.npc = R.pick(NPC_FIRST);
      map.house = R.pick(HOUSE_NAMES);
      c.npc = map.npc;
      break;
    }
    case 'escort': c.hours = tpl.hours || 36; break;
    case 'boss': {
      if (G.campaign.bosses?.[region]) return null;
      break;
    }
    default: return null;
  }
  c.title = fill(tpl.title, map);
  c.desc = fill(tpl.desc, map);
  return c;
}
/** ITEMS de A carregado? (sem ele, não filtra ids de material). */
const ITEMS_KNOWN = () => !!itemDefOf('racao') || !!itemDefOf('sucata');

/** Reabastece as ofertas do quadro a cada N dias. */
export function refreshOffers(G, giver, force = false) {
  G.city.contractDay = G.city.contractDay || {};
  const d = day(G);
  const last = G.city.contractDay[giver];
  if (!force && last != null && d - last < CONTRACT_LIMITS.refreshDays) return false;
  G.city.contractDay[giver] = d;
  G.city.contracts = (G.city.contracts || []).filter((c) => !(c.giver === giver && c.state === 'offer'));
  // limpa históricos velhos
  G.city.contracts = G.city.contracts.filter((c) => c.state === 'active' || c.state === 'offer' || d - (c.closedDay || d) < 15);
  const tpls = CONTRACT_TEMPLATES.filter((t) => t.giver === giver && (!t.minBoss || bossCount(G) >= t.minBoss));
  let tries = 0;
  const seen = new Set();
  while (contractsOf(G, giver, 'offer').length < CONTRACT_LIMITS.offers && tries++ < 20) {
    const tpl = R.weighted(tpls, (t) => (seen.has(t.id) ? t.w * 0.25 : t.w));
    const c = makeContract(G, tpl);
    if (c) { seen.add(tpl.id); G.city.contracts.push(c); }
  }
  return true;
}

/** Injeta a carcaça do NPC na região (C mostra como nó Carcaça). */
function injectCarcass(G, c) {
  let st = G.world.regions?.[c.region];
  if ((!st || !st.map) && EX.ensureRegion) { try { st = EX.ensureRegion(G, c.region) || G.world.regions[c.region]; } catch (e) { console.error(e); } }
  if (!st) { G.world.regions[c.region] = st = {}; }
  st.carcasses = st.carcasses || [];
  const nodes = Object.values(st.map?.nodes || {}).filter((n) => (n.depth || 0) >= 2 && !['boss', 'entry', 'entrada', 'chefe'].includes(n.type));
  const node = nodes.length ? R.pick(nodes) : null;
  const items = [];
  if (LO.randomItem) { try { const it = LO.randomItem(G, { tier: Number(c.region.slice(1)) || 1 }); if (it) items.push(it); } catch { /* ignore */ } }
  if (IT.makeItem && itemDefOf('racao')) items.push(IT.makeItem('racao', { n: 2 }));
  const carc = {
    uid: `carc_${c.uid}`, contract: c.uid, npc: true, name: c.npc, gen: 0, level: Number(c.region.slice(1)) + 1,
    region: c.region, nodeId: node?.id ?? null, items, coin: R.int(10, 40), ichor: c.reward.ichor || 1,
    corrupted: R.chance(25), day: day(G), recovered: false,
  };
  st.carcasses.push(carc);
  if (node && st.discovered && !st.discovered.includes(node.id)) st.discovered.push(node.id);
  c.carcassUid = carc.uid;
}

export function acceptContract(G, uid) {
  const c = (G.city.contracts || []).find((x) => x.uid === uid);
  if (!c || c.state !== 'offer') return { ok: false, reason: 'Contrato indisponível', lines: [] };
  if (activeContracts(G).length >= CONTRACT_LIMITS.active) return { ok: false, reason: `Máximo de ${CONTRACT_LIMITS.active} contratos ativos`, lines: [] };
  if (c.kind === 'escort' && G.campaign.pendingSiege) {
    const left = G.campaign.pendingSiege.dueDay - day(G);
    if (left * 24 <= (c.hours || 36)) return { ok: false, reason: 'O cerco chega antes da volta', lines: [] };
  }
  c.state = 'active';
  c.acceptedDay = day(G);
  c.deadline = day(G) + c.days;
  if (c.kind === 'hunt') c.base = killsOf(G, c.targets);
  if (c.kind === 'nest') c.base = nestsDestroyed(G, c.region);
  if (c.kind === 'carcass') injectCarcass(G, c);
  journal(G, `Contrato aceito: ${c.title}.`);
  const lines = [{ text: `Contrato: ${c.title}. Prazo: dia ${c.deadline}.`, kind: 'info' }];
  if (c.kind === 'escort') { c.escort = { fight: 0, fights: c.n }; lines.push({ text: 'A carroça sai agora.', kind: 'warn' }); }
  return { ok: true, lines, escort: c.kind === 'escort' };
}

/** Progresso: { cur, need, done, label }. */
export function contractProgress(G, c) {
  switch (c.kind) {
    case 'hunt': {
      const cur = Math.max(0, killsOf(G, c.targets) - c.base);
      return { cur: Math.min(cur, c.n), need: c.n, done: cur >= c.n, label: `${Math.min(cur, c.n)}/${c.n} mortos` };
    }
    case 'bring': {
      const cur = heroCount(G, c.item);
      return { cur: Math.min(cur, c.n), need: c.n, done: cur >= c.n, label: `${Math.min(cur, c.n)}/${c.n} na mochila` };
    }
    case 'nest': {
      const cur = Math.max(0, nestsDestroyed(G, c.region) - c.base);
      return { cur: Math.min(cur, c.n), need: c.n, done: cur >= c.n, label: `${Math.min(cur, c.n)}/${c.n} ninhos` };
    }
    case 'carcass': {
      const carc = (G.world.regions?.[c.region]?.carcasses || []).find((x) => x.uid === c.carcassUid);
      const ok = !!carc?.recovered || !!G.campaign.flags[`carcass_${c.carcassUid}`];
      return { cur: ok ? 1 : 0, need: 1, done: ok, label: ok ? 'Carcaça recuperada' : 'Encontre a carcaça no mapa' };
    }
    case 'boss': {
      const ok = !!G.campaign.bosses?.[c.region];
      return { cur: ok ? 1 : 0, need: 1, done: ok, label: ok ? 'Chefe morto' : 'Chefe vivo' };
    }
    case 'escort': {
      const e = c.escort || { fight: 0, fights: c.n };
      return { cur: e.fight, need: e.fights, done: e.fight >= e.fights, label: `${e.fight}/${e.fights} emboscadas` };
    }
    default: return { cur: 0, need: 1, done: false, label: '' };
  }
}

export function rewardText(c) {
  const r = c.reward;
  const p = [`${r.coin} moedas`];
  if (r.ichor) p.push(`${r.ichor} Icor`);
  if (r.item) p.push('item');
  if (r.defense) p.push(`+${r.defense} muralha`);
  if (r.rep) p.push(`+${r.rep} rep.`);
  return p.join(', ');
}

function payReward(G, c) {
  const lines = [];
  const h = G.hero;
  h.coin = (h.coin || 0) + c.reward.coin;
  lines.push({ text: `+${c.reward.coin} moedas`, kind: 'good' });
  if (c.reward.ichor) { h.ichor = (h.ichor || 0) + c.reward.ichor; lines.push({ text: `+${c.reward.ichor} Icor`, kind: 'ichor' }); }
  if (c.reward.item) lines.push(...applyD(G, [{ op: 'item', id: c.reward.item }], { source: 'contract' }).lines);
  if (c.reward.defense) lines.push(...addDefense(G, c.reward.defense));
  if (c.reward.morale) G.city.morale = clamp((G.city.morale ?? 50) + c.reward.morale, 0, 100);
  if (c.reward.rep) lines.push(...addRep(G, GIVER_FACTION[c.giver], c.reward.rep));
  return lines;
}

/** Entrega. 'bring' consome os itens. */
export function turnInContract(G, uid) {
  const c = (G.city.contracts || []).find((x) => x.uid === uid);
  if (!c || c.state !== 'active') return { ok: false, reason: 'Contrato inválido', lines: [] };
  const p = contractProgress(G, c);
  if (!p.done) return { ok: false, reason: 'Objetivo incompleto', lines: [] };
  if (c.kind === 'bring' && IT.removeItem) IT.removeItem(G.hero, c.item, c.n);
  c.state = 'done';
  c.closedDay = day(G);
  counter(G, 'contractsDone');
  journal(G, `Contrato cumprido: ${c.title}.`);
  return { ok: true, lines: [{ text: `Contrato cumprido: ${c.title}`, kind: 'good' }, ...payReward(G, c)] };
}

function failContract(G, c, why) {
  c.state = 'failed';
  c.closedDay = day(G);
  counter(G, 'contractsFailed');
  journal(G, `Contrato perdido: ${c.title}${why ? ` (${why})` : ''}.`);
  if (c.carcassUid) {
    const st = G.world.regions?.[c.region];
    if (st?.carcasses) st.carcasses = st.carcasses.filter((x) => x.uid !== c.carcassUid || x.recovered);
  }
  return [{ text: `Contrato falhou: ${c.title}`, kind: 'bad' }, ...addRep(G, GIVER_FACTION[c.giver], CONTRACT_LIMITS.failRep, { cross: false })];
}

export function abandonContract(G, uid) {
  const c = (G.city.contracts || []).find((x) => x.uid === uid);
  if (!c || c.state !== 'active') return [];
  return failContract(G, c, 'abandonado');
}

/** Virada do dia: contratos vencidos falham. */
export function expireContracts(G, d) {
  const lines = [];
  for (const c of G.city.contracts || []) {
    if (c.state === 'active' && c.deadline && d > c.deadline && !contractProgress(G, c).done) lines.push(...failContract(G, c, 'prazo'));
  }
  return lines;
}

/** Contratos ativos já cumpridos (avisos no hub). */
export const contractsReady = (G) => activeContracts(G).filter((c) => contractProgress(G, c).done);

// ------------------------------------------------------------------ escolta
/** Spec da próxima emboscada da escolta (a UI chama startCombat). */
export function escortSpec(G, uid) {
  const c = (G.city.contracts || []).find((x) => x.uid === uid);
  if (!c || c.kind !== 'escort' || c.state !== 'active') return null;
  const pools = ENEMY_POOLS[c.region] || ENEMY_POOLS.r1;
  const ids = [...(pools.humanos || []), ...(pools.feras || [])].filter(enemyOk);
  const fight = c.escort.fight;
  const n = 2 + (fight > 0 ? 1 : 0);
  const enemies = Array.from({ length: n }, () => ({ id: R.pick(ids.length ? ids : ['saqueador']), dist: R.int(0, 2) }));
  return { enemies, region: c.region, canFlee: true, ambush: fight === 0 ? 'enemy' : undefined, context: { source: 'contract', contract: c.uid, fight } };
}

/** Fim de uma luta da escolta: { status:'next'|'done'|'failed', lines }. */
export function escortStep(G, uid, outcome = {}) {
  const c = (G.city.contracts || []).find((x) => x.uid === uid);
  if (!c?.escort) return { status: 'failed', lines: [] };
  if (outcome.result !== 'win') {
    const lines = failContract(G, c, 'a carroça foi perdida');
    lines.push(...advanceTime(G, Math.round((c.hours || 36) / 2), { where: 'field' }));
    return { status: 'failed', lines };
  }
  c.escort.fight += 1;
  if (c.escort.fight < c.escort.fights) {
    const lines = advanceTime(G, Math.round((c.hours || 36) / (c.escort.fights + 1)), { where: 'field' });
    return { status: 'next', lines: [{ text: 'A estrada segue. Mais adiante, outra emboscada.', kind: 'warn' }, ...lines] };
  }
  const lines = advanceTime(G, Math.round((c.hours || 36) / (c.escort.fights + 1)), { where: 'field' });
  const r = turnInContract(G, uid);
  return { status: 'done', lines: [{ text: 'O grão chegou a Moenda. Você volta com a carroça vazia.', kind: 'good' }, ...lines, ...r.lines] };
}
