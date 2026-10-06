// IA dos inimigos e do sequaz: escolha de intenção (telegrafada), turno, golpes contra o herói (com defesas).
import { R } from '../../core/rng.js';
import { clamp } from '../../core/util.js';
import { COMPANIONS } from '../../data/companions.js';
import {
  HERO_UID, heroActor, allyActor, foes, edef, hasTag, log, emitEv, getStatus, hasStatus, stacks, addStatus, removeStatus,
  statusSum, partBroken, partOk, swarmAlive, canMove, pickHeroPart, changeMorale, rollPct, rangeRoll, DIST_NAMES, HERO_PART_NAMES,
} from './core.js';
import { heroD } from './deps.js';
import {
  damageHero, damageAlly, damageEnemy, applyStatusList, dreadHero, corruptHero, interrupt, summon, killEnemy, healHero,
} from './resolve.js';
import { INTENT_SPECIALS, ATTACK_MODS, AFTER_HIT, AFTER_ATTACK, shoveHero, heroHasFire } from './specials.js';
import { heroStrike, blockPct, setEnemyStrike, pushEnemy } from './hero.js';

const PART_PREP = { cabeca: 'na cabeça', tronco: 'no tronco', bracoD: 'no braço da arma', bracoE: 'no braço esquerdo', pernas: 'nas pernas' };
export const ENGAGE_CAP = 2;
const ADVANCE = { id: '_avancar', label: 'Avança', icon: '➜', kind: 'move', move: -1, time: 60 };
const WAIT = { id: '_esperar', label: 'Observa', icon: '…', kind: 'self', time: 60 };

// ───────────────────────── condições de intenção ─────────────────────────

function whenOk(G, a, w) {
  const c = G.combat;
  const h = heroActor(G);
  switch (w) {
    case 'heroDown': return hasStatus(h, 'caido');
    case 'loaded': return !!a.flags.loaded;
    case 'notLoaded': return !a.flags.loaded;
    case 'engaged': return a.dist === 0;
    case 'notEngaged': return a.dist > 0;
    case 'canMove': return canMove(G, a);
    case 'allies': return foes(G).some((f) => f !== a);
    case 'notGrabbing': return !hasStatus(a, 'agarrando');
    case 'heroNotGrabbed': return !hasStatus(h, 'agarrado');
    case 'grabbingHero': return getStatus(h, 'agarrado')?.src === a.uid;
    case 'corpse': return (c.env.corpses || 0) > 0;
    case 'swarmHurt': return a.hp < a.hpMax * 0.9 || Object.values(a.parts).some((p) => p.role === 'swarm' && partBroken(p));
    case 'hpBelow50': return a.hp < a.hpMax * 0.5;
    case 'hpBelow30': return a.hp < a.hpMax * 0.3;
    case 'once': return true; // tratado por used
    case 'notMaxFury': return stacks(a, 'furioso') < 3;
    case 'canDrink': return !a.flags.noDrink && (a.flags.stage || 0) < 2;
    case 'stage1': return (a.flags.stage || 0) >= 1;
    case 'stage2': return (a.flags.stage || 0) >= 2;
    case 'heroCorrupt': return (G.hero.corruption || 0) >= 25;
    case 'notFurious': return !hasStatus(a, 'furioso');
    case 'hasBomb': return (a.flags.bombs || 0) > 0;
    case 'phase2': return (a.flags.phase || 1) >= 2;
    case 'fallen': return !!a.flags.fallen;
    default: return true;
  }
}

function intentValid(G, a, it) {
  const c = G.combat;
  if ((a.flags.cd?.[it.id] || 0) > c.round) return false;
  if ((it.when || []).includes('once') && a.flags.used?.[it.id]) return false;
  if (it.uses && it.uses.some((u) => !partOk(a, u))) return false;
  if (it.usesAny && !it.usesAny.some((u) => partOk(a, u))) return false;
  for (const w of it.when || []) if (!whenOk(G, a, w)) return false;
  if (it.kind === 'move' && !canMove(G, a)) return false;
  if (it.kind === 'summon') {
    const n = c.actors.filter((x) => !x.dead && !x.gone && x.flags?.master === a.uid && x.def === it.summon).length;
    if (n >= (it.max || 1)) return false;
  }
  if (hasStatus(a, 'desarmado') && it.kind === 'attack' && it.uses?.includes('bracoD') && it.dmg?.[1] > 8) return rollPct(50);
  return true;
}

