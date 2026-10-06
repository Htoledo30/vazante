// Ações do herói: lista de ações, alvos, prévia de acerto/dano, ataques, técnicas, defesas, movimento, itens.
// Tudo opera sobre G.combat (JSON puro). Retornos { time } = custo de tempo da ação (antes da velocidade).
import { R } from '../../core/rng.js';
import { clamp } from '../../core/util.js';
import { TECHNIQUES, CLASS_TECHNIQUES, masteryLevel } from '../../data/techniques.js';
import { STATUSES } from '../../data/statuses.js';
import { COMBAT_SPECIALS } from '../../data/items.js';
import {
  HERO_UID, heroActor, allyActor, foes, surrendered, engagedFoes, edef, hasTag, log, emitEv, getStatus, hasStatus, stacks,
  addStatus, removeStatus, statusSum, partBroken, partOk, woundedParts, brokenCount, swarmAlive, changeMorale, rollPct, rangeRoll,
  canMove, DIST_NAMES, DTYPE_NAMES,
} from './core.js';
import { heroD, itemDef, itemName, countItem, removeItem, consumeInst, equipItem, applyEffects } from './deps.js';
import {
  damageEnemy, damageHero, healHero, killEnemy, knockDown, interrupt, applyStatusList, dreadHero, corruptHero, releaseGrab,
} from './resolve.js';

// ───────────────────────── utilidades ─────────────────────────

const ROLE_HIT = { head: -20, torso: 5, arm: -10, arm2: -10, legs: -8, special: -10, swarm: 0 };
const ROLE_LABEL = { head: 'cabeça', torso: 'tronco', arm: 'braço', arm2: 'braço', legs: 'pernas', special: 'ponto fraco', swarm: 'bando' };

const BASIC = {
  golpe: { id: 'golpe', name: 'Golpe', stam: null, time: 1, dmgMult: 1, hitMod: 0, target: 'part', desc: 'Ataque normal com a arma.' },
  disparo: { id: 'disparo', name: 'Disparar', stam: null, time: 1, dmgMult: 1, hitMod: 0, target: 'part', ranged: true, req: { loaded: true }, desc: 'Dispara o virote armado.' },
  secundaria: { id: 'secundaria', name: 'Golpe da mão secundária', stam: 1, time: 60, dmgMult: 0.6, hitMod: 0, target: 'part', offhand: true, desc: 'Ataque rápido com a arma leve da outra mão (60% do dano).' },
};

export function techDef(id) { return BASIC[id] || TECHNIQUES[id] || null; }

/** Lê/garante as flags transitórias do ator herói. */
function hf(G) { const h = heroActor(G); h.flags ||= {}; return h.flags; }

/** Multiplicador de tempo do herói. */
export function heroTimeMult(G, D = heroD(G)) {
  const h = heroActor(G);
  let m = clamp(1 - (D.speed || 0) / 100, 0.55, 1.8);
  m *= 1 + statusSum(h, 'timePct') / 100;
  return m;
}

/** Tempo base de uma técnica (antes da velocidade). */
function techTime(tech, D) {
  const wt = tech.offhand ? 60 : (D.weapon.time || 100);
  if (tech.time == null) return wt;
  return tech.time > 3 ? tech.time : Math.round(wt * tech.time);
}
function techStam(tech, D) {
  if (tech.stam == null) return D.weapon.stam ?? 2;
  return tech.stam;
}

function weaponReach(D, tech) {
  if (tech.reach != null) return tech.reach;
  if (tech.offhand) return 0;
  if (D.weapon.ranged || tech.ranged) return 2;
  return D.weapon.reach || 0;
}

/** Técnicas disponíveis (ids), sem checar requisitos situacionais. */
export function heroTechniques(G, D = heroD(G)) {
  const hero = G.hero;
  const cls = D.weapon.cls || 'desarmado';
  const lvl = masteryLevel((hero.mastery?.[cls] || 0));
  const out = [];
  for (const id of CLASS_TECHNIQUES[cls] || []) if (TECHNIQUES[id].mastery <= lvl) out.push(id);
  for (const id of CLASS_TECHNIQUES.geral || []) if (!TECHNIQUES[id].tome) out.push(id);
  for (const id of hero.techniques || []) if (TECHNIQUES[id] && !out.includes(id)) out.push(id);
  return out;
}

/** Partes do inimigo que a técnica permite mirar. */
function partAllowed(p, pid, tech) {
  if (!tech.parts) return true;
  const role = p.role;
  for (const want of tech.parts) {
    if (want === pid) return true;
    if (want === 'cabeca' && role === 'head') return true;
    if (want === 'tronco' && role === 'torso') return true;
    if (want === 'pernas' && role === 'legs') return true;
    if (want === 'braco' && (role === 'arm' || role === 'arm2')) return true;
    if (want === 'bracoD' && role === 'arm') return true;
    if (want === 'bracoE' && role === 'arm2') return true;
    if (want === 'membro' && ['arm', 'arm2', 'legs'].includes(role)) return true;
  }
  return false;
}

function targetIndefeso(t) {
  return ['caido', 'atordoado', 'agarrado', 'enredado', 'rendido', 'desprevenido', 'cego'].some((s) => hasStatus(t, s));
}

/** Requisitos situacionais de uma técnica (sem alvo). Retorna '' se ok, ou o motivo. */
function techReqProblem(G, tech, D) {
  const h = heroActor(G);
  const r = tech.req || {};
  if (r.offhand && D.offhand.kind !== r.offhand) return r.offhand === 'shield' ? 'Precisa de escudo.' : r.offhand === 'torch' ? 'Precisa de tocha na mão.' : 'Mão secundária errada.';
  if (r.loaded && !h.flags.loaded) return 'A besta não está armada.';
  if (r.notLoaded && h.flags.loaded) return 'Já está armada.';
  if (r.ammo && countItem(G.hero, r.ammo) <= 0) return `Sem ${itemDef(r.ammo)?.name || r.ammo}.`;
  if (r.item && countItem(G.hero, r.item) <= 0) return `Sem ${itemDef(r.item)?.name || r.item}.`;
  if (tech.offhand && !(D.offhand.kind === 'weapon' && D.offhand.dmg)) return 'Sem arma na outra mão.';
  return '';
}

/** Problema de um alvo específico para a técnica. */
function targetProblem(G, tech, D, t) {
  if (!t || t.dead || t.gone) return 'Alvo inválido.';
  const r = tech.req || {};
  const reach = weaponReach(D, tech);
  if (tech.id !== 'executar' && tech.special !== 'executar') {
    if (!tech.ranged && !D.weapon.ranged && !tech.offhand && t.dist > reach) return `Longe demais (${DIST_NAMES[t.dist]}). Avance.`;
    if (tech.offhand && t.dist > 0) return 'Só no corpo a corpo.';
  }
  if (tech.special === 'executar') {
    if (t.dist > 0) return 'Precisa estar colado nele.';
    if (!targetIndefeso(t) && t.hp > t.hpMax * 0.25) return 'Só em quem está caído, atordoado, preso, rendido ou moribundo.';
    if (t.flags?.boss && t.hp > t.hpMax * 0.15) return 'Grande demais para um golpe de misericórdia (abaixo de 15%).';
  }
  if (r.targetStatus && !r.targetStatus.some((s) => hasStatus(t, s))) return 'Alvo precisa estar indefeso (caído, atordoado, preso...).';
  if (r.targetHpBelow && t.hp > t.hpMax * r.targetHpBelow) return `Alvo precisa estar abaixo de ${Math.round(r.targetHpBelow * 100)}% de Vida.`;
  if (r.notEngaged && t.dist === 0) return 'Alvo colado demais.';
  if (r.engaged && t.dist > 0) return 'Só no corpo a corpo.';
  if (tech.parts && !Object.entries(t.parts).some(([pid, p]) => !partBroken(p) && partAllowed(p, pid, tech))) return 'Não há parte válida.';
  return '';
}

// ───────────────────────── cálculo de ataque ─────────────────────────

function darkPenalty(G, D) {
  const c = G.combat;
  if (!c.env.dark || c.env.lit) return 0;
  return Math.max(0, 15 - Math.floor((D.mods.dark || 0) / 3));
}

