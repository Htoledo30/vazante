// Resolução de dano: herói, aliado e inimigos (partes, decepar, fraturar, morte, moral, fases, invocações).
import { R } from '../../core/rng.js';
import { clamp } from '../../core/util.js';
import {
  HERO_PART_NAMES, getActor, heroActor, allyActor, foes, edef, hasTag, log, emitEv,
  addStatus, removeStatus, hasStatus, getStatus, partBroken, swarmAlive, brokenCount, changeMorale, rollPct,
} from './core.js';
import { heroD, inflictWound, addDread, addCorruption, describeWound } from './deps.js';
import { buildEnemy, numberNames, regionTier } from './build.js';
import { PART_HOOKS, DEATH_HOOKS } from './specials.js';

// ───────────────────────── Pavor / Corrupção ─────────────────────────

/** Pavor do herói em combate. Trata o Colapso dentro da luta. */
export function dreadHero(G, n, why) {
  if (!n || !G.hero) return;
  const before = G.hero.dread || 0;
  let r;
  try { r = addDread(G, n, why); } catch (e) { r = { lines: [] }; }
  for (const l of r?.lines || []) log(G, typeof l === 'string' ? l : l.text, 'dread');
  const after = G.hero.dread || 0;
  if (n > 0 && after > before) emitEv(G, { type: 'dread', target: 'hero', n: after - before });
  if (n > 0 && (r?.collapse || after >= 100)) heroCollapse(G);
}

export function corruptHero(G, n, why) {
  if (!n || !G.hero) return;
  const r = addCorruption(G, n, why);
  for (const l of r?.lines || []) log(G, typeof l === 'string' ? l : l.text, 'corr');
  log(G, `+${n} Corrupção (${why}).`, 'corr');
  emitEv(G, { type: 'corrupt', target: 'hero', n });
  if (r?.transformed || (G.hero.corruption || 0) >= 100) {
    const c = G.combat;
    if (c && !c.result) {
      c.result = 'lose';
      c.killer = 'o Icor';
      c.deathCause = 'Transformação';
      c.corrupted = true;
      log(G, 'O Icor fecha seus olhos por dentro. O que se levanta não é mais você.', 'blood');
    }
  }
}

const COLLAPSE_TEXT = {
  panico: 'COLAPSO: o pânico toma conta. Suas pernas querem correr.',
  furia: 'COLAPSO: algo se rompe. Você só vê vermelho.',
  catatonia: 'COLAPSO: você congela. O mundo fica longe e abafado.',
};

export function heroCollapse(G) {
  const h = heroActor(G);
  if (!h || h.flags.collapse) return;
  G.hero.dread = 70;
  const kind = R.weighted([['panico', 3], ['furia', 3], ['catatonia', 2]]);
  h.flags.collapse = { kind, turns: kind === 'catatonia' ? 2 : 3 };
  if (kind === 'furia') addStatus(G, h, 'furioso', { stacks: 2, turns: 3 });
  if (kind === 'panico') addStatus(G, h, 'aterrorizado', { turns: 3 });
  log(G, COLLAPSE_TEXT[kind], 'dread');
  emitEv(G, { type: 'collapse', target: 'hero', kind, sfx: 'scream' });
}

// ───────────────────────── Herói ─────────────────────────