/** Peso ajustado pela IA. */
function weightFor(G, a, it) {
  const def = edef(a);
  let w = it.w ?? 1;
  const reach = it.reach ?? 0;
  const inReach = it.kind !== 'attack' || it.ranged || a.dist <= reach;
  if (it.kind === 'attack' && inReach) w *= 1.4;
  if (it.kind === 'attack' && !inReach && !canMove(G, a)) return 0;
  const ai = def?.ai;
  if (ai === 'atirador' || ai === 'cacador') {
    if (a.dist === 0 && it.kind === 'move') w *= 3;
    if (a.dist > 0 && it.ranged) w *= 1.5;
  }
  if (ai === 'matilha' && heroHasFire(G) && it.special === 'rosnar' && (a.morale ?? 0) < 60) w = 4;
  if (ai === 'matilha' && it.special === 'rosnar' && !heroHasFire(G)) w = 0;
  if (ai === 'ceifeiro' && it.special === 'shove' && a.dist === 0) w *= 1.5;
  if (a.flags.boss && it.windup) w *= 1.2;
  return Math.max(0, w);
}

/** Escolhe a próxima intenção e calcula o que mostrar (parte-alvo, dano estimado). */
export function chooseIntent(G, a) {
  const def = edef(a);
  if (!def || a.dead) { a.intent = null; return null; }
  if (hasStatus(a, 'rendido')) { a.intent = null; return null; }
  const list = [];
  for (const it of def.intents || []) {
    if (!intentValid(G, a, it)) continue;
    const w = weightFor(G, a, it);
    if (w > 0) list.push([it, w]);
  }
  let it = list.length ? R.weighted(list) : null;
  if (!it) {
    // ninguém ao alcance e nada útil: avança se puder
    it = canMove(G, a) && a.dist > 0 ? ADVANCE : WAIT;
  }
  a.intent = describeIntent(G, a, it);
  a.flags.needIntent = false;
  return a.intent;
}

function scaleDmg(a, it) {
  const s = a.flags.scale?.dmg || 1;
  const fury = 1 + statusSum(a, 'dmgPct') / 100;
  return [Math.max(0, Math.round(it.dmg[0] * s * fury)), Math.max(0, Math.round(it.dmg[1] * s * fury))];
}

function describeIntent(G, a, it) {
  const st = {
    id: it.id, label: it.label, icon: it.icon || '•', kind: it.kind, windup: it.windup || 0, dtype: it.dtype || null,
    reach: it.reach ?? 0, ranged: !!it.ranged, target: 'hero', part: null, est: null, aoe: it.aoe || null,
  };
  if (it.kind === 'attack') {
    const h = heroActor(G);
    const lost = heroD(G).lostParts || [];
    if (it.part && it.part !== 'random') st.part = pickHeroPart(it.part, lost);
    else st.part = pickHeroPart('random', lost);
    if (!it.noDamage) st.est = scaleDmg(a, it);
    if (it.hitsPerSwarm) { const n = clamp(Math.round(swarmAlive(a) * it.hitsPerSwarm), 1, it.maxHits || 9); st.hits = n; }
    const al = allyActor(G);
    if (al && !it.aoe && al.flags.order === 'atacar' && a.dist === 0 && rollPct(30)) st.target = 'ally';
    if (al && al.flags.order === 'segurar' && st.target === 'ally') st.target = 'hero';
    if (h && hasStatus(h, 'agarrado') && getStatus(h, 'agarrado').src === a.uid) st.target = 'hero';
  }
  return st;
}

