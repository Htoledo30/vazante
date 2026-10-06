// ICOR — linguagem comum de efeitos e condições (Área A).
// applyEffects(G, effects, ctx) -> { lines:[{text, kind}], pending:[...] }
// pending: { type:'combat', spec } | { type:'event', id } | { type:'death', cause } | { type:'loot' }
// Ops de outras áreas são delegadas aos donos (time, factions, campaign, siege, expedition) por namespace,
// só em tempo de execução — assim ciclos de importação não quebram o carregamento.
import { R } from '../core/rng.js';
import { clamp } from '../core/util.js';
import * as CH from './character.js';
import * as IT from './items.js';
import * as WS from './wounds.js';
import * as LO from './loot.js';
import * as TM from './time.js';
import * as FA from './factions.js';
import * as CP from './campaign.js';
import * as SG from './siege.js';
import * as EX from './expedition.js';
import { ITEMS } from '../data/items.js';
import { TRAITS } from '../data/traits.js';
import { MUTATIONS } from '../data/mutations.js';
import { TECHNIQUES } from '../data/techniques.js';
import { COMPANIONS, makeCompanion } from '../data/companions.js';
import { BACKGROUNDS } from '../data/backgrounds.js';

const ATTR = { for: 'FOR', des: 'DES', vig: 'VIG', von: 'VON', ast: 'AST' };
const FACTION_NAMES = { sutura: 'Sutura', coroa: 'Coroa', guilda: 'Guilda', bebedores: 'Bebedores' };
const PART_NAMES = { cabeca: 'cabeça', tronco: 'tronco', bracoD: 'braço da arma', bracoE: 'braço do escudo', pernas: 'pernas' };
const REGION_NAMES = { r1: 'Campos de Cinza', r2: 'Floresta dos Enforcados', r3: 'Catacumbas de Sal', r4: 'Vel-Maren', r5: 'O Cadáver' };

const line = (text, kind = '') => ({ text, kind });
const sgn = (n) => (n > 0 ? `+${n}` : `${n}`);
const asLines = (x) => (Array.isArray(x) ? x : x?.lines || []).map((l) => (typeof l === 'string' ? line(l) : l)).filter((l) => l && l.text);
const itemName = (id) => ITEMS[id]?.name || id;
const inCombat = (G) => !!(G.combat && !G.combat.result);
const day = (G) => Math.floor((G.time || 0) / 24) + 1;

function safe(fn, fallback) { try { return fn(); } catch (e) { console.error('[effects]', e); return fallback; } }

/** Aplica a lista de efeitos. ctx: { source, region, nodeId, item, ... } */
export function applyEffects(G, effects, ctx = {}) {
  const out = { lines: [], pending: [] };
  if (!G || !Array.isArray(effects)) return out;
  const st = { drinkDouble: false };
  for (const e of effects) {
    if (!e || !e.op) continue;
    try { applyOne(G, e, ctx, out, st); } catch (err) { console.error('[effects] op falhou', e, err); }
    if (out.pending.some((p) => p.type === 'death')) break;
  }
  return out;
}

function hurt(G, n, why, out) {
  const h = G.hero;
  if (inCombat(G)) {
    h.hp = Math.max(1, (h.hp || 0) - n);
    const a = G.combat.actors?.find((x) => x.side === 'hero');
    if (a) a.hp = h.hp;
    out.lines.push(line(`−${n} Vida${why ? ` (${why})` : ''}.`, 'bad'));
    return;
  }
  const r = CH.damageHero(G, n, why || 'Ferimentos');
  out.lines.push(line(`−${r.dealt} Vida${why ? ` (${why})` : ''}.`, 'bad'));
  if (r.died) out.pending.push({ type: 'death', cause: why || 'Ferimentos' });
}

function giveItem(G, id, n, q, out) {
  const h = G.hero;
  if (String(id).startsWith('@')) {
    const m = /^@(\w+):([1-5]|R|T)$/.exec(id);
    const tier = m && /\d/.test(m[2]) ? Number(m[2]) : regionTier(G);
    for (let i = 0; i < (n || 1); i++) {
      const inst = LO.randomItem(G, { type: m ? m[1] : 'any', tier });
      if (inst) { IT.addItem(h, inst); out.lines.push(line(`+ ${IT.itemName(inst)}`, 'good')); }
    }
    return;
  }
  const def = ITEMS[id];
  if (!def) { console.warn('[effects] item desconhecido', id); return; }
  if (IT.isStackable(def)) IT.addItem(h, IT.makeItem(id, { n: n || 1, q: q ?? 1 }));
  else for (let i = 0; i < (n || 1); i++) IT.addItem(h, IT.makeItem(id, { q: q ?? 1 }));
  out.lines.push(line(`+${(n || 1) > 1 ? `${n}× ` : ''}${def.name}`, 'good'));
}

