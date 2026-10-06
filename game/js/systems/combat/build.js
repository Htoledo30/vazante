// Construção de atores (inimigos, herói, aliado) a partir dos dados.
import { R } from '../../core/rng.js';
import { uid, clone } from '../../core/util.js';
import { ENEMIES, resolveEnemyId, REGION_TIER } from '../../data/enemies.js';
import { COMPANIONS } from '../../data/companions.js';
import { HERO_UID, HERO_PARTS } from './core.js';
import { heroD } from './deps.js';

/** Botões globais de balanceamento (dano inimigo). */
export const GLOBAL_DMG = 0.8;
export const GLOBAL_BOSS_DMG = 0.9;

const ELITE_PREFIX = { humano: 'Veterano', fera: 'Alfa', enxame: 'Grande', morto: 'Inchado' };

function eliteName(def) {
  for (const t of def.tags || []) if (ELITE_PREFIX[t]) return `${def.name} ${ELITE_PREFIX[t]}`;
  return `${def.name} Brutal`;
}

/** Normaliza a especificação de um inimigo (string ou objeto). */
export function normSpec(s) { return typeof s === 'string' ? { id: s } : { ...(s || {}) }; }

/**
 * Cria um ator inimigo. regionTier: tier da região do combate (escala humanos genéricos).
 * opts: { summoned, master, heroLevel }
 */
export function buildEnemy(G, spec, regionTier = 1, opts = {}) {
  const s = normSpec(spec);
  const r = resolveEnemyId(s.id);
  if (r.substituted) console.warn(`[combat] inimigo '${s.id}' ainda não implementado; usando '${r.id}' (nível +${r.level}).`);
  const def = r.def;
  let level = (s.level && !def.levelScaled ? s.level : 0) + r.level;
  if (def.scales) level += Math.max(0, regionTier - (def.tier || 1));
  const elite = !!s.elite && !def.elite && !def.boss;

  let hpMult = (1 + 0.3 * level) * (elite ? 1.4 : 1);
  let dmgMult = (1 + 0.15 * level) * (elite ? 1.2 : 1);
  let accBonus = level * 4 + (elite ? 5 : 0);
  let armorBonus = level;
  if (def.levelScaled) {
    // Aberração: escala com o nível do herdeiro morto.
    const lv = Math.max(1, s.level ?? opts.heroLevel ?? 1);
    hpMult = 1 + 0.2 * (lv - 1);
    dmgMult = 1 + 0.12 * (lv - 1);
    accBonus = (lv - 1) * 2;
    armorBonus = Math.floor((lv - 1) / 2);
    level = lv;
  }

  const parts = {};
  for (const [pid, p] of Object.entries(def.parts)) {
    const hp = Math.max(1, Math.round(p.hp * hpMult));
    const armor = { corte: 0, perf: 0, impacto: 0, fogo: 0, ...(p.armor || {}) };
    if (p.role !== 'swarm') for (const k of ['corte', 'perf', 'impacto']) armor[k] += armorBonus;
    parts[pid] = {
      hp, max: hp, armor, state: 'ok', role: p.role, name: p.name || pid,
      hitMod: p.hitMod, weakpoint: p.weakpoint, severable: p.severable, onBreak: p.onBreak, vital: p.vital, desc: p.desc,
    };
    for (const k of Object.keys(parts[pid])) if (parts[pid][k] === undefined) delete parts[pid][k];
  }
  const swarm = Object.values(def.parts).some((p) => p.role === 'swarm');
  const hpMax = swarm
    ? Object.values(parts).reduce((t, p) => t + p.max, 0)
    : Math.max(1, Math.round(def.hp * hpMult));

  let dist = s.dist;
  if (dist == null) {
    const sd = def.startDist;
    dist = Array.isArray(sd) ? R.int(sd[0], sd[1]) : (sd ?? 1);
  }

  return {
    uid: uid('e'), side: 'enemy', def: r.id, name: elite ? eliteName(def) : def.name,
    hp: hpMax, hpMax, stamina: 0, staminaMax: 0, next: 0, dist: Math.max(0, Math.min(2, dist)),
    parts, statuses: [], intent: null,
    morale: def.morale || 0, moraleMax: def.morale || 0,
    flags: {
      cd: {}, used: {}, scale: { dmg: +(dmgMult * (def.boss ? GLOBAL_BOSS_DMG : GLOBAL_DMG)).toFixed(3), acc: accBonus }, level, elite: elite || !!def.elite, boss: !!def.boss,
      loaded: !!def.startLoaded, bombs: def.bombs || 0, phase: 1, stage: 0, speedBonus: 0,
      origId: s.id, summoned: !!opts.summoned, master: opts.master || null, lowHpShaken: false,
    },
  };
}

/** Numera nomes repetidos ("Cão da Chaga 2"). */
export function numberNames(actors) {
  const count = {};
  for (const a of actors) if (a.side === 'enemy') count[a.name] = (count[a.name] || 0) + 1;
  const seen = {};
  for (const a of actors) {
    if (a.side !== 'enemy' || count[a.name] < 2 || a.flags.numbered) continue;
    seen[a.name] = (seen[a.name] || 0) + 1;
    a.flags.numbered = true;
    a.name = `${a.name} ${seen[a.name]}`;
  }
}

export function buildHero(G) {
  const D = heroD(G);
  const h = G.hero;
  const parts = {};
  for (const p of HERO_PARTS) {
    const lost = D.lostParts.includes(p);
    parts[p] = { hp: lost ? 0 : 1, max: 1, armor: D.armor[p], state: lost ? 'decepado' : 'ok' };
  }
  h.hp = Math.min(h.hp ?? D.hpMax, D.hpMax);
  const stamMax = D.staminaMax;
  return {
    uid: HERO_UID, side: 'hero', def: 'hero', name: h.name || 'Você',
    hp: h.hp, hpMax: D.hpMax, stamina: stamMax, staminaMax: stamMax, next: 0, dist: 0,
    parts, statuses: [], intent: null, morale: 100,
    flags: { loaded: true, charge: null, lastStand: 0, orderGiven: false, collapse: null, sneak: false, stunImmune: 0 },
  };
}

export function buildAlly(G) {
  const c = G.hero?.companion;
  if (!c) return null;
  const def = COMPANIONS[c.id];
  if (!def || (c.hp ?? 1) <= 0) return null;
  const armor = { corte: def.armor, perf: def.armor, impacto: def.armor, fogo: 0 };
  return {
    uid: 'ally', side: 'ally', def: c.id, name: c.name || def.name,
    hp: Math.min(c.hp ?? def.hp, c.hpMax ?? def.hp), hpMax: c.hpMax ?? def.hp, stamina: 0, staminaMax: 0, next: 0, dist: 0,
    parts: { tronco: { hp: 1, max: 1, armor, state: 'ok' } }, statuses: [], intent: null, morale: 100,
    flags: { order: c.order || 'atacar', stunImmune: 0 },
  };
}

export function regionTier(region) { return REGION_TIER[region] || 1; }
export { ENEMIES, clone };