/** Texto da intenção conforme o detalhe que o herói consegue ler (AST). */
export function intentText(G, a, detail = heroD(G).intentDetail) {
  const it = a.intent;
  if (!it) return hasStatus(a, 'rendido') ? 'Implora pela vida' : '—';
  if (a.flags.charging) return `${it.label} — CARREGANDO`;
  if (detail <= 0) {
    if (it.kind === 'attack') return it.est && it.est[1] >= 14 ? 'Algo pesado' : it.ranged ? 'Algo de longe' : 'Vai atacar';
    if (it.kind === 'move') return it.id === '_avancar' ? 'Avança' : 'Se move';
    return 'Prepara algo';
  }
  let s = it.label;
  if (it.kind === 'attack') {
    if (it.target === 'ally') s += ' → sequaz';
    else if (it.part && detail >= 1) s += ` → ${HERO_PART_NAMES[it.part] || it.part}`;
    if (it.est && detail >= 2) s += ` (${it.est[0]}–${it.est[1]}${it.hits > 1 ? ` ×${it.hits}` : ''})`;
    else if (it.est && detail >= 1) s += it.est[1] >= 14 ? ' (pesado)' : ' (leve)';
    if (it.windup) s += ' · carrega';
    if (it.aoe) s += ' · área';
  }
  return s;
}

// ───────────────────────── golpe inimigo contra o herói ─────────────────────────

function heroEvasion(G, D) {
  const h = heroActor(G);
  let e = (D.eva || 0) + statusSum(h, 'eva');
  if (hasStatus(h, 'esquiva') && !['caido', 'agarrado', 'enredado'].some((s) => hasStatus(h, s))) {
    e += Math.max(5, 30 + (D.mods.dodge || 0) - (D.heavy || 0) * 6) + (h.flags.shadow ? 100 : 0);
  }
  if (h.flags.recobrar) e -= 10;
  if (hasStatus(h, 'agarrando')) e -= 20;
  return e;
}

/** Um golpe de `a` com a intenção `it` contra o herói ou o sequaz. opts: { label, mult, target } */
export function enemyStrike(G, a, it, opts = {}) {
  const c = G.combat;
  const h = heroActor(G);
  const D = heroD(G);
  const al = allyActor(G);
  let tgt = opts.target || (a.intent?.target === 'ally' && al ? 'ally' : 'hero');
  const label = opts.label || it.label;
  const melee = !it.ranged && (it.reach ?? 0) <= 1;

  // muralha de pontas / postura de lança: estocada antes
  if (tgt === 'hero' && melee && a.dist <= 1 && h.flags.muralha && !a.dead) {
    log(G, `${a.name} vem pela ponta da sua lança.`, 'info');
    heroStrike(G, a, Object.keys(a.parts).find((k) => a.parts[k].role === 'torso') || Object.keys(a.parts)[0], { label: 'Muralha de pontas', mult: 0.7 });
    if (a.dead || hasStatus(a, 'atordoado')) return { hit: false };
  }

  // o sequaz se joga na frente
  if (tgt === 'hero' && al && al.flags.order === 'proteger' && !it.aoe) {
    const ic = COMPANIONS[al.def]?.intercept || 0;
    if (ic > 0 && rollPct(ic)) { tgt = 'ally'; log(G, `${al.name} se joga na frente do golpe!`, 'info'); }
  }

  const hits = it.hitsPerSwarm ? clamp(Math.round(swarmAlive(a) * it.hitsPerSwarm), 1, it.maxHits || 9) : 1;
  let anyHit = false;
  for (let i = 0; i < hits; i++) {
    if (c.result || a.dead) break;
    const r = tgt === 'ally' && al && !al.dead ? strikeAlly(G, a, it, al, label, opts) : strikeHero(G, a, it, label, opts, D, hits > 1);
    anyHit = anyHit || r.hit;
    if (r.parried) break;
  }
  if (it.aoe === 'hero_ally' && al && !al.dead && tgt === 'hero' && !c.result) strikeAlly(G, a, it, al, label, opts);
  if (it.special && AFTER_ATTACK[it.special]) AFTER_ATTACK[it.special](G, a);
  if (hits > 1 && !anyHit) log(G, `${a.name} não acha brecha.`, 'miss');
  return { hit: anyHit };
}

