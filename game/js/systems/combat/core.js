// Núcleo do combate: acesso ao estado, registro, eventos de UI, estados (status) e utilidades.
// Tudo opera sobre G.combat (JSON puro). Sem DOM.
import { R } from '../../core/rng.js';
import { clamp } from '../../core/util.js';
import { STATUSES } from '../../data/statuses.js';
import { ENEMIES } from '../../data/enemies.js';
import { COMPANIONS } from '../../data/companions.js';

export const HERO_UID = 'hero';
export const HERO_PARTS = ['cabeca', 'tronco', 'bracoD', 'bracoE', 'pernas'];
export const HERO_PART_NAMES = { cabeca: 'cabeça', tronco: 'tronco', bracoD: 'braço da arma', bracoE: 'braço esquerdo', pernas: 'pernas' };
export const HERO_PART_WEIGHTS = [['cabeca', 10], ['tronco', 45], ['bracoD', 15], ['bracoE', 15], ['pernas', 15]];
export const DIST_NAMES = ['Corpo a corpo', 'Perto', 'Longe'];
export const DIST_SHORT = ['C.a.C', 'Perto', 'Longe'];
export const DTYPE_NAMES = { corte: 'corte', perf: 'perfuração', impacto: 'impacto', fogo: 'fogo', icor: 'icor' };

export function getActor(G, uid) { return G.combat?.actors.find((a) => a.uid === uid) || null; }
export function heroActor(G) { return G.combat?.actors.find((a) => a.side === 'hero') || null; }
export function allyActor(G) { return G.combat?.actors.find((a) => a.side === 'ally' && isUp(a)) || null; }

/** Está em pé na luta (vivo e não fugiu). Rendidos contam como "em pé" mas não hostis. */
export const isUp = (a) => !!a && !a.dead && !a.gone;
export const isHostile = (a) => isUp(a) && a.side === 'enemy' && !hasStatus(a, 'rendido');
export function foes(G) { return (G.combat?.actors || []).filter(isHostile); }
export function surrendered(G) { return (G.combat?.actors || []).filter((a) => isUp(a) && a.side === 'enemy' && hasStatus(a, 'rendido')); }
export function engagedFoes(G) { return foes(G).filter((a) => a.dist === 0); }

export function edef(a) {
  if (!a) return null;
  if (a.side === 'enemy') return ENEMIES[a.def] || null;
  if (a.side === 'ally') return COMPANIONS[a.def] || null;
  return null;
}
export function hasTag(a, tag) { return !!edef(a)?.tags?.includes(tag); }

// ───────────── registro e eventos ─────────────
export function log(G, text, kind = 'info') {
  const c = G.combat;
  if (!c) return;
  c.log.push({ text, kind, r: c.round });
  if (c.log.length > 120) c.log.splice(0, c.log.length - 120);
}

/** Evento para a UI animar (números de dano, shake, sons). Limpo a cada act(). */
export function emitEv(G, e) {
  const c = G.combat;
  if (!c) return;
  (c.events ||= []).push(e);
  if (c.events.length > 60) c.events.shift();
}

// ───────────── estados ─────────────
export function getStatus(a, id) { return a?.statuses?.find((s) => s.id === id) || null; }
export function hasStatus(a, id) { return !!getStatus(a, id); }
export function stacks(a, id) { return getStatus(a, id)?.stacks || 0; }

const IMMUNE = {
  construto: ['sangrando', 'envenenado', 'aterrorizado', 'agarrado'],
  morto: ['envenenado', 'aterrorizado', 'infectado'],
  enxame: ['agarrado', 'caido', 'aleijado', 'desarmado', 'enredado', 'atordoado', 'cego'],
  voador: ['caido'],
  chefe: ['agarrado', 'aterrorizado'],
  fanatico: ['aterrorizado'],
};

export function isImmune(G, a, id) {
  if (a.side === 'hero') {
    if (id === 'aterrorizado' && hasStatus(a, 'entorpecido')) return true;
    if (id === 'atordoado' && a.flags?.stunImmune > 0) return true;
    return false;
  }
  const tags = edef(a)?.tags || [];
  for (const t of tags) if (IMMUNE[t]?.includes(id)) return true;
  if (id === 'atordoado' && a.flags?.stunImmune > 0) return true;
  return false;
}

