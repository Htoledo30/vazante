// ICOR — Regiões do Ermo (Área C).
// Dados puros. Lidos por systems/mapgen.js, systems/expedition.js, systems/camp.js e telas de expedição.
//
// Campos principais (contrato ARCHITECTURE §C):
//   id, name, tier, travelHours (da cidade), desc, nodeCount, enemies (pesos), events (tags), bossId,
//   nestEnemy, unlock, dark?, palette
// Campos extras (Área C):
//   env        { light: open | canopy | always | glow, water, flesh (corrupção/hora), saltWounds }
//   ambushBase / campAmbush  chance base (%) de emboscada viajando / acampando
//   nodeWeights pesos dos tipos "livres" de nó; nests = nº de ninhos fixos; veins influi via peso
//   terrains   arestas: { id, name, h (horas), w (peso), hazard? }
//   hazards    perigos de aresta com teste: { name, text, check:{attr,diff}, fail:[efeitos], douse? }
//   traps      armadilhas de ruína: { id, name, spot (dif. AST), disarm (dif. DES), effects, salvage? }
//   ruinLoot / nestLoot / carcassScavengers / merchant
//   names      nomes de nós por tipo (sabor)
//   ambient    linhas curtas de chegada/escuridão/noite

export const REGION_ORDER = ['r1', 'r2', 'r3', 'r4', 'r5'];

/** Horas de luz de uma tocha (antes de modificadores light_eff). */
export const TORCH_HOURS = 6;
/** Horas de luz extras ao reforçar a tocha com sebo. */
export const TALLOW_HOURS = 3;
/** Horas entre refeições. */
export const MEAL_HOURS = 12;

/** Nomes e ícones dos tipos de nó (UI e registros). */
export const NODE_TYPES = {
  entry:    { name: 'Entrada',          icon: '⌂', desc: 'Onde a estrada da cidade morre. Daqui se volta para Valdrem.' },
  combat:   { name: 'Combate',          icon: '⚔', desc: 'Algo vive aqui e não vai deixar você passar.' },
  event:    { name: 'Desconhecido',     icon: '❖', desc: 'Sinais de gente, de bicho ou de coisa pior. Pode ser qualquer coisa.' },
  ruin:     { name: 'Ruína',            icon: '♜', desc: 'Saque esquecido. E o que o protege.' },
  camp:     { name: 'Abrigo',           icon: '△', desc: 'Um lugar defensável. Acampar aqui é mais seguro.' },
  shrine:   { name: 'Santuário',        icon: '✝', desc: 'Altar de algum deus. Talvez do morto.' },
  merchant: { name: 'Mercador errante', icon: '⚖', desc: 'Alguém vende coisas no fim do mundo. Caro. Talvez honesto.' },
  nest:     { name: 'Ninho',            icon: '☣', desc: 'A Chaga se reproduz aqui. Cresce se for ignorado. Destruir: Chaga −3.' },
  carcass:  { name: 'Carcaça',          icon: '☠', desc: 'Um dos seus morreu aqui. O que ele levava ainda está lá.' },
  passage:  { name: 'Passagem',         icon: '⇅', desc: 'Atalho para a cidade. Aberta ao ser alcançada.' },
  boss:     { name: 'Covil',            icon: '♛', desc: 'O senhor desta terra.' },
  vein:     { name: 'Veio de Icor',     icon: '◆', desc: 'O sangue do deus aflora. Colher custa horas e faz barulho.' },
};