function strikeHero(G, a, it, label, opts, D, multi) {
  const c = G.combat;
  const h = heroActor(G);
  const def = edef(a);
  const part = (a.intent?.id === it.id && a.intent?.part && !multi) ? a.intent.part : pickHeroPart(it.part && it.part !== 'random' ? it.part : 'random', D.lostParts || []);
  const melee = !it.ranged && (it.reach ?? 0) <= 1;

  // acerto
  let ch = 70 + (def?.acc || 0) + (it.acc || 0) + (a.flags.scale?.acc || 0) + statusSum(a, 'acc');
  ch -= heroEvasion(G, D);
  ch += statusSum(h, 'beHit');
  if (multi) ch -= 5;
  ch = clamp(Math.round(ch), 8, 95);
  if (!rollPct(ch)) {
    const dodging = hasStatus(h, 'esquiva');
    if (!multi) log(G, dodging ? `Você esquiva de ${label} de ${a.name}.` : `${a.name}: ${label} — erra.`, dodging ? 'good' : 'miss');
    emitEv(G, { type: 'miss', target: HERO_UID, sfx: 'miss' });
    return { hit: false };
  }

  // aparar
  let mult = opts.mult ?? 1;
  if (hasStatus(h, 'aparando') && melee && !it.grab && !multi) {
    removeStatus(h, 'aparando');
    let pch = 30 + (D.attrs.des || 3) * 4 + (D.mods.parry || 0) + ((D.weapon.props || []).includes('apara') ? 15 : 0) + (h.flags.riposta ? 25 : 0) - (it.windup ? 10 : 0);
    if (D.weapon.cls === 'desarmado') pch -= 20;
    pch = clamp(Math.round(pch), 5, 90);
    if (rollPct(pch)) {
      log(G, `APARADO! Você desvia ${label} e devolve. (${pch}%)`, 'good');
      emitEv(G, { type: 'parry', target: HERO_UID, sfx: 'parry' });
      const rip = (1 + (D.mods.riposte || 0) / 100) * (h.flags.riposta ? 2 : 1);
      const pid = R.pick(Object.keys(a.parts).filter((k) => !partBroken(a.parts[k])));
      heroStrike(G, a, pid, { label: 'Contra-ataque', mult: rip, hitBonus: 20 });
      if (!a.dead && rollPct(50) && addStatus(G, a, 'atordoado', { turns: 1 })) { log(G, `${a.name} cambaleia.`, 'good'); interrupt(G, a, 'aparado'); }
      return { hit: false, parried: true };
    }
    log(G, `Você tenta aparar e falha. (${pch}%)`, 'bad');
    mult *= 1.25;
  }

  // dano
  let dmg = 0;
  let crit = false;
  if (!it.noDamage && it.dmg) {
    const base = rangeRoll(it.dmg) * (a.flags.scale?.dmg || 1) * (1 + statusSum(a, 'dmgPct') / 100);
    let m = mult;
    if (it.special && ATTACK_MODS[it.special]) m *= ATTACK_MODS[it.special](G, a);
    if (multi) m *= 0.85;
    crit = rollPct(5 + (it.crit || 0) + statusSum(h, 'beCrit'));
    if (crit) m *= 1.5;
    dmg = base * m;
    // guarda
    if (hasStatus(h, 'guarda') && !it.ignoreBlock) {
      let b = blockPct(G, D) * (1 - (it.ignoreBlockPct || 0) / 100);
      const cost = h.flags.shieldWall ? 0 : (D.offhand.kind === 'shield' ? D.offhand.stamBlock : 2);
      if (h.stamina < cost) { b /= 2; log(G, 'Sem fôlego, a guarda cede.', 'bad'); }
      else h.stamina -= cost;
      const blocked = dmg * b / 100;
      dmg -= blocked;
      if (blocked >= 1) emitEv(G, { type: 'block', target: HERO_UID, n: Math.round(blocked), sfx: 'block' });
      const sh = D.offhand.inst;
      if (sh && sh.dur != null && rollPct(25)) sh.dur = Math.max(0, sh.dur - 1);
    }
    // armadura
    const dt = it.dtype || 'corte';
    if (dt !== 'icor' && dt !== 'sangue' && dt !== 'veneno') {
      const arm = D.armor?.[part]?.[dt] ?? 0;
      dmg -= arm;
      const slot = part === 'cabeca' ? 'cabeca' : part === 'tronco' ? 'tronco' : part === 'pernas' ? 'pernas' : 'bracos';
      const piece = G.hero.equip?.[slot];
      if (piece && piece.dur != null && rollPct(25)) piece.dur = Math.max(0, piece.dur - 1);
    } else if (dt === 'icor') dmg -= Math.floor((D.armor?.[part]?.fogo ?? 0) / 2);
    dmg -= statusSum(h, 'flatReduce');
    dmg = Math.max(1, Math.round(dmg));
  }
  if (dmg > 0) {
    log(G, `${a.name}: ${label} — ${crit ? 'CRÍTICO ' : ''}${dmg} ${PART_PREP[part] || `em ${part}`}.`, crit ? 'crit_bad' : 'bad');
    damageHero(G, dmg, { part, dtype: it.dtype || 'corte', crit, src: a.uid, srcName: a.name });
  } else if (it.noDamage) {
    log(G, `${a.name}: ${label}.`, 'bad');
  }
  if (c.result) return { hit: true };
  if (it.status) applyStatusList(G, h, it.status, a.uid);
  if (it.grab) {
    addStatus(G, h, 'agarrado', { turns: 3, src: a.uid });
    addStatus(G, a, 'agarrando', { turns: 99 });
    log(G, `${a.name} te agarra. Você não consegue se mover.`, 'bad');
    if (h.flags.charge) { h.flags.charge = null; removeStatus(h, 'carregando'); }
  }
  if (it.dread) dreadHero(G, it.dread, a.name);
  if (it.corruption) corruptHero(G, it.corruption, a.name);
  if (it.special && AFTER_HIT[it.special]) AFTER_HIT[it.special](G, a, dmg);
  if (dmg >= (heroD(G).hpMax || 60) * 0.25) dreadHero(G, 2, 'golpe brutal');
  return { hit: true };
}

