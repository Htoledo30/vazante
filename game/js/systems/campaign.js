// Campanha: intro/legado, atos por chefes, fragmentos do deus, finais e epílogo,
// além dos efeitos específicos da Área D (mapReveal, uniqueItem...) e traços temporários.
import { clamp, clone } from '../core/util.js';
import { R } from '../core/rng.js';
import { loadMeta, saveMeta } from '../core/save.js';
import * as EF from './effects.js';
import * as IT from './items.js';
import * as EX from './expedition.js';
import * as TR from '../data/traits.js';
import * as ITD from '../data/items.js';
import {
  LEGACIES, D_TRAITS, ACTS, BOSS_FRAGMENT, BOSS_NAMES, BOSS_TEXT, FRAGMENTS, ENDINGS, FALL, EXTINCT, EPILOGUE, HOUSE_NAMES,
} from '../data/story.js';
import { BLESSINGS, FRAGMENT_ATTR, ANTRO } from '../data/city.js';
import { UNIQUE_ITEMS, FACTIONS } from '../data/factions.js';
import { day, journal, addChaga, counter, heroCorruption, heroDread, logLine } from './time.js';
import { addRep, questStep, rep } from './factions.js';
import { addDefense } from './siege.js';

// ------------------------------------------------------------------ traços da Área D
/** Registra os traços de D (casa, vício, bênçãos...) no TRAITS de A, se ainda não existirem. */
export function registerDTraits() {
  const T = TR.TRAITS;
  if (!T || typeof T !== 'object' || Array.isArray(T)) return false;
  try {
    for (const [id, t] of Object.entries(D_TRAITS)) if (!T[id]) T[id] = { ...t };
    for (const b of BLESSINGS) if (!T[b.id]) T[b.id] = { id: b.id, name: b.name, kind: 'good', desc: b.desc, mods: { ...b.mods }, temp: true };
    return true;
  } catch { return false; }
}
registerDTraits();

export function traitName(id) {
  return TR.TRAITS?.[id]?.name || D_TRAITS[id]?.name || BLESSINGS.find((b) => b.id === id)?.name || id;
}

/** Traço temporário (expira no dia indicado). */
export function addTempTrait(G, id, days) {
  const h = G.hero;
  if (!h) return [];
  h.traits = h.traits || [];
  h.flags = h.flags || {};
  const tt = h.flags.tempTraits || (h.flags.tempTraits = {});
  if (!h.traits.includes(id)) h.traits.push(id);
  tt[id] = Math.max(tt[id] || 0, day(G) + days);
  return [{ text: `${traitName(id)} (${days} dias)`, kind: 'good' }];
}

export function expireTempTraits(G, d) {
  const h = G.hero;
  const tt = h?.flags?.tempTraits;
  if (!tt) return [];
  const lines = [];
  for (const [id, until] of Object.entries(tt)) {
    if (d >= until) {
      delete tt[id];
      h.traits = (h.traits || []).filter((t) => t !== id);
      lines.push({ text: `${traitName(id)} passou.`, kind: '' });
    }
  }
  return lines;
}

export function hasTrait(G, id) { return !!G.hero?.traits?.includes(id); }

// ------------------------------------------------------------------ contadores lidos por D
export function killsOf(G, ids = []) {
  const b = G.world?.bestiary || {};
  return ids.reduce((s, id) => s + (b[id]?.kills || 0), 0);
}

function destroyedIn(nests) {
  if (!nests) return 0;
  const vals = Array.isArray(nests) ? nests : Object.values(nests);
  return vals.filter((v) => v === true || v === 'destroyed' || v?.destroyed || v?.state === 'destroyed' || v?.cleared).length;
}

/** Ninhos destruídos (C pode marcar em G.world.regions[r].nests ou contar em counters['nests_destroyed_'+r]). */
export function nestsDestroyed(G, region = 'any') {
  const regs = region === 'any' ? Object.keys(G.world?.regions || {}) : [region];
  const c = G.campaign.counters || {};
  let n = 0;
  for (const r of regs) n += Math.max(c[`nests_destroyed_${r}`] || 0, destroyedIn(G.world?.regions?.[r]?.nests));
  if (region === 'any') n = Math.max(n, c.nests_destroyed || 0);
  return n;
}

