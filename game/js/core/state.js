// Estado global da campanha (G). Tudo aqui é JSON puro e vai para o save.
// Regra: nada de funções, classes, Map/Set ou referências cíclicas dentro de G.
let G = null;

export const SAVE_VERSION = 1;

export function getG() { return G; }
export function setG(g) { G = g; return G; }

/**
 * Cria uma campanha nova (sem herói — o herói é criado na tela de criação/linhagem).
 * Os sistemas acrescentam/consultam campos, mas a FORMA abaixo é o contrato.
 */
export function newCampaign({ seed, houseName = 'Vharn' } = {}) {
  const s = (seed ?? (Date.now() ^ (Math.random() * 1e9))) >>> 0;
  G = {
    v: SAVE_VERSION,
    seed: s,            // seed fixa da campanha (layout de mapas etc.)
    rng: s ^ 0x9e3779b9, // estado do RNG global (muda a cada rolagem)
    uidSeq: 0,
    createdAt: Date.now(),

    // ----- tempo e apocalipse -----
    time: 8,            // horas absolutas desde o início (dia 1, 08h)
    chaga: 10,          // 0..100 — 100 = Valdrem cai
    chagaLog: [],       // [{day, delta, why}]

    // ----- campanha / história -----
    campaign: {
      ended: null,      // null | { type: 'fall'|'ending_<id>', day, text }
      act: 1,
      flags: {},        // flags narrativas livres: { chave: valor }
      counters: {},     // contadores livres: kills por tipo, etc.
      bosses: {},       // { r1: true, ... } chefes derrotados
      fragments: {},    // { olho: 'held'|'sutura'|'coroa'|'guilda'|'bebedores'|null }
      sieges: {},       // { 30: 'won'|'lost', 60: ..., 90: ... }
      journal: [],      // [{day, text}] diário (eventos importantes)
    },

    // ----- cidade -----
    city: {
      defense: 20,      // 0..100 força da Muralha
      lostDistricts: [],// ids de serviços perdidos em cercos
      unlocked: {},     // { bebedores: true, ... }
      stock: {},        // estoque das lojas por serviço { ferreiro: [itemInst...] }
      stockDay: 0,      // dia do último reabastecimento
      contracts: [],    // contratos ativos/disponíveis
      lastDailyEventDay: 0,
      morale: 50,
    },

    // ----- facções -----
    factions: { sutura: 0, coroa: 0, guilda: 0, bebedores: 0 },
    factionQuests: {},  // { sutura: { step: 0, state: 'available'|'active'|'done'|'failed' }, ... }

    // ----- linhagem -----
    lineage: {
      house: houseName,
      generation: 1,
      dead: [],         // [{ name, gen, bg, level, cause, day, region, nodeId, corrupted, items:[inst], recovered:false }]
      heirloom: null,   // instância de item herdada
      upgrades: {},     // melhorias da casa { bau: 1, ... }
      stash: [],        // baú da casa (instâncias de item)
      heirs: null,      // candidatos a herdeiro quando o herói morre
    },

    hero: null,         // ver ARCHITECTURE.md (systems/character.js cria)

    // ----- mundo -----
    world: {
      regions: {},      // { r1: { unlocked, map:{nodes, edges}, discovered:[], visitedEver:[], nests:{}, ... } }
      bestiary: {},     // { enemyId: { kills, seen } }
    },

    expedition: null,   // estado da expedição em andamento (systems/expedition.js)
    combat: null,       // estado do combate em andamento (systems/combat) — JSON puro, salvo a cada ação
    event: null,        // evento narrativo em andamento { id, stage, ctx }

    log: [],            // registro curto recente [{t, text, kind}] (limitado)
  };
  return G;
}
