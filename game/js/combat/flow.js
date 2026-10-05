// Fluxo do combate: criação, turno do jogador, fase inimiga, ambiente e maré.
import { key, clone, DIRS } from '../core/util.js';
import { makeRng, rnd } from '../core/rng.js';
import { REG } from './registry.js';
import {
  ev, log, getHero, liveEnemies, reachable, pathTo, placeUnit, damage, heroHook, tileAt,
  isDeep, isWater, setTide, tideAt, applyFlood, checkEnd, cleanup, addStatus, spawnEnemy,
  unitAt, hasTag, isFlying, defOf, solidTile, MAX_TIDE,
} from './engine.js';
import { resolveIntent } from './attacks.js';
import { planAll } from './ai.js';

let undoSnap = null; // instantâneo para desfazer movimento (fora do save)

export function createCombat(o) {
  const c = {
    uid: Math.floor(Math.random() * 1e9),
    w: o.w || 7, h: o.h || 8,
    tiles: o.tiles,
    units: [], nextId: 1,
    round: 1, schedule: o.schedule && o.schedule.length ? o.schedule : [0],
    tideMods: [], tide: 0,
    phase: 'player', turn: { moved: false, acted: false },
    obj: o.obj || { type: 'kill' },
    kind: o.kind || 'normal', title: o.title || 'Combate', district: o.district || 0,
    mods: o.mods || {}, knowledge: o.knowledge || {},
    rng: makeRng(o.seed || 12345),
    reward: { xp: 0, pearls: o.basePearls || 0 }, kills: [],
    stats: { dealt: 0, taken: 0, skills: 0, rounds: 0, items: 0 },
    ev: [], log: [], flags: {}, incoming: [],
    forecast: o.forecast || 3,
    fireBonus: 0,
    tutorial: o.tutorial || null,
    loopTide: o.kind === 'boss',
  };
  const hu = o.hero;
  hu.id = c.nextId++;
  hu.x = o.heroPos.x; hu.y = o.heroPos.y;
  c.units.push(hu);
  for (const e of o.enemies || []) spawnEnemy(c, e.def, e.x, e.y, e.extra || {});
  for (const a of o.allies || []) {
    const u = { id: c.nextId++, side: 'ally', def: a.def || 'captive', name: a.name, x: a.x, y: a.y, hp: a.hp, maxHp: a.hp, armor: 0, move: 0, st: {}, tags: a.tags || [], mem: {}, rescue: a.rescue, captive: true };
    c.units.push(u);
  }
  c.ev = [];
  c.tide = tideAt(c, 1);
  applyFlood(c);
  heroHook(c, 'onCombatStart');
  if (REG.enemies && c.obj.onStart) { /* reservado */ }
  for (const u of liveEnemies(c)) { const d = defOf(u); if (d.onCombatStart) d.onCombatStart(c, u); }
  planAll(c);
  startPlayerTurn(c, true);
  log(c, o.intro || 'O combate começa.', 'info');
  c.ev = [];
  return c;
}

// ---------- turno do jogador ----------
export function startPlayerTurn(c, first = false) {
  c.phase = 'player';
  c.turn = { moved: false, acted: false, quick: 0, hurt: false };
  undoSnap = null;
  const h = getHero(c);
  if (!h) return;
  const st = h.st;
  if (st.shield && !h.mods.keepShield) delete st.shield;
  if (st.root) { c.turn.moved = true; st.root--; if (!st.root) delete st.root; log(c, 'Você está preso e não pode se mover neste turno.', 'warn'); }
  if (st.stun) { c.turn.acted = true; delete st.stun; log(c, 'Você está atordoado: sem ação neste turno.', 'warn'); }
  for (const s of ['mark', 'fort', 'oiled', 'bleed']) if (st[s]) { st[s]--; if (st[s] <= 0) delete st[s]; }
  if (st.wet && !isWater(c, h.x, h.y)) { st.wet--; if (st.wet <= 0) delete st.wet; }
  if (st.sub && !isDeep(c, h.x, h.y)) delete st.sub;
  if (!first) {
    const deep = isDeep(c, h.x, h.y) && !hasTag(h, 'swimmer') && !h.mods.noDrain;
    if (!deep) h.fol = Math.min(h.folMax, h.fol + 1 + (h.mods.folRegen || 0));
  }
  for (const sk of h.skills) if (sk.cd > 0) sk.cd--;
  if (h.mods.waterMove && isWater(c, h.x, h.y)) c.turn.bonusMove = h.mods.waterMove;
  heroHook(c, first ? 'onFirstTurn' : 'onTurnStart');
  ev(c, { t: 'phase', p: 'player' });
}

