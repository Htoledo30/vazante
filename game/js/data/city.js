// Valdrem: distritos/serviços, horários, receitas, unções, ritos, bênçãos, boatos, melhorias da Casa.
// Dono: Área D. Lógica em systems/city.js.

/** Serviços da cidade. hours: [abre, fecha) em horas do dia (fecha < abre = atravessa a noite). null = sempre. */
export const SERVICES = {
  ferreiro: {
    id: 'ferreiro', name: 'Ferreiro', who: 'Brun Sem-Dedos', icon: '⚒', district: 'Rua das Forjas',
    desc: 'O martelo não para. Brun perdeu três dedos para uma lâmina que ele mesmo forjou.',
    hours: [7, 19], faction: 'guilda', buys: ['weapon', 'armor', 'offhand', 'ammo'], losable: true,
  },
  barbeiro: {
    id: 'barbeiro', name: 'Barbeiro-cirurgião', who: 'Mestre Odo', icon: '✂', district: 'Beco dos Serrotes',
    desc: 'Serras, ferros em brasa, um balde que nunca fica vazio. Odo corta cabelo também.',
    hours: null, faction: null, buys: [], losable: true,
  },
  boticario: {
    id: 'boticario', name: 'Boticário', who: 'Velha Ama', icon: '⚗', district: 'Rua das Ervas',
    desc: 'Potes de vidro turvo, raízes, coisas que se mexem em salmoura.',
    hours: [7, 21], faction: 'guilda', buys: ['consumable', 'material'], losable: true,
  },
  templo: {
    id: 'templo', name: 'Templo da Sutura', who: 'Madre Ostra', icon: '✚', district: 'Colina da Agulha',
    desc: 'Mortos costurados nas paredes como tapeçaria. O cheiro de incenso não cobre o resto.',
    hours: null, faction: 'sutura', buys: [], losable: true,
  },
  quartel: {
    id: 'quartel', name: 'Quartel da Guarda', who: 'Marechal Vane', icon: '♜', district: 'Pátio das Forcas',
    desc: 'Capas cinzentas, forcas ocupadas, um quadro de contratos pregado com facas.',
    hours: null, faction: 'coroa', buys: [], losable: true,
  },
  guilda: {
    id: 'guilda', name: 'Guilda dos Carniceiros', who: 'Mestra Ilse Corvo', icon: '⚖', district: 'Mercado do Sangue',
    desc: 'Balanças de ouro e ganchos de açougue. Aqui o deus é vendido a peso.',
    hours: [6, 22], faction: 'guilda', buys: ['material', 'trinket', 'key'], losable: true,
  },
  taverna: {
    id: 'taverna', name: 'Taverna do Enforcado', who: 'Greta Meia-Orelha', icon: '🍺', district: 'Baixa',
    desc: 'Cerveja aguada, dados de osso, mercenários sem dono. Todo boato passa por aqui.',
    hours: [11, 5], faction: null, buys: [], losable: true,
  },
  antro: {
    id: 'antro', name: 'Antro dos Bebedores', who: 'O Sem-Pele', icon: '☩', district: 'Esgotos',
    desc: 'Um poço sob o matadouro. Velas de sebo humano. Gente que brilha por dentro.',
    hours: [20, 6], faction: 'bebedores', buys: [], hidden: true, losable: false,
  },
  casa: {
    id: 'casa', name: 'Casa', who: '', icon: '⌂', district: 'Rua dos Carniceiros',
    desc: 'O que sobrou da sua casa. Retratos de mortos, um baú, uma cama fria.',
    hours: null, faction: null, buys: [], losable: false,
  },
  muralha: {
    id: 'muralha', name: 'Muralha', who: 'Sargento Hulda', icon: '▦', district: 'Ameias Norte',
    desc: 'Pedra velha remendada com ossos e madeira. Do outro lado, a Chaga respira.',
    hours: null, faction: 'coroa', buys: [], losable: false,
  },
  portao: {
    id: 'portao', name: 'Portão', who: '', icon: '⛩', district: 'Portão da Cinza',
    desc: 'O único caminho para o Ermo. Os guardas não olham quem sai, só quem volta.',
    hours: null, faction: null, buys: [], losable: false,
  },
};

/** Ordem no hub (cartões). */
export const SERVICE_ORDER = ['casa', 'ferreiro', 'barbeiro', 'boticario', 'templo', 'quartel', 'guilda', 'taverna', 'antro', 'muralha', 'portao'];