/** Dano final no herói (já depois de armadura/guarda). */
export function damageHero(G, dmg, { part = 'tronco', dtype = 'corte', crit = false, src = null, srcName = '', noWound = false, dotName = '' } = {}) {
  const c = G.combat;
  const h = heroActor(G);
  const hero = G.hero;
  dmg = Math.max(0, Math.round(dmg));
  if (!c || !h || dmg <= 0) return { dealt: 0, died: false };
  const D = heroD(G);
  hero.hp = (hero.hp ?? D.hpMax) - dmg;
  h.hp = hero.hp;
  c.stats.dmgTaken += dmg;
  emitEv(G, { type: 'hit', target: 'hero', dmg, crit, part, dtype, sfx: crit || dmg >= D.hpMax * 0.2 ? 'hit_heavy' : 'hit' });

  removeStatus(h, 'mirando');
  if (h.flags.charge && (dmg >= D.hpMax * 0.15 || crit)) {
    h.flags.charge = null;
    removeStatus(h, 'carregando');
    log(G, 'O golpe que você preparava se perde na dor.', 'bad');
  }

  // Feridas por golpes fortes.
  const ratio = dmg / D.hpMax;
  if (!noWound && (crit || ratio >= 0.2) && hero.hp > -D.hpMax * 0.6) {
    const chance = clamp(30 + ratio * 220 + (crit ? 25 : 0), 0, 95);
    if (rollPct(chance)) {
      const sev = ratio >= 0.45 || (crit && ratio >= 0.3) ? 3 : ratio >= 0.3 ? 2 : 1;
      const w = inflictWound(G, part, dtype === 'sangue' || dtype === 'veneno' ? 'corte' : dtype, sev);
      if (w) {
        const wd = describeWound(w);
        c.stats.wounds += 1;
        log(G, `FERIDA (${HERO_PART_NAMES[part] || part}): ${wd?.name || 'ferimento'}${wd?.effect ? ` — ${wd.effect}` : ''}.`, 'blood');
        emitEv(G, { type: 'wound', target: 'hero', part, sev, sfx: sev >= 3 ? 'bone' : 'squelch' });
        dreadHero(G, 3 + sev * 3, 'ferida grave');
      }
    }
  }

  if (hero.hp <= 0) {
    // Por um fio: VIG dá uma chance de não morrer (cada vez mais difícil).
    const massacre = dmg >= D.hpMax * 0.6;
    const chance = massacre ? 0 : clamp(12 + D.attrs.vig * 4 - h.flags.lastStand * 25 + (D.mods.lastStand || 0), 0, 60);
    if (!c.result && rollPct(chance)) {
      h.flags.lastStand += 1;
      hero.hp = 1;
      h.hp = 1;
      log(G, 'Você deveria estar morto. Não está. (Por um fio)', 'warn');
      inflictWound(G, part, dtype === 'sangue' || dtype === 'veneno' ? 'corte' : dtype, 2);
      dreadHero(G, 15, 'quase morte');
      emitEv(G, { type: 'laststand', target: 'hero', sfx: 'scream' });
    } else {
      hero.hp = 0;
      h.hp = 0;
      if (!c.result) {
        c.result = 'lose';
        c.killer = srcName || (dotName === 'queimando' ? 'o fogo' : dotName === 'envenenado' ? 'o veneno' : dotName === 'sangrando' ? 'a hemorragia' : 'os ferimentos');
        log(G, `Você cai. ${srcName ? `${srcName} não para de bater.` : dotName === 'queimando' ? 'O fogo termina o serviço.' : 'O sangue não para.'}`, 'blood');
        emitEv(G, { type: 'death', target: 'hero', sfx: 'death' });
      }
      return { dealt: dmg, died: true };
    }
  }
  return { dealt: dmg, died: false };
}

export function healHero(G, n) {
  const h = heroActor(G);
  const D = heroD(G);
  const before = G.hero.hp;
  G.hero.hp = Math.min(D.hpMax, (G.hero.hp || 0) + Math.round(n));
  if (h) h.hp = G.hero.hp;
  const got = G.hero.hp - before;
  if (got > 0) emitEv(G, { type: 'heal', target: 'hero', n: got, sfx: 'heal' });
  return got;
}

// ───────────────────────── Aliado ─────────────────────────

export function damageAlly(G, a, dmg, { srcName = '', crit = false } = {}) {
  dmg = Math.max(0, Math.round(dmg));
  if (!a || a.dead || dmg <= 0) return { dealt: 0 };
  a.hp -= dmg;
  emitEv(G, { type: 'hit', target: a.uid, dmg, crit, sfx: 'hit' });
  if (a.hp <= 0) {
    a.hp = 0;
    a.dead = true;
    G.combat.companionDied = true;
    log(G, `${a.name} morre${srcName ? ` sob ${srcName}` : ''}. Você ouve o último som que ele faz.`, 'blood');
    emitEv(G, { type: 'death', target: a.uid, sfx: 'death' });
    dreadHero(G, 12, 'companheiro morto');
    for (const s of G.combat.actors) if (s.side === 'enemy') removeStatus(s, 'agarrando');
  }
  return { dealt: dmg };
}

// ───────────────────────── Inimigos ─────────────────────────

const ROLE_MULT = { head: 1.25, torso: 1, arm: 0.75, arm2: 0.75, legs: 0.75, swarm: 1, special: 0.5 };

function partName(a, pid) { return a.parts[pid]?.name || pid; }

