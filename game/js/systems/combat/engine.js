// Motor do combate: criação, linha do tempo, início de turno (sangramentos, fogo, regeneração), ação do herói,
// fim de luta (saque, maestria, bestiário, sequaz) e ponte com o fluxo do jogo.
import { R } from '../../core/rng.js';
import { clamp, uid } from '../../core/util.js';
import { save } from '../../core/save.js';
import * as flow from '../flow.js';
import * as EV from '../events.js';
import { COMPANIONS } from '../../data/companions.js';
import { MASTERY_THRESHOLDS, masteryLevel, CLASS_NAMES } from '../../data/techniques.js';
import { STATUSES } from '../../data/statuses.js';
import {
  HERO_UID, heroActor, allyActor, foes, surrendered, edef, hasTag, log, emitEv, getStatus, hasStatus, stacks, addStatus, removeStatus,
  statusSum, tickDurations, clearStances, partBroken, changeMorale, rollPct, rangeRoll,
} from './core.js';
import { heroD, rollLoot, applyEffects, inflictWound, describeWound, itemDef, makeItem } from './deps.js';
import { buildEnemy, buildHero, buildAlly, numberNames, regionTier } from './build.js';
import { damageHero, damageAlly, killEnemy, healHero, dreadHero, heroCollapse } from './resolve.js';
import { chooseIntent, enemyTurn, allyTurn, enemyTimeMult } from './ai.js';
import { performHeroAction, heroTimeMult, releaseCharge } from './hero.js';

// ───────────────────────── início ─────────────────────────

/**
 * Cria G.combat. spec: { enemies:[id|{id,dist,elite,level}], region, ambush:'enemy'|'hero'|null, dark, night, boss, canFlee,
 *   context:{source,...}, onWin, onFlee, text }
 */
export function startCombat(G, spec = {}) {
  const region = spec.region || spec.context?.region || G.expedition?.region || 'r1';
  const tier = regionTier(region);
  const context = { source: 'expedition', region, canFlee: spec.canFlee ?? true, boss: !!spec.boss, ...(spec.context || {}) };
  if (spec.onWin && !context.onWin) context.onWin = spec.onWin;
  if (spec.onFlee && !context.onFlee) context.onFlee = spec.onFlee;
  context.region = context.region || region;
  const D = heroD(G);
  const torchInHand = D.offhand.kind === 'torch';
  G.combat = {
    id: uid('c'), round: 1, time: 0, turn: null, heroTurnReady: false,
    log: [], events: [],
    actors: [],
    context,
    env: { dark: !!spec.dark && !torchInHand, lit: !spec.dark || torchInHand, night: !!spec.night, torchInHand, corpses: 0 },
    corpses: [], killed: [], mastery: {}, recover: [],
    stats: { dmgDealt: 0, dmgTaken: 0, wounds: 0, severed: 0, interrupts: 0, executions: 0 },
    result: null, text: spec.text || '', boss: !!spec.boss,
  };
  const c = G.combat;
  const hero = buildHero(G);
  c.actors.push(hero);
  const ally = buildAlly(G);
  if (ally) c.actors.push(ally);
  for (const s of (spec.enemies || []).slice(0, 7)) {
    const a = buildEnemy(G, s, tier, { heroLevel: G.hero?.level || 1 });
    c.actors.push(a);
    const b = (G.world.bestiary[a.def] ||= { kills: 0, seen: 0 });
    b.seen += 1;
  }
  if (!foes(G).length) c.actors.push(buildEnemy(G, 'saqueador', tier));
  numberNames(c.actors);

  // linha do tempo inicial
  const first = D.mods.first_strike || 0;
  hero.next = Math.max(0, R.int(0, 25) - first);
  if (ally) ally.next = R.int(10, 50);
  for (const a of foes(G)) a.next = Math.round(R.int(15, 70) * enemyTimeMult(a));
  if (spec.ambush === 'enemy') {
    hero.next += 45;
    addStatus(G, hero, 'desprevenido', { turns: 1 });
    for (const a of foes(G)) a.next = R.int(0, 35);
    log(G, 'EMBOSCADA! Eles atacam primeiro.', 'bad');
  } else if (spec.ambush === 'hero') {
    hero.next = 0;
    for (const a of foes(G)) { a.next += 60; addStatus(G, a, 'desprevenido', { turns: 1 }); }
    log(G, 'Você os pega desprevenidos.', 'good');
  }
  if (c.env.dark) log(G, 'Escuro: você mal enxerga (−precisão).', 'warn');
  if (spec.text) log(G, spec.text, 'info');
  // pavor de entrada (auras)
  let aura = 0;
  for (const a of foes(G)) aura += edef(a)?.dread || 0;
  if (aura > 0) dreadHero(G, Math.min(20, Math.round(aura * (c.env.dark ? 1.3 : 1))), 'o que você vê');
  for (const a of foes(G)) chooseIntent(G, a);
  advance(G);
  save();
  return c;
}

