// Operações sobre a expedição (herói, itens, pérolas). Usadas por eventos, loja, recompensas.
import { REG } from '../combat/registry.js';
import { heroStats, xpForLevel } from './hero.js';
import { rnd, pick, weighted, sample } from '../core/rng.js';
import { MEMORIES } from '../data/story.js';

export const stats = (run) => heroStats(run.hero, run.metaBonus);
export const maxHp = (run) => stats(run).maxHp;

export function healRun(run, n) {
  const m = maxHp(run);
  const before = run.hero.hp;
  run.hero.hp = Math.min(m, run.hero.hp + n);
  return run.hero.hp - before;
}
export function healPct(run, pct) { return healRun(run, Math.ceil(maxHp(run) * pct / 100)); }

// Dano fora de combate nunca mata: deixa no mínimo 1.
export function hurtRun(run, n) {
  const before = run.hero.hp;
  run.hero.hp = Math.max(1, run.hero.hp - n);
  return before - run.hero.hp;
}

export function addPearls(run, n) { run.pearls = Math.max(0, run.pearls + n); return n; }

export function itemSlots(run) { return run.hero.slots; }
export function canAddItem(run) { return run.hero.items.length < run.hero.slots; }
export function addItem(run, id) {
  if (!canAddItem(run)) return false;
  run.hero.items.push(id);
  return true;
}
export function addRelic(run, id) {
  if (run.hero.relics.includes(id)) return false;
  run.hero.relics.push(id);
  const r = REG.relics[id];
  if (r && r.mods && r.mods.hp) run.hero.hp += r.mods.hp;
  return true;
}
export function equipSuit(run, id) {
  const oldMax = maxHp(run);
  run.hero.suit = id;
  const newMax = maxHp(run);
  if (newMax < oldMax) run.hero.hp = Math.min(run.hero.hp, newMax);
}

export function relicPool(run) {
  return Object.keys(REG.relics).filter((id) => {
    const r = REG.relics[id];
    return !r.story && !run.hero.relics.includes(id);
  });
}
export function rollRelic(run, minRarity = 1) {
  const pool = relicPool(run).filter((id) => (REG.relics[id].rarity || 1) >= minRarity);
  const p = pool.length ? pool : relicPool(run);
  if (!p.length) return null;
  return weighted(run.rng, p.map((id) => ({ id, w: 4 - Math.min(3, REG.relics[id].rarity || 1) }))).id;
}
export function rollRelics(run, n, minRarity = 1) {
  const out = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) { const id = rollRelic(run, minRarity); if (id && !out.includes(id)) out.push(id); }
  return out;
}
export function rollItem(run) {
  const pool = Object.keys(REG.items);
  return weighted(run.rng, pool.map((id) => ({ id, w: 3 - Math.min(2, REG.items[id].rarity || 1) }))).id;
}
export function rollSuit(run) {
  const pool = Object.keys(REG.suits).filter((id) => id !== 'rags' && id !== run.hero.suit);
  return pick(run.rng, pool);
}

export function addXp(run, n) {
  const bonus = stats(run).mods.xpBonus || 0;
  const v = Math.round(n * (1 + bonus / 100));
  run.hero.xp += v;
  return v;
}
export function levelFromXp(xp) {
  let lv = 1;
  while (xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}
export function pendingLevels(run) {
  return Math.max(0, levelFromXp(run.hero.xp) - run.hero.lvl);
}

export function hasSkill(run, id) { return run.hero.skills.some((s) => s.id === id); }
export function activeCount(run) { return run.hero.skills.filter((s) => REG.skills[s.id].kind === 'active').length; }

export function upgradableSkills(run) {
  return run.hero.skills.filter((s) => s.lv < 2 && REG.skills[s.id].up);
}

// Memórias de Aurélia: ficam no perfil (não se perdem ao morrer).
export function findMemory(run, meta) {
  const left = MEMORIES.filter((m) => !meta.memoryIds.includes(m.id));
  if (!left.length) return null;
  const m = left[0];
  meta.memoryIds.push(m.id);
  meta.memoriesFound = meta.memoryIds.length;
  run.stats.memories++;
  return m;
}
export const memoriesLeft = (meta) => MEMORIES.length - meta.memoryIds.length;

export function attrPick(run) {
  return pick(run.rng, ['vig', 'imp', 'fol', 'can']);
}