/** Ritos de santuário (usados quando o santuário não gera evento do pool 'shrine'). Efeitos na linguagem de A. */
export const SHRINE_RITES = {
  sangria: {
    id: 'sangria', name: 'Sangrar no altar', desc: 'Abra a palma sobre a pedra. O medo escorre junto.',
    cost: [{ op: 'hp', n: -8 }], effects: [{ op: 'dread', n: -25 }],
  },
  oferenda: {
    id: 'oferenda', name: 'Derramar Icor', desc: 'Um frasco para o deus que já está morto. Algo ainda escuta.',
    cond: { ichor: 1 }, cost: [{ op: 'ichor', n: -1 }], effects: [{ op: 'heal', n: 25 }, { op: 'healWounds', n: 1 }],
  },
  pia: {
    id: 'pia', name: 'Beber da pia', desc: 'Água parada, dourada no fundo. Você vê longe. Longe demais.',
    cost: [{ op: 'corruption', n: 5 }], effects: [{ op: 'reveal', n: 5 }, { op: 'heal', n: 8 }],
  },
  vigilia: {
    id: 'vigilia', name: 'Vigília', desc: 'Horas de joelhos no frio. A Vontade decide se adianta.',
    hours: 3, check: { attr: 'von', diff: 20 },
    effects: [{ op: 'dread', n: -35 }], fail: [{ op: 'dread', n: 10 }],
  },
  profanar: {
    id: 'profanar', name: 'Profanar', desc: 'Arranque as oferendas. Ninguém vai reclamar. Ninguém vivo.',
    loot: { rolls: 2, coin: [5, 25], ichor: [0, 1], table: [['@trinket:T', 3], ['@consumable:T', 4], ['@material:T', 3]] },
    effects: [{ op: 'dread', n: 12 }, { op: 'rep', f: 'sutura', n: -4 }],
  },
  confissao: {
    id: 'confissao', name: 'Nomear os mortos', desc: 'Diga em voz alta o nome de cada um que a casa perdeu.',
    needDead: true, effects: [{ op: 'dread', n: -20 }, { op: 'reveal', n: 2 }],
  },
  cauterio: {
    id: 'cauterio', name: 'Brasa votiva', desc: 'As velas do altar ainda queimam. Encoste a ferida nelas.',
    cost: [{ op: 'hp', n: -5 }, { op: 'dread', n: 6 }], effects: [{ op: 'healWounds', n: 1 }],
  },
  sal_bento: {
    id: 'sal_bento', name: 'Raspar o sal do altar', desc: 'Sal consagrado. Arde nos mortos.',
    effects: [{ op: 'item', id: 'sal_bento', n: 1 }, { op: 'dread', n: 4 }],
  },
};

/** Ritos corrompidos (santuários tomados pela Chaga, Chaga alta). */
export const ROT_RITES = {
  comunhao: {
    id: 'comunhao', name: 'Comungar a podridão', desc: 'O altar pulsa. Morda.',
    cost: [{ op: 'corruption', n: 8 }], effects: [{ op: 'heal', n: 40 }, { op: 'ichor', n: 1 }],
  },
  ouvir: {
    id: 'ouvir', name: 'Encostar a orelha', desc: 'Alguém sussurra rotas por dentro da pedra.',
    cost: [{ op: 'dread', n: 15 }], effects: [{ op: 'reveal', n: 8 }],
  },
};