/** Chance de acerto (%) do herói numa parte. */
export function hitChance(G, D, tech, t, pid) {
  const h = heroActor(G);
  const p = t.parts[pid];
  const def = edef(t);
  let ch = (D.acc || 60) + 8 + (tech.hitMod || 0);
  ch += (p?.hitMod ?? 0) + (ROLE_HIT[p?.role] ?? 0);
  ch -= (def?.eva || 0) + statusSum(t, 'eva');
  ch += statusSum(t, 'beHit') + statusSum(h, 'acc');
  ch -= darkPenalty(G, D);
  if ((D.weapon.ranged || tech.ranged) && t.dist === 0 && !tech.offhand) ch -= 20;
  if (t.flags?.elite) ch -= 3;
  return clamp(Math.round(ch), 5, 95);
}

/** Linha de multiplicadores contra o alvo. */
function dmgMultiplier(G, D, tech, t, dtype, pid) {
  const h = heroActor(G);
  const def = edef(t);
  let m = (tech.dmgMult ?? 1) * (1 + ((D.mods.dmg_all || 0) + (D.mods[`dmg_${dtype}`] || 0)) / 100) * (1 + statusSum(h, 'dmgPct') / 100);
  if (D.weapon.cls === 'desarmado' && !tech.offhand) m *= 1 + (D.mods.unarmed || 0) / 100;
  if (def?.weak?.includes(dtype)) m *= 1.3;
  if (def?.resist?.includes(dtype)) m *= 0.7;
  const holy = (D.weapon.props || []).includes('santa') || (D.tags || []).includes('arma_santa');
  if (holy && (hasTag(t, 'morto') || hasTag(t, 'chaga'))) m *= 1.3;
  if (tech.perWound) m *= 1 + (tech.perWound / 100) * (woundedParts(t) + brokenCount(t));
  if (tech.perBleed) m *= 1 + (tech.perBleed / 100) * stacks(t, 'sangrando');
  if (tech.vs && tech.vs.statuses.some((s) => hasStatus(t, s))) m *= tech.vs.mult;
  if (tech.special === 'desossar') { const p = t.parts[pid]; if (p && (p.state !== 'ok' || p.hp < p.max)) m *= 1.8; }
  const guarded = hasStatus(t, 'guarda') && !partBroken(t.parts.bracoE);
  const ignoresGuard = tech.special === 'ignora_guarda' || (D.weapon.props || []).includes('ignora_bloqueio') || (D.weapon.props || []).includes('quebra_escudo');
  if (guarded && !ignoresGuard) m *= 0.5;
  if (guarded && tech.special === 'ignora_guarda') m *= 1.3;
  return m;
}

function armorFor(D, tech, p, dtype) {
  if (!p) return 0;
  if (dtype === 'icor') return 0;
  let a = p.armor?.[dtype] ?? 0;
  let pierce = tech.armorPierce || 0;
  if (dtype === 'perf' && (D.weapon.props || []).includes('fura')) pierce += 0.25;
  if (dtype === 'impacto' && (D.weapon.props || []).includes('antiplaca')) a *= 0.5;
  return Math.max(0, a * (1 - clamp(pierce, 0, 1)));
}

function baseDamage(G, D, tech) {
  if (tech.offhand) return D.offhand?.dmg || [2, 4];
  return D.weapon.dmg;
}

/** Prévia: { hit, est:[min,max], crit, notes } */
export function previewHit(G, actionId, targetUid, partId) {
  const c = G.combat;
  const D = heroD(G);
  const tech = resolveTech(actionId, D);
  const t = c.actors.find((a) => a.uid === targetUid);
  if (!tech || !t) return null;
  const pid = partId === 'swarm' ? (Object.keys(t.parts).find((k) => !partBroken(t.parts[k])) || partId) : partId;
  const p = t.parts[pid];
  const dtype = tech.dtype || (tech.offhand ? D.offhand.dtype : D.weapon.dtype) || 'corte';
  const m = dmgMultiplier(G, D, tech, t, dtype, pid);
  const arm = armorFor(D, tech, p, dtype);
  const [a, b] = baseDamage(G, D, tech);
  const hits = tech.hits || 1;
  let est = [Math.max(1, Math.round(a * m - arm)), Math.max(1, Math.round(b * m - arm))];
  if (tech.dmgMult === 0) est = [0, 0];
  const notes = [];
  if (arm > 0) notes.push(`armadura −${Math.round(arm)}`);
  if (edef(t)?.weak?.includes(dtype)) notes.push('fraqueza!');
  if (edef(t)?.resist?.includes(dtype)) notes.push('resiste');
  if (hasStatus(t, 'guarda')) notes.push('em guarda');
  if (hits > 1) notes.push(`${hits} golpes`);
  if (tech.kill && t.hp <= t.hpMax * tech.kill.hpBelow) notes.push(`${tech.kill.chance}% morte instantânea`);
  return {
    hit: tech.target === 'self' ? 100 : hitChance(G, D, tech, t, pid),
    est: hits > 1 ? [est[0] * hits, est[1] * hits] : est,
    crit: clamp((D.crit || 0) + (tech.crit || 0) + statusSum(t, 'beCrit') + statusSum(heroActor(G), 'crit'), 0, 100),
    sever: (tech.sever || 0) + (D.mods.sever || 0),
    notes, dtype,
  };
}

function resolveTech(actionId, D) {
  if (actionId === 'atacar') return D.weapon.ranged ? BASIC.disparo : BASIC.golpe;
  return techDef(actionId);
}

// ───────────────────────── golpe do herói ─────────────────────────

/**
 * Um golpe do herói numa parte. opts: { tech, mult, free, forceCrit, noMiss, label }
 * Retorna { hit, dealt, killed, crit }.
 */