export function heroMoveRange(c, h) {
  return Math.max(0, h.move + (c.turn.bonusMove || 0));
}

export function heroReach(c) {
  const h = getHero(c);
  if (!h || c.phase !== 'player' || c.turn.moved) return new Map();
  return reachable(c, h, heroMoveRange(c, h));
}

export function heroMove(c, x, y) {
  const h = getHero(c);
  if (!h || c.phase !== 'player' || c.turn.moved) return false;
  const reach = heroReach(c);
  const node = reach.get(key(x, y));
  if (!node || (x === h.x && y === h.y)) return false;
  const evBefore = c.ev; c.ev = [];
  undoSnap = { uid: c.uid, data: JSON.stringify(c) };
  c.ev = evBefore;
  const path = pathTo(node);
  ev(c, { t: 'move', id: h.id, path });
  for (let i = 1; i < path.length; i++) {
    const stop = placeUnit(c, h, path[i].x, path[i].y, 'walk');
    if (h.hp <= 0 || stop) break;
  }
  if (h.st.bleed && h.hp > 0) damage(c, h, 1, { el: 'pure' });
  if (h.st.sub && !isDeep(c, h.x, h.y)) delete h.st.sub;
  c.turn.moved = true;
  heroHook(c, 'onMove', path);
  cleanup(c);
  checkEnd(c);
  if (c.turn.acted) undoSnap = null;
  return true;
}

export function canUndo(c) {
  return !!(undoSnap && undoSnap.uid === c.uid && c.phase === 'player' && c.turn.moved && !c.turn.acted);
}

// Restaura o estado anterior ao movimento. Retorna o novo objeto de combate.
export function undoMove(c) {
  if (!canUndo(c)) return c;
  const restored = JSON.parse(undoSnap.data);
  restored.ev = [{ t: 'undo' }];
  undoSnap = null;
  return restored;
}

// ---------- habilidades ----------
export function skillLevel(h, sid) {
  const s = h.skills.find((k) => k.id === sid);
  return s ? s.lv : 1;
}

export function isQuick(def, lv) {
  return typeof def.quick === 'function' ? !!def.quick(lv) : !!def.quick;
}

export function skillCost(h, def, lv) {
  let cost = typeof def.cost === 'function' ? def.cost(lv, h) : (def.cost || 0);
  if (h.mods.freeFirstSkill && !h.cs.freeUsed && cost > 0) cost = 0;
  return cost;
}

export function canUseSkill(c, sid) {
  const h = getHero(c);
  const def = REG.skills[sid];
  if (!h || !def) return { ok: false, why: 'Indisponível' };
  if (c.phase !== 'player') return { ok: false, why: 'Aguarde seu turno' };
  const inst = h.skills.find((k) => k.id === sid);
  const lv = inst ? inst.lv : 1;
  if (!isQuick(def, lv) && c.turn.acted) return { ok: false, why: 'Ação já usada neste turno' };
  if (inst && inst.cd > 0) return { ok: false, why: `Recarga: ${inst.cd} turno(s)` };
  const cost = skillCost(h, def, lv);
  if (h.fol < cost) return { ok: false, why: `Fôlego insuficiente (${cost})` };
  if (def.kind === 'passive' || def.kind === 'hidden') return { ok: false, why: 'Passiva' };
  if (def.available) {
    const r = def.available(c, h, lv);
    if (r !== true) return { ok: false, why: r || 'Indisponível agora' };
  }
  const tg = def.targets(c, h, lv);
  if (!tg.length) return { ok: false, why: 'Sem alvos válidos' };
  return { ok: true, targets: tg, cost, lv };
}