/**
 * Dano final numa parte de um inimigo (armadura já descontada pelo atacante).
 * info: { part, dtype, crit, sever, fracture, stun, by:'hero'|'ally'|uid, prone }
 * Retorna { dealt, killed, broke, severed, fractured, stunned }.
 */
export function damageEnemy(G, a, dmg, info = {}) {
  const res = { dealt: 0, killed: false, broke: false, severed: false, fractured: false, stunned: false };
  if (!a || a.dead) return res;
  dmg = Math.max(0, Math.round(dmg));
  let pid = info.part;
  if (!a.parts[pid] || partBroken(a.parts[pid])) pid = fallbackPart(a);
  const p = a.parts[pid];
  const dtype = info.dtype || 'corte';
  res.dealt = dmg;
  a.flags.lastDtype = dtype;
  if (dmg <= 0) return res;

  const role = p?.role || 'torso';
  if (p) p.hp = Math.max(0, p.hp - dmg);
  if (role === 'swarm') {
    a.hp = Object.values(a.parts).filter((x) => x.role === 'swarm').reduce((t, x) => t + x.hp, 0);
  } else {
    const mult = role === 'special' ? (p.weakpoint || ROLE_MULT.special) : (ROLE_MULT[role] ?? 1);
    a.hp = Math.max(0, a.hp - Math.max(1, Math.round(dmg * mult)));
  }
  if (info.by === 'hero') G.combat.stats.dmgDealt += dmg;
  emitEv(G, { type: 'hit', target: a.uid, part: pid, dmg, crit: !!info.crit, dtype, sfx: info.crit ? 'crit' : (dmg >= 12 ? 'hit_heavy' : 'hit') });

  if (p && !partBroken(p)) {
    if (p.hp <= 0) {
      const sev = dtype === 'corte' && p.severable !== false && role !== 'torso' && role !== 'swarm';
      breakPart(G, a, pid, sev ? 'sever' : dtype, info.by);
      res.broke = true;
      res.severed = sev;
    } else {
      if (p.state === 'ok' && p.hp <= p.max * 0.5) p.state = 'ferido';
      const limb = ['head', 'arm', 'arm2', 'legs'].includes(role);
      if (dtype === 'corte' && limb && p.severable !== false && dmg >= p.max * 0.35) {
        const ch = 5 + (info.sever || 0);
        if (rollPct(ch)) { breakPart(G, a, pid, 'sever', info.by); res.broke = true; res.severed = true; }
      }
      if (!res.broke && dtype === 'impacto' && limb && !p.fractured && dmg >= p.max * 0.3) {
        const ch = 15 + (info.fracture || 0);
        if (rollPct(ch)) { fracturePart(G, a, pid); res.fractured = true; }
      }
      if (!res.broke && dtype === 'impacto' && role === 'head') {
        const ch = Math.min(60, Math.round((dmg / p.max) * 60));
        if (ch > 0 && !hasTag(a, 'chefe') && rollPct(ch) && addStatus(G, a, 'atordoado', { turns: 1 })) {
          res.stunned = true;
          log(G, `${a.name} cambaleia, atordoado.`, 'good');
          interrupt(G, a, 'atordoado');
        }
      }
    }
  }
  if (!a.dead && info.stun && !res.stunned && rollPct(info.stun) && addStatus(G, a, 'atordoado', { turns: 1 })) {
    res.stunned = true;
    log(G, `${a.name} fica atordoado.`, 'good');
    interrupt(G, a, 'atordoado');
  }
  if (!a.dead && info.prone && rollPct(info.prone)) knockDown(G, a);

  if (!a.dead && a.hp <= 0) {
    killEnemy(G, a, { by: info.by, how: res.severed ? 'sever' : dtype, part: pid });
  }
  if (a.dead) res.killed = true;
  if (!a.dead) {
    if (!a.flags.lowHpShaken && a.hp < a.hpMax * 0.3) { a.flags.lowHpShaken = true; changeMorale(G, a, -15); }
    if (dmg >= a.hpMax * 0.25 && !hasTag(a, 'chefe')) interrupt(G, a, 'o golpe o desequilibra');
    checkPhase(G, a);
  }
  return res;
}

function fallbackPart(a) {
  if (a.parts.tronco && !partBroken(a.parts.tronco)) return 'tronco';
  const alive = Object.keys(a.parts).filter((k) => !partBroken(a.parts[k]));
  if (!alive.length) return Object.keys(a.parts)[0];
  const sw = alive.filter((k) => a.parts[k].role === 'swarm');
  return sw.length ? R.pick(sw) : alive[0];
}