function strikeAlly(G, a, it, al, label) {
  const cd = COMPANIONS[al.def] || {};
  const def = edef(a);
  const ch = clamp(70 + (def?.acc || 0) + (it.acc || 0) + (a.flags.scale?.acc || 0) - (cd.eva || 0) + statusSum(al, 'beHit'), 8, 95);
  if (!rollPct(ch)) { log(G, `${a.name} erra ${al.name}.`, 'miss'); return { hit: false }; }
  if (it.noDamage || !it.dmg) {
    if (it.status) applyStatusList(G, al, it.status.filter((s) => s.id !== 'infectado'), a.uid);
    return { hit: true };
  }
  const dmg = Math.max(1, Math.round(rangeRoll(it.dmg) * (a.flags.scale?.dmg || 1) * (1 + statusSum(a, 'dmgPct') / 100) - (cd.armor || 0)));
  log(G, `${a.name}: ${label} — ${dmg} em ${al.name}.`, 'bad');
  damageAlly(G, al, dmg, { srcName: a.name });
  if (!al.dead && it.status) applyStatusList(G, al, it.status.filter((s) => ['sangrando', 'queimando', 'atordoado', 'caido', 'envenenado'].includes(s.id)), a.uid);
  return { hit: true };
}

setEnemyStrike(enemyStrike);

// ───────────────────────── turno do inimigo ─────────────────────────

function enemyTimeMult(a) {
  const def = edef(a);
  const sp = (def?.speed || 100) + (a.flags.speedBonus || 0);
  let m = 100 / Math.max(30, sp);
  if (Object.values(a.parts).some((p) => p.role === 'legs' && p.fractured)) m *= 1.15;
  m *= 1 + statusSum(a, 'timePct') / 100;
  return m;
}