// ------------------------------------------------------------------ itens
export function itemDefOf(id) { return ITD.ITEMS?.[id] || null; }

function stackable(def) { return def && ['consumable', 'material', 'ammo'].includes(def.type); }

/** Dá item ao herói (A), com fallback mínimo. Retorna linhas. */
export function giveItem(G, id, n = 1, q) {
  const h = G.hero;
  if (!h || !n) return [];
  if (IT.makeItem && IT.addItem) {
    const def = itemDefOf(id);
    if (def && stackable(def)) {
      IT.addItem(h, IT.makeItem(id, { n, q: q ?? 1 }));
    } else {
      for (let i = 0; i < n; i++) IT.addItem(h, IT.makeItem(id, { q: q ?? 1 }));
    }
  } else {
    h.inv = h.inv || [];
    h.inv.push({ uid: `d${G.uidSeq = (G.uidSeq || 0) + 1}`, id, q: q ?? 1, n, dur: 100, ench: null });
  }
  const name = itemDefOf(id)?.name || id;
  return [{ text: `+${n > 1 ? `${n}× ` : ''}${name}`, kind: 'good' }];
}

export function heroCount(G, id) {
  const h = G.hero;
  if (!h) return 0;
  if (IT.countItem) return IT.countItem(h, id);
  return (h.inv || []).filter((i) => i.id === id).reduce((s, i) => s + (i.n || 1), 0);
}

/** Cria a instância de um item único de recompensa. */
export function makeUnique(G, key) {
  const u = UNIQUE_ITEMS[key];
  if (!u) return null;
  let base = u.base;
  if (!itemDefOf(base) && u.fallbackType && ITD.ITEMS) {
    base = Object.keys(ITD.ITEMS).find((k) => ITD.ITEMS[k].type === u.fallbackType) || base;
  }
  let inst;
  if (IT.makeItem && itemDefOf(base)) inst = IT.makeItem(base, { q: u.q });
  else inst = { uid: `d${G.uidSeq = (G.uidSeq || 0) + 1}`, id: base, q: u.q, n: 1, dur: 100, ench: null };
  inst.name = u.name;
  inst.mods = { ...(inst.mods || {}), ...u.mods };
  inst.unique = key;
  inst.desc = u.desc;
  return inst;
}

// ------------------------------------------------------------------ mapa (revelar nós)
export function mapReveal(G, region, n) {
  if (!region || !n) return [];
  let st = G.world?.regions?.[region];
  if ((!st || !st.map) && EX.ensureRegion) {
    try { st = EX.ensureRegion(G, region) || G.world.regions[region]; } catch (e) { console.error(e); }
  }
  const nodes = st?.map?.nodes;
  if (!nodes) {
    const pr = G.campaign.pendingReveals || (G.campaign.pendingReveals = {});
    pr[region] = (pr[region] || 0) + n;
    return [{ text: `Você conhece ${n} caminho(s) a mais nessa região.`, kind: 'info' }];
  }
  st.discovered = st.discovered || [];
  const known = new Set(st.discovered);
  const cand = Object.values(nodes).filter((nd) => !known.has(nd.id)).sort((a, b) => (a.depth || 0) - (b.depth || 0));
  const add = cand.slice(0, n).map((nd) => nd.id);
  st.discovered.push(...add);
  return add.length ? [{ text: `Mapa: ${add.length} local(is) revelado(s).`, kind: 'info' }] : [{ text: 'Nada que você já não soubesse.', kind: '' }];
}

function flushPendingReveals(G) {
  const pr = G.campaign.pendingReveals;
  if (!pr) return [];
  const lines = [];
  for (const [r, n] of Object.entries(pr)) {
    if (G.world?.regions?.[r]?.map?.nodes) { delete pr[r]; lines.push(...mapReveal(G, r, n)); }
  }
  return lines;
}