export function heroStrike(G, t, pid, opts = {}) {
  const c = G.combat;
  const D = heroD(G);
  const h = heroActor(G);
  const tech = opts.tech || BASIC.golpe;
  if (!t || t.dead) return { hit: false, dealt: 0 };
  if (!t.parts[pid] || partBroken(t.parts[pid])) {
    const alive = Object.keys(t.parts).filter((k) => !partBroken(t.parts[k]) && partAllowed(t.parts[k], k, tech));
    pid = alive.find((k) => t.parts[k].role === 'torso') || alive[0] || Object.keys(t.parts)[0];
  }
  const p = t.parts[pid];
  const pname = (p?.role === 'swarm' ? 'bando' : (p?.name || ROLE_LABEL[p?.role] || pid)).toLowerCase();
  const weaponName = tech.offhand ? (D.offhand.name || 'mão secundária') : (D.weapon.name || 'arma');
  let chance = hitChance(G, D, tech, t, pid) + (opts.hitBonus || 0);
  if (opts.noMiss) chance = 100;
  if (!rollPct(chance)) {
    log(G, `${opts.label || tech.name}: você erra ${t.name}${p?.role !== 'swarm' ? ` (${pname})` : ''}.`, 'miss');
    emitEv(G, { type: 'miss', target: t.uid, sfx: 'miss' });
    if (hasStatus(h, 'mirando') && (D.weapon.ranged || tech.ranged)) removeStatus(h, 'mirando');
    return { hit: false, dealt: 0 };
  }
  const dtype = tech.dtype || (tech.offhand ? D.offhand.dtype : D.weapon.dtype) || 'corte';
  let critCh = (D.crit || 0) + (tech.crit || 0) + statusSum(t, 'beCrit') + statusSum(h, 'crit');
  let crit = opts.forceCrit || h.flags.nextCrit || rollPct(critCh);
  if (h.flags.nextCrit) h.flags.nextCrit = false;
  if (hasStatus(h, 'mirando') && (D.weapon.ranged || tech.ranged)) removeStatus(h, 'mirando');
  let m = dmgMultiplier(G, D, tech, t, dtype, pid) * (opts.mult ?? 1);
  if (crit) m *= 1.5;
  const raw = rangeRoll(baseDamage(G, D, tech)) * m;
  let dmg = Math.max(tech.dmgMult === 0 ? 0 : 1, Math.round(raw - armorFor(D, tech, p, dtype)));
  // unção / cobertura
  let extra = 0;
  const xd = D.weapon.extraDmg;
  if (xd && !tech.offhand) extra += xd.n;
  const winst = D.weapon.inst;
  const fireNear = D.offhand.kind === 'torch' || (D.tags || []).includes('arma_fogo');
  const oil = (winst?.coat?.kind === 'oleo' && winst.coat.hits > 0) || stacks(h, 'untado_oleo') > 0;
  const poison = (winst?.coat?.kind === 'veneno' && winst.coat.hits > 0) || stacks(h, 'untado_veneno') > 0;
  if (oil && dmg > 0) {
    if (fireNear || c.env.lit) { extra += 4; if (rollPct(30)) applyStatusList(G, t, [{ id: 'queimando', chance: 100 }], HERO_UID); }
    spendCoat(h, winst, 'oleo', 'untado_oleo');
  }
  const before = t.hp;
  const res = damageEnemy(G, t, dmg + extra, {
    part: pid, dtype, crit,
    sever: (tech.sever || 0) + (D.mods.sever || 0) + ((D.weapon.props || []).includes('decepa') ? 10 : 0) + (crit ? 15 : 0),
    fracture: (tech.fracture || 0) + (D.mods.fracture || 0) + (crit ? 10 : 0),
    stun: tech.stun ? tech.stun + (crit ? 15 : 0) : ((D.weapon.props || []).includes('atordoa') && dtype === 'impacto' ? 8 + (crit ? 15 : 0) : 0),
    prone: tech.prone || 0, by: 'hero',
  });
  const dealt = Math.max(0, before - t.hp);
  const verb = crit ? 'CRÍTICO' : 'acerta';
  log(G, `${opts.label || tech.name}: ${verb} ${t.name}${p?.role !== 'swarm' ? ` no ${pname}` : ''} (${dmg + extra}${dtype !== 'corte' ? ` ${DTYPE_NAMES[dtype] || dtype}` : ''}).`, crit ? 'crit' : 'hit');
  if (!t.dead) {
    // sangramento
    let bleed = tech.bleed || 0;
    if ((D.weapon.props || []).includes('sangra') && dtype !== 'impacto' && rollPct(35 + (D.mods.bleed || 0) / 2)) bleed += 1;
    if (bleed > 0) applyStatusList(G, t, [{ id: 'sangrando', chance: 100, stacks: bleed + ((D.mods.bleed || 0) >= 40 ? 1 : 0), turns: 4 }], HERO_UID);
    if (poison && dmg > 0) { applyStatusList(G, t, [{ id: 'envenenado', chance: 100, stacks: 2 }], HERO_UID); spendCoat(h, winst, 'veneno', 'untado_veneno'); }
    if ((D.tags || []).includes('arma_veneno') && dmg > 0 && rollPct(40)) applyStatusList(G, t, [{ id: 'envenenado', chance: 100, stacks: 1 }], HERO_UID);
    if (tech.status) {
      applyStatusList(G, t, tech.status.filter((s) => !s.self), HERO_UID);
      applyStatusList(G, h, tech.status.filter((s) => s.self), HERO_UID);
    }
    if (tech.interrupt) interrupt(G, t, 'golpe certeiro');
    if (tech.morale) changeMorale(G, t, tech.morale);
    if (tech.kill && t.hp <= t.hpMax * tech.kill.hpBelow && !t.flags.boss && rollPct(tech.kill.chance)) {
      killEnemy(G, t, { by: 'hero', how: pid && t.parts[pid]?.role === 'head' ? 'decapitado' : 'executado', part: pid });
      log(G, `${tech.name}: ${t.name} cai de uma vez.`, 'kill');
    }
  }
  if (tech.moraleAll) for (const f of foes(G)) changeMorale(G, f, tech.moraleAll);
  // lifesteal
  if (D.mods.lifesteal && dealt > 0) healHero(G, Math.max(1, Math.round(dealt * D.mods.lifesteal / 100)));
  // autoflagelo (mangual do penitente)
  if ((D.weapon.props || []).includes('autoflagelo') && !tech.offhand) damageHero(G, 2, { part: 'bracoD', dtype: 'corte', noWound: true, srcName: 'a própria corrente' });
  // desgaste da arma
  if (winst && !tech.offhand && winst.dur != null && rollPct(20)) winst.dur = Math.max(0, winst.dur - 1);
  // maestria
  if (!tech.offhand) c.mastery[D.weapon.cls] = (c.mastery[D.weapon.cls] || 0) + 1;
  if (t.dead && (D.weapon.props || []).includes('sede')) corruptHero(G, 1, 'a lâmina bebeu');
  return { hit: true, dealt, killed: !!t.dead, crit };
}

function spendCoat(h, inst, kind, statusId) {
  if (inst?.coat?.kind === kind && inst.coat.hits > 0) { inst.coat.hits -= 1; if (inst.coat.hits <= 0) inst.coat = null; return; }
  const s = getStatus(h, statusId);
  if (s) { s.stacks -= 1; if (s.stacks <= 0) removeStatus(h, statusId); }
}

// ───────────────────────── lista de ações ─────────────────────────

function heroCanMove(G) {
  const h = heroActor(G);
  return !['agarrado', 'enredado', 'caido', 'aleijado'].some((s) => hasStatus(h, s));
}

export function fleeChance(G, D = heroD(G)) {
  const c = G.combat;
  const eng = engagedFoes(G).filter((f) => !hasStatus(f, 'atordoado') && !hasStatus(f, 'caido')).length;
  let ch = 25 + (D.attrs.des || 3) * 5 + (eng === 0 ? 30 : -12 * eng) - (D.heavy || 0) * 5 + Math.floor((D.mods.stealth || 0) / 2);
  if (c.env.dark && !c.env.lit) ch += 10;
  if (c.smoke && c.smoke >= c.round) ch += 25;
  return clamp(Math.round(ch), 5, 90);
}

function parryChance(G, D) {
  const h = heroActor(G);
  let ch = 30 + (D.attrs.des || 3) * 4 + (D.mods.parry || 0) + ((D.weapon.props || []).includes('apara') ? 15 : 0);
  if (h.flags.riposta) ch += 25;
  if (D.weapon.cls === 'desarmado') ch -= 20;
  return clamp(Math.round(ch), 5, 90);
}

export function blockPct(G, D) {
  const h = heroActor(G);
  let b = D.offhand.kind === 'shield' ? D.offhand.block : ((D.weapon.props || []).includes('apara') ? 25 : D.weapon.hands === 2 ? 22 : 15);
  b += D.mods.block || 0;
  if (h.flags.shieldWall) b += 30;
  return clamp(Math.round(b), 0, 90);
}