function regionTier(G) {
  const r = G.expedition?.region || G.combat?.context?.region;
  const m = /^r([1-5])$/.exec(r || '');
  if (m) return Number(m[1]);
  const bosses = Object.values(G.campaign?.bosses || {}).filter(Boolean).length;
  return clamp(1 + bosses, 1, 5);
}

function queueLoot(G, loot, ctx) {
  const items = loot.items || [];
  if (!items.length && !loot.coin && !loot.ichor) return false;
  const pl = G.pendingLoot;
  if (pl) {
    pl.items = [...(pl.items || []), ...items];
    pl.coin = (pl.coin || 0) + (loot.coin || 0);
    pl.ichor = (pl.ichor || 0) + (loot.ichor || 0);
  } else {
    G.pendingLoot = { items, coin: loot.coin || 0, ichor: loot.ichor || 0, source: ctx.source || 'expedition', title: ctx.lootTitle || 'Saque' };
  }
  return true;
}

function applyOne(G, e, ctx, out, st) {
  const h = G.hero;
  const n = e.n ?? 1;
  switch (e.op) {
    // ---------------------------------------------------- recursos do herói
    case 'hp': case 'heal': {
      if (!h) return;
      if (n >= 0) {
        const got = inCombat(G) ? healInCombat(G, n) : CH.heal(h, n);
        if (got > 0) out.lines.push(line(`+${got} Vida.`, 'good'));
      } else hurt(G, -n, e.why || ctx.why || '', out);
      return;
    }
    case 'dread': {
      if (!h) return;
      let v = n;
      if (v < 0 && st.drinkDouble) v *= 2;
      const r = CH.addDread(G, v, e.why || '');
      out.lines.push(...asLines(r));
      return;
    }
    case 'corruption': {
      if (!h) return;
      const r = CH.addCorruption(G, n, e.why || '');
      out.lines.push(...asLines(r));
      if (r.transformed) out.pending.push({ type: 'death', cause: 'Transformação', corrupted: true, handled: true });
      return;
    }
    case 'stamina': {
      const a = G.combat?.actors?.find((x) => x.side === 'hero');
      if (a) { a.stamina = clamp((a.stamina || 0) + n, 0, a.staminaMax || 99); out.lines.push(line(`${sgn(n)} Fôlego.`, n > 0 ? 'good' : 'bad')); }
      return;
    }
    case 'coin': {
      if (!h) return;
      const v = n < 0 ? -Math.min(-n, h.coin || 0) : n;
      h.coin = Math.max(0, (h.coin || 0) + v);
      if (v) out.lines.push(line(`${sgn(v)} moedas.`, v > 0 ? 'good' : 'bad'));
      return;
    }
    case 'ichor': {
      if (!h) return;
      const v = n < 0 ? -Math.min(-n, h.ichor || 0) : n;
      h.ichor = Math.max(0, (h.ichor || 0) + v);
      if (v) out.lines.push(line(`${sgn(v)} Icor.`, 'ichor'));
      return;
    }
    case 'attr': {
      if (!h || !ATTR[e.a]) return;
      const before = h.attrs[e.a] || 1;
      h.attrs[e.a] = clamp(before + n, 1, 10);
      if (h.attrs[e.a] !== before) out.lines.push(line(`${ATTR[e.a]} ${sgn(h.attrs[e.a] - before)} (agora ${h.attrs[e.a]}).`, n > 0 ? 'good' : 'bad'));
      return;
    }
    // ---------------------------------------------------- itens
    case 'item': if (h) giveItem(G, e.id, e.n || 1, e.q, out); return;
    case 'take': {
      if (!h) return;
      const k = Math.min(e.n || 1, IT.countItem(h, e.id));
      if (k > 0 && IT.removeItem(h, e.id, k)) out.lines.push(line(`−${k > 1 ? `${k}× ` : ''}${itemName(e.id)}`, 'bad'));
      return;
    }
    case 'loot': {
      const tier = typeof e.tier === 'number' ? e.tier : regionTier(G);
      const res = LO.rollLoot(G, e.table || [], { tier, rolls: e.rolls, bonus: safe(() => CH.derive(h).mods.loot || 0, 0) });
      const coin = e.coin ? R.range(e.coin) : 0;
      const ichor = e.ichor ? R.range(e.ichor) : 0;
      if (queueLoot(G, { items: res.items, coin, ichor }, ctx)) out.pending.push({ type: 'loot' });
      return;
    }
    case 'eat': {
      if (!h) return;
      if (G.expedition) out.lines.push(...asLines(safe(() => EX.eat(G, { cooked: !!e.cooked }), [])));
      else { h.hunger = 0; out.lines.push(line('Você come.', 'good')); }
      return;
    }
    case 'drink': {
      if (!h) return;
      st.drinkDouble = (safe(() => CH.derive(h).tags, []) || []).includes('bebida_dobra');
      IT.markAddictionUse(G, 'aguardente');
      h.flags = h.flags || {};
      h.flags.drinks = (h.flags.drinks || 0) + 1;
      return;
    }
    case 'addict': {
      if (!h || !TRAITS[e.id] || h.traits.includes(e.id)) return;
      if (R.chance(e.pct ?? 20)) {
        h.traits.push(e.id);
        h.flags = h.flags || {};
        h.flags[`lastUse_${e.id}`] = G.time || 0;
        out.lines.push(line(`Vício: ${TRAITS[e.id].name}.`, 'bad'));
      }
      return;
    }
    case 'treat': {
      if (!h) return;
      const w = IT.bestWoundFor(h, e.method);
      if (!w) { if (!e.soft) out.lines.push(line('Nenhuma ferida para isso.', 'warn')); return; }
      out.lines.push(...asLines(WS.treatWound(G, w.uid, e.method, { where: 'field' })));
      return;
    }
    case 'cure': {
      if (!h) return;
      const ws = h.wounds || [];
      if (e.what === 'infeccao') {
        const w = ws.find((x) => x.infected);
        if (w) { w.infected = false; w.infDays = 0; out.lines.push(line('A febre de uma ferida cede.', 'good')); }
      } else if (e.what === 'sangramento') {
        let k = 0;
        for (const w of ws) if (w.bleeding && !w.treated) { w.bleeding = false; w.treated = true; k++; }
        if (k) out.lines.push(line('Os sangramentos param.', 'good'));
      } else if (e.what === 'chaga') {
        let k = 0;
        for (const w of ws) if (!w.salted && /chaga|necrose|gangrena/.test(w.id)) { w.salted = true; k++; }
        if (k) out.lines.push(line('O sal queima a mancha cinza.', 'good'));
      } else if (e.what === 'veneno') {
        const a = G.combat?.actors?.find((x) => x.side === 'hero');
        if (a) a.statuses = (a.statuses || []).filter((s) => s.id !== 'envenenado');
        out.lines.push(line('O veneno perde a força.', 'good'));
      }
      return;
    }
    case 'coat': {
      const w = h?.equip?.main;
      if (!w) return;
      w.coat = { kind: e.kind, hits: e.hits || 3 };
      out.lines.push(line(e.kind === 'veneno' ? 'Lâmina envenenada.' : 'Lâmina untada com óleo.', 'info'));
      return;
    }
    case 'woundDays': {
      if (!h) return;
      let k = 0;
      for (const w of h.wounds || []) if (w.days > 0) { w.days = Math.max(0.5, w.days - n); k++; }
      if (k) out.lines.push(line(`${k} ferida(s) saram mais rápido.`, 'good'));
      return;
    }
    // ---------------------------------------------------- corpo
    case 'wound': {
      if (!h) return;
      const w = WS.inflictWound(G, { part: e.part, dtype: e.dtype || 'corte', sev: e.sev || 1 });
      if (w) {
        const d = WS.describeWound(w);
        out.lines.push(line(`Ferida (${PART_NAMES[w.part] || w.part}): ${d.name}${d.effect ? ` — ${d.effect}` : ''}.`, 'blood'));
      }
      return;
    }
    case 'healWounds': {
      if (!h) return;
      const names = WS.healWounds(h, e.n ?? null);
      out.lines.push(line(names.length ? `Curado: ${names.join(', ')}.` : 'Nenhuma ferida para curar.', names.length ? 'good' : ''));
      return;
    }
    case 'trait': {
      if (!h || !e.id) return;
      if (!h.traits.includes(e.id)) {
        h.traits.push(e.id);
        const t = TRAITS[e.id];
        out.lines.push(line(`Traço: ${t?.name || e.id}${t?.desc ? ` — ${t.desc}` : ''}`, t?.good === false ? 'bad' : t?.good ? 'good' : 'warn'));
      }
      return;
    }
    case 'untrait': {
      if (!h || !h.traits.includes(e.id)) return;
      h.traits = h.traits.filter((t) => t !== e.id);
      out.lines.push(line(`Perdeu o traço: ${TRAITS[e.id]?.name || e.id}.`, 'info'));
      return;
    }
    case 'mutation': {
      if (!h) return;
      if (e.id && MUTATIONS[e.id]) out.lines.push(...asLines(CH.applyMutation(h, e.id)));
      else {
        h.mutationPending = (h.mutationPending || 0) + 1;
        out.lines.push(line('A carne muda. Escolha uma mutação na Ficha.', 'corr'));
      }
      return;
    }
    case 'mastery': {
      if (!h) return;
      h.mastery = h.mastery || {};
      h.mastery[e.cls] = (h.mastery[e.cls] || 0) + n;
      out.lines.push(line(`Maestria (${e.cls}) ${sgn(n)}.`, 'good'));
      return;
    }
    case 'learn': {
      if (!h || !e.id) return;
      h.techniques = h.techniques || [];
      if (!h.techniques.includes(e.id)) {
        h.techniques.push(e.id);
        out.lines.push(line(`Técnica aprendida: ${TECHNIQUES[e.id]?.name || e.id}.`, 'good'));
      }
      return;
    }
    case 'companion': {
      if (!h || !COMPANIONS[e.id]) return;
      if (h.companion) { out.lines.push(line(`${h.companion.name} não aceita dividir o caminho. Ninguém novo se junta.`, 'warn')); return; }
      h.companion = makeCompanion(e.id, e.name);
      out.lines.push(line(`${h.companion.name} segue você.`, 'good'));
      return;
    }
    case 'loseCompanion': {
      if (!h?.companion) return;
      out.lines.push(line(`${h.companion.name} vai embora.`, 'bad'));
      h.companion = null;
      return;
    }
    // ---------------------------------------------------- mundo / campanha
    case 'rep': {
      if (!FACTION_NAMES[e.f]) return;
      const r = safe(() => FA.addRep(G, e.f, n), null);
      if (r) out.lines.push(...asLines(r));
      else { G.factions[e.f] = clamp((G.factions[e.f] || 0) + n, -100, 100); out.lines.push(line(`${FACTION_NAMES[e.f]} ${sgn(n)}.`, n > 0 ? 'good' : 'bad')); }
      return;
    }
    case 'chaga': {
      const r = safe(() => TM.addChaga(G, n, e.why || ''), null);
      if (r) out.lines.push(...asLines(r));
      else { G.chaga = clamp((G.chaga || 0) + n, 0, 100); out.lines.push(line(`Chaga ${sgn(n)}.`, n > 0 ? 'rot' : 'good')); }
      return;
    }
    case 'time': {
      const hrs = e.h ?? e.n ?? 1;
      if (!(hrs > 0)) return;
      if (G.expedition && EX.passHours) {
        const r = EX.passHours(G, hrs, { mode: 'work' });
        out.lines.push(...asLines(r));
        if (r.died) out.pending.push({ type: 'death', cause: 'Ermo', handled: true });
      } else out.lines.push(...asLines(safe(() => TM.advanceTime(G, hrs, { where: 'city' }), [])));
      return;
    }
    case 'light': {
      const hrs = e.h ?? e.n ?? 0;
      if (!G.expedition) return;
      if (hrs <= -99) { G.expedition.light = 0; out.lines.push(line('A luz se apaga.', 'bad')); return; }
      out.lines.push(...asLines(EX.gainLight(G, hrs)));
      return;
    }
    case 'food': {
      if (!h) return;
      if (n > 0) giveItem(G, 'racao', n, 1, out);
      else {
        const k = Math.min(-n, IT.countItem(h, 'racao'));
        if (k > 0) { IT.removeItem(h, 'racao', k); out.lines.push(line(`−${k} ração.`, 'bad')); }
      }
      return;
    }
    case 'reveal': {
      if (G.expedition) {
        const k = EX.revealNodes(G, n);
        out.lines.push(line(k ? `Você entende o terreno: ${k} lugar(es) revelado(s).` : 'Nada de novo no horizonte.', 'info'));
      } else {
        const r = e.region || Object.keys(G.world?.regions || {}).find((x) => G.world.regions[x]?.unlocked) || 'r1';
        out.lines.push(...asLines(CP.mapReveal(G, r, n)));
      }
      return;
    }
    case 'flag': {
      G.campaign.flags[e.k] = e.v === undefined ? true : e.v;
      return;
    }
    case 'count': {
      G.campaign.counters[e.k] = (G.campaign.counters[e.k] || 0) + n;
      return;
    }
    case 'unlock': {
      if (!G.city.unlocked[e.k]) {
        const r = safe(() => CP.applyD(G, [{ op: 'unlock', k: e.k }], ctx), null);
        if (r) out.lines.push(...asLines(r));
        G.city.unlocked[e.k] = true;
        if (e.k !== 'antro') out.lines.push(line('Algo novo se abriu para você.', 'info'));
      }
      return;
    }
    case 'journal': safe(() => TM.journal(G, e.text)); return;
    case 'log': out.lines.push(line(e.text, e.kind || '')); return;
    case 'questStep': out.lines.push(...asLines(safe(() => FA.questStep(G, e.f, e.step), []))); return;
    case 'fragment': out.lines.push(...asLines(safe(() => CP.fragmentTo(G, e.id, e.to), []))); return;
    case 'siegeDefense': out.lines.push(...asLines(safe(() => SG.addDefense(G, n), []))); return;
    case 'uniqueItem': case 'mapReveal': case 'tempTrait': case 'morale': {
      const r = safe(() => CP.applyD(G, [e], ctx), null);
      if (r) { out.lines.push(...asLines(r)); out.pending.push(...(r.pending || [])); }
      return;
    }
    case 'random': {
      const list = (e.table || []).filter((x) => (x.w ?? 1) > 0);
      if (!list.length) return;
      const pick = R.weighted(list, (x) => x.w ?? 1);
      if (pick.text) out.lines.push(line(pick.text, 'info'));
      const sub = applyEffects(G, pick.effects || [], ctx);
      out.lines.push(...sub.lines);
      out.pending.push(...sub.pending);
      return;
    }
    // ---------------------------------------------------- navegação (pending)
    case 'combat':
      out.pending.push({ type: 'combat', spec: { enemies: e.enemies || [], ambush: e.ambush || null, boss: !!e.boss, onWin: e.onWin || [], onFlee: e.onFlee || [], text: e.text || '', canFlee: e.canFlee ?? true } });
      return;
    case 'event':
      out.pending.push({ type: 'event', id: e.id });
      return;
    case 'kill':
      if (h) { h.hp = 0; h.flags = h.flags || {}; h.flags.deathCause = e.cause || 'Morte'; }
      out.pending.push({ type: 'death', cause: e.cause || 'Morte' });
      return;
    default:
      console.warn('[effects] op desconhecida', e.op);
  }
}