/** Executa o turno de um inimigo. Retorna o tempo gasto (já com velocidade). */
export function enemyTurn(G, a) {
  const c = G.combat;
  const def = edef(a);
  const mult = enemyTimeMult(a);

  // rendido não age
  if (hasStatus(a, 'rendido')) return 999;

  // fuga anunciada
  if (hasStatus(a, 'fugindo')) {
    if (canMove(G, a)) {
      a.gone = true;
      a.intent = null;
      c.fled = (c.fled || 0) + 1;
      log(G, `${a.name} foge para o Ermo.`, 'warn');
      emitEv(G, { type: 'flee', target: a.uid, sfx: 'step' });
      return 100;
    }
    removeStatus(a, 'fugindo');
    if (def?.surrender) return surrender(G, a);
  }

  // moral
  if (a.moraleMax > 0 && (a.morale ?? 0) <= 0 && !a.flags.boss) {
    const lowHp = a.hp < a.hpMax * 0.5;
    if (def?.surrender && (lowHp || rollPct(40))) return surrender(G, a);
    if (def?.flee) {
      addStatus(G, a, 'fugindo', { turns: 99 });
      a.intent = { id: '_fugir', label: 'Vai fugir', icon: '🏃', kind: 'move' };
      log(G, `${a.name} perde a coragem e procura um jeito de fugir.`, 'good');
      return 70 * mult;
    }
  }

  // carga pronta: solta
  if (a.flags.charging) {
    a.flags.charging = false;
    removeStatus(a, 'carregando');
    const it = intentDef(a, a.intent?.id);
    if (it && intentStillValid(G, a, it)) {
      executeIntent(G, a, it, true);
      finishIntent(G, a, it);
      return (it.time || 100) * mult;
    }
    log(G, `${a.name} perde o golpe que preparava.`, 'good');
    chooseIntent(G, a);
    return 60 * mult;
  }

  // garante intenção
  if (!a.intent || a.flags.needIntent) chooseIntent(G, a);
  const it = a.intent?.id === '_avancar' ? ADVANCE : a.intent?.id === '_esperar' ? WAIT : intentDef(a, a.intent?.id);
  if (!it || !intentStillValid(G, a, it)) {
    chooseIntent(G, a);
    log(G, `${a.name} muda de ideia.`, 'info');
    return 50 * mult;
  }

  // precisa chegar perto
  if (it.kind === 'attack' && !it.ranged && a.dist > (it.reach ?? 0)) {
    if (canMove(G, a)) return advanceEnemy(G, a) * mult;
    chooseIntent(G, a);
    return 60 * mult;
  }

  // começa a carregar
  if (it.windup && !a.flags.charging) {
    a.flags.charging = true;
    addStatus(G, a, 'carregando', { turns: 99 });
    log(G, `${a.name} prepara: ${it.label}.`, 'warn');
    emitEv(G, { type: 'charge', target: a.uid });
    return it.windup * mult;
  }

  executeIntent(G, a, it, false);
  finishIntent(G, a, it);
  return (it.time || 100) * mult;
}

function intentDef(a, id) { return (edef(a)?.intents || []).find((x) => x.id === id) || null; }
function intentStillValid(G, a, it) {
  if (it.uses && it.uses.some((u) => !partOk(a, u))) return false;
  if (it.usesAny && !it.usesAny.some((u) => partOk(a, u))) return false;
  if (it.when?.includes('grabbingHero') && getStatus(heroActor(G), 'agarrado')?.src !== a.uid) return false;
  if (it.when?.includes('heroDown') && !hasStatus(heroActor(G), 'caido')) return false;
  if (it.when?.includes('loaded') && !a.flags.loaded) return false;
  if (it.when?.includes('corpse') && !(G.combat.env.corpses > 0)) return false;
  return true;
}

function finishIntent(G, a, it) {
  const c = G.combat;
  if (it.cd) a.flags.cd[it.id] = c.round + it.cd;
  a.flags.used[it.id] = true;
  if (!a.dead) chooseIntent(G, a);
}

function surrender(G, a) {
  addStatus(G, a, 'rendido', { turns: 999 });
  removeStatus(a, 'fugindo');
  a.intent = null;
  if (hasStatus(a, 'agarrando')) { removeStatus(a, 'agarrando'); removeStatus(heroActor(G), 'agarrado'); }
  log(G, `${a.name} larga a arma e cai de joelhos. "Piedade..."`, 'good');
  emitEv(G, { type: 'surrender', target: a.uid });
  return 999;
}

