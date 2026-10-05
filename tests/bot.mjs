// Bot de testes (não faz parte do jogo): busca 2 passos (mover+agir / agir+mover)
// avaliando cópias do estado. Serve como "jogador médio" para medir dificuldade e achar erros.
import { REG } from '../game/js/data/index.js';
import { getHero, liveEnemies, isDeep, hasTag } from '../game/js/combat/engine.js';
import { heroReach, heroMove, canUseSkill, useSkill, endTurn, defend, canUseItem, useItem } from '../game/js/combat/flow.js';
import { threatMap } from '../game/js/combat/attacks.js';

const clone = (c) => { const s = JSON.parse(JSON.stringify({ ...c, ev: [] })); return s; };

function skillIds(h) {
  return [...h.basics, ...h.skills.map((s) => s.id), 'free_captive', 'ending_concha', 'ending_versos'];
}

function evaluate(base, s) {
  if (s.phase === 'win') return 1000;
  const h = getHero(s);
  if (!h) return -1000;
  let sc = 0;
  const hb = getHero(base);
  sc -= (hb.hp - h.hp) * 5;
  for (const u of base.units) {
    if (u.side !== 'enemy' || u.hp <= 0) continue;
    const v = s.units.find((w) => w.id === u.id);
    const boss = hasTag(u, 'boss');
    if (!v || v.hp <= 0) sc += boss ? 60 : 14;
    else sc += (u.hp - v.hp) * (boss ? 4 : 3) + (v.st.stun && !u.st.stun && u.intent ? 6 : 0);
  }
  for (let i = 0; i < base.tiles.length; i++) {
    const a = base.tiles[i].obj, b = s.tiles[i].obj;
    if (a && (a.k === 'chain' || (a.k === 'bell' && a.big))) sc += ((a.hp) - (b ? b.hp : 0)) * 3;
  }
  if ((s.obj.rescued || 0) > (base.obj.rescued || 0)) sc += 40;
  const tm = threatMap(s);
  const t = tm.get(h.x + ',' + h.y);
  if (t && t.dmg) sc -= t.dmg * 4.5 * (h.st.sub ? 0 : 1) - (h.st.shield || 0) * 3;
  for (const u of s.units) if (u.captive && u.hp > 0) { const e = tm.get(u.x + ',' + u.y); if (e && e.dmg) sc -= e.dmg * 3; }
  if (isDeep(s, h.x, h.y) && !hasTag(h, 'swimmer') && !h.mods.noDrain) sc -= h.fol > 0 ? 1.5 : 5;
  if (s.tiles[h.y * 7 + h.x].fire) sc -= 3;
  let dmin = 99;
  for (const u of liveEnemies(s)) dmin = Math.min(dmin, Math.abs(u.x - h.x) + Math.abs(u.y - h.y));
  sc -= Math.max(0, dmin - 2) * 0.4;
  sc -= (hb.fol - h.fol) * 0.4;
  return sc;
}

function actions(c) {
  const h = getHero(c);
  const out = [];
  for (const sid of skillIds(h)) {
    const chk = canUseSkill(c, sid);
    if (!chk.ok) continue;
    for (const t of chk.targets) out.push({ sid, x: t.x, y: t.y });
  }
  return out;
}

export function botTurn(c, rnd = Math.random) {
  const h0 = getHero(c);
  // cura de emergência
  if (h0.hp <= h0.maxHp * 0.4) {
    const i = h0.items.findIndex((id) => REG.items[id].quick && /Cura/.test(REG.items[id].desc));
    if (i >= 0) { const chk = canUseItem(c, i); if (chk.ok) useItem(c, i, h0.x, h0.y); }
  }
  let best = { sc: -Infinity, plan: null };
  const consider = (plan) => {
    const s = clone(c);
    try {
      for (const st of plan) {
        if (st.m) { if (!heroMove(s, st.x, st.y)) return; }
        else if (st.d) { if (!defend(s)) return; }
        else if (!useSkill(s, st.sid, st.x, st.y)) return;
      }
    } catch (e) { return; }
    const sc = evaluate(c, s) + rnd() * 0.3;
    if (sc > best.sc) best = { sc, plan };
  };
  const reach = [...heroReach(c).values()];
  const acts = actions(c);
  consider([]);
  consider([{ d: 1 }]);
  for (const a of acts) consider([a]);
  for (const n of reach) {
    if (n.cost === 0) continue;
    consider([{ m: 1, x: n.x, y: n.y }]);
    consider([{ m: 1, x: n.x, y: n.y }, { d: 1 }]);
    const s = clone(c);
    if (!heroMove(s, n.x, n.y)) continue;
    for (const a of actions(s)) consider([{ m: 1, x: n.x, y: n.y }, a]);
  }
  // agir e depois mover (só para as melhores ações)
  for (const a of acts) {
    const s = clone(c);
    if (!useSkill(s, a.sid, a.x, a.y) || s.phase !== 'player') continue;
    for (const n of heroReach(s).values()) if (n.cost > 0) consider([a, { m: 1, x: n.x, y: n.y }]);
  }
  for (const st of best.plan || []) {
    if (c.phase !== 'player') break;
    if (st.m) heroMove(c, st.x, st.y);
    else if (st.d) defend(c);
    else useSkill(c, st.sid, st.x, st.y);
  }
  if (c.phase === 'player') endTurn(c);
}

export function playCombat(c, maxRounds = 40, rnd = Math.random) {
  let guard = 0;
  while (c.phase === 'player' && guard++ < maxRounds) {
    botTurn(c, rnd);
    c.ev = [];
  }
  return c.phase;
}
