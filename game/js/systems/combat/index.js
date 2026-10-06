// API pública do combate (Área B). Ver docs/ARCHITECTURE.md.
export { startCombat, act, finishCombat, isOver, timeline, resolveSurrender, resultSummary, drainEvents, advance } from './engine.js';
export { heroActions, targetsFor, previewHit, fleeChance, heroTechniques, techDef } from './hero.js';
export { intentText, chooseIntent } from './ai.js';
export {
  heroActor, allyActor, foes, surrendered, edef, hasStatus, getStatus, partBroken, swarmAlive, DIST_NAMES, DIST_SHORT, HERO_PART_NAMES, DTYPE_NAMES,
} from './core.js';