// ------------------------------------------------------------------ efeitos (D + A)
const D_OPS = new Set(['mapReveal', 'uniqueItem', 'siegeDefense', 'chaga', 'rep', 'questStep', 'fragment', 'journal', 'unlock', 'flag', 'count', 'coin', 'ichor', 'random', 'morale', 'log', 'tempTrait']);

/**
 * Aplica efeitos com as ops de D tratadas aqui e o resto delegado a applyEffects (A).
 * Retorna { lines, pending }.
 */
export function applyD(G, effects = [], ctx = {}) {
  const lines = [];
  const pending = [];
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    if (EF.applyEffects) {
      const r = EF.applyEffects(G, batch, ctx) || {};
      lines.push(...(r.lines || []));
      pending.push(...(r.pending || []));
    } else {
      for (const e of batch) lines.push(...fallbackOp(G, e));
    }
    batch = [];
  };
  for (const e of effects || []) {
    if (!e) continue;
    if (!D_OPS.has(e.op)) { batch.push(e); continue; }
    flush();
    const h = G.hero;
    switch (e.op) {
      case 'mapReveal': lines.push(...mapReveal(G, e.region, e.n)); break;
      case 'uniqueItem': {
        const inst = makeUnique(G, e.key);
        if (inst && h) {
          if (IT.addItem) IT.addItem(h, inst); else (h.inv = h.inv || []).push(inst);
          lines.push({ text: `Recebeu: ${inst.name}`, kind: 'ichor' });
        }
        break;
      }
      case 'siegeDefense': lines.push(...addDefense(G, e.n)); break;
      case 'chaga': lines.push(...addChaga(G, e.n, e.why || '')); break;
      case 'rep': lines.push(...addRep(G, e.f, e.n)); break;
      case 'questStep': lines.push(...questStep(G, e.f, e.step)); break;
      case 'fragment': lines.push(...fragmentTo(G, e.id, e.to).lines); break;
      case 'journal': journal(G, e.text); break;
      case 'unlock': {
        if (!G.city.unlocked[e.k]) {
          G.city.unlocked[e.k] = true;
          if (e.k === 'antro') { lines.push({ text: 'Novo lugar na cidade: Antro dos Bebedores.', kind: 'corr' }); journal(G, 'Descobri o Antro dos Bebedores.'); }
        }
        break;
      }
      case 'flag': G.campaign.flags[e.k] = e.v === undefined ? true : e.v; break;
      case 'count': counter(G, e.k, e.n ?? 1); break;
      case 'coin': if (h) { h.coin = Math.max(0, (h.coin || 0) + e.n); lines.push({ text: `${e.n > 0 ? '+' : ''}${e.n} moedas`, kind: e.n > 0 ? 'good' : '' }); } break;
      case 'ichor': if (h) { h.ichor = Math.max(0, (h.ichor || 0) + e.n); lines.push({ text: `${e.n > 0 ? '+' : ''}${e.n} Icor`, kind: 'ichor' }); } break;
      case 'morale': G.city.morale = clamp((G.city.morale ?? 50) + e.n, 0, 100); lines.push({ text: `Moral da cidade ${e.n > 0 ? '+' : ''}${e.n}`, kind: e.n > 0 ? 'good' : 'bad' }); break;
      case 'log': lines.push({ text: e.text, kind: e.kind || '' }); break;
      case 'tempTrait': lines.push(...addTempTrait(G, e.id, e.days || 3)); break;
      case 'random': {
        const pick = R.weighted(e.table, (x) => x.w ?? 1);
        if (pick) {
          if (pick.text) lines.push({ text: pick.text, kind: 'info' });
          const r = applyD(G, pick.effects || [], ctx);
          lines.push(...r.lines); pending.push(...r.pending);
        }
        break;
      }
      default: break;
    }
  }
  flush();
  return { lines, pending };
}