export function knockDown(G, a) {
  if (!a || a.dead) return false;
  if (hasStatus(a, 'caido')) return false;
  if (hasTag(a, 'chefe') && !a.flags.fallen) return false;
  if (!addStatus(G, a, 'caido', { turns: 99 })) return false;
  log(G, `${a.name} vai ao chão.`, 'good');
  emitEv(G, { type: 'prone', target: a.uid, sfx: 'hit_heavy' });
  interrupt(G, a, 'derrubado');
  return true;
}

function fracturePart(G, a, pid) {
  const p = a.parts[pid];
  p.fractured = true;
  if (p.state === 'ok') p.state = 'ferido';
  const role = p.role;
  if (role === 'legs') log(G, `Osso partido: ${a.name} manca — mais lento e fácil de acertar.`, 'good');
  else if (role === 'head') {
    log(G, `O crânio de ${a.name} racha. Ele cambaleia.`, 'good');
    if (addStatus(G, a, 'atordoado', { turns: 1 })) interrupt(G, a, 'crânio rachado');
  } else log(G, `Osso partido: o ${partName(a, pid).toLowerCase()} de ${a.name} pende inútil pela metade.`, 'good');
  emitEv(G, { type: 'fracture', target: a.uid, part: pid, sfx: 'bone' });
  changeMorale(G, a, -10);
}

const BREAK_TEXT = {
  head: { sever: (n) => `A cabeça de ${n} rola pela lama. O corpo ainda dá dois passos.`, impacto: (n) => `O crânio de ${n} afunda como uma abóbora podre.`, perf: (n) => `A ponta entra pelo olho de ${n} e sai pela nuca.`, fogo: (n) => `O rosto de ${n} derrete.`, icor: (n) => `O Icor come o rosto de ${n}.`, other: (n) => `A cabeça de ${n} vira uma ruína.` },
  arm: { sever: (n, p) => `O ${p} de ${n} voa longe, ainda segurando a arma.`, other: (n, p) => `O ${p} de ${n} dobra onde não há junta.` },
  arm2: { sever: (n, p) => `${n} perde o ${p} num jorro escuro.`, other: (n, p) => `O ${p} de ${n} vira pasta.` },
  legs: { sever: (n) => `${n} perde a perna e desaba gritando.`, other: (n) => `As pernas de ${n} cedem com um estalo seco.` },
  torso: { any: (n) => `${n} se abre ao meio. O cheiro vem depois.` },
  swarm: { any: (n) => `Um bando de ${n} cai em penas e sangue.` },
  special: { any: (n, p) => `${p} de ${n} se rompe.` },
};

/** Destrói/decepa uma parte e aplica as consequências mecânicas. */
export function breakPart(G, a, pid, how, by) {
  const p = a.parts[pid];
  if (!p || partBroken(p)) return;
  p.hp = 0;
  p.state = how === 'sever' ? 'decepado' : 'destruido';
  const role = p.role;
  const pn = partName(a, pid).toLowerCase();
  const T = BREAK_TEXT[role] || BREAK_TEXT.special;
  const fn = T[how] || T.other || T.any;
  const text = fn ? fn(a.name, role === 'special' ? p.name : pn) : `${p.name} de ${a.name} é destruído.`;
  log(G, text, how === 'sever' ? 'blood' : 'good');
  emitEv(G, { type: how === 'sever' ? 'sever' : 'break', target: a.uid, part: pid, sfx: how === 'sever' ? 'sever' : 'bone' });

  if (how === 'sever') {
    G.combat.stats.severed += 1;
    if (by === 'hero' && G.hero.stats) G.hero.stats.severed = (G.hero.stats.severed || 0) + 1;
    if (role !== 'swarm') addStatus(G, a, 'sangrando', { stacks: 3, turns: 4 });
  }

  if (role === 'head' && p.vital !== false) {
    killEnemy(G, a, { by, how: how === 'sever' ? 'decapitado' : how, part: pid, silent: true });
    return;
  }
  if (role === 'torso') { killEnemy(G, a, { by, how, part: pid, silent: true }); return; }
  if (role === 'swarm') {
    if (swarmAlive(a) === 0) killEnemy(G, a, { by, how, part: pid, silent: true });
    else changeMorale(G, a, -8);
    return;
  }
  if (role === 'arm') {
    changeMorale(G, a, -25);
    if (a.intent && (intentUses(a, pid))) interrupt(G, a, `sem o ${pn}`);
    if (hasStatus(a, 'agarrando')) releaseGrab(G, a);
  } else if (role === 'arm2') {
    changeMorale(G, a, -15);
    removeStatus(a, 'guarda');
    if (hasStatus(a, 'agarrando')) releaseGrab(G, a);
    if (a.intent && intentUses(a, pid)) interrupt(G, a, `sem o ${pn}`);
  } else if (role === 'legs') {
    changeMorale(G, a, -20);
    addStatus(G, a, 'aleijado', { turns: 999 });
    a.flags.fallen = true;
    knockDown(G, a);
  } else if (role === 'head') {
    addStatus(G, a, 'cego', { turns: 999 });
  }
  if (a.intent && intentUses(a, pid)) interrupt(G, a, `sem ${pn}`);
  const hook = p.onBreak && PART_HOOKS[p.onBreak];
  if (hook) hook(G, a, pid, { how, by });
  if (!a.dead) checkPhase(G, a);
}

