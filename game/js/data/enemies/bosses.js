// ICOR — Chefes (Área B). Onda 1: Mãe-Colheita (r1).
// Chefes usam 'phases' (lidas por ai.js -> comportamento 'mae_colheita') e partes especiais com onBreak.

const A = (corte = 0, perf = 0, impacto = 0, fogo = 0) => ({ corte, perf, impacto, fogo });

export const BOSSES = {
  mae_colheita: {
    id: 'mae_colheita', name: 'Mãe-Colheita', region: 'r1', tier: 1, boss: true,
    hp: 130, eva: 0, acc: 5, speed: 90, morale: 0, dread: 12,
    tags: ['chefe', 'morto', 'chaga', 'construto'], weak: ['fogo'], resist: ['perf'],
    parts: {
      lanterna: { name: 'Lanterna', hp: 12, armor: A(), role: 'special', hitMod: -20, severable: false, onBreak: 'lanterna',
        desc: 'A luz que a guia. Quebrada: ela queima por dentro — e a noite cai sobre você.' },
      cabeca: { name: 'Saco da cabeça', hp: 30, armor: A(0, 2, 0), role: 'head', vital: false, onBreak: 'mae_cabeca',
        desc: 'Estopa e dentes costurados. Destruída, ela fica cega para sempre.' },
      foiceD: { name: 'Braço-foice direito', hp: 30, armor: A(2, 3, 1), role: 'arm', desc: 'Decepe para acabar com a Ceifa.' },
      foiceE: { name: 'Braço-foice esquerdo', hp: 30, armor: A(2, 3, 1), role: 'arm2', desc: 'Usado no Abraço de Palha.' },
      tronco: { name: 'Tronco costurado', hp: 130, armor: A(1, 3, 0), role: 'torso', vital: true, desc: 'Cadáveres costurados com arame. Furar faz pouco.' },
      estaca: { name: 'Estaca', hp: 36, armor: A(3, 3, 4), role: 'legs', onBreak: 'estaca',
        desc: 'O poste que a mantém de pé. Partida, ela desaba — e fica desesperada.' },
    },
    intents: [
      { id: 'ceifa_dupla', label: 'Ceifa Dupla', icon: '🌙', kind: 'attack', dmg: [14, 22], dtype: 'corte', reach: 1, w: 3, cd: 2, windup: 60, uses: ['foiceD', 'foiceE'],
        aoe: 'hero_ally', part: [['tronco', 3], ['pernas', 2], ['bracoD', 1], ['bracoE', 1]], status: [{ id: 'sangrando', chance: 55, stacks: 2 }] },
      { id: 'ceifa', label: 'Ceifa', icon: '🌾', kind: 'attack', dmg: [8, 13], dtype: 'corte', reach: 1, w: 4, usesAny: ['foiceD', 'foiceE'], part: 'random',
        status: [{ id: 'sangrando', chance: 35 }] },
      { id: 'luz_colheita', label: 'Luz da Colheita', icon: '🏮', kind: 'attack', dmg: [6, 10], dtype: 'fogo', reach: 2, ranged: true, w: 2, cd: 3, uses: ['lanterna'], part: 'cabeca', dread: 4,
        status: [{ id: 'queimando', chance: 70, stacks: 1 }] },
      { id: 'chamar_corvos', label: 'Chama os corvos', icon: '🐦', kind: 'summon', w: 3, cd: 7, summon: 'corvos', max: 1, time: 80 },
      { id: 'costurar', label: 'Costura um morto', icon: '🧵', kind: 'summon', w: 4, cd: 4, when: ['corpse'], summon: 'lavrador_oco', max: 2, windup: 40, consumeCorpse: true, usesAny: ['foiceD', 'foiceE'] },
      { id: 'abraco', label: 'Abraço de Palha', icon: '✊', kind: 'attack', dmg: [4, 7], dtype: 'impacto', reach: 0, w: 2, cd: 4, uses: ['foiceE'], part: 'tronco', grab: true, when: ['heroNotGrabbed', 'engaged'] },
      { id: 'rasgar', label: 'Rasga quem abraça', icon: '🩸', kind: 'attack', dmg: [16, 24], dtype: 'corte', reach: 0, w: 12, usesAny: ['foiceD', 'foiceE'], when: ['grabbingHero'], part: 'tronco', acc: 30,
        status: [{ id: 'sangrando', chance: 80, stacks: 2 }] },
      // fase 2
      { id: 'parir', label: 'O ventre pare um morto', icon: '🫀', kind: 'summon', w: 4, cd: 3, when: ['phase2'], uses: ['ventre'], summon: 'lavrador_oco', max: 2, time: 80 },
      { id: 'chuva_palha', label: 'Chuva de palha e ossos', icon: '🌪', kind: 'attack', dmg: [5, 9], dtype: 'perf', reach: 2, ranged: true, w: 3, cd: 2, when: ['phase2'], aoe: 'hero_ally', part: 'random' },
      { id: 'rastejar', label: 'Rasteja e morde', icon: '🦷', kind: 'attack', dmg: [10, 16], dtype: 'perf', reach: 0, w: 5, when: ['fallen'], part: [['pernas', 3], ['tronco', 2]],
        status: [{ id: 'infectado', chance: 35 }, { id: 'caido', chance: 25 }] },
    ],
    phases: [
      { at: { hpBelow: 0.5, partsBroken: 2 }, id: 2, text: 'As costuras do ventre rebentam. Corpos escorregam para fora, ainda mexendo.',
        addParts: { ventre: { name: 'Ventre de cadáveres', hp: 40, armor: { corte: 0, perf: 0, impacto: 0, fogo: 0 }, role: 'special', hitMod: 10, weakpoint: 1.5, severable: false, onBreak: 'ventre',
          desc: 'Exposto e mole: dano ao corpo ×1,5. Destruído, ela para de parir.' } },
        speed: 15, dread: 8, summon: 'lavrador_oco' },
    ],
    ai: 'mae_colheita', surrender: false, flee: false, startDist: 1, onDeath: 'mae_morte',
    loot: [['@weapon:2', 2], ['@armor:2', 2], ['@trinket:2', 2], ['lasca_divina', 2], ['tonico', 1], ['elixir_icor', 1]], lootRolls: 3,
    coin: [30, 60], ichor: [8, 12],
    desc: 'Um espantalho de cadáveres costurados, alto como um celeiro. Na cabeça, uma lanterna que nunca apaga. Ela cuida dos campos.',
  },
};