/** Lista de ações do herói agora. */
export function heroActions(G) {
  const c = G.combat;
  if (!c || c.result || c.turn !== 'hero') return [];
  const D = heroD(G);
  const h = heroActor(G);
  const out = [];
  const stam = h.stamina;
  const tm = heroTimeMult(G, D);
  const col = h.flags.collapse;
  const panic = col?.kind === 'panico';
  const fury = col?.kind === 'furia';
  const add = (o) => {
    const st = o.cost?.stam || 0;
    if (!o.disabled && st > stam) { o.disabled = true; o.why = `Fôlego insuficiente (${stam}/${st}).`; }
    if (o.cost && o.cost.time != null) o.cost.time = Math.round(o.cost.time * tm);
    if (!o.sub && o.cost) o.sub = `${o.cost.stam ? `${o.cost.stam} Fôlego · ` : ''}tempo ${o.cost.time}`;
    out.push(o);
  };
  const anyTarget = (tech) => foes(G).some((t) => !targetProblem(G, tech, D, t)) || surrendered(G).some((t) => !targetProblem(G, tech, D, t));

  // ataques
  const basic = resolveTech('atacar', D);
  {
    let why = techReqProblem(G, basic, D);
    if (!why && D.weapon.unusable) why = D.weapon.unusable;
    if (!why && !anyTarget(basic)) why = D.weapon.ranged ? 'Sem alvo.' : 'Ninguém ao alcance. Avance.';
    if (panic) why = 'Pânico: você só consegue pensar em fugir.';
    add({ id: 'atacar', label: D.weapon.ranged ? 'Disparar' : `Golpe (${D.weapon.name})`, kind: 'attack', target: 'part', disabled: !!why, why,
      cost: { stam: techStam(basic, D), time: techTime(basic, D) }, desc: `${D.weapon.dmg[0]}–${D.weapon.dmg[1]} ${DTYPE_NAMES[D.weapon.dtype] || ''}` });
  }
  if (D.offhand.kind === 'weapon' && D.offhand.dmg) {
    const t = BASIC.secundaria;
    let why = anyTarget(t) ? '' : 'Ninguém colado em você.';
    if (panic) why = 'Pânico.';
    add({ id: 'secundaria', label: 'Mão secundária', kind: 'attack', target: 'part', disabled: !!why, why, cost: { stam: 1, time: 60 }, desc: t.desc });
  }
  for (const id of heroTechniques(G, D)) {
    const tech = TECHNIQUES[id];
    if (!tech) continue;
    if (D.weapon.unusable && tech.cls !== 'geral') continue;
    let why = techReqProblem(G, tech, D);
    const tgt = tech.target === 'self' ? 'self' : (tech.target === 'engaged' || tech.target === 'near') ? 'none' : (tech.target === 'enemy' ? 'enemy' : 'part');
    if (!why && tgt === 'none') {
      const maxD = tech.target === 'engaged' ? 0 : 1;
      if (!foes(G).some((f) => f.dist <= maxD)) why = 'Ninguém perto o bastante.';
    } else if (!why && (tgt === 'part' || tgt === 'enemy') && !anyTarget(tech)) why = 'Nenhum alvo válido agora.';
    if (panic && tech.target !== 'self') why = 'Pânico.';
    if (fury && tech.target === 'self' && ['riposta', 'passo_sombra', 'muralha_pontas', 'muralha_escudo'].includes(tech.special || tech.id)) why = 'Fúria: você não se defende.';
    const kind = tech.cls === 'geral' ? 'other' : 'tech';
    add({ id, label: tech.name, kind, target: tgt, disabled: !!why, why, cost: { stam: techStam(tech, D), time: techTime(tech, D) + (tech.windup || 0) }, desc: tech.desc, windup: tech.windup || 0 });
  }
  // defesas
  const defWhy = fury ? 'Fúria: você não se defende.' : '';
  add({ id: 'guarda', label: D.offhand.kind === 'shield' ? 'Guarda (escudo)' : 'Guarda', kind: 'defense', target: 'self', disabled: !!defWhy, why: defWhy,
    cost: { stam: 1, time: 60 }, desc: `Bloqueia ${blockPct(G, D)}% de cada golpe até seu próximo turno (custa ${D.offhand.kind === 'shield' ? D.offhand.stamBlock : 2} Fôlego por bloqueio).` });
  const dodgeWhy = defWhy || (['caido', 'agarrado', 'enredado'].some((s) => hasStatus(h, s)) ? 'Preso ou caído: não dá para esquivar.' : '');
  add({ id: 'esquiva', label: 'Esquiva', kind: 'defense', target: 'self', disabled: !!dodgeWhy, why: dodgeWhy,
    cost: { stam: 2, time: 60 }, desc: `+${Math.max(5, 30 + (D.mods.dodge || 0) - (D.heavy || 0) * 6)} de esquiva até seu próximo turno. Armadura pesada atrapalha.` });
  const parryWhy = defWhy || (D.weapon.ranged ? 'Não se apara com besta.' : '');
  add({ id: 'aparar', label: 'Aparar', kind: 'defense', target: 'self', disabled: !!parryWhy, why: parryWhy,
    cost: { stam: 2, time: 60 }, desc: `${parryChance(G, D)}% contra o próximo golpe corpo a corpo: anula, contra-ataca e pode atordoar. Falha: +25% de dano.` });
  // movimento
  const mvWhy = heroCanMove(G) ? '' : 'Preso ou caído.';
  const farFoes = foes(G).filter((f) => f.dist > 0);
  add({ id: 'avancar', label: 'Avançar', kind: 'move', target: 'enemy', disabled: !!(mvWhy || !farFoes.length || panic), why: panic ? 'Pânico.' : mvWhy || 'Todos já estão colados em você.',
    cost: { stam: 1, time: 50 }, desc: 'Aproxima-se de um inimigo (1 passo).' });
  const eng = engagedFoes(G).length;
  add({ id: 'recuar', label: 'Recuar', kind: 'move', target: 'none', disabled: !!mvWhy || !foes(G).some((f) => f.dist < 2), why: mvWhy || 'Já está longe de todos.',
    cost: { stam: 1, time: 60 }, desc: eng ? `Afasta-se de todos. ${eng} inimigo(s) colado(s) atacam ao você virar as costas.` : 'Afasta-se de todos (1 passo).' });
  const canFleeHere = c.context.canFlee !== false && !c.context.boss && D.canFlee;
  const fleeWhy = !canFleeHere ? (c.context.boss ? 'Não se foge disso.' : !D.canFlee ? 'Suas pernas não deixam.' : 'Não há para onde fugir.') : mvWhy;
  add({ id: 'fugir', label: 'Fugir', kind: 'move', target: 'none', disabled: !!fleeWhy, why: fleeWhy, cost: { stam: 2, time: 80 },
    sub: fleeWhy ? undefined : `${fleeChance(G, D)}% · falha: golpes nas costas`, desc: 'Abandona a luta. Falhar custa caro.' });
  if (hasStatus(h, 'caido')) add({ id: 'levantar', label: 'Levantar', kind: 'move', target: 'self', cost: { stam: 1, time: 70 }, desc: 'Sai do chão.' });
  if (hasStatus(h, 'agarrado')) {
    const g = c.actors.find((a) => a.uid === getStatus(h, 'agarrado').src);
    const ch = clamp(35 + (D.attrs.for || 3) * 7 - (g?.flags?.elite ? 15 : 0), 5, 92);
    add({ id: 'soltar', label: 'Soltar-se', kind: 'move', target: 'self', cost: { stam: 2, time: 70 }, sub: `${ch}% (FOR) · 2 Fôlego`, desc: 'Arranca-se de quem te segura.' });
  }
  // itens
  for (const inst of G.hero.inv || []) {
    const def = itemDef(inst);
    if (!def || def.type !== 'consumable' || !def.use?.combat) continue;
    if (out.some((o) => o.itemId === def.id)) continue;
    const sp = typeof def.use.combat === 'string' ? def.use.combat : null;
    const throws = !!(def.throw || def.use?.throw) && ['throw_bomb', 'throw_lime', 'throw_knife', 'holy_water', 'smoke'].includes(sp);
    const half = allyActor(G)?.def === 'carregador' && allyActor(G)?.flags?.order === 'segurar';
    add({ id: `item:${inst.uid}`, itemId: def.id, label: `${def.name} (${countItem(G.hero, def.id)})`, kind: 'item',
      target: throws && sp !== 'smoke' ? 'enemy' : 'none', cost: { stam: 0, time: Math.round((def.use.time || 100) * (half ? 0.5 : 1)) },
      desc: COMBAT_SPECIALS[sp] || def.desc, disabled: false });
  }
  // trocar arma
  for (const inst of G.hero.inv || []) {
    const def = itemDef(inst);
    if (!def || def.type !== 'weapon' || def.prosthetic) continue;
    add({ id: `swap:${inst.uid}`, label: `Empunhar ${itemName(inst)}`, kind: 'swap', target: 'none', cost: { stam: 0, time: 80 }, desc: `${def.dmg?.[0]}–${def.dmg?.[1]} · ${def.hands === 2 ? '2 mãos' : '1 mão'}` });
  }
  // sequaz
  const al = allyActor(G);
  if (al && !h.flags.orderGiven) {
    for (const o of ['atacar', 'proteger', 'segurar']) {
      if (al.flags.order === o) continue;
      add({ id: `order:${o}`, label: `${al.name}: ${o === 'atacar' ? 'Atacar' : o === 'proteger' ? 'Proteger' : 'Segurar'}`, kind: 'order', target: 'none', cost: { stam: 0, time: 0 }, sub: 'ação livre', desc: 'Muda a ordem do sequaz.' });
    }
  }
  add({ id: 'esperar', label: 'Respirar', kind: 'other', target: 'none', cost: { stam: 0, time: 50 }, desc: 'Passa o tempo e recupera +2 Fôlego extra.' });
  return out;
}