function intentUses(a, pid) {
  const d = edef(a);
  const it = d?.intents?.find((i) => i.id === a.intent?.id);
  if (!it) return false;
  if (it.uses?.includes(pid)) return true;
  if (it.usesAny?.length && it.usesAny.every((x) => x === pid || partBroken(a.parts[x]))) return true;
  return false;
}

export function releaseGrab(G, a) {
  removeStatus(a, 'agarrando');
  const h = heroActor(G);
  const g = getStatus(h, 'agarrado');
  if (g && g.src === a.uid) { removeStatus(h, 'agarrado'); log(G, 'Você está livre.', 'good'); }
  const al = allyActor(G);
  const ga = getStatus(al, 'agarrado');
  if (ga && ga.src === a.uid) removeStatus(al, 'agarrado');
}

const DEATH_TEXT = {
  decapitado: (n) => `${n} morre sem cabeça.`,
  executado: (n) => `${n} está morto.`,
  fogo: (n) => `${n} queima até parar de gritar.`,
  sangue: (n) => `${n} sangra até ficar branco.`,
  veneno: (n) => `${n} morre espumando.`,
  default: (n) => `${n} cai e não levanta mais.`,
};

/** Mata um inimigo: corpos, moral, saque, ganchos. */
export function killEnemy(G, a, { by = null, how = 'default', part = null, silent = false, executed = false } = {}) {
  if (!a || a.dead) return;
  const c = G.combat;
  a.dead = true;
  a.hp = 0;
  a.intent = null;
  a.flags.charging = false;
  if (hasStatus(a, 'agarrando')) releaseGrab(G, a);
  a.statuses = [];
  const def = edef(a);
  const swarm = def?.tags?.includes('enxame');
  if (!swarm) { c.env.corpses += 1; c.corpses.push({ def: a.def, uid: a.uid }); }
  c.killed.push({ uid: a.uid, def: a.def, name: a.name, by, how, summoned: !!a.flags.summoned, executed, elite: !!a.flags.elite, boss: !!a.flags.boss });
  if (!silent || executed) log(G, (DEATH_TEXT[how] || DEATH_TEXT.default)(a.name), 'kill');
  else log(G, `${a.name} morre.`, 'kill');
  emitEv(G, { type: 'death', target: a.uid, sfx: 'enemy_death' });

  // bestiário
  const b = (G.world.bestiary[a.def] ||= { kills: 0, seen: 0 });
  b.kills += 1;

  if (by === 'hero') {
    const D = heroD(G);
    c.mastery[D.weapon.cls] = (c.mastery[D.weapon.cls] || 0) + 1;
    const dk = -1 + (D.mods.dread_on_kill || 0);
    if (dk) dreadHero(G, dk, 'matou');
    if (D.mods.hp_on_kill) healHero(G, D.mods.hp_on_kill);
  }
  // moral dos outros
  for (const f of foes(G)) {
    if (f === a) continue;
    changeMorale(G, f, executed ? -25 : a.flags.boss ? -40 : a.flags.elite ? -25 : -12);
  }
  const hook = def?.onDeath && DEATH_HOOKS[def.onDeath];
  if (hook) hook(G, a, { by, how });
}

