// ICOR — Agregador de inimigos (Área B).
// Para adicionar uma região (Onda 2): crie data/enemies/r2.js exportando R2_ENEMIES no mesmo formato
// e acrescente-o em SOURCES abaixo. Ids canônicos ainda não implementados caem num substituto do mesmo tier.
import { R1_ENEMIES } from './enemies/r1.js';
import { HUMAN_ENEMIES } from './enemies/humans.js';
import { BOSSES } from './enemies/bosses.js';
import { BOSSES2 } from './enemies/bosses2.js';
import { R2_ENEMIES } from './enemies/r2.js';
import { R3_ENEMIES } from './enemies/r3.js';
import { R4_ENEMIES } from './enemies/r4.js';
import { R5_ENEMIES } from './enemies/r5.js';

const SOURCES = [R1_ENEMIES, R2_ENEMIES, R3_ENEMIES, R4_ENEMIES, R5_ENEMIES, HUMAN_ENEMIES, BOSSES, BOSSES2];

export const ENEMIES = Object.assign({}, ...SOURCES);

/** Tier de cada região. */
export const REGION_TIER = { r1: 1, r2: 2, r3: 3, r4: 4, r5: 5 };

/** Todos os ids canônicos do contrato (incluindo os da Onda 2), com tier e papel. */
export const CANONICAL_ENEMIES = {
  // r1
  saqueador: { tier: 1, role: 'comum' }, besteiro: { tier: 1, role: 'atirador' }, cao_chaga: { tier: 1, role: 'fera' },
  lavrador_oco: { tier: 1, role: 'morto' }, corvos: { tier: 1, role: 'enxame' }, ceifeiro: { tier: 1, role: 'elite' }, mae_colheita: { tier: 1, role: 'chefe' },
  // r2
  enforcado: { tier: 2, role: 'morto' }, lobo_tendao: { tier: 2, role: 'fera' }, bruxa_casca: { tier: 2, role: 'atirador' },
  cacador_cabecas: { tier: 2, role: 'comum' }, tecela: { tier: 2, role: 'fera' }, cervo_podre: { tier: 2, role: 'elite' }, rei_galhado: { tier: 2, role: 'chefe' },
  // r3
  esqueleto_placas: { tier: 3, role: 'comum' }, carnical: { tier: 3, role: 'fera' }, sacerdote_renegado: { tier: 3, role: 'atirador' },
  verme_ossos: { tier: 3, role: 'fera' }, costurado: { tier: 3, role: 'morto' }, guardiao_sal: { tier: 3, role: 'elite' }, bispo_costurado: { tier: 3, role: 'chefe' },
  // r4
  afogado: { tier: 4, role: 'morto' }, pescador: { tier: 4, role: 'comum' }, sereia_carcaca: { tier: 4, role: 'atirador' },
  caranguejo_ossario: { tier: 4, role: 'fera' }, enguia_icor: { tier: 4, role: 'fera' }, cavaleiro_mare: { tier: 4, role: 'elite' }, voz_submersa: { tier: 4, role: 'chefe' },
  // r5
  anticorpo: { tier: 5, role: 'fera' }, filho_icor: { tier: 5, role: 'morto' }, verme_divino: { tier: 5, role: 'fera' },
  bebedor_ascendido: { tier: 5, role: 'comum' }, anjo_carne: { tier: 5, role: 'elite' }, coracao: { tier: 5, role: 'chefe' },
  // genéricos
  desertor: { tier: 1, role: 'comum' }, zelote: { tier: 1, role: 'comum' }, bebedor: { tier: 1, role: 'comum' }, cacador_bruxas: { tier: 1, role: 'atirador' },
  carniceiro_rival: { tier: 1, role: 'comum' }, aberracao: { tier: 1, role: 'elite' }, horda_oco: { tier: 1, role: 'enxame' },
};

/** Substitutos por papel (quando o id canônico ainda não existe). */
const FALLBACK_BY_ROLE = {
  comum: 'saqueador', atirador: 'besteiro', fera: 'cao_chaga', morto: 'lavrador_oco', enxame: 'corvos', elite: 'ceifeiro', chefe: 'mae_colheita',
};

/**
 * Resolve um id de inimigo: devolve { id, def, level, warned } — id real implementado e nível de escala extra.
 * Nunca lança: ids desconhecidos viram 'saqueador'.
 */
export function resolveEnemyId(id) {
  if (ENEMIES[id]) return { id, def: ENEMIES[id], level: 0, substituted: false };
  const canon = CANONICAL_ENEMIES[id];
  const role = canon?.role || 'comum';
  const sub = FALLBACK_BY_ROLE[role] || 'saqueador';
  const def = ENEMIES[sub];
  const level = Math.max(0, (canon?.tier || 1) - (def.tier || 1));
  return { id: sub, def, level, substituted: true, original: id };
}

export function enemyDef(id) { return ENEMIES[id] || resolveEnemyId(id).def; }