/** Alvos de uma ação: [{ uid, name, dist, valid, why, parts:[{id,name,hit,est,state,role,desc}] }] */
export function targetsFor(G, actionId) {
  const c = G.combat;
  const D = heroD(G);
  const list = [...foes(G), ...surrendered(G)];
  if (actionId === 'avancar') {
    return list.filter((t) => !hasStatus(t, 'rendido')).map((t) => ({ uid: t.uid, name: t.name, dist: t.dist, valid: t.dist > 0, why: t.dist > 0 ? '' : 'Já colado.', parts: [] }));
  }
  if (actionId.startsWith('item:')) {
    return list.filter((t) => !hasStatus(t, 'rendido')).map((t) => ({ uid: t.uid, name: t.name, dist: t.dist, valid: true, why: '', parts: [] }));
  }
  const tech = resolveTech(actionId, D);
  if (!tech) return [];
  return list.map((t) => {
    const why = targetProblem(G, tech, D, t);
    const isRendido = hasStatus(t, 'rendido');
    const execOk = actionId === 'executar';
    const valid = !why && (!isRendido || execOk);
    const parts = [];
    let swarmDone = false;
    for (const [pid, p] of Object.entries(t.parts)) {
      if (partBroken(p) || !partAllowed(p, pid, tech)) continue;
      if (p.role === 'swarm') {
        if (swarmDone) continue;
        swarmDone = true;
        const pv = previewHit(G, actionId, t.uid, pid);
        parts.push({ id: 'swarm', name: `Bando (${swarmAlive(t)} vivos)`, role: 'swarm', hit: pv.hit, est: pv.est, crit: pv.crit, notes: pv.notes, state: 'ok', hp: p.hp, max: p.max });
        continue;
      }
      const pv = previewHit(G, actionId, t.uid, pid);
      parts.push({ id: pid, name: p.name || ROLE_LABEL[p.role], role: p.role, hit: pv.hit, est: pv.est, crit: pv.crit, notes: pv.notes, state: p.state, hp: p.hp, max: p.max, desc: p.desc, fractured: !!p.fractured });
    }
    return { uid: t.uid, name: t.name, dist: t.dist, valid: valid && (parts.length > 0 || tech.target !== 'part'), why: why || (isRendido && !execOk ? 'Rendido.' : ''), parts };
  });
}

// ───────────────────────── execução ─────────────────────────

function payStam(G, n) {
  const h = heroActor(G);
  h.stamina = Math.max(0, h.stamina - (n || 0));
  if (h.stamina <= 0 && !hasStatus(h, 'exausto')) { addStatus(G, h, 'exausto', { turns: 99 }); log(G, 'Você está exausto.', 'warn'); }
}

function opportunityAttacks(G, frac = 0.6, why = 'nas suas costas') {
  for (const f of engagedFoes(G)) {
    if (hasStatus(f, 'atordoado') || hasStatus(f, 'caido') || hasStatus(f, 'agarrado')) continue;
    const def = edef(f);
    const it = (def?.intents || []).find((i) => i.kind === 'attack' && (i.reach ?? 0) === 0 && !i.noDamage && !(i.uses || []).some((u) => partBroken(f.parts[u])));
    if (!it) continue;
    enemyStrikeRef(G, f, { ...it, windup: 0 }, { label: `${it.label} (${why})`, mult: frac });
    if (G.combat.result) return;
  }
}

// Referência tardia (evita import circular com ai.js).
let enemyStrikeRef = () => {};
export function setEnemyStrike(fn) { enemyStrikeRef = fn; }

/** Solta o golpe carregado (chamado pelo motor no início do turno do herói). Retorna { time }. */
export function releaseCharge(G) {
  const c = G.combat;
  const h = heroActor(G);
  const ch = h.flags.charge;
  h.flags.charge = null;
  removeStatus(h, 'carregando');
  if (!ch) return { time: 0 };
  const D = heroD(G);
  const tech = resolveTech(ch.action, D);
  const t = c.actors.find((x) => x.uid === ch.target);
  if (!tech || !t || t.dead || t.gone) { log(G, 'O alvo do golpe preparado se foi. Você baixa a arma.', 'info'); return { time: 30 }; }
  if (targetProblem(G, tech, D, t)) { log(G, `${tech.name}: ${t.name} saiu do alcance. O golpe desce no vazio.`, 'miss'); return { time: 40 }; }
  log(G, `${tech.name}!`, 'warn');
  let pid = ch.part === 'swarm' ? R.pick(Object.keys(t.parts).filter((k) => !partBroken(t.parts[k]))) : ch.part;
  if (!pid || !t.parts[pid] || partBroken(t.parts[pid])) pid = Object.keys(t.parts).find((k) => !partBroken(t.parts[k]) && partAllowed(t.parts[k], k, tech)) || Object.keys(t.parts)[0];
  heroStrike(G, t, pid, { tech });
  return { time: Math.round(techTime(tech, D) * 0.6) };
}

/**
 * Executa a ação do herói. Retorna { ok, time, why }.
 */