const R1 = {
  id: 'r1', name: 'Campos de Cinza', short: 'Cinza', tier: 1, travelHours: 6, nodeCount: 20,
  desc: 'Aldeias queimadas até o osso. Camponeses que não morreram direito. Cães que comem o que sobra.',
  env: { light: 'open', water: false, flesh: 0 },
  dark: false,
  ambushBase: 10, campAmbush: 14,
  nodeWeights: { combat: 30, event: 24, ruin: 13, camp: 8, shrine: 6, merchant: 7, vein: 7 },
  nests: 1,
  terrains: [
    { id: 'estrada', name: 'Estrada de cinza', h: 1, w: 4 },
    { id: 'campo', name: 'Campo queimado', h: 2, w: 5 },
    { id: 'vala', name: 'Vala de cadáveres', h: 2, w: 2, hazard: 'vala' },
    { id: 'brejo', name: 'Brejo de cinza', h: 3, w: 1, hazard: 'lama' },
  ],
  hazards: {
    vala: { name: 'Vala comum', text: 'Atravessar por cima dos corpos.', check: { attr: 'vig', diff: 0 },
      fail: [{ op: 'dread', n: 6 }, { op: 'hp', n: -3 }], failText: 'Você afunda até a cintura nos mortos. O cheiro não sai.' },
    lama: { name: 'Lama de cinza', text: 'Cinza molhada que segura as botas.', check: { attr: 'for', diff: 0 },
      fail: [{ op: 'time', h: 2 }], failText: 'Duas horas cavando a própria perna para fora.' },
  },
  enemies: { saqueador: 8, besteiro: 5, cao_chaga: 7, lavrador_oco: 7, corvos: 4, ceifeiro: 1 },
  fodder: ['saqueador', 'cao_chaga', 'lavrador_oco'],
  events: ['cinza', 'aldeia', 'campo'],
  bossId: 'mae_colheita', bossName: 'A Mãe-Colheita',
  nestEnemy: 'cao_chaga', nestName: 'Covil da matilha',
  fragment: 'olho',
  unlock: null,
  ichorMult: 1, lootTier: 1,
  palette: { bg: '#17120e', fog: '#2b231b', edge: '#5d4a38', accent: '#9a8a70', glow: '#c96a2a' },
  names: {
    entry: ['Marco da estrada'],
    combat: ['Encruzilhada', 'Cerca caída', 'Trigal negro', 'Forca do vigário', 'Poço seco', 'Estábulo aberto', 'Cemitério raso'],
    event: ['Casebre', 'Carroça tombada', 'Espantalho', 'Pomar morto', 'Fogueira apagada', 'Ponte de tábuas', 'Moenda'],
    ruin: ['Moinho queimado', 'Capela sem teto', 'Celeiro lacrado', 'Casa do coletor', 'Torre de vigia'],
    camp: ['Muro de pedra', 'Cripta de família', 'Curral fortificado'],
    shrine: ['Santa sem rosto', 'Cruz de estrada', 'Altar de colheita'],
    merchant: ['Carroça coberta', 'Barraca de trapos'],
    vein: ['Rachadura dourada', 'Poça que brilha'],
    nest: ['Covil da matilha', 'Toca dos cães'],
    passage: ['Túnel de contrabando', 'Bueiro do aqueduto'],
    boss: ['O Grande Trigal'],
  },
  ruinLoot: { rolls: 2, coin: [4, 18], ichor: [0, 1],
    table: [['@consumable:1', 30], ['@material:1', 30, 1, 3], ['@weapon:1', 9], ['@armor:1', 9], ['racao', 10], ['tocha', 10], ['bandagem', 8], ['@trinket:1', 3]] },
  nestLoot: { rolls: 2, coin: [0, 6], ichor: [2, 4], table: [['osso', 20, 1, 3], ['dente', 20, 1, 3], ['tendao', 15, 1, 2], ['carne_podre', 15, 1, 2], ['@trinket:1', 4]] },
  traps: [
    { id: 'urso', name: 'Armadilha de urso', spot: 0, disarm: 0, text: 'Mandíbulas de ferro sob a palha.',
      effects: [{ op: 'hp', n: -8 }, { op: 'wound', part: 'pernas', dtype: 'perf', sev: 2 }], salvage: [{ op: 'item', id: 'sucata', n: 2 }] },
    { id: 'telhado', name: 'Viga podre', spot: 20, disarm: 20, text: 'O teto inteiro está preso por um fio.',
      effects: [{ op: 'hp', n: -10 }, { op: 'wound', part: 'cabeca', dtype: 'impacto', sev: 1 }] },
    { id: 'estaca', name: 'Fosso de estacas', spot: 20, disarm: 0, text: 'Tábuas finas sobre estacas sujas de merda.',
      effects: [{ op: 'hp', n: -7 }, { op: 'wound', part: 'pernas', dtype: 'perf', sev: 1 }] },
  ],
  carcassScavengers: ['cao_chaga', 'cao_chaga'],
  merchant: { markup: 1.8, purse: [40, 90], guards: ['desertor', 'desertor'], ambushers: ['saqueador', 'saqueador', { id: 'besteiro', dist: 2 }] },
  ambient: {
    arrive: ['Cinza até os tornozelos.', 'Um sino toca longe. Não tem igreja ali.', 'O vento traz cheiro de porco assado. Não é porco.'],
    dark: ['Você ouve passos que param quando você para.', 'Algo arrasta um saco pesado na escuridão.'],
    night: ['Os ocos saem dos campos à noite. Dá para ouvir as foices.'],
  },
};