export function useSkill(c, sid, x, y) {
  const chk = canUseSkill(c, sid);
  if (!chk.ok) return false;
  if (!chk.targets.some((t) => t.x === x && t.y === y)) return false;
  const h = getHero(c);
  const def = REG.skills[sid];
  const inst = h.skills.find((k) => k.id === sid);
  h.fol -= chk.cost;
  if (h.mods.freeFirstSkill && chk.cost === 0 && (typeof def.cost === 'function' ? def.cost(chk.lv, h) : def.cost) > 0) h.cs.freeUsed = true;
  if (inst && def.cd) inst.cd = typeof def.cd === 'function' ? def.cd(chk.lv) : def.cd;
  const quick = isQuick(def, chk.lv);
  if (!quick) { c.turn.acted = true; undoSnap = null; }
  ev(c, { t: 'skill', id: h.id, name: def.name, sid });
  const wasSub = h.st.sub;
  def.apply(c, h, x, y, chk.lv);
  if (wasSub && !def.keepSub && !quick && h.st.sub) { delete h.st.sub; ev(c, { t: 'status', id: h.id, s: 'sub', n: 0 }); }
  if (def.attack && h.cs.pressure && !def.keepPressure) h.cs.pressure = 0;
  c.stats.skills++;
  heroHook(c, 'onSkill', def, x, y);
  cleanup(c);
  checkEnd(c);
  return true;
}

// ---------- itens ----------
export function canUseItem(c, idx) {
  const h = getHero(c);
  const id = h && h.items[idx];
  const def = id && REG.items[id];
  if (!def) return { ok: false, why: 'Sem item' };
  if (c.phase !== 'player') return { ok: false, why: 'Aguarde seu turno' };
  if (!def.quick && c.turn.acted) return { ok: false, why: 'Ação já usada' };
  if (!def.targets) return { ok: false, why: 'Só fora de combate' };
  const tg = def.targets(c, h);
  if (!tg.length) return { ok: false, why: 'Sem alvos válidos' };
  return { ok: true, targets: tg };
}

export function useItem(c, idx, x, y) {
  const chk = canUseItem(c, idx);
  if (!chk.ok || !chk.targets.some((t) => t.x === x && t.y === y)) return false;
  const h = getHero(c);
  const def = REG.items[h.items[idx]];
  h.items.splice(idx, 1);
  if (!def.quick) { c.turn.acted = true; undoSnap = null; }
  ev(c, { t: 'item', name: def.name });
  def.apply(c, h, x, y);
  c.stats.items++;
  heroHook(c, 'onItem', def);
  cleanup(c);
  checkEnd(c);
  return true;
}

export function defend(c) {
  const h = getHero(c);
  if (!h || c.phase !== 'player' || c.turn.acted) return false;
  c.turn.acted = true;
  undoSnap = null;
  const n = 1 + (h.mods.defendBonus || 0);
  addStatus(c, h, 'shield', n);
  if (h.mods.defendHeal) { h.hp = Math.min(h.maxHp, h.hp + h.mods.defendHeal); ev(c, { t: 'heal', id: h.id, n: h.mods.defendHeal, x: h.x, y: h.y }); }
  log(c, `Você se protege (+${n} Escudo).`);
  heroHook(c, 'onDefend');
  return true;
}

// ---------- fim do turno / fase inimiga ----------
export function endTurn(c) {
  if (c.phase !== 'player') return;
  const h = getHero(c);
  undoSnap = null;
  heroHook(c, 'onTurnEnd');
  cleanup(c); checkEnd(c);
  if (c.phase === 'win' || c.phase === 'lose') return;
  c.phase = 'enemy';
  ev(c, { t: 'phase', p: 'enemy' });
  const acting = liveEnemies(c).filter((u) => u.intent).sort((a, b) => a.intent.order - b.intent.order);
  for (const u of acting) {
    if (u.hp <= 0 || !u.intent) continue;
    resolveIntent(c, u);
    checkEnd(c);
    if (c.phase === 'win' || c.phase === 'lose') { cleanup(c); return; }
  }
  cleanup(c);
  endRound(c);
  cleanup(c);
  checkEnd(c);
  if (c.phase === 'win' || c.phase === 'lose') return;
  // avança a rodada e a maré
  c.tideMods = c.tideMods.map((m) => ({ ...m, r: m.r - 1 })).filter((m) => m.r > 0);
  c.round++;
  c.stats.rounds++;
  setTide(c, tideAt(c, c.round));
  cleanup(c);
  checkEnd(c);
  if (c.phase === 'win' || c.phase === 'lose') return;
  if (c.obj.type === 'survive' && c.round > c.obj.rounds) {
    c.phase = 'enemy';
    checkWinSurvive(c);
    return;
  }
  reinforcements(c);
  for (const u of liveEnemies(c)) { const d = defOf(u); if (d.onRoundStart) d.onRoundStart(c, u); }
  cleanup(c);
  checkEnd(c);
  if (c.phase === 'win' || c.phase === 'lose') return;
  planAll(c);
  cleanup(c);
  checkEnd(c);
  if (c.phase === 'win' || c.phase === 'lose') return;
  startPlayerTurn(c);
}