export function performHeroAction(G, { action, target, part } = {}) {
  const c = G.combat;
  const D = heroD(G);
  const h = heroActor(G);
  const acts = heroActions(G);
  const a = acts.find((x) => x.id === action);
  if (!a) return { ok: false, why: 'Ação indisponível.' };
  if (a.disabled) return { ok: false, why: a.why || 'Indisponível.' };
  const t = target ? c.actors.find((x) => x.uid === target) : null;

  // ── ordens (livres)
  if (action.startsWith('order:')) {
    const al = allyActor(G);
    al.flags.order = action.slice(6);
    if (G.hero.companion) G.hero.companion.order = al.flags.order;
    h.flags.orderGiven = true;
    log(G, `${al.name}: "${al.flags.order === 'atacar' ? 'Pra cima deles.' : al.flags.order === 'proteger' ? 'Fico na sua frente.' : 'Fico atrás.'}"`, 'info');
    return { ok: true, time: 0, free: true };
  }

  // ── troca de arma
  if (action.startsWith('swap:')) {
    c.allowEquip = true;
    const r = equipItem(G.hero, action.slice(5));
    c.allowEquip = false;
    if (!r?.ok) return { ok: false, why: r?.reason || 'Não deu para trocar.' };
    const D2 = heroD(G);
    log(G, `Você empunha ${D2.weapon.name}.`, 'info');
    h.flags.loaded = false;
    return { ok: true, time: 80 };
  }

  // ── itens
  if (action.startsWith('item:')) return useCombatItem(G, action.slice(5), t);

  switch (action) {
    case 'guarda': payStam(G, 1); addStatus(G, h, 'guarda', { turns: 1 }); log(G, `Você ergue a guarda (${blockPct(G, D)}%).`, 'info'); emitEv(G, { type: 'stance', target: HERO_UID, sfx: 'block' }); return { ok: true, time: 60 };
    case 'esquiva': payStam(G, 2); addStatus(G, h, 'esquiva', { turns: 1 }); log(G, 'Você fica leve nos pés, pronto para saltar.', 'info'); return { ok: true, time: 60 };
    case 'aparar': payStam(G, 2); addStatus(G, h, 'aparando', { turns: 1 }); log(G, `Você espera o golpe com a lâmina em ângulo (${parryChance(G, D)}%).`, 'info'); emitEv(G, { type: 'stance', target: HERO_UID, sfx: 'parry' }); return { ok: true, time: 60 };
    case 'esperar': h.stamina = Math.min(h.staminaMax, h.stamina + 2); log(G, 'Você respira fundo.', 'info'); return { ok: true, time: 50 };
    case 'levantar': payStam(G, 1); removeStatus(h, 'caido'); log(G, 'Você se levanta.', 'info'); return { ok: true, time: 70 };
    case 'soltar': {
      payStam(G, 2);
      const st = getStatus(h, 'agarrado');
      const g = c.actors.find((x) => x.uid === st?.src);
      const ch = clamp(35 + (D.attrs.for || 3) * 7 - (g?.flags?.elite ? 15 : 0), 5, 92);
      if (rollPct(ch)) {
        removeStatus(h, 'agarrado');
        if (g) removeStatus(g, 'agarrando');
        log(G, `Você se arranca das mãos de ${g?.name || 'quem segurava'}. (${ch}%)`, 'good');
      } else log(G, `Você não consegue se soltar. (${ch}%)`, 'bad');
      return { ok: true, time: 70 };
    }
    case 'avancar': {
      if (!t || t.dist <= 0) return { ok: false, why: 'Escolha um inimigo distante.' };
      payStam(G, 1);
      t.dist -= 1;
      if (hasStatus(h, 'agarrando')) releaseHeroGrip(G);
      log(G, `Você avança sobre ${t.name} (${DIST_NAMES[t.dist]}).`, 'info');
      emitEv(G, { type: 'move', target: t.uid, sfx: 'step' });
      return { ok: true, time: 50 };
    }
    case 'recuar': {
      payStam(G, 1);
      opportunityAttacks(G, 0.6);
      if (c.result) return { ok: true, time: 60 };
      for (const f of [...foes(G), ...surrendered(G)]) if (!hasStatus(f, 'agarrando') || getStatus(h, 'agarrado')?.src !== f.uid) f.dist = Math.min(2, f.dist + 1);
      if (hasStatus(h, 'agarrando')) releaseHeroGrip(G);
      log(G, 'Você recua, abrindo espaço.', 'info');
      emitEv(G, { type: 'move', target: HERO_UID, sfx: 'step' });
      return { ok: true, time: 60 };
    }
    case 'fugir': {
      payStam(G, 2);
      const ch = fleeChance(G, D);
      if (rollPct(ch)) {
        c.result = 'fled';
        log(G, `Você foge. (${ch}%) Atrás de você, gritos e passos.`, 'warn');
        emitEv(G, { type: 'flee', target: HERO_UID, sfx: 'step' });
      } else {
        log(G, `Você tenta fugir e não consegue. (${ch}%)`, 'bad');
        opportunityAttacks(G, 0.75, 'enquanto você corre');
      }
      return { ok: true, time: 80 };
    }
    default: break;
  }

  // ── ataques e técnicas
  const tech = resolveTech(action, D);
  if (!tech) return { ok: false, why: 'Técnica desconhecida.' };
  const stamCost = techStam(tech, D);
  const time = techTime(tech, D);

  if (tech.target === 'self') {
    payStam(G, stamCost);
    selfTechnique(G, tech, D);
    return { ok: true, time };
  }

  // carga (windup): prepara e solta no próximo turno do herói
  if (tech.windup && !h.flags.charge) {
    if (!t) return { ok: false, why: 'Escolha um alvo.' };
    payStam(G, stamCost);
    h.flags.charge = { action, target: t.uid, part: part || null };
    addStatus(G, h, 'carregando', { turns: 99 });
    log(G, `Você ergue a arma para ${tech.name}. (solta no próximo turno)`, 'warn');
    emitEv(G, { type: 'charge', target: HERO_UID });
    return { ok: true, time: tech.windup };
  }

  if (tech.target === 'engaged' || tech.target === 'near') {
    payStam(G, stamCost);
    const maxD = tech.target === 'engaged' ? 0 : 1;
    const targets = foes(G).filter((f) => f.dist <= maxD);
    log(G, `${tech.name}!`, 'info');
    for (const f of targets) {
      if (c.result) break;
      const swarm = Object.values(f.parts).some((p) => p.role === 'swarm');
      if (swarm) {
        const live = Object.keys(f.parts).filter((k) => !partBroken(f.parts[k]));
        for (const pid of R.shuffle(live).slice(0, 3)) { if (!f.dead) heroStrike(G, f, pid, { tech }); }
      } else heroStrike(G, f, pickAreaPart(f), { tech });
      if (!f.dead && tech.push) pushEnemy(G, f, tech.push);
    }
    return { ok: true, time };
  }

  if (!t) return { ok: false, why: 'Escolha um alvo.' };
  const prob = targetProblem(G, tech, D, t);
  if (prob) return { ok: false, why: prob };
  if (hasStatus(t, 'rendido') && tech.special !== 'executar') return { ok: false, why: 'Ele se rendeu. Execute ou deixe.' };
  payStam(G, stamCost);

  // técnicas especiais sem golpe comum
  const sp = tech.special;
  if (sp && SPECIAL_ACTIONS[sp]) {
    const r = SPECIAL_ACTIONS[sp](G, t, part, tech, D);
    if (r !== undefined) return { ok: true, time, ...r };
  }

  let pid = part === 'swarm' ? R.pick(Object.keys(t.parts).filter((k) => !partBroken(t.parts[k]))) : part;
  if (!pid || !t.parts[pid] || partBroken(t.parts[pid]) || !partAllowed(t.parts[pid], pid, tech)) {
    pid = Object.keys(t.parts).find((k) => !partBroken(t.parts[k]) && partAllowed(t.parts[k], k, tech) && t.parts[k].role === 'torso')
      || Object.keys(t.parts).find((k) => !partBroken(t.parts[k]) && partAllowed(t.parts[k], k, tech));
  }
  if (D.weapon.ranged && !tech.offhand && (action === 'atacar' || tech.ranged)) {
    h.flags.loaded = false;
    G.hero.flags = G.hero.flags || {};
  }
  const hits = tech.hits || 1;
  for (let i = 0; i < hits && !t.dead && !c.result; i++) heroStrike(G, t, pid, { tech });
  if (!t.dead) {
    if (tech.push) pushEnemy(G, t, tech.push);
    if (tech.pull) pullEnemy(G, t, tech.pull);
  }
  if (sp && AFTER_SPECIALS[sp]) AFTER_SPECIALS[sp](G, t, pid, tech, D);
  return { ok: true, time };
}

function pickAreaPart(f) {
  const alive = Object.keys(f.parts).filter((k) => !partBroken(f.parts[k]));
  return R.weighted(alive.map((k) => [k, f.parts[k].role === 'torso' ? 5 : f.parts[k].role === 'special' ? 0.5 : 1]));
}

function releaseHeroGrip(G) {
  const h = heroActor(G);
  removeStatus(h, 'agarrando');
  for (const f of G.combat.actors) {
    const s = getStatus(f, 'agarrado');
    if (s && s.src === HERO_UID) removeStatus(f, 'agarrado');
  }
}

export function pushEnemy(G, t, n = 1) {
  if (!t || t.dead) return;
  if (hasTag(t, 'chefe') && !t.flags.fallen) { log(G, `${t.name} não se move.`, 'warn'); return; }
  if (hasStatus(t, 'agarrando')) { releaseGrabOf(G, t); }
  const before = t.dist;
  t.dist = Math.min(2, t.dist + n);
  if (t.dist !== before) { log(G, `${t.name} é empurrado para ${DIST_NAMES[t.dist].toLowerCase()}.`, 'good'); emitEv(G, { type: 'move', target: t.uid }); }
  interrupt(G, t, 'empurrado');
}
function releaseGrabOf(G, t) {
  removeStatus(t, 'agarrando');
  const h = heroActor(G);
  const s = getStatus(h, 'agarrado');
  if (s && s.src === t.uid) { removeStatus(h, 'agarrado'); log(G, 'O agarrão se desfaz.', 'good'); }
}
export function pullEnemy(G, t, n = 1) {
  if (!t || t.dead) return;
  if (hasTag(t, 'chefe')) { log(G, `${t.name} é pesado demais para puxar.`, 'warn'); return; }
  const before = t.dist;
  t.dist = Math.max(0, t.dist - n);
  if (t.dist !== before) { log(G, `Você arrasta ${t.name} para ${DIST_NAMES[t.dist].toLowerCase()}.`, 'good'); emitEv(G, { type: 'move', target: t.uid }); }
}

// ───────────────────────── técnicas de postura ─────────────────────────