// ───────────────────────── linha do tempo ─────────────────────────

function nextActor(G) {
  const c = G.combat;
  let best = null;
  for (const a of c.actors) {
    if (a.dead || a.gone) continue;
    if (a.side === 'enemy' && hasStatus(a, 'rendido')) continue;
    if (!best || a.next < best.next || (a.next === best.next && a.side === 'hero')) best = a;
  }
  return best;
}

/** Fila prevista dos próximos turnos (para a UI). */
export function timeline(G, n = 8) {
  const c = G.combat;
  if (!c) return [];
  const D = heroD(G);
  const sim = c.actors.filter((a) => !a.dead && !a.gone && !(a.side === 'enemy' && hasStatus(a, 'rendido')))
    .map((a) => ({ uid: a.uid, side: a.side, name: a.name, t: a.next, step: a.side === 'hero' ? 100 * heroTimeMult(G, D) : a.side === 'ally' ? 100 : (a.intent?.windup && !a.flags.charging ? a.intent.windup : 100) * enemyTimeMult(a), charging: !!a.flags?.charging }));
  const out = [];
  for (let i = 0; i < n && sim.length; i++) {
    sim.sort((x, y) => x.t - y.t || (x.side === 'hero' ? -1 : 1));
    const s = sim[0];
    out.push({ uid: s.uid, side: s.side, name: s.name, at: Math.round(s.t - c.time), charging: s.charging && i < sim.length });
    s.t += Math.max(30, s.step);
    s.charging = false;
  }
  return out;
}

function endCheck(G) {
  const c = G.combat;
  if (c.result) return true;
  if (!foes(G).length) {
    c.result = 'win';
    const s = surrendered(G);
    if (s.length) log(G, `${s.map((x) => x.name).join(', ')} ${s.length > 1 ? 'imploram' : 'implora'} de joelhos.`, 'info');
    else log(G, 'Silêncio. Só o seu fôlego e o cheiro de sangue.', 'good');
    emitEv(G, { type: 'win', sfx: 'win' });
    return true;
  }
  return false;
}