function fallbackOp(G, e) {
  const h = G.hero;
  if (!h) return [];
  switch (e.op) {
    case 'item': return giveItem(G, e.id, e.n || 1, e.q);
    case 'take': if (IT.removeItem) IT.removeItem(h, e.id, e.n || 1); return [];
    case 'dread': return heroDread(G, e.n);
    case 'corruption': return heroCorruption(G, e.n).lines;
    case 'hp': case 'heal': h.hp = Math.max(1, (h.hp || 0) + e.n); return [{ text: `${e.n > 0 ? '+' : ''}${e.n} Vida`, kind: e.n > 0 ? 'good' : 'bad' }];
    case 'trait': h.traits = [...new Set([...(h.traits || []), e.id])]; return [{ text: `Traço: ${traitName(e.id)}`, kind: 'info' }];
    case 'attr': h.attrs[e.a] = (h.attrs[e.a] || 0) + e.n; return [{ text: `${e.a.toUpperCase()} ${e.n > 0 ? '+' : ''}${e.n}`, kind: 'good' }];
    default: return [];
  }
}

// ------------------------------------------------------------------ fragmentos
export const fragState = (G, id) => G.campaign.fragments?.[id] || null;
export const fragmentsGivenTo = (G, f) => Object.values(G.campaign.fragments || {}).filter((v) => v === f).length;
export const fragmentsEaten = (G) => Object.values(G.campaign.fragments || {}).filter((v) => v === 'eaten').length;
export const fragmentsKept = (G) => Object.values(G.campaign.fragments || {}).filter((v) => v === 'held' || v === 'eaten' || v === 'carcass').length;

/** Onde está o item do fragmento: 'hero' | 'stash' | null. */
export function fragmentLocation(G, id) {
  const f = FRAGMENTS[id];
  if (!f) return null;
  if (heroCount(G, f.item) > 0 || Object.values(G.hero?.equip || {}).some((i) => i?.id === f.item)) return 'hero';
  if ((G.lineage.stash || []).some((i) => i.id === f.item)) return 'stash';
  return null;
}

function takeFragmentItem(G, id) {
  const f = FRAGMENTS[id];
  const h = G.hero;
  const where = fragmentLocation(G, id);
  if (where === 'hero') {
    for (const [slot, inst] of Object.entries(h.equip || {})) if (inst?.id === f.item) { h.equip[slot] = null; return true; }
    if (IT.removeItem) return IT.removeItem(h, f.item, 1) !== false;
    const i = (h.inv || []).findIndex((x) => x.id === f.item);
    if (i >= 0) { h.inv.splice(i, 1); return true; }
  }
  if (where === 'stash') {
    const i = G.lineage.stash.findIndex((x) => x.id === f.item);
    if (i >= 0) { G.lineage.stash.splice(i, 1); return true; }
  }
  return false;
}

/** Destino de um fragmento: to = facção | 'eaten'. Retorna { ok, reason, lines }. */
export function fragmentTo(G, id, to) {
  const f = FRAGMENTS[id];
  if (!f) return { ok: false, reason: 'Fragmento desconhecido', lines: [] };
  const st = fragState(G, id);
  if (st !== 'held') return { ok: false, reason: 'Você não tem este fragmento', lines: [] };
  if (!fragmentLocation(G, id)) return { ok: false, reason: 'O fragmento não está com você nem no baú', lines: [] };
  const lines = [];
  if (FACTIONS[to]) {
    takeFragmentItem(G, id);
    G.campaign.fragments[id] = to;
    lines.push({ text: `${f.name} entregue a ${FACTIONS[to].name}.`, kind: 'info' });
    lines.push(...addRep(G, to, 25));
    journal(G, `Entreguei o ${f.name} à ${FACTIONS[to].name}.`);
    return { ok: true, lines };
  }
  if (to === 'eaten') {
    if (fragmentLocation(G, id) !== 'hero') return { ok: false, reason: 'Precisa estar com você', lines: [] };
    takeFragmentItem(G, id);
    G.campaign.fragments[id] = 'eaten';
    const a = FRAGMENT_ATTR[id];
    lines.push({ text: `Você devora o ${f.name}. Algo desce rasgando.`, kind: 'corr' });
    lines.push(...applyD(G, [{ op: 'attr', a, n: 2 }, { op: 'mutation' }], { source: 'antro' }).lines);
    lines.push(...heroCorruption(G, ANTRO.devour.corruption, 'Carne do deus').lines);
    if (!hasTrait(G, 'devorador')) { G.hero.traits.push('devorador'); lines.push({ text: 'Traço: Devorador de Deus', kind: 'corr' }); }
    lines.push(...addRep(G, 'bebedores', 10));
    journal(G, `Devorei o ${f.name}.`);
    return { ok: true, lines };
  }
  return { ok: false, reason: 'Destino inválido', lines: [] };
}

