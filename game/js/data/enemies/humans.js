// ICOR — Inimigos humanos/genéricos (aparecem em qualquer região; escalam com o tier da região) + aberração e horda (Área B).

const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });

const human = (hp, { head = A(), torso = A(), arms = A(), legs = A(), headHp, armHp, legHp } = {}) => ({
  cabeca: { name: 'Cabeça', hp: headHp ?? Math.round(hp * 0.38), armor: head, role: 'head', vital: true },
  tronco: { name: 'Tronco', hp, armor: torso, role: 'torso', vital: true },
  bracoD: { name: 'Braço da arma', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm' },
  bracoE: { name: 'Braço esquerdo', hp: armHp ?? Math.round(hp * 0.4), armor: arms, role: 'arm2' },
  pernas: { name: 'Pernas', hp: legHp ?? Math.round(hp * 0.45), armor: legs, role: 'legs' },
});

export const HUMAN_ENEMIES = {
  desertor: {
    id: 'desertor', name: 'Desertor', region: 'any', tier: 1, scales: true,
    hp: 36, eva: 5, acc: 5, speed: 100, morale: 50, dread: 0,
    tags: ['humano', 'escudo'], weak: [], resist: [],
    parts: (() => {
      const p = human(36, { head: A(3, 2, 1), torso: A(5, 3, 2), arms: A(2, 2, 1), legs: A(2, 1, 1) });
      p.bracoE.name = 'Braço do escudo';
      return p;
    })(),
    intents: [
      { id: 'estocada', label: 'Estocada de lança curta', icon: '🗡', kind: 'attack', dmg: [6, 10], dtype: 'perf', reach: 1, w: 4, uses: ['bracoD'], part: 'random' },
      { id: 'parede', label: 'Parede de escudo', icon: '🛡', kind: 'self', w: 2, uses: ['bracoE'], cd: 2, special: 'shieldwall', time: 60 },
      { id: 'golpe_escudo', label: 'Golpe de escudo', icon: '⛨', kind: 'attack', dmg: [3, 5], dtype: 'impacto', reach: 0, w: 2, uses: ['bracoE'], part: 'cabeca', when: ['engaged'],
        status: [{ id: 'atordoado', chance: 25 }] },
      { id: 'investida', label: 'Investida de escudo e lança', icon: '⚡', kind: 'attack', dmg: [11, 16], dtype: 'perf', reach: 1, w: 1, cd: 3, windup: 50, uses: ['bracoD'], part: 'tronco' },
    ],
    ai: 'soldado', surrender: true, flee: true,
    loot: [['@weapon:1', 2], ['@armor:1', 2], ['@offhand:1', 1], ['racao', 2], ['bandagem', 1]], lootRolls: 1,
    coin: [4, 12], ichor: [0, 1],
    desc: 'Fugiu da Muralha com o escudo do rei. Ainda marcha em formação, mesmo sozinho.',
  },

  zelote: {
    id: 'zelote', name: 'Zelote', region: 'any', tier: 1, scales: true,
    hp: 30, eva: 5, acc: 0, speed: 105, morale: 0, dread: 3,
    tags: ['humano', 'fanatico'], weak: [], resist: [],
    parts: human(30, { head: A(), torso: A(1, 0, 1), arms: A(), legs: A() }),
    intents: [
      { id: 'flagelar', label: 'Flagela as próprias costas', icon: '⛓', kind: 'self', w: 3, cd: 1, when: ['notMaxFury'], special: 'flagelar', time: 60 },
      { id: 'mangual', label: 'Mangual de espinhos', icon: '✴', kind: 'attack', dmg: [5, 9], dtype: 'impacto', reach: 0, w: 4, uses: ['bracoD'], part: 'random', ignoreBlock: true,
        status: [{ id: 'sangrando', chance: 35 }] },
      { id: 'pregacao', label: 'Prega o fim', icon: '📜', kind: 'self', w: 1, cd: 4, dread: 6, special: 'pregacao' },
      { id: 'martirio', label: 'Martírio em chamas', icon: '🔥', kind: 'attack', dmg: [6, 10], dtype: 'fogo', reach: 0, w: 20, windup: 40, when: ['hpBelow30', 'once'], part: 'tronco', acc: 20,
        status: [{ id: 'queimando', chance: 100, stacks: 2 }], special: 'martirio' },
    ],
    ai: 'zelote', surrender: false, flee: false,
    loot: [['agua_benta', 2], ['sal_bento', 1], ['pano', 2], ['@trinket:1', 1]], lootRolls: 1,
    coin: [0, 5], ichor: [0, 1],
    desc: 'Cada chicotada é uma oração. Cada oração o deixa mais forte. Não se rende; não sabe como.',
  },

  bebedor: {
    id: 'bebedor', name: 'Bebedor de Icor', region: 'any', tier: 1, scales: true,
    hp: 30, eva: 10, acc: 5, speed: 105, morale: 40, dread: 2,
    tags: ['humano', 'chaga'], weak: [], resist: [],
    parts: {
      ...human(30, { head: A(), torso: A(2, 1, 1), arms: A(), legs: A(1, 0, 0) }),
      frasco: { name: 'Cinturão de frascos', hp: 6, armor: A(), role: 'special', hitMod: -5, severable: false, onBreak: 'frascos',
        desc: 'Icor para beber no meio da luta. Quebre antes que ele beba.' },
    },
    intents: [
      { id: 'faca', label: 'Faca torta', icon: '🗡', kind: 'attack', dmg: [6, 10], dtype: 'corte', reach: 0, w: 3, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 25 }] },
      { id: 'beber', label: 'Bebe um frasco de Icor', icon: '⚱', kind: 'special', w: 5, cd: 2, uses: ['frasco'], when: ['canDrink'], special: 'beber', time: 70 },
      { id: 'chicote', label: 'Chicote de carne', icon: '〰', kind: 'attack', dmg: [8, 13], dtype: 'icor', reach: 1, w: 5, when: ['stage1'], part: 'random', corruption: 2 },
      { id: 'grito_icor', label: 'Grito dourado', icon: '📢', kind: 'self', w: 1, cd: 4, when: ['stage2'], dread: 7, special: 'pregacao' },
    ],
    ai: 'bebedor', surrender: true, flee: true,
    loot: [['elixir_icor', 1], ['bile', 2], ['@consumable:1', 2]], lootRolls: 1,
    coin: [2, 8], ichor: [2, 4],
    desc: 'Dentes dourados de Icor. A cada gole, menos homem. Leva o próprio estoque na cintura.',
  },

  cacador_bruxas: {
    id: 'cacador_bruxas', name: 'Caçador de Bruxas', region: 'any', tier: 1, scales: true,
    hp: 34, eva: 10, acc: 10, speed: 105, morale: 65, dread: 0,
    tags: ['humano', 'atirador'], weak: [], resist: [],
    parts: human(34, { head: A(2, 1, 1), torso: A(3, 2, 2), arms: A(1, 1, 1), legs: A(1, 1, 1) }),
    intents: [
      { id: 'pistola', label: 'Besta de mão', icon: '➶', kind: 'attack', dmg: [7, 11], dtype: 'perf', reach: 2, ranged: true, w: 4, when: ['loaded'], uses: ['bracoE'], part: 'random', special: 'shoot' },
      { id: 'recarga', label: 'Recarrega a besta de mão', icon: '⟳', kind: 'self', w: 4, time: 70, when: ['notLoaded'], uses: ['bracoE'], special: 'reload' },
      { id: 'lamina', label: 'Lâmina de prata', icon: '🗡', kind: 'attack', dmg: [6, 10], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', special: 'prata' },
      { id: 'rede', label: 'Lança a rede', icon: '🕸', kind: 'attack', dmg: [0, 0], dtype: 'impacto', reach: 2, ranged: true, w: 2, cd: 4, noDamage: true, acc: 10, when: ['notEngaged'],
        status: [{ id: 'enredado', chance: 100, turns: 2 }] },
      { id: 'fogo_purificador', label: 'Fogo purificador', icon: '🔥', kind: 'attack', dmg: [8, 12], dtype: 'fogo', reach: 1, w: 1, cd: 4, windup: 40, part: 'tronco',
        status: [{ id: 'queimando', chance: 100, stacks: 2 }] },
      { id: 'herege', label: '"Herege!"', icon: '✝', kind: 'self', w: 4, when: ['heroCorrupt', 'notFurious'], special: 'herege', time: 40 },
    ],
    ai: 'cacador', surrender: true, flee: false, startLoaded: true, startDist: [1, 2],
    loot: [['virote', 2, 2, 4], ['sal_bento', 2], ['agua_benta', 1], ['@weapon:1', 1], ['oleo', 1]], lootRolls: 1,
    coin: [6, 14], ichor: [0, 1],
    desc: 'Tem uma lista. Quanto mais Icor nas suas veias, mais alto você está nela.',
  },

  carniceiro_rival: {
    id: 'carniceiro_rival', name: 'Carniceiro Rival', region: 'any', tier: 1, scales: true,
    hp: 38, eva: 10, acc: 5, speed: 100, morale: 55, dread: 0,
    tags: ['humano'], weak: [], resist: [],
    parts: human(38, { head: A(1, 1, 1), torso: A(4, 3, 2), arms: A(2, 1, 1), legs: A(2, 1, 1) }),
    intents: [
      { id: 'cutelo', label: 'Cutelo de açougue', icon: '🔪', kind: 'attack', dmg: [7, 12], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 35 }] },
      { id: 'bomba', label: 'Arremessa uma bomba', icon: '💣', kind: 'attack', dmg: [6, 10], dtype: 'fogo', reach: 2, ranged: true, w: 4, uses: ['bracoE'], aoe: 'hero_ally', when: ['hasBomb'], part: 'tronco',
        special: 'bomba', status: [{ id: 'queimando', chance: 70 }] },
      { id: 'golpe_sujo', label: 'Golpe sujo', icon: '✋', kind: 'attack', dmg: [2, 4], dtype: 'impacto', reach: 0, w: 1, cd: 3, part: 'cabeca', status: [{ id: 'cego', chance: 60, turns: 1 }] },
      { id: 'oleo', label: 'Unta o cutelo com óleo', icon: '🛢', kind: 'self', w: 2, when: ['once'], special: 'untar', time: 60 },
    ],
    ai: 'rival', surrender: true, flee: true, bombs: 1,
    loot: [['@any:1', 3], ['@consumable:1', 2], ['bomba', 1], ['oleo', 1], ['bandagem', 2]], lootRolls: 2,
    coin: [8, 20], ichor: [1, 3],
    desc: 'Mesma profissão, outra casa. No Ermo não existe concorrência — só cadáveres.',
  },

  aberracao: {
    id: 'aberracao', name: 'Aberração', region: 'any', tier: 1, elite: true, levelScaled: true,
    hp: 50, eva: 5, acc: 5, speed: 95, morale: 0, dread: 10,
    tags: ['morto', 'chaga', 'elite', 'aberracao'], weak: ['fogo'], resist: [],
    parts: {
      cabeca: { name: 'Rosto conhecido', hp: 18, armor: A(), role: 'head', vital: true },
      tronco: { name: 'Tronco inchado', hp: 50, armor: A(2, 2, 1), role: 'torso', vital: true },
      bracoD: { name: 'Garra', hp: 20, armor: A(1, 1, 0), role: 'arm' },
      bracoE: { name: 'Braço que agarra', hp: 20, armor: A(1, 1, 0), role: 'arm2' },
      pernas: { name: 'Pernas tortas', hp: 22, armor: A(), role: 'legs' },
      boca: { name: 'Boca no ventre', hp: 14, armor: A(), role: 'special', hitMod: -15, weakpoint: 1.6, severable: false, onBreak: 'boca',
        desc: 'Ponto fraco: dano ao corpo inteiro ×1,6. Destruída, ele não devora nem vomita.' },
    },
    intents: [
      { id: 'garra', label: 'Garra', icon: '🖐', kind: 'attack', dmg: [8, 14], dtype: 'corte', reach: 0, w: 4, uses: ['bracoD'], part: 'random', status: [{ id: 'sangrando', chance: 40 }] },
      { id: 'agarrar', label: 'Te abraça', icon: '✊', kind: 'attack', dmg: [2, 4], dtype: 'impacto', reach: 0, w: 2, uses: ['bracoE'], part: 'tronco', grab: true, when: ['notGrabbing', 'heroNotGrabbed'], cd: 2 },
      { id: 'devorar', label: 'Devora', icon: '👄', kind: 'attack', dmg: [10, 16], dtype: 'perf', reach: 0, w: 10, uses: ['boca'], when: ['grabbingHero'], part: 'tronco', special: 'devorar', acc: 25 },
      { id: 'vomito', label: 'Vômito de Icor', icon: '🤮', kind: 'attack', dmg: [5, 9], dtype: 'icor', reach: 1, w: 2, cd: 3, uses: ['boca'], part: 'cabeca', corruption: 3,
        status: [{ id: 'cego', chance: 30, turns: 1 }] },
      { id: 'chamado', label: 'Chama você pelo nome', icon: '🗣', kind: 'self', w: 1, cd: 5, dread: 10, special: 'chamado' },
    ],
    ai: 'aberracao', surrender: false, flee: false,
    loot: [['lasca_divina', 1], ['@any:2', 2], ['bile', 1]], lootRolls: 1,
    coin: [0, 0], ichor: [3, 6],
    desc: 'Já foi da sua casa. Ainda usa os seus brincos. A boca nova fica na barriga.',
  },

  horda_oco: {
    id: 'horda_oco', name: 'Horda de Ocos', region: 'any', tier: 1, scales: true,
    hp: 84, eva: 0, acc: 0, speed: 70, morale: 0, dread: 6,
    tags: ['morto', 'chaga', 'enxame', 'horda'], weak: ['fogo'], resist: ['perf'],
    parts: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`leva${i}`, { name: 'Leva de Ocos', hp: 14, armor: A(0, 2, 0), role: 'swarm' }])),
    intents: [
      { id: 'arranhar', label: 'Mãos e dentes', icon: '🖐', kind: 'attack', dmg: [3, 6], dtype: 'corte', reach: 0, w: 4, part: 'random', hitsPerSwarm: 0.5, maxHits: 4,
        status: [{ id: 'infectado', chance: 6 }] },
      { id: 'soterrar', label: 'Soterram você', icon: '⛰', kind: 'attack', dmg: [6, 10], dtype: 'impacto', reach: 0, w: 2, cd: 3, windup: 40, part: 'tronco', when: ['engaged'],
        status: [{ id: 'caido', chance: 50 }] },
      { id: 'gemido', label: 'Gemido de mil bocas', icon: '〰', kind: 'self', w: 1, cd: 4, dread: 4, special: 'lamento' },
    ],
    ai: 'horda', surrender: false, flee: false, startDist: 2,
    loot: [['pano', 2], ['osso', 2], ['@material:1', 1]], lootRolls: 1,
    coin: [0, 6], ichor: [0, 2],
    desc: 'Vilas inteiras andando juntas. Uma lâmina corta um; fogo e varredura derrubam fileiras.',
  },
};