/** Processa o início do turno de um ator. Retorna 'skip' se perde o turno, 'dead' se morreu, '' normal. */
function startTurn(G, a) {
  const c = G.combat;
  clearStances(a);
  if (a.side === 'hero') {
    a.flags.riposta = false; a.flags.shadow = false; a.flags.muralha = false; a.flags.shieldWall = false; a.flags.recobrar = false; a.flags.orderGiven = false;
  }
  // dano contínuo
  const dots = [];
  for (const s of a.statuses) {
    const d = STATUSES[s.id];
    if (d?.dot) dots.push([s, d]);
  }
  for (const [s, d] of dots) {
    if (a.dead || c.result) break;
    let dmg = d.dot.dmg * (s.stacks || 1);
    if (a.side === 'hero') {
      dmg = d.dot.dmg * Math.min(s.stacks || 1, s.id === 'sangrando' ? 4 : 3);
      const D = heroD(G);
      if (s.id === 'sangrando') dmg = Math.max(1, Math.round(dmg * (1 - (D.bleedResist || 0) / 100)));
      if (s.id === 'queimando') dmg = Math.max(1, Math.round(dmg * (1 - (D.fireResist || 0) / 100)));
      if (s.id === 'envenenado') dmg = Math.max(1, Math.round(dmg * (1 - (D.poisonResist || 0) / 100)));
      log(G, `${d.name}: −${dmg}.`, 'bad');
      damageHero(G, dmg, { part: 'tronco', dtype: d.dot.dtype, noWound: true, srcName: '', dotName: d.name.toLowerCase() });
    } else if (a.side === 'ally') {
      damageAlly(G, a, dmg, { srcName: d.name.toLowerCase() });
    } else {
      const def = edef(a);
      if (s.id === 'queimando' && def?.weak?.includes('fogo')) dmg = Math.round(dmg * 1.3);
      if (s.id === 'sangrando' && (hasTag(a, 'morto') || hasTag(a, 'construto'))) dmg = Math.ceil(dmg / 2);
      if (Object.values(a.parts).some((p) => p.role === 'swarm') && s.id === 'queimando') {
        for (const p of Object.values(a.parts)) if (p.role === 'swarm' && !partBroken(p)) { p.hp = Math.max(0, p.hp - Math.ceil(dmg / 2)); if (p.hp <= 0) p.state = 'destruido'; }
        a.hp = Object.values(a.parts).filter((p) => p.role === 'swarm').reduce((t, p) => t + p.hp, 0);
      } else a.hp = Math.max(0, a.hp - dmg);
      emitEv(G, { type: 'dot', target: a.uid, id: s.id, dmg });
      if (d.morale) changeMorale(G, a, d.morale);
      if (s.id === 'queimando' && hasTag(a, 'fera')) changeMorale(G, a, -10);
      if (a.hp <= 0) {
        killEnemy(G, a, { by: s.src === HERO_UID ? 'hero' : 'env', how: s.id === 'queimando' ? 'fogo' : s.id === 'envenenado' ? 'veneno' : 'sangue' });
        return 'dead';
      }
    }
  }
  if (a.dead || c.result) return 'dead';
  // regeneração
  const regen = statusSum(a, 'heal') * 1;
  if (regen > 0) {
    const st = getStatus(a, 'regenerando');
    const n = (STATUSES.regenerando.heal || 3) * (st?.stacks || 1);
    if (a.side === 'hero') healHero(G, n); else a.hp = Math.min(a.hpMax, a.hp + n);
  }
  if (a.side === 'hero') {
    const D = heroD(G);
    if (D.mods.regen) healHero(G, D.mods.regen);
    const regenSt = Math.max(1, (D.staminaRegen || 3) + statusSum(a, 'regen'));
    a.stamina = Math.min(a.staminaMax, a.stamina + regenSt);
    if (hasStatus(a, 'exausto') && a.stamina >= 3) removeStatus(a, 'exausto');
    // colapso
    const col = a.flags.collapse;
    if (col) {
      col.turns -= 1;
      if (col.kind === 'catatonia') {
        log(G, 'Você não se move. O mundo está longe.', 'dread');
        if (col.turns <= 0) a.flags.collapse = null;
        return 'skip';
      }
      if (col.turns <= 0) { a.flags.collapse = null; log(G, 'Você volta a si.', 'info'); }
    }
    // pavor alto: travar
    if ((G.hero.dread || 0) >= 75 && rollPct(10)) { log(G, 'Suas mãos tremem. Você hesita.', 'dread'); return 'skip'; }
  }
  if (hasStatus(a, 'atordoado')) {
    removeStatus(a, 'atordoado');
    a.flags.stunImmune = 2;
    log(G, a.side === 'hero' ? 'Você está atordoado e perde o turno.' : `${a.name} está atordoado.`, a.side === 'hero' ? 'bad' : 'good');
    return 'skip';
  }
  const skipCh = statusSum(a, 'skipChance');
  if (skipCh > 0 && rollPct(skipCh)) {
    log(G, a.side === 'hero' ? 'O terror trava seu corpo.' : `${a.name} congela de terror.`, a.side === 'hero' ? 'dread' : 'good');
    return 'skip';
  }
  return '';
}

