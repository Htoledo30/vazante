// Vila de Salgema: construções, melhorias permanentes, contratos e Marés Vivas.

export const BUILDINGS = {
  forja: { name: 'Forja da Ilda', icon: '⚒', npc: 'ilda', desc: 'Armas alternativas e vigor.' },
  botica: { name: 'Botica da Marisol', icon: '🌿', npc: 'marisol', desc: 'Poções, bolsos e a Segunda Maré.' },
  farol: { name: 'Farol de Salgema', icon: '🗼', npc: null, desc: 'Reacenda o farol para enxergar além.' },
  cais: { name: 'Cais do Gaspar', icon: '⛵', npc: 'gaspar', desc: 'Atalhos para distritos já abertos.' },
  arquivo: { name: 'Arquivo do Frei Anselmo', icon: '📜', npc: 'anselmo', desc: 'Bestiário, memórias e estudos.' },
  taverna: { name: 'Taverna O Anzol', icon: '🍺', npc: 'benta', desc: 'Contratos e boatos.' },
  pedra: { name: 'Pedra do Treino', icon: '🪨', npc: null, desc: 'Treino de atributos iniciais.' },
};

// req(meta) → true ou texto explicando o requisito.
export const UPGRADES = {
  forge_w1: { b: 'forja', name: 'Moldes Antigos', cost: 60, desc: 'Desbloqueia a 2ª arma de cada ofício (escolha no cais).' },
  forge_w2: { b: 'forja', name: 'Bronze da Carranca', cost: 120, desc: 'Desbloqueia a 3ª arma de cada ofício.', req: (m) => (m.upgrades.forge_w1 ? (m.bosses.includes('carranca') ? true : 'Derrote A Carranca') : 'Requer Moldes Antigos') },
  forge_hp1: { b: 'forja', name: 'Couro Curtido', cost: 45, desc: '+3 de Vida máxima em todas as expedições.' },
  forge_hp2: { b: 'forja', name: 'Placas de Bronze', cost: 110, desc: '+3 de Vida máxima (total +6).', req: (m) => (m.upgrades.forge_hp1 ? true : 'Requer Couro Curtido') },
  apoth_belt: { b: 'botica', name: 'Bolsa de Cintura', cost: 40, desc: '+1 espaço de consumível (3 → 4).' },
  apoth_tonic: { b: 'botica', name: 'Tônico de Partida', cost: 50, desc: 'Comece cada expedição com um Tônico de Algas.' },
  apoth_rest: { b: 'botica', name: 'Unguento de Sal', cost: 70, desc: 'Bolsões de Ar curam 15% a mais.' },
  apoth_elixir: { b: 'botica', name: 'Elixir da Segunda Maré', cost: 160, desc: 'Uma vez por expedição: ao cair, você volta com metade da vida.', req: (m) => (m.bosses.includes('gardener') ? true : 'Derrote O Jardineiro') },
  light_relight: { b: 'farol', name: 'Reacender o Farol', cost: 60, desc: 'Desbloqueia o ofício Faroleiro.' },
  light_lens: { b: 'farol', name: 'Lente de Fresnel', cost: 100, desc: '+1 rodada de previsão na Tábua de Marés.', req: (m) => (m.upgrades.light_relight ? true : 'Reacenda o Farol') },
  light_signal: { b: 'farol', name: 'Sinais do Farol', cost: 80, desc: 'Revela o tipo de todos os locais no mapa dos distritos.', req: (m) => (m.upgrades.light_relight ? true : 'Reacenda o Farol') },
  dock_r2: { b: 'cais', name: 'Rota aos Jardins', cost: 70, desc: 'Comece expedições direto nos Jardins de Coral (nível 4, com algum equipamento).', req: (m) => (m.bosses.includes('carranca') ? true : 'Derrote A Carranca') },
  dock_r3: { b: 'cais', name: 'Rota aos Sinos', cost: 110, desc: 'Comece no Bairro dos Sinos (nível 7).', req: (m) => (m.bosses.includes('gardener') ? (m.upgrades.dock_r2 ? true : 'Requer Rota aos Jardins') : 'Derrote O Jardineiro') },
  dock_r4: { b: 'cais', name: 'Rota à Catedral', cost: 150, desc: 'Comece na Catedral do Abismo (nível 10).', req: (m) => (m.bosses.includes('sineiro') ? (m.upgrades.dock_r3 ? true : 'Requer Rota aos Sinos') : 'Derrote O Sineiro') },
  arch_study: { b: 'arquivo', name: 'Tratado dos Afogados', cost: 60, desc: 'Inimigos ficam Estudados com metade das derrotas (3 em vez de 6).' },
  arch_tomes: { b: 'arquivo', name: 'Biblioteca Salgada', cost: 90, desc: '+1 opção ao subir de nível (4 cartas).' },
  train_vig: { b: 'pedra', name: 'Carregar Pedras', cost: 50, desc: '+1 Vigor inicial.' },
  train_fol: { b: 'pedra', name: 'Prender a Respiração', cost: 50, desc: '+1 Fôlego inicial.' },
  train_imp: { b: 'pedra', name: 'Remar Contra a Corrente', cost: 80, desc: '+1 Ímpeto inicial.' },
  train_can: { b: 'pedra', name: 'Cantar às Ondas', cost: 80, desc: '+1 Canto inicial.' },
};

