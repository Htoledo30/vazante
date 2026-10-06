// Modelos de contratos (Quartel e Guilda). systems/contracts.js gera instâncias rastreáveis.
// Dono: Área D.
//
// kind:
//   'hunt'    matar N inimigos de uma lista (Bestiário: kills desde o aceite)
//   'bring'   entregar N de um material
//   'nest'    destruir N ninhos na região
//   'carcass' recuperar a carcaça de um carniceiro (D injeta uma carcaça em G.world.regions[r].carcasses)
//   'escort'  escolta imediata: combates em sequência a partir da cidade (sai pelo Portão, volta em dias)
//   'boss'    matar o chefe da região
// region: 'r1'..'r5' (minBoss: chefes necessários para aparecer)

export const ENEMY_POOLS = {
  r1: { feras: ['cao_chaga', 'corvos'], humanos: ['saqueador', 'besteiro'], ocos: ['lavrador_oco'], elite: ['ceifeiro'] },
  r2: { feras: ['lobo_tendao'], mortos: ['enforcado'], bruxas: ['bruxa_casca', 'tecela'], humanos: ['cacador_cabecas'], elite: ['cervo_podre'] },
  r3: { mortos: ['esqueleto_placas', 'costurado'], carniçais: ['carnical', 'verme_ossos'], humanos: ['sacerdote_renegado'], elite: ['guardiao_sal'] },
  r4: { afogados: ['afogado', 'sereia_carcaca'], feras: ['caranguejo_ossario', 'enguia_icor'], humanos: ['pescador'], elite: ['cavaleiro_mare'] },
  r5: { carne: ['anticorpo', 'verme_divino'], icor: ['filho_icor', 'bebedor_ascendido'], elite: ['anjo_carne'] },
};

export const POOL_NAMES = {
  feras: 'feras', humanos: 'saqueadores', ocos: 'camponeses ocos', elite: 'elites', mortos: 'mortos',
  bruxas: 'bruxas', 'carniçais': 'carniçais', afogados: 'afogados', carne: 'anticorpos', icor: 'filhos do Icor',
};

export const REGION_NAMES = { r1: 'Campos de Cinza', r2: 'Floresta dos Enforcados', r3: 'Catacumbas de Sal', r4: 'Vel-Maren', r5: 'O Cadáver' };

export const CONTRACT_TEMPLATES = [
  // ---------------- Quartel (Coroa)
  { id: 'c_limpeza', giver: 'quartel', kind: 'hunt', w: 3, n: [3, 5], pool: 'any', days: [6, 9],
    title: 'Limpeza de {pool}', desc: 'A Guarda paga por {n} {pool} mortos em {region}. Orelhas como prova.',
    coin: [40, 70], rep: 6 },
  { id: 'c_elite', giver: 'quartel', kind: 'hunt', w: 1, n: [1, 1], pool: 'elite', days: [8, 12], minBoss: 0,
    title: 'Cabeça de elite', desc: 'Algo grande ronda {region}. Traga a cabeça.',
    coin: [90, 130], rep: 10, item: '@weapon:+1' },
  { id: 'c_ninho', giver: 'quartel', kind: 'nest', w: 2, n: [1, 1], days: [7, 10],
    title: 'Queimar o ninho', desc: 'Um ninho da Chaga pulsa em {region}. Queime-o antes que choque.',
    coin: [60, 90], rep: 8, defense: 2 },
  { id: 'c_escolta', giver: 'quartel', kind: 'escort', w: 2, n: [2, 2], days: [2, 3],
    title: 'Escolta de grão', desc: 'Uma carroça de grão até a aldeia de Moenda. Dois dias. A estrada morde.',
    coin: [55, 80], rep: 6, hours: 36, morale: 4 },
  { id: 'c_desertores', giver: 'quartel', kind: 'hunt', w: 2, n: [3, 4], fixed: ['desertor', 'saqueador', 'besteiro'], region: 'r1', days: [5, 8],
    title: 'Enforcar desertores', desc: 'Desertores com cores da Coroa saqueiam {region}. Nenhum volta vivo.',
    coin: [45, 65], rep: 8 },
  // ---------------- Guilda
  { id: 'g_carga', giver: 'guilda', kind: 'bring', w: 3, n: [3, 5], items: ['couro', 'osso', 'tendao', 'sebo', 'bile', 'dente'], days: [6, 10],
    title: 'Encomenda: {item}', desc: 'Um comprador quer {n}× {item}. A Guilda paga adiantado a quem entrega.',
    coin: [35, 60], rep: 5 },
  { id: 'g_raro', giver: 'guilda', kind: 'bring', w: 1, n: [1, 2], items: ['ferro_negro', 'lasca_divina', 'cabelo_bruxa'], days: [8, 12],
    title: 'Encomenda rara: {item}', desc: 'Um ourives de longe paga caro por {n}× {item}.',
    coin: [80, 140], rep: 8 },
  { id: 'g_carcaca', giver: 'guilda', kind: 'carcass', w: 2, n: [1, 1], days: [7, 10],
    title: 'Carcaça de {npc}', desc: '{npc}, da Casa {house}, não voltou de {region}. Traga o que ele carregava. A Guilda fica com metade.',
    coin: [50, 80], rep: 7, ichor: [1, 3] },
  { id: 'g_caca', giver: 'guilda', kind: 'hunt', w: 2, n: [4, 6], pool: 'any', days: [7, 10],
    title: 'Colheita de {pool}', desc: 'Partes de {pool} valem bem no mercado. Mate {n} em {region}.',
    coin: [40, 65], rep: 5, item: '@material:+0' },
  { id: 'g_chefe', giver: 'guilda', kind: 'boss', w: 1, n: [1, 1], days: [14, 20], unbeatenOnly: true,
    title: 'Contrato do chefe', desc: 'A Guilda paga uma fortuna pela morte do que reina em {region}.',
    coin: [200, 260], rep: 12, ichor: [2, 3] },
];

/** Contratos ativos simultâneos e quantidade de ofertas por quadro. */
export const CONTRACT_LIMITS = { active: 3, offers: 3, refreshDays: 3, failRep: -8 };