function checkWinSurvive(c) {
  // vitória por sobrevivência
  c.phase = 'win';
  c.winMsg = 'Você resistiu até a maré virar!';
  for (const u of c.units) if (u.side === 'enemy' && u.hp > 0) { u.hp = 0; u.dead = true; ev(c, { t: 'death', id: u.id, x: u.x, y: u.y, flee: true }); }
  log(c, c.winMsg, 'good');
  ev(c, { t: 'sfx', k: 'win' });
}

function endRound(c) {
  // dano contínuo
  for (const u of c.units.slice()) {
    if (u.hp <= 0) continue;
    if (u.st.burn) {
      damage(c, u, 1, { el: 'pure', how: 'burn' });
      if (u.hp > 0) { u.st.burn--; if (u.st.burn <= 0) delete u.st.burn; }
      else c.kills.length && (c.kills[c.kills.length - 1].how = 'fire');
    }
    if (u.hp > 0 && u.st.poison) {
      damage(c, u, 1, { el: 'pure', how: 'poison' });
      if (u.hp > 0) { u.st.poison--; if (u.st.poison <= 0) delete u.st.poison; }
    }
  }
  // fogo nos quadrados
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const t = tileAt(c, x, y);
    if (t.fire > 0) {
      const u = unitAt(c, x, y);
      if (u && !isFlying(u) && !u.st.burn) damage(c, u, 1, { el: 'fire', area: true, how: 'fire' });
      t.fire--;
      if (t.fire <= 0) { t.fire = 0; t.oil = false; }
    }
    if (t.tmd > 0) { t.tmd--; if (t.tmd <= 0) { t.tm = 0; t.tmd = 0; } }
    if (t.ink > 0) t.ink--;
  }
  // afogamento
  for (const u of c.units.slice()) {
    if (u.hp <= 0 || isFlying(u)) continue;
    if (!isDeep(c, u.x, u.y)) continue;
    if (u.side === 'player') {
      if (hasTag(u, 'swimmer') || u.mods.noDrain) continue;
      if (u.fol > 0) { u.fol--; ev(c, { t: 'text', x: u.x, y: u.y, s: '-1 Fôlego', col: '#7fd' }); }
      else { log(c, 'Sem fôlego, você se afoga!', 'bad'); damage(c, u, 1, { el: 'pure', how: 'drown' }); }
    } else if (u.side === 'enemy' && !hasTag(u, 'aquatic') && !hasTag(u, 'drowned') && !hasTag(u, 'boss')) {
      ev(c, { t: 'text', x: u.x, y: u.y, s: 'Afogando', col: '#7fd' });
      damage(c, u, 1, { el: 'pure', how: 'drown' });
    }
  }
  heroHook(c, 'onRoundEnd');
  for (const u of liveEnemies(c)) { const d = defOf(u); if (d.onRoundEnd) d.onRoundEnd(c, u); }
  applyFlood(c);
}

