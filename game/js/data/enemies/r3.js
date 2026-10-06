// ICOR — Inimigos da Região 3: Catacumbas de Sal (Onda 2).
const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });
const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const R3_ENEMIES = {
  esqueleto_placas: {
    id: 'esqueleto_placas', name: 'Esqueleto de Placas', region: 'r3', tier: 3,
    hp: 46, eva: 0, acc: 10, speed: 90, morale: 0, dread: 5,
    tags: ['morto', 'construto', 'escudo'], weak: ['impacto'], resist: ['corte', 'perf'],
    parts: (() => {
      const p = human(46, { head: A(6, 5, 1), torso: A(8, 7, 2), arms: A(6, 5, 1), legs: A(6, 5, 1), headHp: 18 });
      p.bracoE.name = 'Braço do escudo';
      return p;
    })(),
    intents: [
      { id: 'espada', label: 'Espada enferrujada', icon: '⚔', kind: 'attack', dmg: [10, 16], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random' },
      { id: 'escudo', label: 'Ergue o escudo de sal', icon: '🛡', kind: 'self', w: 2, cd: 2, uses: ['bracoE'], special: 'shieldwall', time: 60 },
      { id: 'golpe_escudo', label: 'Borda do escudo', icon: '⛨', kind: 'attack', dmg: [6, 9], dtype: 'impacto', reach: 0, w: 2, uses: ['bracoE'], part: 'cabeca', status: [{ id: 'atordoado', chance: 25 }] },
      { id: 'estocada_lenta', label: 'Estocada de cavaleiro', icon: '🗡', kind: 'attack', dmg: [15, 22], dtype: 'perf', reach: 1, w: 2, cd: 3, windup: 50, uses: ['bracoD'], part: 'tronco' },
    ],
    ai: 'soldado', surrender: false, flee: false, startDist: [0, 1],
    loot: [['sal', 3, 1, 2], ['@armor:3', 2], ['@weapon:3', 1], ['osso', 3, 1, 3], ['sucata', 2, 1, 2]], lootRolls: 1,
    coin: [2, 12], ichor: [0, 2],
    desc: 'Um cavaleiro que morreu de pé e não sabe. As placas seguram os ossos. Lâmina escorrega; maça entra.',
  },

  carnical: {
    id: 'carnical', name: 'Carniçal', region: 'r3', tier: 3,
    hp: 44, eva: 15, acc: 10, speed: 120, morale: 40, dread: 6,
    tags: ['fera', 'morto'], weak: ['fogo'], resist: [],
    parts: {
      cabeca: { name: 'Bocarra', hp: 16, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Corpo magro', hp: 44, armor: A(1, 1, 1), role: 'torso', vital: true },
      bracoD: { name: 'Garras', hp: 18, armor: A(), role: 'arm' },
      pernas: { name: 'Pernas dobradas', hp: 20, armor: A(), role: 'legs' },
    },
    intents: [
      { id: 'garras', label: 'Garras imundas', icon: '🖐', kind: 'attack', dmg: [9, 14], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 35 }, { id: 'infectado', chance: 20 }] },
      { id: 'mordida_paralisante', label: 'Mordida que entorpece', icon: '🦷', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 0, w: 3, cd: 3, uses: ['cabeca'], part: [['bracoD', 2], ['pernas', 2], ['tronco', 1]], status: [{ id: 'atordoado', chance: 30 }, { id: 'envenenado', chance: 40 }] },
      { id: 'salto', label: 'Salta da parede', icon: '⤴', kind: 'attack', dmg: [8, 12], dtype: 'impacto', reach: 1, w: 3, cd: 2, uses: ['pernas'], when: ['notEngaged'], part: 'tronco', special: 'charge', status: [{ id: 'caido', chance: 30 }] },
      { id: 'banquete', label: 'Devora um cadáver', icon: '🍖', kind: 'special', w: 7, when: ['corpse', 'hpBelow50'], special: 'banquete_carnical', time: 90 },
    ],
    ai: 'matilha', surrender: false, flee: true, startDist: [0, 2],
    loot: [['osso', 3, 1, 3], ['dente', 3, 1, 3], ['carne_podre', 2], ['@trinket:3', 1], ['bile', 1]], lootRolls: 1,
    coin: [0, 6], ichor: [1, 3],
    desc: 'Come os mortos para fechar as próprias feridas. Mate rápido — ou queime os corpos.',
  },

  sacerdote_renegado: {
    id: 'sacerdote_renegado', name: 'Sacerdote Renegado', region: 'r3', tier: 3,
    hp: 38, eva: 5, acc: 10, speed: 100, morale: 45, dread: 5,
    tags: ['humano', 'atirador'], weak: [], resist: [],
    parts: {
      ...human(38, { torso: A(2, 2, 1), headHp: 15 }),
      agulha: { name: 'Agulha de osso', hp: 10, armor: A(0, 0, 2), role: 'special', hitMod: -10, severable: true,
        desc: 'Ele costura os mortos com ela. Quebre e ele só reza.' },
    },
    intents: [
      { id: 'costurar', label: 'Costura um morto de pé', icon: '🧵', kind: 'summon', w: 6, cd: 3, uses: ['agulha'], when: ['corpse'], summon: 'costurado', max: 2, consumeCorpse: true, windup: 40 },
      { id: 'sal', label: 'Sal nas feridas', icon: '✶', kind: 'attack', dmg: [8, 13], dtype: 'fogo', reach: 2, ranged: true, w: 4, part: 'random', status: [{ id: 'cego', chance: 25, turns: 1 }] },
      { id: 'bencao', label: 'Bênção profana', icon: '✝', kind: 'self', w: 3, cd: 3, when: ['allies'], special: 'curar_aliados' },
      { id: 'sermao', label: 'Sermão do fim', icon: '📜', kind: 'self', w: 1, cd: 4, dread: 7, special: 'pregacao' },
      { id: 'turibulo', label: 'Turíbulo de ferro', icon: '🔔', kind: 'attack', dmg: [7, 11], dtype: 'impacto', reach: 0, w: 4, when: ['engaged'], uses: ['bracoD'], part: 'cabeca', status: [{ id: 'atordoado', chance: 20 }] },
      { id: 'recua', label: 'Recua atrás dos mortos', icon: '↩', kind: 'move', move: 1, w: 4, when: ['engaged', 'canMove', 'allies'] },
    ],
    ai: 'atirador', surrender: true, flee: true, startDist: 2,
    loot: [['agua_benta', 2], ['sal_bento', 2], ['vinho_sutura', 1], ['@trinket:3', 2], ['tomo_sangria', 1]], lootRolls: 1,
    coin: [6, 18], ichor: [1, 3],
    desc: 'A Sutura o expulsou por costurar vivos junto com os mortos. Ele achou que era a mesma coisa.',
  },

  verme_ossos: {
    id: 'verme_ossos', name: 'Ninhada de Vermes de Osso', region: 'r3', tier: 3,
    hp: 50, eva: 20, acc: 10, speed: 110, morale: 0, dread: 6,
    tags: ['fera', 'enxame'], weak: ['fogo', 'impacto'], resist: ['perf'],
    parts: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`verme${i}`, { name: 'Verme', hp: 10, armor: A(1, 3, 0), role: 'swarm' }])),
    intents: [
      { id: 'roer', label: 'Roem por dentro da bota', icon: '🪱', kind: 'attack', dmg: [3, 5], dtype: 'perf', reach: 0, w: 5, part: [['pernas', 4], ['tronco', 2], ['bracoD', 1]], hitsPerSwarm: 0.6, maxHits: 3, status: [{ id: 'infectado', chance: 8 }, { id: 'sangrando', chance: 20 }] },
      { id: 'cavar', label: 'Afundam no chão de ossos', icon: '⬇', kind: 'special', w: 2, cd: 3, special: 'cavar', time: 60 },
      { id: 'emergir', label: 'Explodem do chão', icon: '⬆', kind: 'attack', dmg: [6, 10], dtype: 'perf', reach: 2, w: 8, when: ['once'], part: 'pernas', hitsPerSwarm: 0.6, maxHits: 3, status: [{ id: 'caido', chance: 30 }] },
    ],
    ai: 'enxame', surrender: false, flee: false, startDist: [0, 1],
    loot: [['osso', 3, 2, 4], ['@material:3', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [0, 1],
    desc: 'Vermes brancos do tamanho de um braço, com dentes de serra. Uma lâmina corta um; martelo e fogo esmagam vários.',
  },

  costurado: {
    id: 'costurado', name: 'Costurado', region: 'r3', tier: 3,
    hp: 54, eva: 0, acc: 5, speed: 85, morale: 0, dread: 7,
    tags: ['morto'], weak: ['corte', 'fogo'], resist: ['perf', 'impacto'],
    parts: {
      ...human(54, { torso: A(0, 3, 3), headHp: 20, armHp: 26 }),
      fios: { name: 'Fios dourados', hp: 12, armor: A(0, 5, 5), role: 'special', hitMod: -10, severable: true, onBreak: 'fios',
        desc: 'O que segura as partes juntas. Corte e ele desmonta.' },
    },
    intents: [
      { id: 'punho', label: 'Punho de três mãos', icon: '✊', kind: 'attack', dmg: [11, 17], dtype: 'impacto', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'atordoado', chance: 15 }] },
      { id: 'abraco', label: 'Abraço costurado', icon: '🫂', kind: 'attack', dmg: [4, 7], dtype: 'impacto', reach: 0, w: 3, cd: 3, uses: ['bracoE'], part: 'tronco', grab: true, when: ['heroNotGrabbed', 'notGrabbing'] },
      { id: 'esmagar', label: 'Esmaga contra o peito', icon: '💀', kind: 'attack', dmg: [13, 19], dtype: 'impacto', reach: 0, w: 10, when: ['grabbingHero'], part: 'tronco', acc: 25, status: [{ id: 'atordoado', chance: 25 }] },
    ],
    ai: 'oco', surrender: false, flee: false, startDist: [0, 1],
    loot: [['tendao', 3, 1, 3], ['pano', 2], ['osso', 2], ['@material:3', 1]], lootRolls: 1,
    coin: [0, 4], ichor: [1, 2],
    desc: 'Três ou quatro mortos costurados num só, com fio dourado. Anda torto. Bate como uma porta.',
  },

  guardiao_sal: {
    id: 'guardiao_sal', name: 'Guardião de Sal', region: 'r3', tier: 3, elite: true,
    hp: 130, eva: 0, acc: 10, speed: 80, morale: 0, dread: 8,
    tags: ['morto', 'construto', 'elite'], weak: ['impacto'], resist: ['corte', 'perf', 'fogo'],
    parts: {
      cabeca: { name: 'Elmo de sal', hp: 34, armor: A(6, 6, 2, 4), role: 'head', vital: true },
      tronco: { name: 'Corpo de sal', hp: 130, armor: A(7, 7, 2, 6), role: 'torso', vital: true },
      bracoD: { name: 'Braço da espada', hp: 40, armor: A(6, 6, 2, 4), role: 'arm', severable: false },
      bracoE: { name: 'Braço do punho', hp: 40, armor: A(6, 6, 2, 4), role: 'arm2', severable: false },
      pernas: { name: 'Pernas de pedra', hp: 46, armor: A(6, 6, 2, 4), role: 'legs', severable: false },
      nucleo: { name: 'Núcleo de Icor', hp: 20, armor: A(0, 2, 2), role: 'special', hitMod: -15, weakpoint: 2, severable: false,
        desc: 'Brilha dourado no peito rachado. Dano ×2 no corpo inteiro.' },
    },
    intents: [
      { id: 'espada_sal', label: 'Espada de sal', icon: '⚔', kind: 'attack', dmg: [14, 21], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 30 }] },
      { id: 'punho_sal', label: 'Punho de sal', icon: '✊', kind: 'attack', dmg: [12, 18], dtype: 'impacto', reach: 0, w: 3, uses: ['bracoE'], part: 'cabeca', status: [{ id: 'atordoado', chance: 35 }] },
      { id: 'tempestade', label: 'Tempestade de sal', icon: '🌪', kind: 'attack', dmg: [6, 10], dtype: 'corte', reach: 2, w: 2, cd: 3, aoe: 'hero_ally', part: 'cabeca', status: [{ id: 'cego', chance: 60, turns: 2 }] },
      { id: 'cristalizar', label: 'Cristaliza a pele', icon: '💠', kind: 'self', w: 2, cd: 4, special: 'shieldwall', time: 60 },
      { id: 'desabar', label: 'Desaba sobre você', icon: '⬇', kind: 'attack', dmg: [22, 32], dtype: 'impacto', reach: 0, w: 2, cd: 4, windup: 70, part: 'tronco', status: [{ id: 'caido', chance: 70 }] },
    ],
    ai: 'soldado', surrender: false, flee: false, startDist: 1,
    loot: [['sal', 4, 2, 4], ['ambar_icor', 2], ['@weapon:3', 2], ['@armor:3', 2], ['chave_cripta', 1], ['lasca_divina', 1]], lootRolls: 2,
    coin: [10, 30], ichor: [4, 8],
    desc: 'Uma estátua de santo esculpida em sal, com uma espada de verdade. O Icor no peito a mantém andando.',
  },
};