/** Distritos que podem cair em cercos, em ordem de exposição (os primeiros caem primeiro). */
export const SIEGE_DISTRICT_ORDER = ['taverna', 'boticario', 'ferreiro', 'guilda', 'barbeiro', 'quartel', 'templo'];

// ---------------------------------------------------------------- ferreiro
/** Melhorar qualidade: custo por qualidade atual -> próxima. */
export const QUALITY_UP = {
  0: { coin: 20, mats: [['sucata', 2]], hours: 4 },
  1: { coin: 60, mats: [['ferro_negro', 1], ['sucata', 2]], hours: 8 },
  2: { coin: 160, mats: [['ferro_negro', 2], ['lasca_divina', 1]], hours: 24 },
};

/**
 * Unções: definições (nome, custo em Icor/moedas, efeito) vêm de ENCHANTS em data/items.js (Área A).
 * D acrescenta o MATERIAL exigido pelo ferreiro e as horas de trabalho.
 */
export const ENCHANT_EXTRA = {
  uncao_fogo: { mats: [['polvora', 1], ['sebo', 1]], hours: 3 },
  uncao_icor: { mats: [['lasca_divina', 1]], hours: 6 },
  uncao_sal: { mats: [['sal', 2]], hours: 3 },
  uncao_sangue: { mats: [['sanguessuga', 1]], hours: 3 },
  uncao_bile: { mats: [['bile', 2]], hours: 3 },
  uncao_ferro: { mats: [['sucata', 2]], hours: 4 },
  uncao_cinza: { mats: [['sebo', 1]], hours: 3 },
};
/** Onde cada unção é feita (o Antro faz as "impuras"). */
export const ENCHANT_WHERE = { ferreiro: ['uncao_fogo', 'uncao_sal', 'uncao_ferro', 'uncao_cinza'], antro: ['uncao_icor', 'uncao_sangue', 'uncao_bile'] };

// ---------------------------------------------------------------- receitas (boticário/ferreiro)
/** where: serviço onde se fabrica; ast: Astúcia mínima para dose dupla (fora disso, 1). */
export const RECIPES = [
  { id: 'r_bandagem', where: 'boticario', out: ['bandagem', 2], in: [['pano', 2]], coin: 0, hours: 1 },
  { id: 'r_unguento', where: 'boticario', out: ['unguento', 1], in: [['ervas', 2], ['sebo', 1]], coin: 2, hours: 2, ast: 6 },
  { id: 'r_tonico', where: 'boticario', out: ['tonico', 1], in: [['ervas', 1], ['bile', 1]], coin: 4, hours: 2, ast: 6 },
  { id: 'r_papoula', where: 'boticario', out: ['papoula', 1], in: [['ervas', 3]], coin: 0, hours: 2, ast: 5 },
  { id: 'r_veneno', where: 'boticario', out: ['veneno', 1], in: [['bile', 1], ['cabelo_bruxa', 1]], coin: 5, hours: 3, ast: 7 },
  { id: 'r_oleo', where: 'boticario', out: ['oleo', 1], in: [['sebo', 2]], coin: 1, hours: 1, ast: 5 },
  { id: 'r_bomba', where: 'boticario', out: ['bomba', 1], in: [['polvora', 1], ['sucata', 1], ['pano', 1]], coin: 5, hours: 3, ast: 7 },
  { id: 'r_bomba_cal', where: 'boticario', out: ['bomba_cal', 1], in: [['sal', 1], ['polvora', 1]], coin: 5, hours: 3, ast: 7 },
  { id: 'r_tocha', where: 'boticario', out: ['tocha', 2], in: [['pano', 1], ['sebo', 1]], coin: 0, hours: 1 },
  { id: 'r_racao', where: 'boticario', out: ['racao', 2], in: [['carne_podre', 2], ['sal', 1]], coin: 0, hours: 3, risk: { id: 'infect', pct: 15 } },
  { id: 'r_agua_benta', where: 'boticario', out: ['agua_benta', 1], in: [['sal', 1]], coin: 6, hours: 2, need: { rep: { f: 'sutura', min: 0 } } },
  { id: 'r_elixir', where: 'boticario', out: ['elixir_icor', 1], in: [['ervas', 1], ['bile', 1]], ichor: 1, coin: 8, hours: 4, ast: 8 },
  { id: 'r_faca_arr', where: 'ferreiro', out: ['faca_arremesso', 3], in: [['sucata', 2]], coin: 4, hours: 2 },
  { id: 'r_virote', where: 'ferreiro', out: ['virote', 6], in: [['sucata', 1], ['osso', 1]], coin: 2, hours: 2 },
  { id: 'r_ferro', where: 'ferreiro', out: ['ferro_quente', 1], in: [['sucata', 1], ['polvora', 1]], coin: 3, hours: 1 },
  { id: 'r_tala', where: 'boticario', out: ['tala', 2], in: [['osso', 1], ['pano', 1]], coin: 0, hours: 1 },
];