const R2 = {
  id: 'r2', name: 'Floresta dos Enforcados', short: 'Floresta', tier: 2, travelHours: 10, nodeCount: 23,
  desc: 'Cada galho tem um corpo. Alguns ainda chutam. As copas fecham o céu: aqui é sempre crepúsculo.',
  env: { light: 'canopy', water: false, flesh: 0 },
  dark: false,
  ambushBase: 14, campAmbush: 18,
  nodeWeights: { combat: 31, event: 24, ruin: 11, camp: 7, shrine: 7, merchant: 5, vein: 8 },
  nests: 1,
  terrains: [
    { id: 'trilha', name: 'Trilha de caçador', h: 2, w: 4 },
    { id: 'mata', name: 'Mata fechada', h: 3, w: 4, hazard: 'espinhos' },
    { id: 'forcas', name: 'Bosque das forcas', h: 2, w: 3, hazard: 'forca' },
    { id: 'charco', name: 'Charco de raízes', h: 4, w: 1, hazard: 'raizes' },
  ],
  hazards: {
    espinhos: { name: 'Espinheiro', text: 'Espinhos do tamanho de dedos.', check: { attr: 'des', diff: 0 },
      fail: [{ op: 'hp', n: -5 }, { op: 'wound', part: 'bracoE', dtype: 'corte', sev: 1 }], failText: 'Os espinhos levam pele em tiras.' },
    forca: { name: 'Forcas', text: 'Corpos pendurados baixo demais. Às vezes caem.', check: { attr: 'ast', diff: 20 },
      fail: [{ op: 'hp', n: -6 }, { op: 'dread', n: 10 }], failText: 'Um enforcado despenca em cima de você, ainda morno.' },
    raizes: { name: 'Raízes', text: 'Raízes que se mexem quando você não olha.', check: { attr: 'for', diff: 20 },
      fail: [{ op: 'hp', n: -4 }, { op: 'time', h: 2 }, { op: 'dread', n: 5 }], failText: 'Elas apertam até o osso estalar.' },
  },
  enemies: { enforcado: 7, lobo_tendao: 7, bruxa_casca: 4, cacador_cabecas: 5, tecela: 4, cervo_podre: 1 },
  fodder: ['enforcado', 'lobo_tendao'],
  events: ['floresta', 'enforcados', 'bruxa'],
  bossId: 'rei_galhado', bossName: 'O Rei Galhado',
  nestEnemy: 'lobo_tendao', nestName: 'Toca de tendões',
  fragment: 'lingua',
  unlock: { boss: 'r1' },
  ichorMult: 1.2, lootTier: 2,
  palette: { bg: '#0e130d', fog: '#1d261a', edge: '#3f4f33', accent: '#7f9a62', glow: '#a9c26a' },
  names: {
    entry: ['Orla da mata'],
    combat: ['Clareira dos ossos', 'Carvalho das cordas', 'Trilha de sangue', 'Riacho podre', 'Toco oco', 'Árvore-forca'],
    event: ['Cabana de casca', 'Círculo de pedras', 'Corpo que fala', 'Fio de seda', 'Ninho de corvo', 'Altar de chifres'],
    ruin: ['Pavilhão de caça', 'Mosteiro engolido', 'Serraria', 'Torre do guarda-florestal'],
    camp: ['Tronco caído', 'Gruta de raiz', 'Plataforma de caçador'],
    shrine: ['Ídolo de galhos', 'Árvore sagrada', 'Capela da forca'],
    merchant: ['Cabana do mascate', 'Fogueira de estranhos'],
    vein: ['Seiva dourada', 'Raiz sangrando'],
    nest: ['Toca de tendões', 'Covil da alcateia'],
    passage: ['Leito do rio seco', 'Galeria de toupeiras'],
    boss: ['O Trono de Galhos'],
  },
  ruinLoot: { rolls: 2, coin: [6, 24], ichor: [0, 2],
    table: [['@consumable:2', 30], ['@material:2', 28, 1, 3], ['@weapon:2', 10], ['@armor:2', 10], ['racao', 8], ['tocha', 12], ['ervas', 10, 1, 3], ['@trinket:2', 4]] },
  nestLoot: { rolls: 2, coin: [0, 8], ichor: [2, 5], table: [['tendao', 25, 1, 3], ['osso', 15, 1, 3], ['dente', 15, 1, 3], ['couro', 15, 1, 2], ['@trinket:2', 5]] },
  traps: [
    { id: 'laco', name: 'Laço de forca', spot: 20, disarm: 0, text: 'Uma corda no chão, presa a um galho vergado.',
      effects: [{ op: 'hp', n: -9 }, { op: 'wound', part: 'pernas', dtype: 'impacto', sev: 1 }, { op: 'dread', n: 8 }], salvage: [{ op: 'item', id: 'tendao', n: 1 }] },
    { id: 'colmeia', name: 'Colmeia de vespas-cadáver', spot: 0, disarm: 20, text: 'Um zumbido dentro da parede.',
      effects: [{ op: 'hp', n: -12 }, { op: 'dread', n: 6 }] },
    { id: 'esporos', name: 'Esporos', spot: 40, disarm: 20, text: 'Cogumelos brancos no batente. Respire devagar.',
      effects: [{ op: 'hp', n: -5 }, { op: 'corruption', n: 3 }] },
  ],
  carcassScavengers: ['lobo_tendao', 'lobo_tendao'],
  merchant: { markup: 1.9, purse: [50, 110], guards: ['desertor', 'cacador_bruxas'], ambushers: ['cacador_cabecas', 'cacador_cabecas'] },
  ambient: {
    arrive: ['As cordas rangem todas juntas, como se respirassem.', 'Um enforcado vira a cabeça para acompanhar você.', 'Aqui nenhum pássaro canta.'],
    dark: ['Sob as copas não há dia. Só menos noite.', 'Algo desce de uma árvore atrás de você.'],
    night: ['À noite os enforcados descem.'],
  },
};