// Contratos da taverna: objetivo opcional por expedição.
export const CONTRACTS = {
  fire: { name: 'Fogo Purificador', desc: 'Derrote 6 inimigos com fogo ou chamas.', goal: 6, reward: 30, track: 'fireKills' },
  sink: { name: 'Pesca Pesada', desc: 'Afunde 3 inimigos pesados na água funda.', goal: 3, reward: 35, track: 'sinkKills' },
  pit: { name: 'Pelo Ralo', desc: 'Faça 3 inimigos caírem em ralos.', goal: 3, reward: 30, track: 'pitKills' },
  collide: { name: 'Bate-Estaca', desc: 'Derrote 8 inimigos com colisões.', goal: 8, reward: 30, track: 'collideKills' },
  elites: { name: 'Caçador de Elites', desc: 'Derrote 2 elites.', goal: 2, reward: 40, track: 'elites' },
  clean: { name: 'Sangue Frio', desc: 'Vença 3 combates sem sofrer dano.', goal: 3, reward: 40, track: 'flawless' },
  rescue: { name: 'Ninguém Fica Para Trás', desc: 'Resgate um morador.', goal: 1, reward: 30, track: 'rescues' },
  deep: { name: 'Mergulho Fundo', desc: 'Chegue ao Bairro dos Sinos.', goal: 3, reward: 45, track: 'district' },
  frugal: { name: 'Pão-Duro', desc: 'Termine a expedição com 60+ pérolas guardadas.', goal: 60, reward: 30, track: 'pearlsHeld' },
};

export const HEAT = [
  null,
  { name: 'Marés Vivas I', desc: 'Inimigos comuns +1 de vida.' },
  { name: 'Marés Vivas II', desc: 'Chefes +8 de vida.' },
  { name: 'Marés Vivas III', desc: 'Reforços chegam mais cedo em combates longos.' },
  { name: 'Marés Vivas IV', desc: 'Bolsões de Ar curam menos (−10%).' },
  { name: 'Marés Vivas V', desc: 'Inimigos causam +1 de dano a você.' },
  { name: 'Marés Vivas VI', desc: 'Preços do mercador +25%.' },
  { name: 'Marés Vivas VII', desc: 'Inimigos comuns +1 de vida (total +2).' },
  { name: 'Marés Vivas VIII', desc: 'Mais elites no mapa.' },
  { name: 'Marés Vivas IX', desc: 'Você começa com −3 de Vida máxima.' },
  { name: 'Marés Vivas X', desc: 'A maré é 1 nível mais alta em todos os combates.' },
];

export function heatMods(h) {
  return {
    enemyHp: (h >= 1 ? 1 : 0) + (h >= 7 ? 1 : 0),
    bossHp: h >= 2 ? 8 : 0,
    earlyWaves: h >= 3,
    restPenalty: h >= 4 ? 10 : 0,
    enemyDmg: h >= 5 ? 1 : 0,
    priceUp: h >= 6 ? 25 : 0,
    moreElites: h >= 8,
    hpMinus: h >= 9 ? 3 : 0,
    tideUp: h >= 10 ? 1 : 0,
  };
}