/** Avança a luta até a vez do herói (ou o fim). */
export function advance(G) {
  const c = G.combat;
  if (!c) return;
  for (let guard = 0; guard < 300; guard++) {
    if (endCheck(G)) { c.turn = null; return; }
    const a = nextActor(G);
    if (!a) { c.result = c.result || 'win'; return; }
    c.time = Math.max(c.time, a.next);
    if (a.side === 'hero') {
      if (c.turn === 'hero' && c.heroTurnReady) return; // já está esperando o jogador
      const r = startTurn(G, a);
      if (c.result) { c.turn = null; return; }
      if (r === 'skip') { a.next = c.time + 60; tickDurations(a); c.round += 1; continue; }
      if (a.flags.charge) {
        const rc = releaseCharge(G);
        a.next = c.time + Math.max(30, Math.round(rc.time * heroTimeMult(G)));
        tickDurations(a);
        c.round += 1;
        continue;
      }
      c.turn = 'hero';
      c.heroTurnReady = true;
      return;
    }
    let spent = 60;
    const r = startTurn(G, a);
    if (c.result) { c.turn = null; return; }
    if (r === 'dead') continue;
    if (r === 'skip') spent = 60;
    else if (a.side === 'enemy') spent = enemyTurn(G, a);
    else if (a.side === 'ally') spent = allyTurn(G, a);
    a.next = c.time + Math.max(25, Math.round(spent));
    if (!a.dead) tickDurations(a);
  }
  console.warn('[combat] limite de iterações');
  c.turn = 'hero';
  c.heroTurnReady = true;
}

// ───────────────────────── ação do herói ─────────────────────────

/** Executa a ação do herói e avança até a próxima vez dele. Retorna { ok, why, events }. */
export function act(G, input = {}) {
  const c = G.combat;
  if (!c || c.result) return { ok: false, why: 'Sem combate.', events: [] };
  if (c.turn !== 'hero') advance(G);
  if (c.turn !== 'hero') return { ok: false, why: 'Não é sua vez.', events: drainEvents(G) };
  const h = heroActor(G);
  const r = performHeroAction(G, input);
  if (!r.ok) return { ok: false, why: r.why, events: drainEvents(G) };
  if (input.target) c.lastHeroTarget = input.target;
  if (r.free) { save(); return { ok: true, events: drainEvents(G) }; }
  h.next = c.time + Math.max(20, Math.round((r.time || 100) * heroTimeMult(G)));
  tickDurations(h);
  c.round += 1;
  c.turn = null;
  c.heroTurnReady = false;
  if (!c.result) advance(G);
  save();
  return { ok: true, events: drainEvents(G) };
}

export function drainEvents(G) {
  const c = G.combat;
  if (!c) return [];
  const ev = c.events || [];
  c.events = [];
  return ev;
}

export function isOver(G) { return G.combat?.result || null; }

// ───────────────────────── rendidos ─────────────────────────

/** Decide o destino de um rendido: 'spare' | 'execute'. */
export function resolveSurrender(G, targetUid, choice) {
  const c = G.combat;
  const a = c?.actors.find((x) => x.uid === targetUid);
  if (!a || a.dead || a.gone || !hasStatus(a, 'rendido')) return { ok: false };
  if (choice === 'execute') {
    killEnemy(G, a, { by: 'hero', how: 'executado', executed: true });
    c.executedSurrendered = (c.executedSurrendered || 0) + 1;
    c.stats.executions += 1;
    if (G.hero.stats) G.hero.stats.executions = (G.hero.stats.executions || 0) + 1;
    log(G, `Você executa ${a.name}. Ele não grita; já tinha desistido.`, 'kill');
    dreadHero(G, -3, 'execução');
    emitEv(G, { type: 'execute', target: a.uid, sfx: 'sever' });
  } else {
    a.gone = true;
    a.spared = true;
    c.spared = (c.spared || 0) + 1;
    log(G, `Você deixa ${a.name} ir. Ele some mancando.`, 'info');
  }
  save();
  return { ok: true };
}

// ───────────────────────── fim ─────────────────────────