// ---------------------------------------------------------------- barbeiro
export const BARBER = {
  baseCoin: 12,          // cirurgia: base + dias restantes × perDay
  perDay: 4,
  infectedExtra: 15,
  nightMult: 1.5,        // atendimento fora de hora (20h–6h)
  amputateCoin: 10,
  prosthetics: {
    gancho: { part: ['bracoD', 'bracoE'], coin: 90, mats: [['sucata', 2], ['couro', 1]], days: 2, name: 'Gancho de ferro', desc: 'Ferro no coto. Corta e puxa. Não segura espada.' },
    perna_pau: { part: ['pernas'], coin: 70, mats: [['couro', 1]], days: 2, name: 'Perna de pau', desc: 'Volta a andar. Correr, nunca mais.' },
    olho_vidro: { part: ['cabeca'], coin: 60, mats: [], days: 1, name: 'Olho de vidro', desc: 'Não enxerga. Mas os outros param de olhar o buraco.' },
  },
  bloodletting: { coin: 10, hours: 4, corruption: -10, hpMaxPct: -15, days: 3 },
  suture: { coinPer10: 6, hoursPer10: 1 },
};

// ---------------------------------------------------------------- templo
export const PENANCES = [
  { id: 'confissao', name: 'Confissão', desc: 'Ajoelhar no sal e contar tudo à grade.', coin: 10, hours: 2, dread: -12, corruption: 0, rep: 1 },
  { id: 'flagelo', name: 'Flagelo', desc: 'Sete chicotadas com corda de tripa. O sangue lava o pecado. Diz a Madre.', coin: 0, hours: 3, dread: -20, corruption: -6, hp: -14, rep: 3 },
  { id: 'vigilia', name: 'Vigília e jejum', desc: 'Uma noite de joelhos diante dos costurados. Sem comer.', coin: 0, hours: 24, dread: -35, corruption: -10, hunger: 24, rep: 4 },
  { id: 'agulha', name: 'Rito da Agulha', desc: 'A Madre costura uma oração na sua pele. Dói por dias.', coin: 40, hours: 6, dread: -15, corruption: -20, wound: { part: 'tronco', dtype: 'perf', sev: 1 }, rep: 5, minRep: 25 },
];

/** Bênçãos: traços temporários (registrados em systems/city.js -> D_TRAITS). */
export const BLESSINGS = [
  { id: 'bencao_ferro', name: 'Bênção do Ferro', coin: 35, days: 5, minRep: 0, desc: 'Óleo santo nas fivelas.', mods: { armor_all: 1, dreadResist: 10 } },
  { id: 'bencao_sutura', name: 'Bênção da Sutura', coin: 45, days: 5, minRep: 15, desc: 'A carne fecha mais rápido.', mods: { bleedResist: 35, infectResist: 35, heal_rate: 25 } },
  { id: 'bencao_vigilia', name: 'Bênção da Vigília', coin: 40, days: 5, minRep: 10, desc: 'O escuro pesa menos.', mods: { dreadResist: 25, dark: 15 } },
  { id: 'bencao_martir', name: 'Bênção do Mártir', coin: 70, days: 4, minRep: 40, desc: 'A dor vira fúria.', mods: { dmg_all: 10, hp_on_kill: 3, corrResist: 15 } },
];

/** Oferenda de Icor no altar: n frascos -> Chaga −1 e reputação. Uma por dia. */
export const OFFERING = { ichor: 3, chaga: -1, rep: 4, perDay: 1 };

// ---------------------------------------------------------------- quartel / muralha
export const WALL = {
  investCoin: 40, investDefense: 4,       // moedas -> defesa
  laborHours: 10, laborDefense: 2, laborHunger: 6, // trabalho braçal
  watchHours: 8,                           // vigia noturna (combate)
  max: 100,
};
export const TRAINING = { coin: 30, hours: 24, mastery: 6, maxPerWeapon: 3 };

