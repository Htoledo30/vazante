// ICOR — Sequazes (Área B). Contratados na Taverna (D) e levados nas expedições.
// Instância em G.hero.companion (ver makeCompanion). Em combate viram um ator side:'ally'.
//
// Ordens: 'atacar' (vai para cima do alvo do herói ou do mais ferido),
//         'proteger' (fica colado ao herói, intercepta golpes/estanca sangramentos conforme o estilo),
//         'segurar' (fica para trás: só age à distância/suporte; raramente é alvo).

export const ORDERS = {
  atacar: { id: 'atacar', name: 'Atacar', desc: 'Vai para cima. Causa dano, mas vira alvo.' },
  proteger: { id: 'proteger', name: 'Proteger', desc: 'Cola em você e intercepta golpes (ou cuida de você).' },
  segurar: { id: 'segurar', name: 'Segurar', desc: 'Fica atrás. Age só à distância/suporte; raramente é alvo.' },
};

export const COMPANIONS = {
  cao_guerra: {
    id: 'cao_guerra', name: 'Cão de Guerra', style: 'cao',
    hp: 34, eva: 25, acc: 10, speed: 130, armor: 1, dmg: [5, 9], dtype: 'perf', reach: 0,
    intercept: 25, carry: 0, hireCost: 40, wage: 3, tags: ['fera'],
    skills: { legs: true },
    desc: 'Mastim de cicatrizes. Morde as pernas e segura a presa no chão. Tem medo de fogo como você tem de morrer.',
    orders: {
      atacar: 'Morde as pernas do alvo: pode derrubar (30%).',
      proteger: 'Ataca quem te atacou por último; intercepta 25% dos golpes.',
      segurar: 'Rosna ao seu lado: inimigos que avançam até você levam uma mordida.',
    },
  },
  mercenario: {
    id: 'mercenario', name: 'Mercenário', style: 'mercenario',
    hp: 48, eva: 5, acc: 5, speed: 95, armor: 4, dmg: [7, 12], dtype: 'corte', reach: 0,
    intercept: 50, carry: 5, hireCost: 70, wage: 8, tags: ['humano'],
    skills: { shield: true },
    desc: 'Cota de malha, escudo e nenhuma pergunta. Foge se o pagamento parecer pouco perto da morte.',
    orders: {
      atacar: 'Golpes sólidos no inimigo mais ferido.',
      proteger: 'Escudo à frente: intercepta 50% dos golpes contra você.',
      segurar: 'Parede de escudo: só bate em quem chegar perto.',
    },
  },
  penitente: {
    id: 'penitente', name: 'Penitente', style: 'penitente',
    hp: 40, eva: 5, acc: 0, speed: 100, armor: 0, dmg: [6, 10], dtype: 'impacto', reach: 0,
    intercept: 60, carry: 0, hireCost: 25, wage: 1, tags: ['humano', 'fanatico'],
    skills: { prayer: true },
    desc: 'Pele em tiras de tanto se açoitar. Não quer pagamento — quer uma morte que valha.',
    orders: {
      atacar: 'Se açoita (perde PV) e bate furioso.',
      proteger: 'Joga-se na frente: intercepta 60% dos golpes.',
      segurar: 'Reza: −4 Pavor por turno para você.',
    },
  },
  batedora: {
    id: 'batedora', name: 'Batedora', style: 'batedora',
    hp: 30, eva: 20, acc: 15, speed: 115, armor: 1, dmg: [6, 10], dtype: 'perf', reach: 2, ranged: true,
    intercept: 0, carry: 2, hireCost: 55, wage: 5, tags: ['humano'],
    skills: { scout: true },
    desc: 'Arco curto, olho de falcão. Prefere atirar de longe e marcar alvos para você.',
    orders: {
      atacar: 'Flechas nas pernas de quem avança (para o avanço).',
      proteger: 'Atira em quem está carregando um golpe (pode interromper).',
      segurar: 'Marca o alvo mais perigoso: +15 de precisão para você.',
    },
  },
  carregador: {
    id: 'carregador', name: 'Carregador', style: 'carregador',
    hp: 32, eva: 5, acc: -5, speed: 90, armor: 1, dmg: [3, 6], dtype: 'impacto', reach: 0,
    intercept: 15, carry: 25, hireCost: 30, wage: 3, tags: ['humano'],
    skills: { porter: true },
    desc: 'Costas largas, coragem curta. Carrega 25 de peso e sabe fazer um curativo.',
    orders: {
      atacar: 'Bate com o cajado, sem muita vontade.',
      proteger: 'Faz curativos: estanca seu sangramento e cura 3 PV.',
      segurar: 'Passa itens: seus itens em combate custam metade do tempo.',
    },
  },
};

/** Cria a instância serializável para G.hero.companion. */
export function makeCompanion(id, name) {
  const d = COMPANIONS[id];
  if (!d) return null;
  return { id, name: name || d.name, hp: d.hp, hpMax: d.hp, order: d.style === 'batedora' ? 'segurar' : 'atacar', loyalty: 60, kills: 0 };
}