// ------------------------------------------------------------------ chefes, atos, sincronização
export const bossCount = (G) => Object.keys(G.campaign.bosses || {}).filter((r) => G.campaign.bosses[r]).length;

export function actFor(G) {
  const n = bossCount(G);
  let a = ACTS[0];
  for (const x of ACTS) if (n >= x.minBosses) a = x;
  return a;
}

/** Função para outras áreas: chefe morto. (Também detectado sozinho por syncCampaign.) */
export function onBossKilled(G, region) {
  G.campaign.bosses[region] = true;
  return syncCampaign(G);
}

/**
 * Detecta mudanças feitas por outras áreas (chefes mortos, fragmentos recuperados de carcaças)
 * e aplica as consequências da campanha. Idempotente; chamada em advanceTime e ao entrar na cidade.
 */
export function syncCampaign(G) {
  if (!G?.campaign) return [];
  const lines = [];
  const cp = G.campaign;
  cp.bossDone = cp.bossDone || {};
  cp.fragments = cp.fragments || {};
  for (const r of Object.keys(cp.bosses || {})) {
    if (!cp.bosses[r] || cp.bossDone[r]) continue;
    cp.bossDone[r] = day(G);
    lines.push({ text: `${BOSS_NAMES[r] || 'O chefe'} está morto.`, kind: 'good' });
    if (BOSS_TEXT[r]) journal(G, BOSS_TEXT[r]);
    lines.push(...addChaga(G, -12, `${BOSS_NAMES[r] || 'Chefe'} morto`));
    G.city.morale = clamp((G.city.morale ?? 50) + 10, 0, 100);
    const fid = BOSS_FRAGMENT[r];
    if (fid && !cp.fragments[fid]) {
      cp.fragments[fid] = 'held';
      const inLoot = (G.pendingLoot?.items || []).some((i) => i.id === FRAGMENTS[fid].item);
      if (!fragmentLocation(G, fid) && !inLoot && G.hero && !G.hero.dead) lines.push(...giveItem(G, FRAGMENTS[fid].item, 1));
      lines.push({ text: `Você tem o ${FRAGMENTS[fid].name}.`, kind: 'ichor' });
    }
    if (r === 'r5') { cp.heartPending = true; journal(G, 'O Coração está à minha frente.'); }
  }
  // fragmentos recuperados de carcaças
  for (const [fid, st] of Object.entries(cp.fragments)) {
    if (st === 'carcass' && fragmentLocation(G, fid)) {
      cp.fragments[fid] = 'held';
      lines.push({ text: `O ${FRAGMENTS[fid].name} voltou para a Casa.`, kind: 'ichor' });
    }
  }
  const a = actFor(G);
  if (a.act > (cp.act || 1)) {
    cp.act = a.act;
    journal(G, `${a.title}. ${a.text}`);
    lines.push({ text: a.title, kind: 'info' });
  }
  lines.push(...flushPendingReveals(G));
  return lines;
}

// ------------------------------------------------------------------ intro / casa / legado
export function suggestHouseNames(rng = R, n = 3) {
  return rng.shuffle(HOUSE_NAMES).slice(0, n);
}

export function setHouse(G, name) {
  const clean = String(name || '').replace(/[<>]/g, '').trim().slice(0, 24) || 'Vharn';
  G.lineage.house = clean;
  return clean;
}

export function setLegacy(G, id) {
  const L = LEGACIES.find((l) => l.id === id);
  if (!L) return false;
  G.campaign.legacy = id;
  if (L.houseTrait) G.lineage.houseTrait = L.houseTrait;
  return true;
}

export const legacyDef = (G) => LEGACIES.find((l) => l.id === G.campaign.legacy) || null;

