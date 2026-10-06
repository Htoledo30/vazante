// ICOR — Inimigos da Região 5: O Cadáver (Onda 2). Dentro da carne do deus.
const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });
const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const R5_ENEMIES = {
  anticorpo: {
    id: 'anticorpo', name: 'Anticorpo', region: 'r5', tier: 5,
    hp: 56, eva: 5, acc: 12, speed: 105, morale: 0, dread: 6,
    tags: ['fera', 'construto'], weak: ['fogo', 'corte'], resist: ['impacto', 'icor'],
    parts: {
      nucleo: { name: 'Núcleo', hp: 18, armor: A(1, 1, 3), role: 'head', vital: true, desc: 'O ponto escuro dentro da massa branca.' },
      tronco: { name: 'Massa branca', hp: 56, armor: A(0, 2, 6, 0), role: 'torso', vital: true },
      pseudopodes: { name: 'Pseudópodes', hp: 24, armor: A(0, 1, 3), role: 'arm', severable: true },
    },
    intents: [
      { id: 'engolfar', label: 'Engolfa', icon: '🫧', kind: 'attack', dmg: [6, 10], dtype: 'icor', reach: 0, w: 3, cd: 3, uses: ['pseudopodes'], part: 'tronco', grab: true, when: ['heroNotGrabbed', 'notGrabbing'] },
      { id: 'digerir', label: 'Digere', icon: '🧪', kind: 'attack', dmg: [16, 22], dtype: 'icor', reach: 0, w: 10, when: ['grabbingHero'], part: 'tronco', acc: 25, corruption: 2 },
      { id: 'acoite', label: 'Açoite de linfa', icon: '〰', kind: 'attack', dmg: [12, 18], dtype: 'impacto', reach: 1, w: 4, uses: ['pseudopodes'], part: 'random', status: [{ id: 'envenenado', chance: 35 }] },
      { id: 'dividir', label: 'Se divide', icon: '⚪', kind: 'special', w: 8, when: ['hpBelow50', 'once'], special: 'dividir', time: 70 },
    ],
    ai: 'oco', surrender: false, flee: false, startDist: [0, 1],
    loot: [['bile', 2, 1, 2], ['ambar_icor', 1], ['@material:5', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [2, 4],
    desc: 'O corpo do deus ainda se defende. Você é a doença. Eles são a cura.',
  },

  filho_icor: {
    id: 'filho_icor', name: 'Filho do Icor', region: 'r5', tier: 5,
    hp: 60, eva: 15, acc: 12, speed: 115, morale: 0, dread: 10,
    tags: ['morto', 'chaga'], weak: ['fogo', 'corte'], resist: ['icor'],
    parts: human(60, { torso: A(2, 2, 2), headHp: 20 }),
    intents: [
      { id: 'garras', label: 'Garras de ouro', icon: '🖐', kind: 'attack', dmg: [13, 19], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 40, stacks: 2 }] },
      { id: 'toque', label: 'Toque dourado', icon: '✨', kind: 'attack', dmg: [8, 12], dtype: 'icor', reach: 0, w: 3, uses: ['bracoE'], part: 'tronco', corruption: 3 },
      { id: 'riso', label: 'Ri com a sua voz', icon: '😃', kind: 'self', w: 1, cd: 4, dread: 9, special: 'lamento' },
      { id: 'regenerar', label: 'O ouro fecha a carne', icon: '✚', kind: 'self', w: 4, cd: 3, when: ['hpBelow50'], special: 'regenerar' },
    ],
    ai: 'matilha', surrender: false, flee: false, startDist: [0, 2],
    loot: [['ambar_icor', 2], ['lasca_divina', 1], ['@trinket:5', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [3, 6],
    desc: 'Crianças feitas de Icor coagulado. Imitam a voz de quem você perdeu.',
  },

  verme_divino: {
    id: 'verme_divino', name: 'Verme Divino', region: 'r5', tier: 5,
    hp: 90, eva: 0, acc: 10, speed: 85, morale: 0, dread: 9,
    tags: ['fera'], weak: ['corte'], resist: ['impacto', 'perf'],
    parts: {
      boca: { name: 'Bocarra circular', hp: 30, armor: A(1, 2, 2), role: 'head', vital: true },
      tronco: { name: 'Corpo anelado', hp: 90, armor: A(2, 4, 5), role: 'torso', vital: true },
      segmentos: { name: 'Segmentos traseiros', hp: 40, armor: A(1, 3, 3), role: 'legs', desc: 'Corte-os e ele não avança.' },
    },
    intents: [
      { id: 'engolir', label: 'Engole você', icon: '🕳', kind: 'attack', dmg: [8, 12], dtype: 'perf', reach: 0, w: 3, cd: 4, uses: ['boca'], part: 'tronco', grab: true, when: ['heroNotGrabbed', 'notGrabbing'] },
      { id: 'acido', label: 'Ácido estomacal', icon: '🧪', kind: 'attack', dmg: [18, 26], dtype: 'icor', reach: 0, w: 10, when: ['grabbingHero'], part: 'tronco', acc: 30, corruption: 2 },
      { id: 'esmagar', label: 'Rolar por cima', icon: '🌀', kind: 'attack', dmg: [16, 24], dtype: 'impacto', reach: 0, w: 4, uses: ['segmentos'], part: 'random', status: [{ id: 'caido', chance: 40 }] },
      { id: 'surgir', label: 'Surge da carne', icon: '⬆', kind: 'attack', dmg: [20, 28], dtype: 'perf', reach: 2, w: 3, cd: 4, windup: 60, uses: ['boca'], part: 'pernas', special: 'charge', status: [{ id: 'caido', chance: 50 }] },
    ],
    ai: 'oco', surrender: false, flee: false, startDist: [1, 2],
    loot: [['ambar_icor', 2], ['bile', 3, 1, 3], ['lasca_divina', 1], ['@material:5', 1]], lootRolls: 2,
    coin: [0, 0], ichor: [4, 8],
    desc: 'Um verme do tamanho de uma rua, comendo o deus por dentro. Ele não sabe que você não é deus.',
  },

  bebedor_ascendido: {
    id: 'bebedor_ascendido', name: 'Bebedor Ascendido', region: 'r5', tier: 5,
    hp: 70, eva: 10, acc: 12, speed: 110, morale: 60, dread: 8,
    tags: ['humano', 'chaga'], weak: [], resist: ['icor'],
    parts: {
      ...human(70, { head: A(1, 1, 1), torso: A(3, 3, 3), headHp: 26 }),
      halo: { name: 'Halo de Icor', hp: 18, armor: A(), role: 'special', hitMod: -15, weakpoint: 1.5, severable: false, onBreak: 'frascos',
        desc: 'O Icor ferve em volta da cabeça. Estoure e ele queima por dentro.' },
    },
    intents: [
      { id: 'chicote', label: 'Chicote de carne', icon: '〰', kind: 'attack', dmg: [14, 20], dtype: 'icor', reach: 1, w: 4, part: 'random', corruption: 2 },
      { id: 'garras', label: 'Garras douradas', icon: '🖐', kind: 'attack', dmg: [12, 18], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 45 }] },
      { id: 'grito', label: 'Grito dourado', icon: '📢', kind: 'self', w: 2, cd: 4, dread: 10, special: 'pregacao' },
      { id: 'sermao', label: '"Beba comigo"', icon: '⚱', kind: 'attack', dmg: [0, 0], noDamage: true, reach: 2, ranged: true, w: 2, cd: 4, part: 'cabeca', corruption: 5, status: [{ id: 'aterrorizado', chance: 40 }] },
      { id: 'regenerar', label: 'Bebe da parede', icon: '✚', kind: 'self', w: 3, cd: 3, when: ['hpBelow50'], special: 'regenerar' },
    ],
    ai: 'bebedor', surrender: true, flee: false, startDist: [0, 1],
    loot: [['elixir_icor', 2], ['ambar_icor', 2], ['@weapon:5', 1], ['@trinket:5', 1], ['adaga_icor', 1]], lootRolls: 2,
    coin: [10, 30], ichor: [5, 9],
    desc: 'Bebeu o suficiente para chegar aqui dentro. Não é mais homem. Ainda prega como um.',
  },

  anjo_carne: {
    id: 'anjo_carne', name: 'Anjo de Carne', region: 'r5', tier: 5, elite: true,
    hp: 170, eva: 15, acc: 15, speed: 100, morale: 0, dread: 14,
    tags: ['morto', 'elite', 'voador'], weak: ['fogo'], resist: ['perf', 'icor'],
    parts: {
      cabeca: { name: 'Rosto de ninguém', hp: 40, armor: A(2, 2, 2), role: 'head', vital: true },
      tronco: { name: 'Peito aberto', hp: 170, armor: A(3, 4, 3), role: 'torso', vital: true },
      bracoD: { name: 'Braço-lança', hp: 50, armor: A(3, 3, 2), role: 'arm' },
      asas: { name: 'Asas de pele', hp: 48, armor: A(0, 1, 1), role: 'special', hitMod: 5, severable: true, onBreak: 'asas',
        desc: 'Corte as asas e ele cai. No chão, é só carne.' },
    },
    intents: [
      { id: 'lanca', label: 'Lança de osso', icon: '🗡', kind: 'attack', dmg: [20, 28], dtype: 'perf', reach: 2, w: 3, cd: 2, windup: 55, uses: ['bracoD'], part: 'tronco', crit: 10 },
      { id: 'asas', label: 'Rajada das asas', icon: '🌪', kind: 'attack', dmg: [10, 15], dtype: 'corte', reach: 1, w: 3, uses: ['asas'], aoe: 'hero_ally', part: 'random', status: [{ id: 'caido', chance: 30 }] },
      { id: 'hino', label: 'Hino do seu nome', icon: '🎶', kind: 'self', w: 2, cd: 3, dread: 12, special: 'canto' },
      { id: 'curar', label: 'Cura os fiéis', icon: '✚', kind: 'self', w: 3, cd: 3, when: ['allies'], special: 'curar_aliados' },
      { id: 'mergulho', label: 'Mergulha do alto', icon: '⬇', kind: 'attack', dmg: [16, 24], dtype: 'impacto', reach: 2, w: 3, cd: 3, uses: ['asas'], part: 'cabeca', special: 'charge', status: [{ id: 'atordoado', chance: 30 }] },
      { id: 'garra_chao', label: 'Rasteja e rasga', icon: '🖐', kind: 'attack', dmg: [14, 20], dtype: 'corte', reach: 0, w: 6, when: ['fallen'], part: 'random', status: [{ id: 'sangrando', chance: 50 }] },
    ],
    ai: 'soldado', surrender: false, flee: false, startDist: 2,
    loot: [['pele_anjo', 1], ['lasca_divina', 2], ['ambar_icor', 2], ['@armor:5', 2], ['@trinket:5', 1]], lootRolls: 2,
    coin: [0, 20], ichor: [8, 14],
    desc: 'Asas de pele esticadas em ossos de costela, um rosto liso. Canta o seu nome do jeito que sua mãe cantava.',
  },
};
