// ICOR — Inimigos da Região 4: Vel-Maren, a Cidade Afogada (Onda 2).
const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });
const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const R4_ENEMIES = {
  afogado: {
    id: 'afogado', name: 'Afogado', region: 'r4', tier: 4,
    hp: 60, eva: 0, acc: 10, speed: 80, morale: 0, dread: 6,
    tags: ['morto', 'chaga'], weak: ['corte'], resist: ['impacto', 'fogo'],
    parts: {
      ...human(60, { torso: A(0, 2, 5, 4), headHp: 22 }),
      barriga: { name: 'Barriga inchada', hp: 16, armor: A(), role: 'special', hitMod: 10, severable: false, onBreak: 'barriga',
        desc: 'Cheia de água podre e bile. Estoura em quem estiver perto. Fure de longe.' },
    },
    intents: [
      { id: 'agarrar', label: 'Mãos frias e moles', icon: '✊', kind: 'attack', dmg: [5, 9], dtype: 'impacto', reach: 0, w: 3, cd: 3, uses: ['bracoE'], part: 'tronco', grab: true, when: ['heroNotGrabbed', 'notGrabbing'] },
      { id: 'afogar', label: 'Afunda sua cabeça', icon: '🌊', kind: 'attack', dmg: [14, 20], dtype: 'impacto', reach: 0, w: 10, when: ['grabbingHero'], part: 'cabeca', acc: 25, status: [{ id: 'atordoado', chance: 30 }], dread: 4 },
      { id: 'soco', label: 'Soco encharcado', icon: '👊', kind: 'attack', dmg: [10, 15], dtype: 'impacto', reach: 0, w: 4, uses: ['bracoD'], part: 'random' },
      { id: 'vomito', label: 'Vomita a maré', icon: '🤮', kind: 'attack', dmg: [5, 8], dtype: 'icor', reach: 1, w: 2, cd: 3, part: 'cabeca', status: [{ id: 'cego', chance: 50, turns: 1 }, { id: 'infectado', chance: 20 }] },
      { id: 'inchar', label: 'Incha até estourar', icon: '💥', kind: 'special', w: 3, when: ['hpBelow50'], windup: 60, uses: ['barriga'], special: 'explodir' },
    ],
    ai: 'oco', surrender: false, flee: false, startDist: [0, 1],
    loot: [['bile', 3, 1, 2], ['escama', 2], ['@armor:4', 1], ['@trinket:4', 1], ['pano', 2]], lootRolls: 1,
    coin: [2, 14], ichor: [1, 3],
    desc: 'Inchado como um odre. Quando estufa ainda mais, recue: ele estoura.',
  },

  pescador: {
    id: 'pescador', name: 'Pescador de Homens', region: 'r4', tier: 4,
    hp: 52, eva: 10, acc: 12, speed: 105, morale: 55, dread: 2,
    tags: ['humano'], weak: [], resist: [],
    parts: human(52, { head: A(2, 1, 1), torso: A(4, 3, 3), arms: A(2, 2, 1), legs: A(2, 1, 1) }),
    intents: [
      { id: 'arpao', label: 'Arpão com corda', icon: '🔱', kind: 'attack', dmg: [11, 16], dtype: 'perf', reach: 2, ranged: true, w: 4, cd: 2, uses: ['bracoD'], part: 'tronco', special: 'pull', status: [{ id: 'sangrando', chance: 50 }] },
      { id: 'rede', label: 'Rede de pesca', icon: '🕸', kind: 'attack', dmg: [0, 0], noDamage: true, reach: 2, ranged: true, w: 3, cd: 3, uses: ['bracoE'], part: 'tronco', status: [{ id: 'enredado', chance: 100, turns: 2 }], acc: 10 },
      { id: 'faca', label: 'Faca de escamar', icon: '🔪', kind: 'attack', dmg: [10, 15], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 40, stacks: 2 }] },
      { id: 'escamar', label: 'Escama o preso', icon: '🐟', kind: 'attack', dmg: [16, 22], dtype: 'corte', reach: 0, w: 9, when: ['heroDown'], part: 'tronco', status: [{ id: 'sangrando', chance: 80, stacks: 2 }] },
    ],
    ai: 'bandido', surrender: true, flee: true, startDist: [1, 2],
    loot: [['escama', 3, 1, 2], ['@weapon:4', 2], ['racao', 2], ['arpao_maren', 1]], lootRolls: 1,
    coin: [8, 22], ichor: [1, 2],
    desc: 'Vive das sobras de Vel-Maren e de quem passa por ela. Arpoa, puxa, escama.',
  },

  sereia_carcaca: {
    id: 'sereia_carcaca', name: 'Sereia-Carcaça', region: 'r4', tier: 4,
    hp: 46, eva: 15, acc: 12, speed: 100, morale: 35, dread: 10,
    tags: ['morto', 'atirador'], weak: ['fogo'], resist: ['impacto'],
    parts: {
      cabeca: { name: 'Rosto de mulher', hp: 18, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Costelas de peixe', hp: 46, armor: A(1, 2, 3), role: 'torso', vital: true },
      garganta: { name: 'Garganta', hp: 12, armor: A(), role: 'special', hitMod: -10, severable: true,
        desc: 'De onde sai o canto. Corte e ela só pode morder.' },
      cauda: { name: 'Cauda de ossos', hp: 22, armor: A(1, 1, 1), role: 'legs' },
    },
    intents: [
      { id: 'canto', label: 'Canto', icon: '🎶', kind: 'self', w: 4, cd: 2, uses: ['garganta'], special: 'canto', dread: 9 },
      { id: 'chamado', label: 'Chamado da água', icon: '🌊', kind: 'attack', dmg: [0, 0], noDamage: true, reach: 2, ranged: true, w: 3, cd: 3, uses: ['garganta'], part: 'cabeca', status: [{ id: 'aterrorizado', chance: 60 }, { id: 'enredado', chance: 40, turns: 1 }], dread: 6 },
      { id: 'grito', label: 'Grito afogado', icon: '📢', kind: 'attack', dmg: [9, 14], dtype: 'impacto', reach: 2, ranged: true, w: 3, uses: ['garganta'], part: 'cabeca', status: [{ id: 'atordoado', chance: 20 }] },
      { id: 'mordida', label: 'Mordida de anzol', icon: '🦷', kind: 'attack', dmg: [11, 16], dtype: 'perf', reach: 0, w: 5, when: ['engaged'], part: 'random', status: [{ id: 'sangrando', chance: 50 }] },
      { id: 'mergulho', label: 'Mergulha e some', icon: '↩', kind: 'move', move: 1, w: 4, when: ['engaged', 'canMove'] },
    ],
    ai: 'atirador', surrender: false, flee: true, startDist: 2,
    loot: [['escama', 3, 1, 3], ['cabelo_bruxa', 1], ['@trinket:4', 2], ['ambar_icor', 1]], lootRolls: 1,
    coin: [0, 10], ichor: [2, 4],
    desc: 'Metade mulher, metade peixe, todas as partes mortas. O canto faz você andar para a água. Surdos têm sorte.',
  },

  caranguejo_ossario: {
    id: 'caranguejo_ossario', name: 'Caranguejo-Ossário', region: 'r4', tier: 4,
    hp: 58, eva: 0, acc: 8, speed: 90, morale: 40, dread: 4,
    tags: ['fera'], weak: ['impacto'], resist: ['corte', 'perf'],
    parts: {
      cabeca: { name: 'Olhos em talos', hp: 14, armor: A(1, 1, 1), role: 'head', vital: false, desc: 'Arrancados, ele fica cego.' },
      tronco: { name: 'Carapaça de crânios', hp: 58, armor: A(7, 7, 2, 3), role: 'torso', vital: true },
      bracoD: { name: 'Pinça grande', hp: 30, armor: A(4, 4, 2), role: 'arm' },
      bracoE: { name: 'Pinça pequena', hp: 22, armor: A(3, 3, 1), role: 'arm2' },
      pernas: { name: 'Pernas', hp: 26, armor: A(2, 2, 1), role: 'legs' },
    },
    intents: [
      { id: 'pinca', label: 'Pinça que quebra', icon: '🦀', kind: 'attack', dmg: [13, 19], dtype: 'impacto', reach: 0, w: 4, uses: ['bracoD'], part: [['bracoD', 2], ['bracoE', 2], ['pernas', 2]], status: [{ id: 'caido', chance: 15 }] },
      { id: 'prender', label: 'Prende com a pinça', icon: '✂', kind: 'attack', dmg: [6, 10], dtype: 'impacto', reach: 0, w: 3, cd: 3, uses: ['bracoE'], part: 'bracoD', grab: true, when: ['heroNotGrabbed', 'notGrabbing'] },
      { id: 'cortar', label: 'Fecha a pinça', icon: '🩸', kind: 'attack', dmg: [15, 22], dtype: 'corte', reach: 0, w: 9, uses: ['bracoD'], when: ['grabbingHero'], part: 'bracoD', acc: 25, status: [{ id: 'sangrando', chance: 70, stacks: 2 }] },
      { id: 'casca', label: 'Recolhe na carapaça', icon: '🛡', kind: 'self', w: 2, cd: 3, special: 'shieldwall', time: 60 },
    ],
    ai: 'soldado', surrender: false, flee: true, startDist: [0, 1],
    loot: [['escama', 3, 1, 3], ['osso', 3, 2, 4], ['carapaca_ossario', 1], ['@material:4', 1]], lootRolls: 1,
    coin: [0, 6], ichor: [0, 2],
    desc: 'Usa crânios de afogados como concha. A carapaça desvia lâminas; martelo racha.',
  },

  enguia_icor: {
    id: 'enguia_icor', name: 'Enguia de Icor', region: 'r4', tier: 4,
    hp: 42, eva: 25, acc: 12, speed: 130, morale: 35, dread: 4,
    tags: ['fera', 'chaga'], weak: ['corte'], resist: ['icor'],
    parts: {
      cabeca: { name: 'Cabeça', hp: 14, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Corpo escorregadio', hp: 42, armor: A(1, 1, 2), role: 'torso', vital: true },
      cauda: { name: 'Cauda elétrica', hp: 18, armor: A(), role: 'special', hitMod: -10, severable: true, desc: 'Sem ela, sem choque.' },
    },
    intents: [
      { id: 'choque', label: 'Choque dourado', icon: '⚡', kind: 'attack', dmg: [12, 18], dtype: 'icor', reach: 1, w: 4, cd: 2, uses: ['cauda'], part: 'tronco', corruption: 2, status: [{ id: 'atordoado', chance: 35 }] },
      { id: 'mordida', label: 'Mordida', icon: '🦷', kind: 'attack', dmg: [9, 14], dtype: 'perf', reach: 0, w: 4, uses: ['cabeca'], part: 'random', status: [{ id: 'sangrando', chance: 40 }] },
      { id: 'enrolar', label: 'Enrola nas pernas', icon: '〰', kind: 'attack', dmg: [4, 7], dtype: 'impacto', reach: 0, w: 3, cd: 3, part: 'pernas', status: [{ id: 'caido', chance: 50 }, { id: 'enredado', chance: 50, turns: 1 }] },
      { id: 'afastar', label: 'Desliza para longe', icon: '↩', kind: 'move', move: 1, w: 2, when: ['engaged', 'canMove'] },
    ],
    ai: 'matilha', surrender: false, flee: true, startDist: [1, 2],
    loot: [['ambar_icor', 2], ['escama', 2], ['bile', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [3, 5],
    desc: 'Grossa como uma coxa, brilhando dourado por dentro. Bebeu Icor demais nos canais.',
  },

  cavaleiro_mare: {
    id: 'cavaleiro_mare', name: 'Cavaleiro da Maré', region: 'r4', tier: 4, elite: true,
    hp: 150, eva: 0, acc: 12, speed: 90, morale: 0, dread: 10,
    tags: ['morto', 'elite', 'escudo'], weak: ['impacto'], resist: ['corte', 'perf'],
    parts: (() => {
      const p = human(150, { head: A(7, 6, 2, 4), torso: A(9, 8, 3, 5), arms: A(7, 6, 2, 3), legs: A(7, 6, 2, 3), headHp: 40, armHp: 50, legHp: 54 });
      p.bracoE.name = 'Braço do escudo de coral';
      p.elmo = { name: 'Viseira cheia de água', hp: 16, armor: A(2, 0, 2), role: 'special', hitMod: -15, weakpoint: 1.6, severable: false,
        desc: 'Furada, a água vaza e ele afoga em seco. Perfuração entra pela fresta.' };
      return p;
    })(),
    intents: [
      { id: 'tridente', label: 'Tridente', icon: '🔱', kind: 'attack', dmg: [15, 22], dtype: 'perf', reach: 1, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 40 }] },
      { id: 'mare', label: 'A maré obedece', icon: '🌊', kind: 'attack', dmg: [8, 13], dtype: 'impacto', reach: 2, w: 2, cd: 3, aoe: 'hero_ally', part: 'pernas', status: [{ id: 'caido', chance: 55 }] },
      { id: 'escudo', label: 'Escudo de coral', icon: '🛡', kind: 'self', w: 2, cd: 2, uses: ['bracoE'], special: 'shieldwall', time: 60 },
      { id: 'afogar', label: 'Afoga o caído', icon: '☠', kind: 'attack', dmg: [20, 28], dtype: 'impacto', reach: 0, w: 9, when: ['heroDown'], part: 'cabeca', status: [{ id: 'atordoado', chance: 40 }] },
      { id: 'empalar', label: 'Empala', icon: '⚔', kind: 'attack', dmg: [24, 34], dtype: 'perf', reach: 1, w: 2, cd: 4, windup: 70, uses: ['bracoD'], part: 'tronco', crit: 10 },
    ],
    ai: 'soldado', surrender: false, flee: false, startDist: 1,
    loot: [['@armor:4', 3], ['@weapon:4', 2], ['elmo_mergulho', 1], ['ambar_icor', 2], ['chave_comporta', 1]], lootRolls: 2,
    coin: [20, 45], ichor: [5, 9],
    desc: 'A armadura afundou com o dono dentro. Ele ainda patrulha a ponte, de cracas e água preta.',
  },
};