function advanceEnemy(G, a) {
  const c = G.combat;
  const h = heroActor(G);
  const to = a.dist - 1;
  // no máximo dois inimigos colados no herói: os outros circulam esperando a vez
  if (to === 0 && foes(G).filter((f) => f !== a && f.dist === 0 && !hasTag(f, 'enxame')).length >= ENGAGE_CAP && !hasTag(a, 'enxame')) {
    log(G, `${a.name} circula, esperando uma brecha.`, 'info');
    return 50;
  }
  if (to === 0 && c.saltLine && c.saltLine >= c.round && hasTag(a, 'morto')) {
    log(G, `${a.name} para na linha de sal e uiva.`, 'good');
    return 60;
  }
  a.dist = Math.max(0, to);
  log(G, `${a.name} avança (${DIST_NAMES[a.dist].toLowerCase()}).`, 'info');
  emitEv(G, { type: 'move', target: a.uid, sfx: 'step' });
  if (a.dist === 0) {
    // lança em riste
    if (hasStatus(h, 'mantendo_distancia') && !a.dead) {
      log(G, `${a.name} corre para a sua ponta.`, 'info');
      heroStrike(G, a, Object.keys(a.parts).find((k) => a.parts[k].role === 'torso') || Object.keys(a.parts)[0], { label: 'Estocada de guarda', mult: 0.8 });
      if (!a.dead && rollPct(50)) { a.dist = 1; log(G, `${a.name} é detido na ponta da lança.`, 'good'); }
    }
    // cão de guarda
    const al = allyActor(G);
    if (al && !a.dead && al.flags.order === 'segurar' && al.def === 'cao_guerra') {
      const cd = COMPANIONS[al.def];
      const dmg = rangeRoll(cd.dmg);
      log(G, `${al.name} morde ${a.name} na chegada.`, 'good');
      damageEnemy(G, a, dmg, { part: legPart(a) || 'tronco', dtype: 'perf', by: 'ally' });
    }
  }
  return 60;
}

function legPart(a) { return Object.keys(a.parts).find((k) => a.parts[k].role === 'legs' && !partBroken(a.parts[k])); }

function executeIntent(G, a, it) {
  const c = G.combat;
  emitEv(G, { type: 'act', target: a.uid });
  switch (it.kind) {
    case 'attack':
      enemyStrike(G, a, it);
      if (it.special === 'shove') shoveHero(G, a);
      break;
    case 'move': {
      if (it.id === '_avancar') { advanceEnemy(G, a); break; }
      const mv = it.move || 1;
      if (mv > 0) { a.dist = Math.min(2, a.dist + mv); log(G, `${a.name}: ${it.label}.`, 'info'); }
      else advanceEnemy(G, a);
      emitEv(G, { type: 'move', target: a.uid, sfx: 'step' });
      break;
    }
    case 'summon': {
      if (it.consumeCorpse) { c.env.corpses = Math.max(0, (c.env.corpses || 0) - 1); c.corpses.shift(); }
      const s = summon(G, a, it.summon, {});
      log(G, `${a.name}: ${it.label}. ${s.name} entra na luta.`, 'boss');
      if (it.dread) dreadHero(G, it.dread, a.name);
      break;
    }
    case 'self': case 'special':
    default: {
      if (it.id === '_esperar') { log(G, `${a.name} observa, esperando uma brecha.`, 'info'); break; }
      if (it.special === 'shove') { shoveHero(G, a); break; }
      const fn = it.special && INTENT_SPECIALS[it.special];
      if (fn) fn(G, a, it);
      else {
        log(G, `${a.name}: ${it.label}.`, 'warn');
        if (it.dread) dreadHero(G, it.dread, a.name);
      }
    }
  }
}

// ───────────────────────── sequaz ─────────────────────────

function allyTimeMult(al) {
  const cd = COMPANIONS[al.def] || {};
  return 100 / Math.max(40, cd.speed || 100);
}

function allyHit(G, al, t, mult = 1, pid = null, extra = {}) {
  const cd = COMPANIONS[al.def] || {};
  if (!t || t.dead) return false;
  const def = edef(t);
  const ch = clamp(70 + (cd.acc || 0) - (def?.eva || 0) - statusSum(t, 'eva') + statusSum(t, 'beHit') + (G.combat.env.dark && !G.combat.env.lit ? -10 : 0), 5, 95);
  const part = pid && t.parts[pid] && !partBroken(t.parts[pid]) ? pid
    : (Object.keys(t.parts).find((k) => t.parts[k].role === 'torso' && !partBroken(t.parts[k])) || Object.keys(t.parts).find((k) => !partBroken(t.parts[k])));
  if (!rollPct(ch)) { log(G, `${al.name} erra ${t.name}.`, 'miss'); return false; }
  const p = t.parts[part];
  const dmg = Math.max(1, Math.round(rangeRoll(cd.dmg || [4, 8]) * mult - (p?.armor?.[cd.dtype || 'corte'] || 0)));
  log(G, `${al.name} acerta ${t.name} (${dmg}).`, 'hit');
  damageEnemy(G, t, dmg, { part, dtype: cd.dtype || 'corte', by: 'ally', prone: extra.prone || 0 });
  return true;
}