const R3 = {
  id: 'r3', name: 'Catacumbas de Sal', short: 'Catacumbas', tier: 3, travelHours: 14, nodeCount: 25,
  desc: 'Minas de sal que viraram ossuário da Sutura. Nenhuma luz entra. Tudo que entra fica.',
  env: { light: 'always', water: false, flesh: 0, saltWounds: true },
  dark: true,
  ambushBase: 16, campAmbush: 20,
  nodeWeights: { combat: 32, event: 22, ruin: 15, camp: 6, shrine: 8, merchant: 4, vein: 8 },
  nests: 2,
  terrains: [
    { id: 'corredor', name: 'Corredor de nichos', h: 1, w: 4 },
    { id: 'galeria', name: 'Galeria de sal', h: 2, w: 4 },
    { id: 'desabamento', name: 'Desabamento', h: 3, w: 2, hazard: 'desabamento' },
    { id: 'poco', name: 'Poço de descida', h: 2, w: 1, hazard: 'queda' },
  ],
  hazards: {
    desabamento: { name: 'Teto solto', text: 'Rastejar sob pedra rachada.', check: { attr: 'des', diff: 20 },
      fail: [{ op: 'hp', n: -8 }, { op: 'wound', part: 'tronco', dtype: 'impacto', sev: 1 }], failText: 'O teto desce. Suas costelas cedem primeiro.' },
    queda: { name: 'Corda podre', text: 'Descer por uma corda que ninguém trocou em trinta anos.', check: { attr: 'for', diff: 20 },
      fail: [{ op: 'hp', n: -10 }, { op: 'wound', part: 'pernas', dtype: 'impacto', sev: 2 }], failText: 'A corda arrebenta. O chão não.' },
  },
  enemies: { esqueleto_placas: 6, carnical: 7, sacerdote_renegado: 4, verme_ossos: 5, costurado: 5, guardiao_sal: 1 },
  fodder: ['carnical', 'esqueleto_placas'],
  events: ['catacumba', 'sutura', 'sal'],
  bossId: 'bispo_costurado', bossName: 'O Bispo Costurado',
  nestEnemy: 'carnical', nestName: 'Fosso dos carniçais',
  fragment: 'mao',
  unlock: { boss: 'r2' },
  ichorMult: 1.4, lootTier: 3,
  palette: { bg: '#121212', fog: '#22211f', edge: '#4a4842', accent: '#cfcac0', glow: '#e8e1cf' },
  names: {
    entry: ['Boca da mina'],
    combat: ['Ossário', 'Nave dos crânios', 'Câmara de nichos', 'Corredor das mãos', 'Cisterna seca', 'Galeria do bispo'],
    event: ['Confessionário', 'Capela de ossos', 'Cela', 'Mesa de costura', 'Fonte de salmoura', 'Escadaria'],
    ruin: ['Sacristia', 'Arquivo da Sutura', 'Cripta de abades', 'Depósito de sal'],
    camp: ['Nicho selado', 'Sala da guarda', 'Câmara alta'],
    shrine: ['Altar da agulha', 'Relicário', 'Santo costurado'],
    merchant: ['Mineiro perdido', 'Contrabandista de sal'],
    vein: ['Veio no sal', 'Estalactite dourada'],
    nest: ['Fosso dos carniçais', 'Câmara dos vermes'],
    passage: ['Poço de ventilação', 'Galeria dos mineiros'],
    boss: ['A Catedral Costurada'],
  },
  ruinLoot: { rolls: 3, coin: [10, 34], ichor: [1, 2],
    table: [['@consumable:3', 28], ['@material:3', 24, 1, 3], ['@weapon:3', 10], ['@armor:3', 12], ['sal', 10, 1, 3], ['tocha', 12], ['@trinket:3', 5], ['agua_benta', 4]] },
  nestLoot: { rolls: 2, coin: [2, 12], ichor: [3, 6], table: [['osso', 25, 2, 4], ['carne_podre', 20, 1, 3], ['dente', 15, 1, 3], ['@trinket:3', 6]] },
  traps: [
    { id: 'lamina', name: 'Lâmina de pêndulo', spot: 20, disarm: 40, text: 'Um sulco fino no chão, na largura de um homem.',
      effects: [{ op: 'hp', n: -14 }, { op: 'wound', part: 'bracoE', dtype: 'corte', sev: 2 }], salvage: [{ op: 'item', id: 'ferro_negro', n: 1 }] },
    { id: 'sal_vivo', name: 'Sal vivo', spot: 20, disarm: 20, text: 'Cristais que cortam ao toque e não deixam cicatrizar.',
      effects: [{ op: 'hp', n: -8 }, { op: 'wound', part: 'bracoD', dtype: 'corte', sev: 1 }], salvage: [{ op: 'item', id: 'sal', n: 2 }] },
    { id: 'gas', name: 'Gás de cripta', spot: 40, disarm: 20, text: 'Ar que tem gosto de moeda.',
      effects: [{ op: 'hp', n: -6 }, { op: 'dread', n: 12 }] },
  ],
  carcassScavengers: ['carnical', 'carnical'],
  merchant: { markup: 2.0, purse: [60, 140], guards: ['zelote', 'zelote'], ambushers: ['carnical', 'sacerdote_renegado'] },
  ambient: {
    arrive: ['O sal range sob as botas como dente.', 'Mil nichos, mil crânios, todos olhando.', 'Uma reza escorre de algum lugar. A voz está errada.'],
    dark: ['Escuridão total. Você ouve mastigação.', 'Dedos frios tocam seu rosto e somem.'],
    night: ['Lá em cima é noite. Aqui não faz diferença.'],
  },
};