/** Cancela uma ação carregada. */
export function interrupt(G, a, why) {
  if (!a?.flags?.charging) return false;
  a.flags.charging = false;
  removeStatus(a, 'carregando');
  log(G, `${a.name} perde o golpe preparado (${why}).`, 'good');
  emitEv(G, { type: 'interrupt', target: a.uid, sfx: 'parry' });
  a.intent = null;
  a.flags.needIntent = true;
  if (G.combat) G.combat.stats.interrupts += 1;
  return true;
}

/** Aplica a lista de estados de uma intenção/técnica num alvo. */
export function applyStatusList(G, target, list, src) {
  for (const s of list || []) {
    if (!s?.id) continue;
    if (s.chance != null && !rollPct(s.chance)) continue;
    if (s.id === 'caido') {
      if (target.side === 'enemy') knockDown(G, target);
      else if (addStatus(G, target, 'caido', { turns: 99 })) log(G, target.side === 'hero' ? 'Você vai ao chão.' : `${target.name} vai ao chão.`, 'bad');
      continue;
    }
    if (s.id === 'atordoado' && target.side === 'hero' && target.flags.charge) {
      target.flags.charge = null;
      removeStatus(target, 'carregando');
    }
    const ok = addStatus(G, target, s.id, { turns: s.turns, stacks: s.stacks, src });
    if (ok) {
      const nm = target.side === 'hero' ? 'Você' : target.name;
      const sid = s.id;
      const txt = {
        sangrando: `${nm} sangra.`, queimando: `${nm} pega fogo!`, envenenado: `${nm} foi envenenado.`, infectado: `${nm}: a Chaga entrou na ferida.`,
        atordoado: `${nm} fica atordoado.`, cego: `${nm} não enxerga!`, enredado: `${nm} fica preso.`, aterrorizado: `${nm} treme de terror.`,
        desarmado: `${nm} perde o controle da arma.`, marcado: `${nm} está marcado.`,
      }[sid];
      if (txt) log(G, txt, target.side === 'hero' ? 'bad' : 'good');
      if (sid === 'atordoado' && target.side === 'enemy') interrupt(G, target, 'atordoado');
      emitEv(G, { type: 'status', target: target.uid, id: sid });
    }
  }
}

// ───────────────────────── Invocações e fases ─────────────────────────

export function summon(G, master, defId, opts = {}) {
  const c = G.combat;
  const a = buildEnemy(G, { id: defId, dist: opts.dist ?? Math.max(1, master?.dist ?? 1) }, regionTier(c.context.region), { summoned: true, master: master?.uid });
  a.next = c.time + (opts.delay ?? 50);
  a.flags.needIntent = true;
  c.actors.push(a);
  numberNames(c.actors);
  const b = (G.world.bestiary[a.def] ||= { kills: 0, seen: 0 });
  b.seen += 1;
  emitEv(G, { type: 'summon', target: a.uid, sfx: 'squelch' });
  return a;
}

export function checkPhase(G, a) {
  const def = edef(a);
  if (!def?.phases || a.dead) return;
  for (const ph of def.phases) {
    if ((a.flags.phase || 1) >= ph.id) continue;
    const hpOk = ph.at.hpBelow && a.hp <= a.hpMax * ph.at.hpBelow;
    const brOk = ph.at.partsBroken && brokenCount(a) >= ph.at.partsBroken;
    if (!hpOk && !brOk) continue;
    a.flags.phase = ph.id;
    log(G, ph.text, 'boss');
    emitEv(G, { type: 'phase', target: a.uid, sfx: 'scream' });
    for (const [pid, p] of Object.entries(ph.addParts || {})) {
      a.parts[pid] = { hp: p.hp, max: p.hp, armor: { corte: 0, perf: 0, impacto: 0, fogo: 0, ...(p.armor || {}) }, state: 'ok',
        role: p.role, name: p.name, hitMod: p.hitMod || 0, weakpoint: p.weakpoint, severable: p.severable, onBreak: p.onBreak, vital: p.vital, desc: p.desc };
    }
    if (ph.speed) a.flags.speedBonus = (a.flags.speedBonus || 0) + ph.speed;
    if (ph.dread) dreadHero(G, ph.dread, a.name);
    if (ph.summon) summon(G, a, ph.summon, { delay: 30 });
    interrupt(G, a, 'muda de forma');
    a.flags.needIntent = true;
  }
}

export { R };