/** Aplica a marca da casa (traço) a um herói recém-criado. */
export function applyHouseToHero(G, hero) {
  const t = G.lineage.houseTrait;
  if (t && hero) {
    hero.traits = hero.traits || [];
    if (!hero.traits.includes(t)) hero.traits.push(t);
  }
}

/** Gancho heroCreated: primeiro herói recebe o legado; todo herói recebe o traço da casa. */
export function onHeroCreated(G) {
  const lines = [];
  const h = G.hero;
  if (!h) return lines;
  h.gen = h.gen || G.lineage.generation || 1;
  h.flags = h.flags || {};
  applyHouseToHero(G, h);
  if (!G.campaign.flags.legacyApplied) {
    G.campaign.flags.legacyApplied = true;
    const L = legacyDef(G);
    if (L) {
      lines.push(...applyD(G, L.effects, { source: 'intro' }).lines);
      if (L.loan) {
        G.city.loan = { amount: 0, owe: L.loan.owe, dueDay: L.loan.dueDay, state: 'open', src: 'legado' };
        lines.push({ text: `Dívida: ${L.loan.owe} moedas até o dia ${L.loan.dueDay}.`, kind: 'warn' });
      }
      journal(G, `Legado da Casa ${G.lineage.house}: ${L.name}.`);
    }
    journal(G, `${h.name} da Casa ${G.lineage.house} assume o nome da família. Dia ${day(G)}.`);
  }
  return lines;
}

// ------------------------------------------------------------------ condições (finais/epílogo)
/** Avalia condições: formato de A + extensões de D (questDone, fragGiven, fragKept, fragEaten, lostDistricts, siegesWon, deadCount, deadMax). */
export function evalCond(G, cond) {
  if (!cond) return true;
  if (Array.isArray(cond)) return cond.every((c) => evalCond(G, c));
  const h = G.hero;
  for (const [k, v] of Object.entries(cond)) {
    let ok = true;
    switch (k) {
      case 'any': ok = v.some((c) => evalCond(G, c)); break;
      case 'all': ok = v.every((c) => evalCond(G, c)); break;
      case 'not': ok = !evalCond(G, v); break;
      case 'questDone': ok = !!G.campaign.flags[`questline_${v}`]; break;
      case 'fragGiven': ok = fragmentsGivenTo(G, v.f) >= v.n; break;
      case 'fragKept': ok = fragmentsKept(G) >= v; break;
      case 'fragEaten': ok = fragmentsEaten(G) >= v; break;
      case 'lostDistricts': ok = (G.city.lostDistricts || []).length >= v; break;
      case 'siegesWon': ok = Object.values(G.campaign.sieges || {}).filter((s) => s === 'won').length >= v; break;
      case 'deadCount': ok = (G.lineage.dead || []).length >= v; break;
      case 'deadMax': ok = (G.lineage.dead || []).length <= v; break;
      case 'rep': ok = (v.min == null || rep(G, v.f) >= v.min) && (v.max == null || rep(G, v.f) <= v.max); break;
      case 'flag': ok = v === undefined ? true : !!G.campaign.flags[v]; break;
      case 'notFlag': ok = !G.campaign.flags[v]; break;
      case 'chaga': ok = (v.min == null || G.chaga >= v.min) && (v.max == null || G.chaga <= v.max); break;
      case 'corruption': ok = !!h && (v.min == null || h.corruption >= v.min) && (v.max == null || h.corruption <= v.max); break;
      case 'dread': ok = !!h && (v.min == null || h.dread >= v.min) && (v.max == null || h.dread <= v.max); break;
      case 'boss': ok = !!G.campaign.bosses?.[v]; break;
      case 'coin': ok = (h?.coin || 0) >= v; break;
      case 'ichor': ok = (h?.ichor || 0) >= v; break;
      case 'service': ok = v === 'antro' ? !!G.city.unlocked.antro : !(G.city.lostDistricts || []).includes(v); break;
      case 'day': ok = (v.min == null || day(G) >= v.min) && (v.max == null || day(G) <= v.max); break;
      case 'has': ok = heroCount(G, v) >= (cond.n || 1); break;
      case 'n': ok = true; break;
      case 'trait': ok = hasTrait(G, v); break;
      case 'notTrait': ok = !hasTrait(G, v); break;
      default:
        ok = EF.checkCond ? !!EF.checkCond(G, { [k]: v }) : true;
    }
    if (!ok) return false;
  }
  return true;
}