const R4 = {
  id: 'r4', name: 'Vel-Maren', short: 'Vel-Maren', tier: 4, travelHours: 18, nodeCount: 27,
  desc: 'A cidade afogada. A maré sobe e desce dentro das casas. Os afogados incham e estouram.',
  env: { light: 'open', water: true, flesh: 0 },
  dark: false,
  ambushBase: 16, campAmbush: 20,
  nodeWeights: { combat: 32, event: 23, ruin: 14, camp: 6, shrine: 6, merchant: 5, vein: 9 },
  nests: 2,
  terrains: [
    { id: 'telhados', name: 'Telhados', h: 2, w: 3, hazard: 'telhas' },
    { id: 'viela', name: 'Viela alagada', h: 2, w: 4 },
    { id: 'canal', name: 'Canal', h: 3, w: 3, hazard: 'afogamento' },
    { id: 'ponte', name: 'Ponte podre', h: 1, w: 2, hazard: 'ponte' },
  ],
  hazards: {
    afogamento: { name: 'Nado', text: 'Água preta até o pescoço. Peso puxa para baixo.', check: { attr: 'vig', diff: 20 }, heavy: true, douse: true,
      fail: [{ op: 'hp', n: -12 }, { op: 'dread', n: 8 }], failText: 'Você engole a água do deus. Algo lá embaixo segura seu tornozelo.' },
    telhas: { name: 'Telhas soltas', text: 'Pular de telhado em telhado.', check: { attr: 'des', diff: 20 },
      fail: [{ op: 'hp', n: -8 }, { op: 'wound', part: 'pernas', dtype: 'impacto', sev: 1 }], failText: 'As telhas descem junto com você.' },
    ponte: { name: 'Ponte', text: 'Tábuas moles sobre o canal.', check: { attr: 'ast', diff: 0 }, douse: true,
      fail: [{ op: 'hp', n: -6 }, { op: 'dread', n: 5 }], failText: 'A ponte cede. Você sai do canal tossindo sal e cabelo.' },
  },
  enemies: { afogado: 7, pescador: 5, sereia_carcaca: 4, caranguejo_ossario: 5, enguia_icor: 4, cavaleiro_mare: 1 },
  fodder: ['afogado', 'caranguejo_ossario'],
  events: ['afogada', 'mare', 'canto'],
  bossId: 'voz_submersa', bossName: 'A Voz Submersa',
  nestEnemy: 'afogado', nestName: 'Cardume de afogados',
  fragment: 'ventre',
  unlock: { boss: 'r3' },
  ichorMult: 1.6, lootTier: 4,
  palette: { bg: '#0b1114', fog: '#16232a', edge: '#33505c', accent: '#7fa7b5', glow: '#7fd0d8' },
  names: {
    entry: ['Cais quebrado'],
    combat: ['Praça submersa', 'Mercado de peixe', 'Rua dos sinos', 'Doca', 'Lavanderia', 'Escadaria do porto'],
    event: ['Casa inundada', 'Barco preso', 'Farol', 'Sino afogado', 'Rede cheia', 'Varanda'],
    ruin: ['Casa de contagem', 'Alfândega', 'Igreja do mar', 'Armazém de sal'],
    camp: ['Sótão seco', 'Torre do relógio', 'Casco virado'],
    shrine: ['Senhora das marés', 'Nicho de conchas', 'Altar de redes'],
    merchant: ['Barqueiro', 'Catador de naufrágios'],
    vein: ['Maré dourada', 'Poça de Icor salgado'],
    nest: ['Cardume de afogados', 'Ninho de ovos de carne'],
    passage: ['Esgoto real', 'Canal dos contrabandistas'],
    boss: ['O Fundo'],
  },
  ruinLoot: { rolls: 3, coin: [14, 44], ichor: [1, 3],
    table: [['@consumable:4', 28], ['@material:4', 22, 1, 3], ['@weapon:4', 11], ['@armor:4', 11], ['racao', 8], ['tocha', 8], ['@trinket:4', 6], ['polvora', 6]] },
  nestLoot: { rolls: 2, coin: [4, 16], ichor: [4, 7], table: [['bile', 25, 1, 3], ['carne_podre', 20, 1, 3], ['dente', 15, 1, 3], ['@trinket:4', 6]] },
  traps: [
    { id: 'alcapao', name: 'Alçapão inundado', spot: 20, disarm: 20, text: 'O assoalho flutua.',
      effects: [{ op: 'hp', n: -12 }, { op: 'dread', n: 10 }, { op: 'light', h: -99 }] },
    { id: 'anzois', name: 'Cortina de anzóis', spot: 40, disarm: 20, text: 'Linhas de pesca cruzando a porta. Brilham.',
      effects: [{ op: 'hp', n: -10 }, { op: 'wound', part: 'cabeca', dtype: 'perf', sev: 1 }], salvage: [{ op: 'item', id: 'sucata', n: 2 }] },
    { id: 'bolsa_bile', name: 'Bolsa de bile', spot: 0, disarm: 40, text: 'Um saco inchado preso ao teto.',
      effects: [{ op: 'hp', n: -9 }, { op: 'corruption', n: 4 }], salvage: [{ op: 'item', id: 'bile', n: 2 }] },
  ],
  carcassScavengers: ['caranguejo_ossario', 'caranguejo_ossario'],
  merchant: { markup: 2.1, purse: [80, 180], guards: ['desertor', 'desertor'], ambushers: ['pescador', 'pescador'] },
  ambient: {
    arrive: ['A água sobe meio palmo enquanto você olha.', 'Sinos submersos tocam com a maré.', 'Uma mulher canta debaixo d’água. Não pare para ouvir.'],
    dark: ['Coisas roçam suas pernas na água escura.', 'O canto fica mais perto quando a luz some.'],
    night: ['Maré da noite: as ruas viram rio.'],
  },
};