// ---------------------------------------------------------------- guilda
export const ICHOR_MARKET = { base: 24, spread: 6, dropPerSale: 1, floor: 10 };
export const MAPS = { coin: 25, nodes: 3 };     // por região; 'guilda_mapas' = metade
export const LOAN = { amount: 120, owe: 170, days: 12, penaltyRep: -30 };

// ---------------------------------------------------------------- taverna
export const DRINK = { coin: 4, hours: 1, dread: -14, addictAt: 3, addictPct: 25, trait: 'alcoolatra' };
export const RUMOR_COST = { coin: 3, hours: 1 };
export const GAMBLE = { stakes: [5, 20, 50], winPct: 45, cheat: { attr: 'des', diff: 20 } };

/**
 * Boatos (efeitos de A + ops de D). cond opcional. 'reveal' = { op:'mapReveal', region, n } (D aplica).
 * kind: 'info' (só texto útil), 'map', 'lead'.
 */
export const RUMORS = [
  { id: 'b_cao', text: 'Cães da Chaga mordem e somem. Quem sobrevive diz: mire nas pernas, eles não sabem rastejar.', effects: [] },
  { id: 'b_mae', text: 'A Mãe-Colheita não sente golpe no tronco de palha. A cabeça de cabaça é carne de verdade.', effects: [], cond: { not: { boss: 'r1' } } },
  { id: 'b_fogo', text: 'Feras do Ermo não chegam perto de quem segura fogo. Leve tocha na mão boa.', effects: [] },
  { id: 'b_mapa1', text: 'Um batedor bêbado desenha os Campos de Cinza na mesa com cerveja. Você decora.', effects: [{ op: 'mapReveal', region: 'r1', n: 2 }] },
  { id: 'b_mapa2', text: 'Um caçador sem orelhas fala das trilhas da Floresta dos Enforcados. Onde as cordas rangem, não pise.', effects: [{ op: 'mapReveal', region: 'r2', n: 2 }], cond: { boss: 'r1' } },
  { id: 'b_mapa3', text: 'Um coveiro desenha as galerias de sal com giz no seu braço.', effects: [{ op: 'mapReveal', region: 'r3', n: 2 }], cond: { boss: 'r2' } },
  { id: 'b_mapa4', text: 'Uma pescadora cega canta o caminho das ruas afogadas de Vel-Maren. Você não esquece a melodia.', effects: [{ op: 'mapReveal', region: 'r4', n: 2 }], cond: { boss: 'r3' } },
  { id: 'b_antro', text: '"Quer beber de verdade? Desça pelo ralo do matadouro depois que os sinos calarem." Ela pisca um olho dourado.', effects: [{ op: 'unlock', k: 'antro' }, { op: 'journal', text: 'Ouvi falar de um antro sob o matadouro.' }], cond: { not: { service: 'antro' } } },
  { id: 'b_carniceiro', text: 'Dizem que o esqueleto de placas tem as juntas de couro podre. Maça nas juntas, não na placa.', effects: [] },
  { id: 'b_carnical', text: 'Carniçais comem os mortos para fechar as feridas. Mate rápido ou queime os corpos.', effects: [] },
  { id: 'b_afogado', text: 'Afogados incham antes de estourar. Quando estufarem, recue. Bile na cara cega.', effects: [] },
  { id: 'b_bispo', text: 'O Bispo Costurado fala com a boca dos outros. Corte os fios, não a carne.', effects: [], cond: { boss: 'r2' } },
  { id: 'b_rei', text: 'O Rei Galhado não cai enquanto a galhada estiver inteira. Machado lá em cima.', effects: [], cond: { boss: 'r1' } },
  { id: 'b_voz', text: 'Quem ouve a Voz Submersa por muito tempo entra na água sozinho. Cera nos ouvidos — ou muita Vontade.', effects: [], cond: { boss: 'r3' } },
  { id: 'b_cerco', text: 'Os vigias dizem que a horda se junta quando a Chaga sobe. Cada moeda na muralha é uma vida a menos no cerco.', effects: [] },
  { id: 'b_enterro', text: 'Um velho coveiro jura que deuses se enterram, não se matam. "Pergunta pros ossos de sal." Ninguém leva a sério.', effects: [{ op: 'flag', k: 'rumor_enterro' }], cond: { not: { flag: 'rumor_enterro' } } },
  { id: 'b_heroi', text: 'Falam de um carniceiro que voltou do Ermo sem a pele do rosto. Vende o que achou por metade do preço à Guilda — ou ao Antro.', effects: [] },
  { id: 'b_guilda', text: 'A Guilda paga melhor pelo Icor nos dias de mercado parado. Venda aos poucos: cada frasco despejado derruba o preço.', effects: [] },
  { id: 'b_ninho', text: 'Ninhos da Chaga são corações pequenos. Queimar um faz a Chaga recuar alguns dias.', effects: [] },
  { id: 'b_tesouro', text: 'Um desertor vende a localização de um esconderijo nos Campos por 15 moedas. Você paga. Talvez seja mentira.', effects: [{ op: 'coin', n: -15 }, { op: 'random', table: [{ w: 1, effects: [{ op: 'mapReveal', region: 'r1', n: 3 }], text: 'O desenho parece real.' }, { w: 1, effects: [], text: 'O desertor some antes do segundo gole. Mentira.' }] }], cond: { coin: 15 } },
];