/** Turno do sequaz. Retorna tempo. */
export function allyTurn(G, al) {
  const c = G.combat;
  const h = heroActor(G);
  const cd = COMPANIONS[al.def] || {};
  const mult = allyTimeMult(al);
  const order = al.flags.order || 'atacar';
  const style = cd.style;
  const list = foes(G);
  if (!list.length) return 100 * mult;
  const reach = cd.ranged ? 2 : 1;
  const inReach = list.filter((f) => f.dist <= reach);
  const lastTarget = c.lastHeroTarget && list.find((f) => f.uid === c.lastHeroTarget);
  const weakest = (arr) => arr.slice().sort((x, y) => x.hp / x.hpMax - y.hp / y.hpMax)[0];

  if (style === 'penitente' && order === 'segurar') { dreadHero(G, -4, 'reza do penitente'); log(G, `${al.name} reza alto, sangrando.`, 'info'); return 100 * mult; }
  if (style === 'carregador' && order === 'proteger') {
    if (hasStatus(h, 'sangrando')) { removeStatus(h, 'sangrando'); log(G, `${al.name} amarra um trapo no seu sangramento.`, 'good'); }
    healHero(G, 3);
    return 100 * mult;
  }
  if (style === 'batedora') {
    if (order === 'segurar') {
      const t = list.slice().sort((x, y) => (y.flags.elite ? 1 : 0) - (x.flags.elite ? 1 : 0) || y.hp - x.hp)[0];
      addStatus(G, t, 'marcado', { turns: 3 });
      log(G, `${al.name} marca ${t.name} com uma flecha no ombro.`, 'info');
      allyHit(G, al, t, 0.5);
      return 100 * mult;
    }
    if (order === 'proteger') {
      const t = list.find((f) => f.flags.charging) || lastTarget || weakest(list);
      if (allyHit(G, al, t, 0.8) && t.flags.charging && rollPct(50)) interrupt(G, t, 'flechada');
      return 100 * mult;
    }
    const t = list.slice().sort((x, y) => x.dist - y.dist)[0];
    allyHit(G, al, t, 1, legPart(t));
    if (!t.dead && rollPct(25) && canMove(G, t)) { addStatus(G, t, 'enredado', { turns: 1 }); log(G, `${t.name} trava com uma flecha na coxa.`, 'good'); }
    return 100 * mult;
  }
  if (order === 'segurar' && !inReach.some((f) => f.dist === 0)) {
    log(G, `${al.name} fica na retaguarda.`, 'info');
    return 80 * mult;
  }
  const pool = order === 'segurar' ? inReach.filter((f) => f.dist === 0) : inReach;
  if (!pool.length) {
    // nada ao alcance: segura a posição
    log(G, `${al.name} espera alguém chegar perto.`, 'info');
    return 70 * mult;
  }
  let t;
  if (order === 'proteger') {
    const attacker = pool.find((f) => f.intent?.kind === 'attack' && f.dist === 0);
    t = attacker || weakest(pool);
  } else t = (lastTarget && pool.includes(lastTarget)) ? lastTarget : weakest(pool);
  if (style === 'cao') {
    allyHit(G, al, t, 1, legPart(t), { prone: order === 'atacar' ? 30 : 0 });
  } else if (style === 'penitente') {
    al.hp = Math.max(1, al.hp - 2);
    addStatus(G, al, 'furioso', { stacks: 1, turns: 3 });
    allyHit(G, al, t, 1 + 0.2 * stacks(al, 'furioso'));
  } else if (style === 'mercenario' && order === 'proteger') {
    addStatus(G, al, 'guarda', { turns: 1 });
    allyHit(G, al, t, 0.8);
  } else allyHit(G, al, t, style === 'carregador' ? 0.7 : 1);
  return 100 * mult;
}

export { intentValid, describeIntent, enemyTimeMult };