function healInCombat(G, n) {
  const h = G.hero;
  const max = CH.derive(h).hpMax;
  const before = h.hp || 0;
  h.hp = Math.min(max, before + Math.round(n));
  const a = G.combat.actors?.find((x) => x.side === 'hero');
  if (a) a.hp = h.hp;
  return h.hp - before;
}

// ============================================================ condições
let warned = new Set();

/** Avalia uma condição (objeto; chaves combinadas com E). */
export function checkCond(G, cond) {
  if (!cond) return true;
  if (Array.isArray(cond)) return cond.every((c) => checkCond(G, c));
  const h = G?.hero;
  const D = h ? safe(() => CH.derive(h), null) : null;
  for (const [k, v] of Object.entries(cond)) {
    if (!evalKey(G, h, D, k, v, cond)) return false;
  }
  return true;
}

const inRange = (x, r) => (r?.min == null || x >= r.min) && (r?.max == null || x <= r.max);

function evalKey(G, h, D, k, v, cond) {
  switch (k) {
    case 'any': return v.some((c) => checkCond(G, c));
    case 'all': return v.every((c) => checkCond(G, c));
    case 'not': return !checkCond(G, v);
    case 'n': case 'min': case 'eq': return true; // modificadores de outras chaves
    case 'has': return !!h && IT.countItem(h, v, { equipped: true }) >= (cond.n || 1);
    case 'attr': return !!h && ((D?.attrs?.[v] ?? h.attrs?.[v] ?? 0) >= (cond.min ?? 0));
    case 'flag': {
      const val = G.campaign?.flags?.[v];
      return cond.eq === undefined ? !!val : val === cond.eq;
    }
    case 'notFlag': return !G.campaign?.flags?.[v];
    case 'rep': return inRange(G.factions?.[v.f] ?? 0, v);
    case 'coin': return (h?.coin || 0) >= v;
    case 'ichor': return (h?.ichor || 0) >= v;
    case 'trait': return !!h?.traits?.includes(v);
    case 'notTrait': return !h?.traits?.includes(v);
    case 'talent': return !!h?.talents?.includes(v);
    case 'mutation': return v === true ? (h?.mutations?.length || 0) > 0 : !!h?.mutations?.includes(v);
    case 'bg': return Array.isArray(v) ? v.includes(h?.bg) : h?.bg === v;
    case 'corruption': return !!h && inRange(h.corruption || 0, v);
    case 'dread': return !!h && inRange(h.dread || 0, v);
    case 'hpPct': return !!h && !!D && inRange(Math.round(((h.hp || 0) / D.hpMax) * 100), v);
    case 'partOk': return !!h && !(D?.lostParts || []).includes(v);
    case 'chaga': return inRange(G.chaga || 0, v);
    case 'day': return inRange(day(G), v);
    case 'region': {
      const r = G.expedition?.region || G.event?.ctx?.region || G.combat?.context?.region;
      return Array.isArray(v) ? v.includes(r) : r === v;
    }
    case 'night': { const hr = (G.time || 0) % 24; const night = hr >= 20 || hr < 6; return v ? night : !night; }
    case 'companion': return v === true ? !!h?.companion : v === false ? !h?.companion : h?.companion?.id === v;
    case 'level': return (h?.level || 1) >= (v?.min ?? v ?? 1);
    case 'boss': return !!G.campaign?.bosses?.[v];
    case 'service': return v === 'antro' ? !!G.city?.unlocked?.antro : !(G.city?.lostDistricts || []).includes(v);
    case 'inExpedition': return v ? !!G.expedition : !G.expedition;
    case 'inCity': return v ? !G.expedition : !!G.expedition;
    case 'unlocked': return !!G.city?.unlocked?.[v];
    case 'counter': return (G.campaign?.counters?.[v.k] || 0) >= (v.min ?? 1);
    default:
      if (!warned.has(k)) { warned.add(k); console.warn('[effects] condição desconhecida:', k); }
      return true;
  }
}