/** Aplica um estado. opts: { turns, stacks, src }. Retorna true se aplicou. */
export function addStatus(G, a, id, opts = {}) {
  const def = STATUSES[id];
  if (!def || !a || a.dead) return false;
  if (isImmune(G, a, id)) return false;
  const turns = opts.turns ?? def.turns ?? 2;
  const add = opts.stacks ?? 1;
  const cur = getStatus(a, id);
  if (cur) {
    cur.stacks = Math.min(def.maxStacks || 1, (cur.stacks || 1) + add);
    cur.turns = Math.max(cur.turns, turns);
    if (opts.src) cur.src = opts.src;
  } else {
    a.statuses.push({ id, turns, stacks: Math.min(def.maxStacks || 1, add), src: opts.src || null });
  }
  return true;
}

export function removeStatus(a, id) {
  if (!a?.statuses) return false;
  const n = a.statuses.length;
  a.statuses = a.statuses.filter((s) => s.id !== id);
  return a.statuses.length !== n;
}

/** Soma de um campo numérico (acc, eva, dmgPct, beHit, beCrit...) sobre os estados (× pilhas para dmgPct/eva de fúria). */
export function statusSum(a, field) {
  let s = 0;
  for (const st of a?.statuses || []) {
    const d = STATUSES[st.id];
    if (!d || d[field] == null) continue;
    const perStack = field === 'dmgPct' || (st.id === 'furioso' && field === 'eva');
    s += d[field] * (perStack ? (st.stacks || 1) : 1);
  }
  return s;
}

/** Diminui durações no fim do turno do portador (posturas saem no início do próximo turno). */
export function tickDurations(a) {
  for (const s of a.statuses) {
    const d = STATUSES[s.id];
    if (!d || d.stance || s.turns >= 99) continue;
    s.turns -= 1;
  }
  a.statuses = a.statuses.filter((s) => s.turns > 0);
  if (a.flags?.stunImmune > 0) a.flags.stunImmune -= 1;
}

export function clearStances(a) {
  a.statuses = a.statuses.filter((s) => !STATUSES[s.id]?.stance);
}

// ───────────── partes ─────────────
export const partBroken = (p) => !p || p.state === 'destruido' || p.state === 'decepado';
export function partOk(a, pid) { return !!a?.parts?.[pid] && !partBroken(a.parts[pid]); }
export function liveParts(a) { return Object.entries(a.parts || {}).filter(([, p]) => !partBroken(p)).map(([id]) => id); }
export function partsByRole(a, role) { return Object.entries(a.parts || {}).filter(([, p]) => p.role === role).map(([id]) => id); }
export function swarmAlive(a) { return Object.values(a.parts || {}).filter((p) => p.role === 'swarm' && !partBroken(p)).length; }
export function brokenCount(a) { return Object.values(a.parts || {}).filter((p) => partBroken(p) && p.role !== 'swarm').length; }
export function woundedParts(a) { return Object.values(a.parts || {}).filter((p) => p.role !== 'swarm' && (p.state !== 'ok' || p.hp < p.max)).length; }

export function legsGone(a) {
  const legs = partsByRole(a, 'legs');
  return legs.length > 0 && legs.every((id) => partBroken(a.parts[id]));
}

export function canMove(G, a) {
  if (!isUp(a)) return false;
  if (hasStatus(a, 'enredado') || hasStatus(a, 'agarrado') || hasStatus(a, 'aleijado') || hasStatus(a, 'rendido')) return false;
  if (a.side !== 'hero' && legsGone(a)) return false;
  return true;
}

/** Sorteia uma parte do herói conforme pesos (pula partes perdidas). */
export function pickHeroPart(spec, lost = []) {
  let list;
  if (!spec || spec === 'random') list = HERO_PART_WEIGHTS;
  else if (typeof spec === 'string') return lost.includes(spec) ? 'tronco' : spec;
  else list = spec;
  const filtered = list.filter(([p]) => !lost.includes(p));
  return R.weighted(filtered.length ? filtered : [['tronco', 1]]);
}

export function moraleOf(a) { return a.morale ?? 0; }
export function changeMorale(G, a, n) {
  if (!a || a.side !== 'enemy' || !a.moraleMax) return;
  a.morale = clamp((a.morale ?? 0) + n, 0, 100);
}

export function rollPct(p) { return R.chance(clamp(p, 0, 100)); }
export function rangeRoll(mm) { return R.int(Math.round(mm[0]), Math.round(Math.max(mm[0], mm[1]))); }