function ichorMult(G, D) {
  return (1 + (D.mods.ichor_find || 0) / 100) * (G.combat.env.night ? 1.25 : 1);
}

/** Encerra a luta: recompensas, sequelas e fluxo. Retorna o outcome. */
export function finishCombat(G) {
  const c = G.combat;
  if (!c) return null;
  const hero = G.hero;
  const result = c.result || 'lose';
  const D = heroD(G);
  const lines = [];
  const source = c.context.source || 'expedition';

  // rendidos não resolvidos: poupados
  for (const a of surrendered(G)) resolveSurrender(G, a.uid, 'spare');

  // maestria
  for (const [cls, n] of Object.entries(c.mastery || {})) {
    if (!n || !hero) continue;
    hero.mastery = hero.mastery || {};
    const before = masteryLevel(hero.mastery[cls] || 0);
    hero.mastery[cls] = (hero.mastery[cls] || 0) + n;
    const after = masteryLevel(hero.mastery[cls]);
    if (after > before) lines.push({ text: `Maestria em ${CLASS_NAMES[cls] || cls}: nível ${after}. Novas técnicas.`, kind: 'good' });
  }
  if (hero?.stats) hero.stats.kills = (hero.stats.kills || 0) + c.killed.filter((k) => k.by === 'hero' || k.by === 'ally' || k.by === 'env').length;

  // infecção da luta vira ferida infeccionada
  const ha = heroActor(G);
  if (result !== 'lose' && hero && hasStatus(ha, 'infectado')) {
    const open = (hero.wounds || []).filter((w) => !w.infected && w.days !== -1);
    if (open.length) { const w = R.pick(open); w.infected = true; lines.push({ text: 'A Chaga da luta entrou numa ferida: infecção.', kind: 'bad' }); }
    else {
      const w = inflictWound(G, null, 'perf', 1);
      if (w) { w.infected = true; lines.push({ text: `Um arranhão infeccionado: ${describeWound(w)?.name || 'ferida'}.`, kind: 'bad' }); }
    }
  }
  // sangramento da luta continua como ferida aberta
  if (result !== 'lose' && hero && stacks(ha, 'sangrando') >= 3 && !(hero.wounds || []).some((w) => w.bleeding)) {
    const w = inflictWound(G, null, 'corte', 1);
    if (w) lines.push({ text: `Você sai da luta sangrando: ${describeWound(w)?.name || 'corte'}.`, kind: 'bad' });
  }

  // sequaz
  const al = c.actors.find((a) => a.side === 'ally');
  if (al && hero?.companion) {
    if (al.dead) { lines.push({ text: `${al.name} morreu. Você vai lembrar do som.`, kind: 'blood' }); hero.companion = null; }
    else {
      hero.companion.hp = Math.max(1, al.hp);
      if (result === 'win') hero.companion.kills = (hero.companion.kills || 0) + c.killed.filter((k) => k.by === 'ally').length;
    }
  }

  // saque
  const loot = { items: [], coin: 0, ichor: 0 };
  if (result === 'win' || result === 'fled') {
    const tier = regionTier(c.context.region);
    const im = ichorMult(G, D);
    for (const k of c.killed) {
      if (k.summoned && result !== 'win') continue;
      if (result === 'fled') continue;
      const def = edef({ side: 'enemy', def: k.def });
      if (!def) continue;
      const rolls = (def.lootRolls ?? 1) + (k.elite ? 1 : 0) + (k.boss ? 1 : 0);
      if (rolls > 0 && def.loot?.length && !k.summoned) {
        const r = rollLoot(G, def.loot, { tier, rolls, bonus: D.mods.loot || 0 });
        loot.items.push(...(r.items || []));
      }
      if (!k.summoned) {
        loot.coin += Math.round(R.range(def.coin || [0, 0]) * (k.elite ? 1.5 : 1));
        loot.ichor += Math.round(R.range(def.ichor || [0, 0]) * im * (k.elite ? 1.5 : 1));
      }
    }
    for (const id of c.recover || []) { const it = makeItem(id, { n: 1 }); if (it) loot.items.push(it); }
    if (c.spared && result === 'win') {
      if (rollPct(50)) { loot.coin += R.int(2, 8); lines.push({ text: 'Um dos poupados joga moedas aos seus pés antes de sumir.', kind: 'info' }); }
      else lines.push({ text: 'Os poupados somem no Ermo. Talvez lembrem disso.', kind: 'info' });
      G.campaign.counters.spared = (G.campaign.counters.spared || 0) + c.spared;
      if (G.campaign.counters.spared >= 3) G.campaign.flags.poupou_rendidos = true;
    }
    if (c.executedSurrendered) G.campaign.counters.executed_surrendered = (G.campaign.counters.executed_surrendered || 0) + c.executedSurrendered;
  }
  // contadores de mortes por tipo (contratos/missões)
  for (const k of c.killed) {
    G.campaign.counters[`kill_${k.def}`] = (G.campaign.counters[`kill_${k.def}`] || 0) + 1;
  }
  if (hero && ha && !hero.dead && result !== 'lose') {
    hero.hp = Math.max(1, Math.min(D.hpMax, ha.hp));
    if (hero.hp <= 0) hero.hp = 1;
  }

  const outcome = {
    result, source, region: c.context.region, nodeId: c.context.nodeId, killed: c.killed.length, stats: { ...c.stats },
    loot: { items: loot.items.length, coin: loot.coin, ichor: loot.ichor }, lines, boss: c.context.boss, context: { ...c.context },
    spared: c.spared || 0, executedSurrendered: c.executedSurrendered || 0,
  };

  // morte
  if (result === 'lose') {
    const cause = c.deathCause || (c.killer ? `Morto por ${c.killer}` : 'Morto em combate');
    const info = { region: c.context.region, nodeId: c.context.nodeId, killer: c.killer, corrupted: !!c.corrupted, source };
    G.combat = null;
    save();
    flow.heroDied(cause, info);
    return outcome;
  }

  // saque pendente
  if (loot.items.length || loot.coin || loot.ichor) {
    const pl = G.pendingLoot;
    const title = c.context.boss ? 'Despojos' : 'Saque da luta';
    if (pl) {
      pl.items = [...(pl.items || []), ...loot.items];
      pl.coin = (pl.coin || 0) + loot.coin;
      pl.ichor = (pl.ichor || 0) + loot.ichor;
    } else G.pendingLoot = { items: loot.items, coin: loot.coin, ichor: loot.ichor, source, title };
  }

  // efeitos de vitória / fuga
  const fx = result === 'win' ? c.context.onWin : result === 'fled' ? c.context.onFlee : null;
  G.combat = null;
  let chainEvent = null;
  if (fx?.length) {
    const r = applyEffects(G, fx, { source, region: outcome.region, nodeId: outcome.nodeId, via: 'combat' });
    lines.push(...(r.lines || []));
    const ev = (r.pending || []).find((p) => p.type === 'event');
    if (ev) chainEvent = ev.id;
    const death = (r.pending || []).find((p) => p.type === 'death');
    if (death) { save(); flow.heroDied(death.cause || 'Morte', { region: outcome.region, nodeId: outcome.nodeId }); return outcome; }
  }
  outcome.lines = lines;
  if (chainEvent && EV.getEvent?.(chainEvent)) {
    try {
      const src = c.context.eventSource || source;
      EV.startEvent(G, chainEvent, { source: src, region: outcome.region, nodeId: outcome.nodeId });
      outcome.chainEvent = chainEvent;
      save();
      return outcome;
    } catch (e) { console.error('[combat] evento encadeado falhou', e); }
  }
  save();
  flow.combatEnded(outcome);
  return outcome;
}

/** Resumo para a tela de resultado (antes de finishCombat). */
export function resultSummary(G) {
  const c = G.combat;
  if (!c) return null;
  return {
    result: c.result, killed: c.killed.filter((k) => !k.summoned).map((k) => k.name), stats: { ...c.stats },
    surrendered: surrendered(G).map((a) => ({ uid: a.uid, name: a.name })), boss: c.context.boss,
  };
}

export { heroCollapse };