// Reforços anunciados com uma rodada de antecedência (quadrados marcados).
function reinforcements(c) {
  if (c.incoming.length) {
    for (const s of c.incoming) {
      const occ = unitAt(c, s.x, s.y);
      if (occ) {
        damage(c, occ, 1, { el: 'impact' });
        ev(c, { t: 'text', x: s.x, y: s.y, s: 'Reforço bloqueado', col: '#ccc' });
        continue;
      }
      const t = tileAt(c, s.x, s.y);
      if (!t || solidTile(t) || t.t === 'pit') continue;
      spawnEnemy(c, s.def, s.x, s.y);
    }
    c.incoming = [];
  }
  const waves = c.obj.waves || [];
  let w = waves.find((q) => q.round === c.round + 1);
  // depois das ondas definidas, a maré continua trazendo criaturas a cada 3 rodadas
  if (!w && c.obj.wavePool && waves.length) {
    const last = Math.max(...waves.map((q) => q.round));
    const r = c.round + 1;
    if (r > last && (r - last) % 3 === 0) {
      const n = Math.min(4, 2 + Math.floor((r - last) / 6));
      const defs = [];
      for (let i = 0; i < n; i++) defs.push(c.obj.wavePool[Math.floor(rnd(c.rng) * c.obj.wavePool.length)]);
      w = { round: r, defs };
    }
  }
  if (w) {
    const spots = edgeSpots(c, w.defs.length, w.edge || 'top');
    c.incoming = spots.map((p, i) => ({ x: p.x, y: p.y, def: w.defs[i] }));
    if (c.incoming.length) log(c, 'Reforços se aproximam! (quadrados marcados)', 'warn');
  }
}

function edgeSpots(c, n, edge) {
  const cand = [];
  for (let x = 0; x < c.w; x++) {
    const ys = edge === 'bottom' ? [c.h - 1] : edge === 'sides' ? [] : [0, 1];
    for (const y of ys) cand.push({ x, y });
  }
  if (edge === 'sides') for (let y = 0; y < c.h; y++) { cand.push({ x: 0, y }); cand.push({ x: c.w - 1, y }); }
  const free = cand.filter((p) => { const t = tileAt(c, p.x, p.y); return t && !solidTile(t) && t.t !== 'pit' && !unitAt(c, p.x, p.y); });
  const out = [];
  while (out.length < n && free.length) {
    const i = Math.floor(rnd(c.rng) * free.length);
    out.push(free.splice(i, 1)[0]);
  }
  return out;
}

// ---------- prévia ----------
// Executa fn numa cópia do combate e devolve as diferenças, sem alterar o original.
export function preview(c, fn) {
  const save = undoSnap;
  const copy = JSON.parse(JSON.stringify({ ...c, ev: [] }));
  copy.preview = true;
  try { fn(copy); } catch (e) { console.warn('preview', e); }
  undoSnap = save;
  const diff = { units: [], tiles: [], tide: copy.tide !== c.tide ? copy.tide : null };
  for (const u of c.units) {
    if (u.hp <= 0) continue;
    const v = copy.units.find((w) => w.id === u.id);
    const dead = !v || v.hp <= 0;
    const hpAfter = v ? Math.max(0, v.hp) : 0;
    const moved = v && (v.x !== u.x || v.y !== u.y);
    const stNew = v ? Object.keys(v.st).filter((s) => !u.st[s]) : [];
    if (dead || hpAfter !== u.hp || moved || stNew.length) {
      diff.units.push({ id: u.id, x: u.x, y: u.y, nx: v ? v.x : u.x, ny: v ? v.y : u.y, dmg: u.hp - hpAfter, dead, st: stNew, side: u.side });
    }
  }
  for (const v of copy.units) if (v.hp > 0 && !c.units.some((u) => u.id === v.id)) diff.units.push({ id: v.id, spawn: true, nx: v.x, ny: v.y, side: v.side });
  diff.objs = [];
  for (let i = 0; i < c.tiles.length; i++) {
    const a = c.tiles[i], b = copy.tiles[i];
    if (a.obj && (!b.obj || b.obj.hp < a.obj.hp)) diff.objs.push({ x: i % c.w, y: Math.floor(i / c.w), k: a.obj.k, dmg: b.obj ? a.obj.hp - b.obj.hp : a.obj.hp, broken: !b.obj });
    if ((a.fire > 0) !== (b.fire > 0) || !!a.oil !== !!b.oil || a.t !== b.t || a.e !== b.e) diff.tiles.push({ x: i % c.w, y: Math.floor(i / c.w), fire: b.fire > 0, oil: !!b.oil, t: b.t });
  }
  diff.win = copy.phase === 'win';
  diff.lose = copy.phase === 'lose';
  return diff;
}

export function forecastList(c, n) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(tideAt(c, c.round + k));
  return out;
}

export { MAX_TIDE };