/** Texto curto de uma condição (para "Requer: ..."). */
export function describeCond(cond) {
  if (!cond) return '';
  if (Array.isArray(cond)) return cond.map(describeCond).filter(Boolean).join(' e ');
  const parts = [];
  for (const [k, v] of Object.entries(cond)) {
    switch (k) {
      case 'any': parts.push(v.map(describeCond).filter(Boolean).join(' ou ')); break;
      case 'all': parts.push(v.map(describeCond).filter(Boolean).join(' e ')); break;
      case 'not': parts.push(`não: ${describeCond(v)}`); break;
      case 'has': parts.push(`${cond.n && cond.n > 1 ? `${cond.n}× ` : ''}${itemName(v)}`); break;
      case 'attr': parts.push(`${ATTR[v] || v} ${cond.min}+`); break;
      case 'flag': case 'notFlag': break; // flags são segredos narrativos
      case 'rep': parts.push(`${FACTION_NAMES[v.f] || v.f}${v.min != null ? ` ${v.min}+` : ''}${v.max != null ? ` até ${v.max}` : ''}`); break;
      case 'coin': parts.push(`${v} moedas`); break;
      case 'ichor': parts.push(`${v} Icor`); break;
      case 'trait': parts.push(TRAITS[v]?.name || v); break;
      case 'notTrait': parts.push(`sem ${TRAITS[v]?.name || v}`); break;
      case 'talent': parts.push(v); break;
      case 'bg': parts.push((Array.isArray(v) ? v : [v]).map((b) => BACKGROUNDS[b]?.name || b).join('/')); break;
      case 'corruption': parts.push(`Corrupção${v.min != null ? ` ${v.min}+` : ''}${v.max != null ? ` até ${v.max}` : ''}`); break;
      case 'dread': parts.push(`Pavor${v.min != null ? ` ${v.min}+` : ''}${v.max != null ? ` até ${v.max}` : ''}`); break;
      case 'partOk': parts.push(`${PART_NAMES[v] || v} inteiro`); break;
      case 'chaga': parts.push(`Chaga${v.min != null ? ` ${v.min}+` : ''}${v.max != null ? ` até ${v.max}` : ''}`); break;
      case 'day': parts.push(`dia${v.min != null ? ` ${v.min}+` : ''}`); break;
      case 'region': parts.push((Array.isArray(v) ? v : [v]).map((r) => REGION_NAMES[r] || r).join('/')); break;
      case 'night': parts.push(v ? 'à noite' : 'de dia'); break;
      case 'companion': parts.push(v === true ? 'um sequaz' : v === false ? 'sem sequaz' : (COMPANIONS[v]?.name || v)); break;
      case 'level': parts.push(`nível ${v?.min ?? v}+`); break;
      case 'boss': parts.push(`chefe de ${REGION_NAMES[v] || v} morto`); break;
      case 'mutation': parts.push(v === true ? 'uma mutação' : MUTATIONS[v]?.name || v); break;
      case 'inExpedition': parts.push(v ? 'no Ermo' : 'na cidade'); break;
      case 'hpPct': parts.push(`Vida${v.min != null ? ` ${v.min}%+` : ''}${v.max != null ? ` até ${v.max}%` : ''}`); break;
      default: break;
    }
  }
  return parts.filter(Boolean).join(', ');
}

