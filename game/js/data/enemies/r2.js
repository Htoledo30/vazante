// ICOR — Inimigos da Região 2: Floresta dos Enforcados (Onda 2). Mesmo formato de r1.js.
const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });
const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const R2_ENEMIES = {
  enforcado: {
    id: 'enforcado', name: 'Enforcado', region: 'r2', tier: 2,
    hp: 44, eva: 5, acc: 5, speed: 90, morale: 0, dread: 5,
    tags: ['morto', 'chaga'], weak: ['fogo', 'corte'], resist: ['perf'],
    parts: {
      ...human(44, { torso: A(1, 3, 0), headHp: 16 }),
      corda: { name: 'Corda no pescoço', hp: 10, armor: A(0, 4, 4), role: 'special', hitMod: -5, severable: false, onBreak: 'corda',
        desc: 'Ainda presa ao galho. Ele usa para laçar. Cortada, ele só tem as mãos.' },
    },
    intents: [
      { id: 'garras', label: 'Unhas pretas', icon: '🖐', kind: 'attack', dmg: [7, 12], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 30 }, { id: 'infectado', chance: 10 }] },
      { id: 'laco', label: 'Laço de corda', icon: '➰', kind: 'attack', dmg: [2, 4], dtype: 'impacto', reach: 1, w: 3, cd: 3, uses: ['corda'], part: 'cabeca', grab: true, special: 'pull', when: ['heroNotGrabbed'] },
      { id: 'enforcar', label: 'Aperta o laço', icon: '☠', kind: 'attack', dmg: [9, 14], dtype: 'impacto', reach: 0, w: 10, uses: ['corda'], when: ['grabbingHero'], part: 'cabeca', acc: 30, status: [{ id: 'atordoado', chance: 35 }], dread: 3 },
      { id: 'queda', label: 'Cai do galho em cima', icon: '⤓', kind: 'attack', dmg: [10, 15], dtype: 'impacto', reach: 0, w: 6, when: ['once'], part: 'tronco', status: [{ id: 'caido', chance: 45 }] },
    ],
    ai: 'oco', surrender: false, flee: false, startDist: [0, 1],
    loot: [['pano', 3], ['tendao', 2], ['@weapon:2', 1], ['@armor:2', 1], ['@trinket:2', 1]], lootRolls: 1,
    coin: [0, 6], ichor: [0, 2],
    desc: 'Pendurado tempo demais. Desce quando você passa embaixo. Corte a corda antes que ela vá para o seu pescoço.',
  },

  lobo_tendao: {
    id: 'lobo_tendao', name: 'Lobo de Tendão', region: 'r2', tier: 2,
    hp: 34, eva: 15, acc: 8, speed: 125, morale: 45, dread: 3,
    tags: ['fera', 'chaga'], weak: ['fogo'], resist: [],
    parts: {
      cabeca: { name: 'Focinho', hp: 13, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Corpo sem pele', hp: 34, armor: A(0, 1, 2), role: 'torso', vital: true },
      pernas: { name: 'Patas', hp: 15, armor: A(), role: 'legs' },
    },
    intents: [
      { id: 'dilacerar', label: 'Dilacera', icon: '🦷', kind: 'attack', dmg: [7, 12], dtype: 'corte', reach: 0, w: 4, uses: ['cabeca'], part: [['pernas', 3], ['bracoD', 2], ['tronco', 2]], status: [{ id: 'sangrando', chance: 45, stacks: 2 }] },
      { id: 'tendao', label: 'Morde o tendão', icon: '🦵', kind: 'attack', dmg: [5, 8], dtype: 'perf', reach: 0, w: 3, cd: 3, uses: ['cabeca'], part: 'pernas', status: [{ id: 'caido', chance: 35 }, { id: 'enredado', chance: 30, turns: 1 }] },
      { id: 'garganta', label: 'Na garganta', icon: '🩸', kind: 'attack', dmg: [11, 16], dtype: 'perf', reach: 0, w: 9, when: ['heroDown'], uses: ['cabeca'], part: 'cabeca', status: [{ id: 'sangrando', chance: 80, stacks: 2 }] },
      { id: 'uivo', label: 'Uivo de carne', icon: '🌕', kind: 'self', w: 1, cd: 5, when: ['allies'], dread: 4, special: 'uivo' },
      { id: 'rosnar', label: 'Recua do fogo', icon: '🔥', kind: 'self', w: 0, time: 70, special: 'rosnar' },
    ],
    ai: 'matilha', surrender: false, flee: true, startDist: [1, 2],
    loot: [['pele_lobo', 3], ['tendao', 3, 1, 2], ['dente', 2], ['carne_podre', 2]], lootRolls: 1,
    coin: [0, 0], ichor: [0, 1],
    desc: 'Lobo sem pele, só músculo vermelho e dentes. Corre em círculos e morde atrás do joelho.',
  },

  bruxa_casca: {
    id: 'bruxa_casca', name: 'Bruxa da Casca', region: 'r2', tier: 2,
    hp: 30, eva: 10, acc: 10, speed: 100, morale: 40, dread: 6,
    tags: ['humano', 'atirador', 'chaga'], weak: ['fogo'], resist: ['perf'],
    parts: {
      ...human(30, { torso: A(2, 3, 1), arms: A(1, 2, 0) }),
      galhos: { name: 'Galhos nas costas', hp: 14, armor: A(0, 2, 0), role: 'special', hitMod: -5, severable: true, onBreak: 'galhos_bruxa',
        desc: 'Ela regenera pela casca. Corte ou queime os galhos.' },
    },
    intents: [
      { id: 'espinhos', label: 'Chuva de espinhos', icon: '✶', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 2, ranged: true, w: 4, part: 'random', status: [{ id: 'envenenado', chance: 35 }] },
      { id: 'raizes', label: 'Raízes', icon: '🌿', kind: 'attack', dmg: [2, 5], dtype: 'impacto', reach: 2, ranged: true, w: 3, cd: 3, part: 'pernas', status: [{ id: 'enredado', chance: 85, turns: 2 }] },
      { id: 'maldicao', label: 'Maldição sussurrada', icon: '👁', kind: 'attack', dmg: [0, 0], noDamage: true, reach: 2, ranged: true, w: 2, cd: 4, part: 'cabeca', dread: 8, status: [{ id: 'cego', chance: 50, turns: 2 }, { id: 'aterrorizado', chance: 40 }] },
      { id: 'casca', label: 'Casca cobre as feridas', icon: '🌳', kind: 'self', w: 4, cd: 3, uses: ['galhos'], when: ['hpBelow50'], special: 'regenerar' },
      { id: 'recua', label: 'Some entre as árvores', icon: '↩', kind: 'move', move: 1, w: 5, when: ['engaged', 'canMove'] },
      { id: 'unha', label: 'Unhas de madeira', icon: '🖐', kind: 'attack', dmg: [5, 8], dtype: 'corte', reach: 0, w: 3, when: ['engaged'], part: 'cabeca' },
    ],
    ai: 'atirador', surrender: true, flee: true, startDist: 2,
    loot: [['cabelo_bruxa', 4], ['ervas', 3, 1, 3], ['fumo_bruxa', 2], ['@trinket:2', 1], ['veneno', 1]], lootRolls: 1,
    coin: [2, 10], ichor: [1, 2],
    desc: 'Metade mulher, metade árvore. Fala com os enforcados e eles escutam.',
  },

  cacador_cabecas: {
    id: 'cacador_cabecas', name: 'Caçador de Cabeças', region: 'r2', tier: 2,
    hp: 42, eva: 10, acc: 8, speed: 105, morale: 55, dread: 2,
    tags: ['humano'], weak: [], resist: [],
    parts: human(42, { head: A(2, 1, 1), torso: A(3, 2, 2), arms: A(1, 1, 1), legs: A(1, 1, 1) }),
    intents: [
      { id: 'machado', label: 'Machado de osso', icon: '🪓', kind: 'attack', dmg: [8, 14], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 30 }] },
      { id: 'arremesso', label: 'Machadinha arremessada', icon: '🌀', kind: 'attack', dmg: [7, 11], dtype: 'corte', reach: 2, ranged: true, w: 3, cd: 2, uses: ['bracoE'], when: ['notEngaged'], part: 'random' },
      { id: 'decapitar', label: 'Decapitação', icon: '⚔', kind: 'attack', dmg: [16, 24], dtype: 'corte', reach: 0, w: 6, cd: 4, windup: 55, uses: ['bracoD'], part: 'cabeca', crit: 10, when: ['heroDown'] },
      { id: 'pescoco', label: 'Mira o pescoço', icon: '◎', kind: 'attack', dmg: [12, 18], dtype: 'corte', reach: 0, w: 2, cd: 3, windup: 40, uses: ['bracoD'], part: 'cabeca' },
      { id: 'trofeu', label: 'Mostra o colar de orelhas', icon: '👂', kind: 'self', w: 1, cd: 5, dread: 5, special: 'pregacao' },
    ],
    ai: 'bandido', surrender: true, flee: true, startDist: [0, 2],
    loot: [['@weapon:2', 2], ['@armor:2', 1], ['dente', 3], ['machadinha', 1], ['racao', 2]], lootRolls: 1,
    coin: [5, 16], ichor: [0, 2],
    desc: 'Pinta o rosto com cinza e coleciona orelhas de Carniceiro. Prefere a cabeça inteira.',
  },

  tecela: {
    id: 'tecela', name: 'Tecelã', region: 'r2', tier: 2,
    hp: 46, eva: 12, acc: 10, speed: 110, morale: 40, dread: 8,
    tags: ['fera', 'chaga'], weak: ['fogo'], resist: [],
    parts: {
      cabeca: { name: 'Cabeça de presas', hp: 16, armor: A(1, 1, 0), role: 'head', vital: true },
      tronco: { name: 'Abdômen inchado', hp: 46, armor: A(1, 0, 2), role: 'torso', vital: true },
      pernas: { name: 'Oito pernas', hp: 26, armor: A(2, 2, 0), role: 'legs' },
      fiandeiras: { name: 'Fiandeiras', hp: 10, armor: A(), role: 'special', hitMod: -10, severable: true,
        desc: 'Sem elas, nada de teia.' },
    },
    intents: [
      { id: 'teia', label: 'Cospe teia', icon: '🕸', kind: 'attack', dmg: [0, 0], noDamage: true, reach: 2, ranged: true, w: 4, cd: 2, uses: ['fiandeiras'], when: ['heroNotGrabbed'], part: 'tronco', status: [{ id: 'enredado', chance: 90, turns: 2 }], acc: 10 },
      { id: 'picada', label: 'Picada', icon: '🦂', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 0, w: 4, uses: ['cabeca'], part: 'random', status: [{ id: 'envenenado', chance: 70, stacks: 2 }] },
      { id: 'arrastar', label: 'Puxa pelo fio', icon: '🧵', kind: 'attack', dmg: [3, 6], dtype: 'impacto', reach: 2, w: 6, uses: ['fiandeiras'], when: ['notEngaged'], part: 'pernas', special: 'pull', status: [{ id: 'caido', chance: 30 }] },
      { id: 'casulo', label: 'Enrola em casulo', icon: '🥚', kind: 'attack', dmg: [4, 7], dtype: 'impacto', reach: 0, w: 5, cd: 3, uses: ['fiandeiras'], when: ['engaged'], part: 'tronco', grab: true, status: [{ id: 'enredado', chance: 100, turns: 2 }] },
      { id: 'veneno_fundo', label: 'Injeta fundo', icon: '☠', kind: 'attack', dmg: [12, 18], dtype: 'perf', reach: 0, w: 9, when: ['grabbingHero'], part: 'tronco', acc: 25, status: [{ id: 'envenenado', chance: 100, stacks: 3 }] },
    ],
    ai: 'bandido', surrender: false, flee: true, startDist: 2,
    loot: [['seda_tecela', 4, 1, 2], ['veneno', 2], ['bile', 1], ['@trinket:2', 1]], lootRolls: 1,
    coin: [0, 4], ichor: [1, 2],
    desc: 'Aranha do tamanho de uma carroça. Guarda os enforcados em casulos para depois.',
  },

  cervo_podre: {
    id: 'cervo_podre', name: 'Cervo Podre', region: 'r2', tier: 2, elite: true,
    hp: 110, eva: 5, acc: 10, speed: 95, morale: 80, dread: 9,
    tags: ['fera', 'chaga', 'elite'], weak: ['fogo'], resist: ['perf'],
    parts: {
      galhada: { name: 'Galhada', hp: 32, armor: A(1, 4, 2), role: 'arm', severable: true, desc: 'Arma e coroa. Quebrada, ele só pisoteia.' },
      cabeca: { name: 'Crânio exposto', hp: 30, armor: A(2, 2, 3), role: 'head', vital: true },
      tronco: { name: 'Flanco apodrecido', hp: 110, armor: A(1, 3, 1), role: 'torso', vital: true },
      pernas: { name: 'Patas compridas', hp: 40, armor: A(1, 1, 1), role: 'legs', desc: 'Quebre-as e a investida acaba.' },
    },
    intents: [
      { id: 'investida', label: 'Investida', icon: '⚡', kind: 'attack', dmg: [16, 24], dtype: 'perf', reach: 2, w: 4, cd: 2, windup: 60, uses: ['galhada', 'pernas'], part: 'tronco', status: [{ id: 'caido', chance: 60 }], special: 'charge', when: ['notEngaged'] },
      { id: 'chifrada', label: 'Chifrada', icon: '🦌', kind: 'attack', dmg: [11, 17], dtype: 'perf', reach: 0, w: 4, uses: ['galhada'], part: 'random', status: [{ id: 'sangrando', chance: 40 }] },
      { id: 'coice', label: 'Coice para trás', icon: '🦵', kind: 'attack', dmg: [9, 14], dtype: 'impacto', reach: 0, w: 3, uses: ['pernas'], part: 'tronco', special: 'shove_after' },
      { id: 'pisotear', label: 'Pisoteia o caído', icon: '⬇', kind: 'attack', dmg: [14, 20], dtype: 'impacto', reach: 0, w: 9, when: ['heroDown'], part: 'tronco', status: [{ id: 'atordoado', chance: 30 }] },
      { id: 'berro', label: 'Berro de cio podre', icon: '📯', kind: 'self', w: 1, cd: 5, dread: 7, special: 'pregacao' },
    ],
    ai: 'ceifeiro', surrender: false, flee: false, startDist: 2,
    loot: [['chifre', 4, 1, 2], ['@armor:2', 2], ['@trinket:2', 2], ['capacete_cervo', 1], ['pele_lobo', 2]], lootRolls: 2,
    coin: [0, 10], ichor: [3, 6],
    desc: 'Um cervo grande como um cavalo de guerra, a carne caindo dos ossos. A galhada pinga algo dourado.',
  },
};