function selfTechnique(G, tech, D) {
  const h = heroActor(G);
  switch (tech.special) {
    case 'riposta': addStatus(G, h, 'aparando', { turns: 1 }); h.flags.riposta = true; log(G, 'Guarda de riposta: a ponta espera o erro dele.', 'info'); break;
    case 'passo_sombra': addStatus(G, h, 'esquiva', { turns: 1 }); h.flags.shadow = true; h.flags.nextCrit = true; log(G, 'Você some entre um golpe e outro.', 'info'); break;
    case 'muralha_pontas': h.flags.muralha = true; addStatus(G, h, 'mantendo_distancia', { turns: 1 }); log(G, 'Lança em riste. Quem vier, vem pela ponta.', 'info'); break;
    case 'muralha_escudo': addStatus(G, h, 'guarda', { turns: 1 }); h.flags.shieldWall = true; log(G, 'Você se planta atrás do escudo.', 'info'); break;
    case 'mirar': addStatus(G, h, 'mirando', { turns: 99 }); log(G, 'Você prende a respiração e mira.', 'info'); break;
    case 'recarregar': {
      if (!removeItem(G.hero, 'virote', 1)) { log(G, 'Sem virotes.', 'bad'); break; }
      h.flags.loaded = true;
      log(G, 'Você gira a manivela. A besta range e trava.', 'info');
      emitEv(G, { type: 'reload', target: HERO_UID, sfx: 'tap' });
      break;
    }
    case 'grito': {
      for (const f of foes(G)) if (!hasTag(f, 'morto') && !hasTag(f, 'construto')) changeMorale(G, f, -10);
      dreadHero(G, -8, 'grito');
      addStatus(G, h, 'inspirado', { turns: 3 });
      log(G, 'Você urra como um açougue inteiro. Alguns recuam.', 'good');
      emitEv(G, { type: 'shout', target: HERO_UID, sfx: 'scream' });
      break;
    }
    case 'recobrar': h.stamina = Math.min(h.staminaMax, h.stamina + 5); h.flags.recobrar = true; removeStatus(h, 'exausto'); log(G, 'Você recupera o fôlego, de guarda baixa.', 'info'); break;
    default: break;
  }
}

// ───────────────────────── técnicas especiais com alvo ─────────────────────────

function lightHit(G, t, dmgRange, dtype, label, extra = {}) {
  const D = heroD(G);
  const pid = extra.part && t.parts[extra.part] && !partBroken(t.parts[extra.part]) ? extra.part : pickAreaPart(t);
  const tech = { id: label, name: label, dmgMult: 1, hitMod: extra.hitMod || 0, dtype, armorPierce: extra.armorPierce || 0, stun: extra.stun, prone: extra.prone, interrupt: extra.interrupt };
  const ch = hitChance(G, D, tech, t, pid);
  if (!rollPct(ch)) { log(G, `${label}: você erra ${t.name}.`, 'miss'); emitEv(G, { type: 'miss', target: t.uid, sfx: 'miss' }); return false; }
  const p = t.parts[pid];
  const dmg = Math.max(1, Math.round(rangeRoll(dmgRange) - (p.armor?.[dtype] || 0) * (1 - (extra.armorPierce || 0))));
  damageEnemy(G, t, dmg, { part: pid, dtype, by: 'hero', stun: extra.stun || 0, prone: extra.prone || 0 });
  log(G, `${label}: ${t.name} (${dmg}).`, 'hit');
  if (!t.dead && extra.interrupt) interrupt(G, t, label.toLowerCase());
  return true;
}

const SPECIAL_ACTIONS = {
  executar(G, t) {
    const D = heroD(G);
    const ok = targetIndefeso(t) || t.hp <= t.hpMax * 0.25;
    if (!ok) { log(G, `${t.name} ainda está de pé e alerta. Não dá para executar.`, 'warn'); return { time: 30 }; }
    if (t.dist > 0) { log(G, 'Precisa estar colado nele.', 'warn'); return { time: 30 }; }
    if (t.flags.boss && t.hp > t.hpMax * 0.15) { log(G, `${t.name} é grande demais para um golpe de misericórdia agora.`, 'warn'); return { time: 30 }; }
    const wasSurr = hasStatus(t, 'rendido');
    killEnemy(G, t, { by: 'hero', how: 'executado', executed: true });
    const c = G.combat;
    c.stats.executions = (c.stats.executions || 0) + 1;
    if (G.hero.stats) G.hero.stats.executions = (G.hero.stats.executions || 0) + 1;
    if (wasSurr) c.executedSurrendered = (c.executedSurrendered || 0) + 1;
    const txt = D.weapon.cls === 'adaga' ? `Você abre a garganta de ${t.name} e segura até parar.` : D.weapon.dtype === 'impacto' ? `Você desce a arma até o crânio de ${t.name} ceder.` : `Um golpe só, no pescoço. ${t.name} acaba.`;
    log(G, txt, 'kill');
    emitEv(G, { type: 'execute', target: t.uid, sfx: 'sever' });
    dreadHero(G, -6 + (D.mods.dread_on_execute || 0), 'execução');
    if (D.mods.hp_on_execute) healHero(G, D.mods.hp_on_execute);
    addStatus(G, heroActor(G), 'coberto_sangue', { turns: 3 });
    c.mastery[D.weapon.cls] = (c.mastery[D.weapon.cls] || 0) + 2;
    return {};
  },
  agarrar(G, t) {
    const D = heroD(G);
    const h = heroActor(G);
    if (hasTag(t, 'enxame') || hasTag(t, 'chefe')) { log(G, 'Não há como agarrar isso.', 'warn'); return { time: 40 }; }
    const ch = clamp(30 + (D.attrs.for || 3) * 6 - (edef(t)?.eva || 0) - (t.flags.elite ? 15 : 0) + (targetIndefeso(t) ? 20 : 0), 5, 90);
    if (rollPct(ch)) {
      addStatus(G, t, 'agarrado', { turns: 3, src: 'hero' });
      addStatus(G, h, 'agarrando', { turns: 3 });
      interrupt(G, t, 'agarrado');
      log(G, `Você agarra ${t.name} e não larga. (${ch}%)`, 'good');
    } else log(G, `${t.name} escapa das suas mãos. (${ch}%)`, 'bad');
    return {};
  },
  chute(G, t) {
    const D = heroD(G);
    const f = D.attrs.for || 3;
    const hit = lightHit(G, t, [2 + Math.floor(f / 2), 5 + f], 'impacto', 'Chute', { interrupt: true });
    if (hit && !t.dead) {
      pushEnemy(G, t, 1);
      if (rollPct(15 + f * 3)) knockDown(G, t);
    }
    return {};
  },
  empurrar(G, t) {
    if (!t.dead) { pushEnemy(G, t, 1); if (rollPct(10)) knockDown(G, t); }
    return {};
  },
  coronhada(G, t) {
    const hit = lightHit(G, t, [3, 6], 'impacto', 'Coronhada', { stun: 20, interrupt: true, part: 'cabeca' });
    if (hit && !t.dead) pushEnemy(G, t, 1);
    return {};
  },
  arremesso(G, t) {
    if (!removeItem(G.hero, 'faca_arremesso', 1)) { log(G, 'Sem facas.', 'bad'); return { time: 20 }; }
    const hit = lightHit(G, t, [4, 8], 'perf', 'Faca arremessada', { hitMod: 5 });
    if (hit && !t.dead) applyStatusList(G, t, [{ id: 'sangrando', chance: 100, stacks: 1 }], HERO_UID);
    if (rollPct(50)) (G.combat.recover ||= []).push('faca_arremesso');
    return {};
  },
  golpe_escudo(G, t) {
    const D = heroD(G);
    const r = D.offhand.dmg || [2, 5];
    lightHit(G, t, [r[0] + 1, r[1] + 2], 'impacto', 'Golpe de escudo', { stun: 35, interrupt: true, part: 'cabeca' });
    return {};
  },
  golpe_tocha(G, t) {
    const hit = lightHit(G, t, [3, 6], 'fogo', 'Tocha na cara', { part: 'cabeca' });
    if (hit && !t.dead) {
      if (rollPct(60)) applyStatusList(G, t, [{ id: 'queimando', chance: 100 }], HERO_UID);
      if (hasTag(t, 'fera')) { changeMorale(G, t, -20); log(G, `${t.name} gane e recua do fogo.`, 'good'); }
    }
    return {};
  },
  pisotear(G, t) {
    const D = heroD(G);
    lightHit(G, t, [4 + Math.floor((D.attrs.for || 3) / 2), 8 + (D.attrs.for || 3)], 'impacto', 'Pisão', { armorPierce: 0.5, part: 'cabeca' });
    return {};
  },
};

