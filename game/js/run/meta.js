// Perfil persistente (progressão entre expedições).
import { REG } from '../combat/registry.js';
import { VILLAGERS } from '../data/story.js';

export const META_VERSION = 1;

export function newMeta(name = 'Iara') {
  return {
    v: META_VERSION, name, created: Date.now(),
    runs: 0, deaths: 0, extracts: 0, conchas: 0, totalConchas: 0,
    upgrades: {}, bosses: [], rescued: [], bestiary: {},
    memoryIds: [], memoriesFound: 0, memoriesGiven: 0,
    hasConcha: false, endings: [], heatUnlocked: 0, heatBest: 0,
    seenStory: [], hints: {}, tutorialDone: false, introDone: false,
    lastRun: null, bestDistrict: 0, totalKills: 0,
    lastClass: 'arpoadora', lastWeapon: {},
  };
}

export function migrateMeta(m) {
  const base = newMeta(m.name);
  for (const k of Object.keys(base)) if (m[k] === undefined) m[k] = base[k];
  m.memoriesFound = m.memoryIds.length;
  return m;
}

export function classUnlocked(meta, cls) {
  if (cls === 'arpoadora') return true;
  if (cls === 'faroleiro') return !!meta.upgrades.light_relight;
  if (cls === 'mergulhadora') return meta.rescued.includes('tiao');
  if (cls === 'cantora') return meta.bosses.filter((b) => ['carranca', 'gardener', 'sineiro'].includes(b)).length >= 2;
  return false;
}

export function weaponUnlocked(meta, wid) {
  const w = REG.weapons[wid];
  if (!w.forge) return true;
  if (w.forge === 1) return !!meta.upgrades.forge_w1;
  return !!meta.upgrades.forge_w2;
}

export function studyThreshold(meta) { return meta.upgrades.arch_study ? 3 : 6; }

export function knowledgeMap(meta) {
  const out = {};
  const th = studyThreshold(meta);
  for (const [id, n] of Object.entries(meta.bestiary)) out[id] = n >= th ? 2 : n >= 1 ? 1 : 0;
  return out;
}

export function metaBonus(meta, heat = 0) {
  const b = {};
  const hp = (meta.upgrades.forge_hp1 ? 3 : 0) + (meta.upgrades.forge_hp2 ? 3 : 0) - (heat >= 9 ? 3 : 0);
  if (hp) b.hp = hp;
  if (meta.upgrades.light_lens) b.forecast = 1;
  if (meta.upgrades.apoth_elixir) b.revive = 1;
  return b;
}

export function startingAttrs(meta, cls) {
  const a = { ...REG.classes[cls].attrs };
  if (meta.upgrades.train_vig) a.vig++;
  if (meta.upgrades.train_fol) a.fol++;
  if (meta.upgrades.train_imp) a.imp++;
  if (meta.upgrades.train_can) a.can++;
  return a;
}

export function startingItems(meta) {
  const items = [];
  if (meta.upgrades.apoth_tonic) items.push('tonic');
  if (meta.rescued.includes('joaquim')) items.push('fish', 'fish');
  if (meta.rescued.includes('bento')) items.push('handbell');
  return items;
}

export function itemSlotsFor(meta) { return 3 + (meta.upgrades.apoth_belt ? 1 : 0); }

export function recordKills(meta, kills) {
  for (const k of kills) {
    meta.bestiary[k.def] = (meta.bestiary[k.def] || 0) + 1;
    meta.totalKills++;
  }
}

export function villagersFor(meta, district) {
  return Object.entries(VILLAGERS).filter(([id, v]) => v.district === district && !meta.rescued.includes(id)).map(([id, v]) => ({ id, ...v }));
}

export function upgradeAvailable(meta, id, def) {
  if (meta.upgrades[id]) return 'Adquirido';
  if (def.req) { const r = def.req(meta); if (r !== true) return r; }
  return true;
}
