// ICOR — Inimigos da Região 1: Campos de Cinza (Área B).
// Formato documentado em docs/notes/B.md ("Formato de inimigo").
// Partes: role 'head'|'torso'|'arm'(braço da arma)|'arm2'(braço secundário/escudo)|'legs'|'special'|'swarm'.
// Intenções: kind 'attack'|'self'|'special'|'summon'|'move'; 'uses' exige partes intactas; 'when' = condições (ver ai.js).

const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });

const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const R1_ENEMIES = {
  saqueador: {
    id: 'saqueador', name: 'Saqueador', region: 'r1', tier: 1,
    hp: 32, eva: 5, acc: 0, speed: 100, morale: 45, dread: 0,
    tags: ['humano'], weak: [], resist: [],
    parts: human(32, { head: A(1, 0, 0), torso: A(3, 2, 1), arms: A(1, 1, 0), legs: A(1, 1, 0) }),
    intents: [
      { id: 'cutelada', label: 'Cutelada', icon: '🗡', kind: 'attack', dmg: [6, 11], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random',
        status: [{ id: 'sangrando', chance: 25, stacks: 1 }] },
      { id: 'rasteira', label: 'Golpe nas pernas', icon: '🦵', kind: 'attack', dmg: [3, 6], dtype: 'corte', reach: 0, w: 2, uses: ['bracoD'], part: 'pernas',
        status: [{ id: 'caido', chance: 30 }] },
      { id: 'investida', label: 'Investida com o cutelo', icon: '⚡', kind: 'attack', dmg: [11, 17], dtype: 'corte', reach: 0, w: 2, uses: ['bracoD'], part: 'tronco', windup: 50, cd: 3 },
      { id: 'areia', label: 'Terra nos olhos', icon: '✋', kind: 'attack', dmg: [0, 0], dtype: 'impacto', reach: 0, w: 1, uses: ['bracoE'], part: 'cabeca', cd: 4, acc: 10,
        status: [{ id: 'cego', chance: 75, turns: 1 }], noDamage: true },
      { id: 'chute_caido', label: 'Chute em quem caiu', icon: '🥾', kind: 'attack', dmg: [5, 9], dtype: 'impacto', reach: 0, w: 5, when: ['heroDown'], part: 'tronco' },
    ],
    ai: 'bandido', surrender: true, flee: true,
    loot: [['racao', 3], ['bandagem', 2], ['@weapon:1', 1], ['@armor:1', 1], ['sucata', 2], ['aguardente', 1], ['couro', 1]], lootRolls: 1,
    coin: [2, 9], ichor: [0, 1],
    desc: 'Fome com faca. Matou o vizinho por um saco de nabos e gostou.',
  },

  besteiro: {
    id: 'besteiro', name: 'Besteiro', region: 'r1', tier: 1,
    hp: 26, eva: 5, acc: 5, speed: 95, morale: 40, dread: 0,
    tags: ['humano', 'atirador'], weak: [], resist: [],
    parts: human(26, { head: A(0, 0, 0), torso: A(2, 1, 2), arms: A(1, 0, 1), legs: A(1, 0, 1) }),
    intents: [
      { id: 'disparo', label: 'Disparo de besta', icon: '➶', kind: 'attack', dmg: [9, 14], dtype: 'perf', reach: 2, ranged: true, w: 5, when: ['loaded'], uses: ['bracoD', 'bracoE'],
        part: 'random', special: 'shoot', status: [{ id: 'sangrando', chance: 20 }] },
      { id: 'disparo_mirado', label: 'Disparo mirado na cabeça', icon: '◎', kind: 'attack', dmg: [13, 19], dtype: 'perf', reach: 2, ranged: true, w: 3, when: ['loaded', 'notEngaged'],
        uses: ['bracoD', 'bracoE'], part: 'cabeca', windup: 40, cd: 3, crit: 15, acc: 10, special: 'shoot' },
      { id: 'recarregar', label: 'Recarrega a besta', icon: '⟳', kind: 'self', w: 8, time: 110, when: ['notLoaded', 'notEngaged'], uses: ['bracoD', 'bracoE'], special: 'reload' },
      { id: 'coronhada', label: 'Coronhada', icon: '🔨', kind: 'attack', dmg: [3, 6], dtype: 'impacto', reach: 0, w: 3, when: ['engaged'], part: 'cabeca',
        status: [{ id: 'atordoado', chance: 15 }] },
      { id: 'recuar', label: 'Recua para atirar', icon: '↩', kind: 'move', move: 1, w: 5, when: ['engaged', 'canMove'] },
    ],
    ai: 'atirador', surrender: true, flee: true, startDist: 2, startLoaded: true,
    loot: [['virote', 4, 2, 5], ['racao', 2], ['@weapon:1', 1], ['bandagem', 1], ['tendao', 1]], lootRolls: 1,
    coin: [3, 8], ichor: [0, 1],
    desc: 'Atira de longe e recarrega rezando. Perto, é só um homem magro com um pedaço de pau.',
  },

  cao_chaga: {
    id: 'cao_chaga', name: 'Cão da Chaga', region: 'r1', tier: 1,
    hp: 22, eva: 12, acc: 5, speed: 115, morale: 30, dread: 2,
    tags: ['fera', 'chaga'], weak: ['fogo'], resist: [],
    parts: {
      cabeca: { name: 'Mandíbula', hp: 9, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Costelas', hp: 22, armor: A(1, 0, 0), role: 'torso', vital: true },
      pernas: { name: 'Patas', hp: 10, armor: A(), role: 'legs' },
    },
    intents: [
      { id: 'mordida', label: 'Mordida nas pernas', icon: '🦷', kind: 'attack', dmg: [4, 8], dtype: 'perf', reach: 0, w: 4, uses: ['cabeca'], part: [['pernas', 4], ['bracoD', 1], ['bracoE', 1]],
        status: [{ id: 'sangrando', chance: 30 }, { id: 'infectado', chance: 8 }, { id: 'caido', chance: 8 }] },
      { id: 'salto', label: 'Salto ao peito', icon: '⤴', kind: 'attack', dmg: [3, 6], dtype: 'impacto', reach: 0, w: 2, uses: ['pernas'], part: 'tronco', cd: 3,
        status: [{ id: 'caido', chance: 20 }] },
      { id: 'jugular', label: 'Vai na jugular', icon: '🩸', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 0, w: 9, when: ['heroDown'], uses: ['cabeca'], part: [['cabeca', 2], ['tronco', 3]],
        status: [{ id: 'sangrando', chance: 70, stacks: 2 }] },
      { id: 'uivo', label: 'Uiva para a matilha', icon: '🌕', kind: 'self', w: 1, cd: 5, when: ['allies'], dread: 3, special: 'uivo' },
      { id: 'rosnar', label: 'Rosna, recuando do fogo', icon: '🔥', kind: 'self', w: 0, time: 70, special: 'rosnar' },
    ],
    ai: 'matilha', surrender: false, flee: true, startDist: [1, 2],
    loot: [['carne_podre', 3], ['dente', 2], ['couro', 2], ['osso', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [0, 1],
    desc: 'Costelas de fora, olhos leitosos. Caçam em bando e mordem baixo para te derrubar.',
  },

  lavrador_oco: {
    id: 'lavrador_oco', name: 'Lavrador Oco', region: 'r1', tier: 1,
    hp: 40, eva: 0, acc: 0, speed: 75, morale: 0, dread: 5,
    tags: ['morto', 'chaga'], weak: ['fogo'], resist: ['perf'],
    parts: {
      cabeca: { name: 'Cabeça', hp: 14, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Tronco oco', hp: 40, armor: A(0, 2, 0), role: 'torso', vital: true },
      bracoD: { name: 'Braço da foice', hp: 15, armor: A(), role: 'arm' },
      bracoE: { name: 'Mão que agarra', hp: 15, armor: A(), role: 'arm2' },
      pernas: { name: 'Pernas', hp: 16, armor: A(), role: 'legs' },
      bolsa: { name: 'Bolsa de esporos', hp: 8, armor: A(), role: 'special', hitMod: -10, severable: false, onBreak: 'esporos',
        desc: 'Estoura em esporos. Melhor a distância — ou com fogo.' },
    },
    intents: [
      { id: 'foice_ferrugem', label: 'Foice enferrujada', icon: '🌾', kind: 'attack', dmg: [6, 10], dtype: 'corte', reach: 0, w: 3, uses: ['bracoD'], part: 'random',
        status: [{ id: 'infectado', chance: 15 }] },
      { id: 'agarrar', label: 'Agarra com a mão fria', icon: '✊', kind: 'attack', dmg: [1, 3], dtype: 'impacto', reach: 0, w: 3, uses: ['bracoE'], part: 'bracoD', grab: true, when: ['notGrabbing', 'heroNotGrabbed'], cd: 3 },
      { id: 'morder', label: 'Morde o pescoço', icon: '🦷', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 0, w: 6, when: ['grabbingHero'], part: 'cabeca', acc: 25,
        status: [{ id: 'infectado', chance: 45 }, { id: 'sangrando', chance: 50 }] },
      { id: 'lamento', label: 'Lamento oco', icon: '〰', kind: 'self', w: 1, cd: 5, dread: 4, special: 'lamento' },
    ],
    ai: 'oco', surrender: false, flee: false, onDeath: 'esporos_morte',
    loot: [['ervas', 2], ['pano', 2], ['carne_podre', 2], ['@material:1', 1]], lootRolls: 1,
    coin: [0, 3], ichor: [0, 1],
    desc: 'Ainda segura a foice da última colheita. Por dentro, só esporos e fome.',
  },

  corvos: {
    id: 'corvos', name: 'Revoada de Corvos', region: 'r1', tier: 1,
    hp: 30, eva: 35, acc: 5, speed: 120, morale: 30, dread: 2,
    tags: ['fera', 'enxame', 'voador'], weak: ['fogo'], resist: [],
    parts: {
      bando1: { name: 'Bando', hp: 6, armor: A(), role: 'swarm' },
      bando2: { name: 'Bando', hp: 6, armor: A(), role: 'swarm' },
      bando3: { name: 'Bando', hp: 6, armor: A(), role: 'swarm' },
      bando4: { name: 'Bando', hp: 6, armor: A(), role: 'swarm' },
      bando5: { name: 'Bando', hp: 6, armor: A(), role: 'swarm' },
    },
    intents: [
      { id: 'bicadas', label: 'Nuvem de bicos', icon: '🐦', kind: 'attack', dmg: [1, 3], dtype: 'perf', reach: 1, w: 5, part: [['cabeca', 3], ['tronco', 3], ['bracoD', 2], ['bracoE', 2], ['pernas', 1]],
        hitsPerSwarm: 0.6, maxHits: 3, ignoreBlockPct: 50 },
      { id: 'olhos', label: 'Vão nos olhos', icon: '👁', kind: 'attack', dmg: [2, 4], dtype: 'perf', reach: 1, w: 2, cd: 3, part: 'cabeca', hitsPerSwarm: 0.5,
        status: [{ id: 'cego', chance: 45, turns: 2 }] },
      { id: 'banquete', label: 'Banquete nos corpos', icon: '🍖', kind: 'special', w: 7, when: ['corpse', 'swarmHurt'], special: 'banquete', time: 90 },
      { id: 'revoar', label: 'Revoam alto', icon: '↟', kind: 'special', w: 1, cd: 4, when: ['hpBelow50'], special: 'revoar', time: 60 },
    ],
    ai: 'enxame', surrender: false, flee: true, startDist: [1, 2],
    loot: [['osso', 1], ['pano', 1]], lootRolls: 0,
    coin: [0, 0], ichor: [0, 0],
    desc: 'Comeram tantos olhos de mortos que aprenderam o gosto. Golpes únicos acertam um bando; fogo e varreduras acertam muitos.',
  },

  ceifeiro: {
    id: 'ceifeiro', name: 'O Ceifeiro', region: 'r1', tier: 1, elite: true,
    hp: 76, eva: 0, acc: 5, speed: 85, morale: 85, dread: 7,
    tags: ['humano', 'chaga', 'elite'], weak: [], resist: [],
    parts: human(76, { head: A(1, 0, 1), torso: A(3, 2, 2), arms: A(2, 1, 1), legs: A(2, 1, 1), headHp: 22, armHp: 26, legHp: 28 }),
    intents: [
      { id: 'ceifa', label: 'Ceifa baixa', icon: '🌙', kind: 'attack', dmg: [15, 24], dtype: 'corte', reach: 1, w: 3, uses: ['bracoD', 'bracoE'], part: 'pernas', windup: 60, cd: 2,
        aoe: 'hero_ally', status: [{ id: 'sangrando', chance: 60, stacks: 2 }, { id: 'caido', chance: 20 }] },
      { id: 'gancho', label: 'Puxa com a foice', icon: '🪝', kind: 'attack', dmg: [3, 6], dtype: 'corte', reach: 1, w: 4, uses: ['bracoD'], part: 'pernas', when: ['notEngaged'], special: 'pull',
        status: [{ id: 'caido', chance: 40 }] },
      { id: 'cabo', label: 'Golpe com o cabo', icon: '🔨', kind: 'attack', dmg: [7, 11], dtype: 'impacto', reach: 0, w: 3, part: 'cabeca', when: ['engaged'],
        status: [{ id: 'atordoado', chance: 15 }] },
      { id: 'afastar', label: 'Empurra para o alcance da foice', icon: '↔', kind: 'special', w: 3, when: ['engaged', 'canMove'], special: 'shove', time: 60 },
      { id: 'colher', label: 'Colhe o caído', icon: '⚰', kind: 'attack', dmg: [14, 21], dtype: 'corte', reach: 1, w: 9, when: ['heroDown'], uses: ['bracoD'], part: 'tronco', windup: 30, crit: 10 },
    ],
    ai: 'ceifeiro', surrender: false, flee: false, startDist: 1,
    loot: [['@weapon:2', 2], ['@armor:1', 1], ['@trinket:1', 1], ['tonico', 1], ['ferro_negro', 1]], lootRolls: 2,
    coin: [10, 25], ichor: [2, 4],
    desc: 'Gigante de olhos brancos. A Chaga o fez colher tudo que respira — e ele não para de trabalhar.',
  },
};
