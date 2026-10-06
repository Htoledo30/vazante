// Cola entre sistemas: quem termina algo (combate, evento, saque, morte) chama flow.*,
// e o sistema dono do contexto registra um gancho (setHook) para decidir o que acontece depois.
// Isso evita importações circulares e mantém cada sistema dono da sua navegação.
//
// Ganchos conhecidos (nome -> quem registra):
//   'combatEnd:<source>'  (G, outcome)      source = G.combat.context.source: 'expedition'|'siege'|'event'|'city'|'arena'
//   'eventEnd:<source>'   (G, info)         source = G.event.ctx.source: 'expedition'|'city'|'camp'|'daily'|'siege'
//   'lootDone:<source>'   (G)               source = G.pendingLoot.source
//   'heroDeath'           (G, cause)        sistema de linhagem (city/lineage)
//   'heroCreated'         (G)               sistema de campanha (city/story)
//   'campaignEnd'         (G, type)         sistema de campanha
import { getG } from '../core/state.js';
import { save } from '../core/save.js';

const hooks = new Map();

export function setHook(name, fn) { hooks.set(name, fn); }

function call(name, ...args) {
  const fn = hooks.get(name);
  if (!fn) { console.warn('[flow] gancho ausente:', name); return false; }
  fn(getG(), ...args);
  return true;
}

/** Combate terminou. outcome = { result:'win'|'lose'|'fled'|'surrender', ... } */
export function combatEnded(outcome) {
  const G = getG();
  const src = G?.combat?.context?.source || outcome?.source || 'expedition';
  if (!call(`combatEnd:${src}`, outcome)) call('combatEnd:expedition', outcome);
  save();
}

/** Evento narrativo terminou. */
export function eventEnded(info) {
  const G = getG();
  const src = info?.source || G?.event?.ctx?.source || 'expedition';
  if (!call(`eventEnd:${src}`, info)) call('eventEnd:expedition', info);
  save();
}

/** Jogador terminou a tela de saque. */
export function lootDone() {
  const G = getG();
  const src = G?.pendingLoot?.source || 'expedition';
  if (!call(`lootDone:${src}`)) call('lootDone:expedition');
  save();
}

/** Herói morreu (combate, evento, fome, corrupção...). cause: texto curto. */
export function heroDied(cause, info = {}) {
  call('heroDeath', cause, info);
  save();
}

export function heroCreated() { call('heroCreated'); save(); }

export function campaignEnded(type, info = {}) { call('campaignEnd', type, info); save(); }