/** Texto curto de efeitos ("+20 moedas, −1 ração"). */
export function describeEffects(effects) {
  const parts = [];
  for (const e of effects || []) {
    const n = e.n ?? 1;
    switch (e.op) {
      case 'hp': parts.push(`${sgn(n)} Vida`); break;
      case 'heal': parts.push(`+${n} Vida`); break;
      case 'dread': parts.push(`${sgn(n)} Pavor`); break;
      case 'corruption': parts.push(`${sgn(n)} Corrupção`); break;
      case 'coin': parts.push(`${sgn(n)} moedas`); break;
      case 'ichor': parts.push(`${sgn(n)} Icor`); break;
      case 'item': parts.push(`+${(e.n || 1) > 1 ? `${e.n}× ` : ''}${String(e.id).startsWith('@') ? 'item' : itemName(e.id)}`); break;
      case 'take': parts.push(`−${(e.n || 1) > 1 ? `${e.n}× ` : ''}${itemName(e.id)}`); break;
      case 'food': parts.push(`${sgn(n)} ração`); break;
      case 'light': parts.push(`${sgn(e.h ?? n)}h de luz`); break;
      case 'time': parts.push(`${e.h ?? n}h`); break;
      case 'rep': parts.push(`${FACTION_NAMES[e.f] || e.f} ${sgn(n)}`); break;
      case 'chaga': parts.push(`Chaga ${sgn(n)}`); break;
      case 'wound': parts.push('ferida'); break;
      case 'healWounds': parts.push('cura feridas'); break;
      case 'trait': parts.push(TRAITS[e.id]?.name || 'traço'); break;
      case 'mutation': parts.push('mutação'); break;
      case 'attr': parts.push(`${ATTR[e.a] || e.a} ${sgn(n)}`); break;
      case 'stamina': parts.push(`${sgn(n)} Fôlego`); break;
      case 'reveal': parts.push(`revela ${n} lugar(es)`); break;
      case 'loot': parts.push('saque'); break;
      case 'combat': parts.push('luta'); break;
      case 'treat': parts.push('trata ferida'); break;
      case 'cure': parts.push({ infeccao: 'cura infecção', sangramento: 'estanca sangue', chaga: 'salga a Chaga', veneno: 'cura veneno' }[e.what] || 'cura'); break;
      case 'coat': parts.push(e.kind === 'veneno' ? 'envenena a arma' : 'unta a arma'); break;
      case 'woundDays': parts.push(`feridas −${n} dia(s)`); break;
      case 'eat': parts.push('mata a fome'); break;
      case 'companion': parts.push(COMPANIONS[e.id]?.name || 'sequaz'); break;
      case 'siegeDefense': parts.push(`Muralha ${sgn(n)}`); break;
      case 'learn': parts.push(`técnica: ${TECHNIQUES[e.id]?.name || e.id}`); break;
      default: break;
    }
  }
  return parts.join(', ');
}

export function resetCondWarnings() { warned = new Set(); }