// ---------------------------------------------------------------- antro
export const ANTRO = {
  sip: { ichor: 1, hp: 25, dread: -25, corruption: 5, hours: 1 },               // beber sem nível
  mutation: { ichor: 3, coin: 40, corruption: 10, hours: 6 },                     // mutação comprada
  bleedOut: { hp: -20, coin: 35, minCorruption: 25, corruption: -8, hours: 2 },   // vender o próprio sangue corrompido
  devour: { corruption: 15, hours: 4 },                                            // devorar um fragmento
};
export const FRAGMENT_ATTR = { olho: 'ast', mao: 'for', lingua: 'von', ventre: 'vig' };

// ---------------------------------------------------------------- casa
export const HOUSE_UPGRADES = {
  bau: { id: 'bau', name: 'Baú reforçado', max: 3, costs: [60, 140, 260], desc: 'Mais espaço no baú da casa.', per: ['10 espaços', '16 espaços', '24 espaços', '34 espaços'] },
  treino: { id: 'treino', name: 'Pátio de treino', max: 3, costs: [90, 200, 380], desc: 'Herdeiros nascem mais preparados (+1 atributo por nível).', per: ['—', '+1 atributo', '+2 atributos', '+3 atributos'] },
  armeiro: { id: 'armeiro', name: 'Armeiro da casa', max: 2, costs: [100, 240], desc: 'Reparos de graça em casa. No nível 2, herdeiros recebem arma de qualidade melhor.', per: ['—', 'reparo grátis', 'reparo grátis + arma Boa'] },
  capela: { id: 'capela', name: 'Capela dos ancestrais', max: 2, costs: [80, 200], desc: 'Dormir em casa reduz mais Pavor. No nível 2, também Corrupção.', per: ['—', '−10 Pavor extra', '−10 Pavor, −2 Corrupção por noite'] },
  enfermaria: { id: 'enfermaria', name: 'Enfermaria', max: 2, costs: [90, 220], desc: 'Feridas saram mais rápido dormindo em casa.', per: ['—', 'feridas +1 dia/noite', 'feridas +2 dias/noite'] },
};
export const STASH_SIZE = [10, 16, 24, 34];

/** Descanso. */
export const REST = { sleepHp: 0.5, sleepDread: -15, homeOnly: true };

/** Estoque fixo (além de shopStock de A) por serviço: [id, n, q?]. Reabastece com o resto. */
export const FIXED_STOCK = {
  templo: [['agua_benta', 3], ['sal_bento', 2], ['bandagem', 3]],
  taverna: [['racao', 6], ['aguardente', 4], ['tocha', 3]],
  antro: [['elixir_icor', 2], ['veneno', 2], ['papoula', 2]],
  quartel: [['virote', 12], ['tocha', 4], ['racao', 4]],
};

/** Serviços com loja (compra). 'shop' = id passado a shopStock de A. */
export const SHOPS = {
  ferreiro: { shop: 'ferreiro' },
  boticario: { shop: 'boticario' },
  guilda: { shop: 'guilda' },
  templo: { shop: null },
  taverna: { shop: null },
  antro: { shop: null },
  quartel: { shop: 'ferreiro', needFlag: 'coroa_arsenal' },
};

/** Chance de evento ao amanhecer na cidade. */
export const DAWN_EVENT_PCT = 45;