const AFTER_SPECIALS = {
  tendao(G, t, pid) {
    const p = t.parts[pid];
    if (!p || t.dead) return;
    if (p.role === 'legs') { addStatus(G, t, 'enredado', { turns: 3 }); log(G, `Tendão cortado: ${t.name} arrasta a perna.`, 'good'); }
    else if (p.role === 'arm' || p.role === 'arm2') { addStatus(G, t, 'desarmado', { turns: 3 }); log(G, `Tendão cortado: o braço de ${t.name} pende.`, 'good'); }
  },
  rachar_escudo(G, t) {
    if (t.dead) return;
    removeStatus(t, 'guarda');
    t.flags.shieldBroken = true;
    if (t.parts.bracoE) for (const k of ['corte', 'perf', 'impacto']) t.parts.bracoE.armor[k] = Math.max(0, (t.parts.bracoE.armor[k] || 0) - 3);
    log(G, `O escudo de ${t.name} racha ao meio.`, 'good');
  },
  amassar(G, t, pid) {
    const p = t.parts[pid];
    if (!p || t.dead) return;
    for (const k of ['corte', 'perf', 'impacto', 'fogo']) p.armor[k] = Math.max(0, (p.armor[k] || 0) - 3);
    log(G, `A armadura do ${(p.name || pid).toLowerCase()} de ${t.name} afunda na carne.`, 'good');
  },
  consome_sangue(G, t) { removeStatus(t, 'sangrando'); },
  abate(G, t) { if (t.dead) { healHero(G, 6); dreadHero(G, -6, 'abate'); } },
  cabecada(G) { damageHero(G, 3, { part: 'cabeca', dtype: 'impacto', noWound: true, srcName: 'a própria cabeçada' }); },
  arrancar_olho(G, t) {
    if (t.dead) return;
    addStatus(G, t, 'cego', { turns: 999 });
    for (const f of foes(G)) changeMorale(G, f, -15);
    log(G, `${t.name} grita com a mão no rosto vazio.`, 'blood');
  },
  eviscerar(G, t) {
    if (!t.dead) return;
    for (const f of foes(G)) changeMorale(G, f, -30);
    dreadHero(G, -10, 'eviscerar');
    log(G, 'As tripas no chão fazem os outros hesitarem.', 'blood');
  },
  manter_distancia(G) { addStatus(G, heroActor(G), 'mantendo_distancia', { turns: 1 }); },
  golpe_icor(G) { corruptHero(G, 2, 'golpe de Icor'); },
};

// ───────────────────────── itens em combate ─────────────────────────

function useCombatItem(G, uid, t) {
  const c = G.combat;
  const h = heroActor(G);
  const inst = (G.hero.inv || []).find((i) => i.uid === uid);
  const def = itemDef(inst);
  if (!inst || !def?.use?.combat) return { ok: false, why: 'Item indisponível.' };
  const sp = typeof def.use.combat === 'string' ? def.use.combat : null;
  const thr = def.throw || def.use?.throw || {};
  const half = allyActor(G)?.def === 'carregador' && allyActor(G)?.flags?.order === 'segurar';
  const time = Math.round((def.use.time || 100) * (half ? 0.5 : 1));
  const needsTarget = ['throw_bomb', 'throw_lime', 'throw_knife', 'holy_water'].includes(sp);
  if (needsTarget && !t) return { ok: false, why: 'Escolha um alvo.' };
  consumeInst(G.hero, uid);
  log(G, `Você usa ${def.name}.`, 'info');
  const fx = () => { const r = applyEffects(G, def.use.effects || [], { source: 'combat', item: inst }); for (const l of r.lines || []) log(G, l.text, l.kind === 'bad' ? 'bad' : 'info'); };
  switch (sp) {
    case 'stop_bleed': removeStatus(h, 'sangrando'); fx(); break;
    case 'stop_bleed_all': removeStatus(h, 'sangrando'); fx(); break;
    case 'cauterize':
      removeStatus(h, 'sangrando'); removeStatus(h, 'infectado'); fx();
      break;
    case 'salve': removeStatus(h, 'queimando'); fx(); break;
    case 'cure_poison': removeStatus(h, 'envenenado'); fx(); break;
    case 'numb': addStatus(G, h, 'entorpecido', { turns: 4 }); fx(); break;
    case 'rage': addStatus(G, h, 'furioso', { stacks: 2, turns: 3 }); fx(); break;
    case 'drink': fx(); break;
    case 'coat_oil': addStatus(G, h, 'untado_oleo', { stacks: 3 }); break;
    case 'coat_poison': addStatus(G, h, 'untado_veneno', { stacks: 3 }); break;
    case 'salt_line': c.saltLine = c.round + 2; log(G, 'Você traça um círculo de sal. Os mortos param na linha.', 'good'); break;
    case 'smoke':
      c.smoke = c.round + 2;
      for (const f of foes(G)) addStatus(G, f, 'cego', { turns: 1 });
      log(G, 'Fumaça grossa e doce. Ninguém enxerga ninguém.', 'info');
      fx();
      break;
    case 'throw_knife': {
      const hit = lightHit(G, t, thr.dmg || [4, 8], thr.dtype || 'perf', def.name, { hitMod: 5 });
      if (hit && !t.dead) applyStatusList(G, t, [{ id: 'sangrando', chance: 100, stacks: 1 }], HERO_UID);
      if (rollPct(50)) (c.recover ||= []).push(def.id);
      break;
    }
    case 'holy_water': {
      const vs = (thr.vsTags || []).some((tg) => hasTag(t, tg));
      const r = thr.dmg || [8, 14];
      lightHit(G, t, vs ? [r[0] * 2, r[1] * 2] : [Math.ceil(r[0] / 3), Math.ceil(r[1] / 3)], 'fogo', def.name, { hitMod: 10 });
      if (vs && !t.dead) log(G, `${t.name} fumega onde a água tocou.`, 'good');
      break;
    }
    case 'throw_bomb': case 'throw_lime': {
      const group = foes(G).filter((f) => (t.dist <= 1 ? f.dist <= 1 : f.dist === 2));
      const dmgR = thr.dmg || [1, 3];
      log(G, sp === 'throw_bomb' ? 'A bomba rola, chia e explode.' : 'Uma nuvem branca de cal.', 'warn');
      emitEv(G, { type: 'aoe', target: t.uid, kind: sp, sfx: sp === 'throw_bomb' ? 'hit_heavy' : 'tap' });
      for (const f of group) {
        if (f.dead) continue;
        const swarm = Object.values(f.parts).some((p) => p.role === 'swarm');
        const pids = swarm ? Object.keys(f.parts).filter((k) => !partBroken(f.parts[k])) : [pickAreaPart(f)];
        for (const pid of pids) {
          if (f.dead) break;
          const p = f.parts[pid];
          const dmg = Math.max(1, rangeRoll(dmgR) - Math.floor((p.armor?.[thr.dtype] || 0) / 2));
          damageEnemy(G, f, dmg, { part: pid, dtype: thr.dtype || 'fogo', by: 'hero' });
        }
        if (!f.dead) applyStatusList(G, f, (thr.statuses || []).map((s) => ({ id: s, chance: 100, turns: 2 })), HERO_UID);
        if (!f.dead && hasTag(f, 'fera')) changeMorale(G, f, -15);
      }
      if (sp === 'throw_bomb' && t.dist === 0) {
        damageHero(G, R.int(4, 8), { part: 'tronco', dtype: 'fogo', srcName: 'a própria bomba', noWound: true });
        log(G, 'Perto demais: os estilhaços voltam em você.', 'bad');
      }
      break;
    }
    default: fx();
  }
  return { ok: true, time };
}

export { techTime, techStam, ROLE_LABEL, STATUSES };