// ------------------------------------------------------------------ finais
export function heartReady(G) { return !!G.campaign.bosses?.r5 && !G.campaign.ended && !!G.hero && !G.hero.dead; }

/** Opções no Coração: [{ id, name, choice, req, available, sacrifice }]. */
export function endingOptions(G) {
  return Object.values(ENDINGS).map((e) => ({
    id: e.id, name: e.name, icon: e.icon, choice: e.choice, req: e.req, sacrifice: !!e.sacrifice,
    available: evalCond(G, e.cond),
  }));
}

export function epilogueLines(G) {
  const dead = (G.lineage.dead || []).length;
  const out = [];
  for (const b of EPILOGUE) {
    if (evalCond(G, b.cond)) out.push(b.text.replace('{dead}', String(dead)));
    if (out.length >= 6) break;
  }
  return out;
}

export function campaignStats(G) {
  const b = G.world?.bestiary || {};
  const kills = Object.values(b).reduce((s, x) => s + (x?.kills || 0), 0);
  const sieges = G.campaign.sieges || {};
  return {
    day: day(G),
    chaga: Math.round(G.chaga),
    generation: G.lineage.generation,
    dead: (G.lineage.dead || []).length,
    kills,
    bosses: bossCount(G),
    siegesWon: Object.values(sieges).filter((s) => s === 'won').length,
    siegesLost: Object.values(sieges).filter((s) => s === 'lost').length,
    lostDistricts: (G.city.lostDistricts || []).length,
    fragments: { ...(G.campaign.fragments || {}) },
    reps: { ...G.factions },
    house: G.lineage.house,
  };
}

function recordMeta(G, type) {
  try {
    const m = loadMeta();
    m.campaigns = (m.campaigns || 0) + 1;
    m.endings = m.endings || {};
    m.endings[type] = (m.endings[type] || 0) + 1;
    m.bestDay = Math.max(m.bestDay || 0, day(G));
    m.unlocks = m.unlocks || {};
    if (type.startsWith('ending_')) m.unlocks[type] = true;
    m.last = { type, day: day(G), house: G.lineage.house, generation: G.lineage.generation };
    saveMeta(m);
  } catch (e) { console.error(e); }
}

/** Encerra a campanha. type: 'fall' | 'extinct' | 'ending_<id>'. Idempotente. */
export function endCampaign(G, type, info = {}) {
  if (G.campaign.ended) return G.campaign.ended;
  const house = G.lineage.house;
  let name, text, icon;
  if (type === 'fall') ({ name, text, icon } = FALL);
  else if (type === 'extinct') ({ name, text, icon } = EXTINCT);
  else {
    const e = ENDINGS[type.replace(/^ending_/, '')];
    name = e?.name || 'Fim'; text = e?.text || ''; icon = e?.icon || '';
  }
  text = text.replace(/\{house\}/g, house);
  G.campaign.ended = {
    type, name, icon, day: day(G), text,
    epilogue: epilogueLines(G),
    stats: campaignStats(G),
    hero: G.hero ? { name: G.hero.name, gen: G.hero.gen, level: G.hero.level } : null,
    ...info,
  };
  journal(G, `Fim: ${name}.`);
  recordMeta(G, type);
  return G.campaign.ended;
}

/** Escolha final no Coração. */
export function chooseEnding(G, id) {
  const e = ENDINGS[id];
  if (!e) return { ok: false, reason: 'Final desconhecido' };
  if (!heartReady(G)) return { ok: false, reason: 'O Coração ainda bate longe daqui' };
  if (!evalCond(G, e.cond)) return { ok: false, reason: e.req };
  if (e.sacrifice && G.hero) { G.hero.dead = true; G.hero.hp = 0; }
  const ended = endCampaign(G, `ending_${id}`, { choice: e.choice });
  return { ok: true, ended };
}

export { journal, logLine, clone };