const R5 = {
  id: 'r5', name: 'O Cadáver', short: 'Cadáver', tier: 5, travelHours: 22, nodeCount: 30,
  desc: 'Dentro do deus. Carne quente, rios de Icor, ossos do tamanho de torres. Respirar aqui já corrompe.',
  env: { light: 'glow', water: false, flesh: 0.5 },
  dark: false,
  ambushBase: 20, campAmbush: 26,
  nodeWeights: { combat: 34, event: 22, ruin: 10, camp: 5, shrine: 6, merchant: 3, vein: 14 },
  nests: 2,
  terrains: [
    { id: 'tendao', name: 'Ponte de tendão', h: 2, w: 3, hazard: 'tendao' },
    { id: 'viscera', name: 'Víscera', h: 3, w: 4 },
    { id: 'arteria', name: 'Artéria', h: 2, w: 3, hazard: 'arteria' },
    { id: 'osso', name: 'Canal de medula', h: 2, w: 2 },
  ],
  hazards: {
    tendao: { name: 'Tendão vivo', text: 'A ponte se contrai enquanto você passa.', check: { attr: 'des', diff: 20 },
      fail: [{ op: 'hp', n: -12 }, { op: 'wound', part: 'pernas', dtype: 'impacto', sev: 2 }], failText: 'O tendão chicoteia e te arremessa contra o osso.' },
    arteria: { name: 'Pulso', text: 'O sangue do deus passa em ondas.', check: { attr: 'vig', diff: 40 },
      fail: [{ op: 'corruption', n: 4 }, { op: 'ichor', n: 1 }], failText: 'A onda te cobre. Você engole. É bom. Isso é o pior.' },
  },
  enemies: { anticorpo: 7, filho_icor: 6, verme_divino: 4, bebedor_ascendido: 4, anjo_carne: 1 },
  fodder: ['anticorpo', 'filho_icor'],
  events: ['cadaver', 'carne', 'icor'],
  bossId: 'coracao', bossName: 'O Coração',
  nestEnemy: 'filho_icor', nestName: 'Útero de Icor',
  fragment: null,
  unlock: { boss: 'r4' },
  ichorMult: 2.2, lootTier: 5,
  palette: { bg: '#170a0b', fog: '#2c1214', edge: '#6b2a2a', accent: '#d8b23a', glow: '#f0c84a' },
  names: {
    entry: ['A Ferida'],
    combat: ['Câmara de pus', 'Nervo exposto', 'Costela', 'Gânglio', 'Válvula', 'Fígado'],
    event: ['Bolha', 'Dente engolido', 'Olho interno', 'Peregrinos mortos', 'Útero vazio', 'Pulmão'],
    ruin: ['Acampamento de Bebedores', 'Expedição da Coroa', 'Ossário de peregrinos'],
    camp: ['Cavidade seca', 'Vértebra oca', 'Cripta de cartilagem'],
    shrine: ['Altar de dentes', 'Ícone de carne'],
    merchant: ['Bebedor que vende'],
    vein: ['Fonte de Icor', 'Ferida aberta', 'Capilar dourado'],
    nest: ['Útero de Icor', 'Colmeia de anticorpos'],
    passage: ['Garganta do deus', 'Fístula'],
    boss: ['O Coração'],
  },
  ruinLoot: { rolls: 3, coin: [20, 60], ichor: [2, 4],
    table: [['@consumable:5', 26], ['@material:5', 20, 1, 3], ['@weapon:5', 12], ['@armor:5', 12], ['lasca_divina', 8], ['elixir_icor', 6], ['@trinket:5', 8], ['tocha', 8]] },
  nestLoot: { rolls: 2, coin: [0, 10], ichor: [6, 10], table: [['lasca_divina', 20], ['bile', 20, 1, 3], ['carne_podre', 20, 1, 3], ['@trinket:5', 8]] },
  traps: [
    { id: 'esfincter', name: 'Esfíncter', spot: 20, disarm: 40, text: 'A passagem pulsa. Fecha a cada três batidas.',
      effects: [{ op: 'hp', n: -16 }, { op: 'wound', part: 'tronco', dtype: 'impacto', sev: 2 }] },
    { id: 'acido', name: 'Bolsa de suco', spot: 20, disarm: 20, text: 'O chão aqui é estômago.',
      effects: [{ op: 'hp', n: -12 }, { op: 'wound', part: 'pernas', dtype: 'fogo', sev: 1 }], salvage: [{ op: 'item', id: 'bile', n: 2 }] },
    { id: 'espinho', name: 'Espinhos de osso', spot: 40, disarm: 40, text: 'Farpas de osso divino nas paredes.',
      effects: [{ op: 'hp', n: -10 }, { op: 'corruption', n: 5 }], salvage: [{ op: 'item', id: 'lasca_divina', n: 1 }] },
  ],
  carcassScavengers: ['anticorpo', 'anticorpo'],
  merchant: { markup: 2.4, purse: [100, 220], guards: ['bebedor', 'bebedor'], ambushers: ['bebedor_ascendido', 'bebedor'] },
  ambient: {
    arrive: ['O chão bate como um peito.', 'Calor. Umidade. Um cheiro doce que gruda nos dentes.', 'Você ouve o coração. Todo mundo ouve.'],
    dark: ['Escuridão quente e molhada. Algo te digere devagar.'],
    night: ['Não há noite dentro do deus. Mas algo dorme e algo acorda.'],
  },
};

export const REGIONS = { r1: R1, r2: R2, r3: R3, r4: R4, r5: R5 };

/** Próxima região na ordem (ou null). */
export function nextRegion(id) {
  const i = REGION_ORDER.indexOf(id);
  return i >= 0 && i < REGION_ORDER.length - 1 ? REGION_ORDER[i + 1] : null;
}

/** Ids de fragmento -> item de chave canônico. */
export const FRAGMENT_ITEMS = { olho: 'fragmento_olho', lingua: 'fragmento_lingua', mao: 'fragmento_mao', ventre: 'fragmento_ventre' };
