// Facções de Valdrem, efeitos cruzados de reputação e linhas de missão (4 etapas cada).
// Dono: Área D. Lógica em systems/factions.js.
//
// Objetivos de missão (verificáveis por systems/factions.js -> objectiveProgress):
//   { type:'kill', enemies:[ids], n }      mortes no Bestiário (G.world.bestiary[id].kills) desde que a etapa começou
//   { type:'boss', region }                 G.campaign.bosses[region]
//   { type:'bring', item, n }               itens na mochila (são tomados ao entregar)
//   { type:'flag', k }                      G.campaign.flags[k] (eventos de data/events/quests.js marcam)
//   { type:'icor', n }                      entregar n frascos de Icor
//   { type:'coin', n }                      pagar n moedas
//   { type:'fragment', n }                  ter entregue n fragmentos a ESTA facção
//   { type:'siege' }                        sobreviver a um cerco (qualquer resultado com o herói lutando)
//   { type:'nest', region, n }              ninhos destruídos na região ('any' = qualquer)
//   { type:'corruption', min }              Corrupção do herói ≥ min
// Recompensa: efeitos (linguagem de A) + extras de D: { op:'uniqueItem', key } (systems/factions resolve).

export const FACTION_IDS = ['sutura', 'coroa', 'guilda', 'bebedores'];

export const FACTIONS = {
  sutura: {
    id: 'sutura', name: 'Igreja da Sutura', short: 'Sutura', color: 'bone', icon: '✚',
    leader: 'Madre Ostra, a Agulha',
    service: 'templo',
    desc: 'Monjas que costuram os mortos com fio de tripa. Acreditam que o deus pode ser remendado e despertar curado.',
    want: 'Fragmentos de volta ao corpo. Icor ofertado, não bebido.',
    hunters: ['zelote', 'cacador_bruxas'],
    hunterText: 'Penitentes de capuz cosido te cercam no beco. "A carne impura volta à agulha."',
  },
  coroa: {
    id: 'coroa', name: 'Coroa e Guarda Cinzenta', short: 'Coroa', color: 'cold', icon: '♜',
    leader: 'Marechal Aldric Vane',
    service: 'quartel',
    desc: 'O que resta do rei: soldados de capa cinza, forcas e fogueiras. Querem queimar o cadáver e tudo o que ele tocou.',
    want: 'Muralha de pé, Chaga contida, bebedores na forca.',
    hunters: ['cacador_bruxas', 'desertor', 'besteiro'],
    hunterText: 'Três capas cinzentas bloqueiam a rua. Um rolo de lei na mão, uma besta na outra.',
  },
  guilda: {
    id: 'guilda', name: 'Guilda dos Carniceiros', short: 'Guilda', color: 'gold', icon: '⚖',
    leader: 'Mestra Ilse Corvo',
    service: 'guilda',
    desc: 'Sua gente. Compram o sangue do deus por peso e vendem a quem pagar. O fim do mundo é um mercado.',
    want: 'Lucro. Rotas abertas. Ninguém morrendo antes de pagar o que deve.',
    hunters: ['carniceiro_rival', 'carniceiro_rival'],
    hunterText: 'Carniceiros da Guilda, cutelos à vista. "A Mestra mandou cobrar. Em carne serve."',
  },
  bebedores: {
    id: 'bebedores', name: 'Bebedores de Icor', short: 'Bebedores', color: 'corr', icon: '☩',
    leader: 'O Sem-Pele',
    service: 'antro',
    desc: 'Seita proibida. Bebem o deus até a carne mudar. Acreditam que quem beber o Coração será o próximo deus.',
    want: 'Icor nas veias. Fragmentos na boca. A Sutura e a Coroa mortas.',
    hunters: ['bebedor', 'bebedor'],
    hunterText: 'Olhos dourados no escuro. Bebedores de veias inchadas. "Você tem algo nosso por dentro."',
  },
};

/** Efeito cruzado: ganhar n com a chave faz as outras variarem n*k (arredondado para zero). */
export const CROSS = {
  sutura: { bebedores: -0.6, coroa: 0.1, guilda: -0.1 },
  coroa: { bebedores: -0.6, guilda: -0.2, sutura: 0.1 },
  guilda: { coroa: -0.2, sutura: -0.15 },
  bebedores: { sutura: -0.6, coroa: -0.6, guilda: 0.1 },
};

export const REP_TIERS = [
  { min: -100, id: 'odio', label: 'Ódio', kind: 'bad' },
  { min: -50, id: 'hostil', label: 'Hostil', kind: 'bad' },
  { min: -20, id: 'desconfianca', label: 'Desconfiança', kind: 'warn' },
  { min: -5, id: 'neutro', label: 'Neutro', kind: '' },
  { min: 15, id: 'tolerado', label: 'Tolerado', kind: 'info' },
  { min: 40, id: 'aliado', label: 'Aliado', kind: 'good' },
  { min: 75, id: 'devoto', label: 'Juramentado', kind: 'good' },
];

/** Itens únicos de recompensa (instâncias customizadas sobre ids base canônicos de A). */
export const UNIQUE_ITEMS = {
  agulha_madre: { base: 'adaga', q: 3, name: 'Agulha da Madre', mods: { bleed: 25, crit: 5, infectResist: 20 }, desc: 'Agulha de costurar mortos, longa como um antebraço.' },
  mortalha_cosida: { base: 'gibao', q: 3, name: 'Mortalha Cosida', mods: { dreadResist: 20, bleedResist: 25 }, desc: 'Tecida com cabelo de penitentes. Não deixa o sangue sair.' },
  estandarte_cinza: { base: 'escudo_ferro', q: 3, name: 'Pavês da Guarda Cinzenta', mods: { block: 15, dreadResist: 10 }, desc: 'Escudo com a cinza de cem fogueiras na tinta.' },
  martelo_juiz: { base: 'martelo_guerra', q: 3, name: 'Martelo do Juiz', mods: { execute: 30, fracture: 15 }, desc: 'Usado nas execuções da praça. Ainda tem cabelo preso.' },
  balanca_corvo: { base: 'amuleto_moeda_furada', fallbackType: 'trinket', q: 2, name: 'Balança de Ilse', mods: { price: 15, loot: 15 }, desc: 'Uma balança de ourives presa ao pescoço. Pesa tudo, inclusive você.' },
  cutelo_mestre: { base: 'cutelo', q: 3, name: 'Cutelo do Mestre-Carniceiro', mods: { sever: 20, ichor_find: 20 }, desc: 'Abriu mais cadáveres de deus do que qualquer outro.' },
  calice_pele: { base: 'amuleto_coracao_seco', fallbackType: 'trinket', q: 2, name: 'Cálice de Pele', mods: { lifesteal: 6, corrResist: -10, hpMax: 10 }, desc: 'Costurado de uma face. Bebe com você.' },
  dente_deus: { base: 'faca', q: 3, name: 'Dente do Deus', mods: { dmg_icor: 25, crit: 8 }, desc: 'Um dente que ainda cresce. Corta como se quisesse.' },
};

/**
 * Linhas de missão. Cada etapa: { title, giver (texto curto), brief, obj, need?:{rep?, boss?}, reward:[efeitos], done (texto) }.
 * need: requisitos para a etapa ficar disponível (além de terminar a anterior).
 */
export const QUESTLINES = {
  sutura: [
    {
      title: 'Fio de Tripa',
      brief: 'A Madre quer tendões frescos para costurar os mortos da enfermaria antes que levantem.',
      obj: { type: 'bring', item: 'tendao', n: 3 },
      need: { rep: -20 },
      reward: [{ op: 'rep', f: 'sutura', n: 10 }, { op: 'coin', n: 40 }, { op: 'item', id: 'agua_benta', n: 2 }],
      done: 'A Madre cheira os tendões. "Ainda quentes. Deus agradece."',
    },
    {
      title: 'A Freira Pendurada',
      brief: 'Irmã Calva foi enforcada na Floresta com a língua cosida. Traga o rosário dela — e não a deixe cair viva.',
      obj: { type: 'flag', k: 'q_sutura_2_done' },
      flagOnStart: 'q_sutura_2',
      need: { rep: 10 },
      reward: [{ op: 'rep', f: 'sutura', n: 15 }, { op: 'uniqueItem', key: 'agulha_madre' }],
      done: 'O rosário volta à capela. Ninguém pergunta como você o tirou dela.',
    },
    {
      title: 'Sal para os Ossos',
      brief: 'Os renegados das Catacumbas de Sal profanam ossários. Mate os sacerdotes renegados antes que costurem um exército.',
      obj: { type: 'kill', enemies: ['sacerdote_renegado', 'costurado'], n: 4 },
      need: { rep: 25, boss: 'r2' },
      reward: [{ op: 'rep', f: 'sutura', n: 15 }, { op: 'uniqueItem', key: 'mortalha_cosida' }, { op: 'flag', k: 'sutura_cura_gratis' }],
      done: '"Agora a enfermaria é sua também. Sem cobrar." A Madre beija sua testa com lábios frios.',
    },
    {
      title: 'Devolver o Corpo',
      brief: 'Entregue dois Fragmentos do deus à Sutura. A Agulha está pronta para o Coração.',
      obj: { type: 'fragment', n: 2 },
      need: { rep: 40 },
      reward: [{ op: 'rep', f: 'sutura', n: 20 }, { op: 'flag', k: 'final_sutura' }, { op: 'chaga', n: -5, why: 'Vigília da Sutura' }],
      done: 'Os sinos tocam a noite toda. A Sutura costurará o deus — se você levar a agulha até o Coração.',
    },
  ],
  coroa: [
    {
      title: 'Lei Marcial',
      brief: 'Desertores roubam os comboios de grão. O Marechal quer cabeças, não prisioneiros.',
      obj: { type: 'kill', enemies: ['desertor', 'saqueador', 'besteiro'], n: 5 },
      need: { rep: -20 },
      reward: [{ op: 'rep', f: 'coroa', n: 10 }, { op: 'coin', n: 50 }, { op: 'siegeDefense', n: 3 }],
      done: 'As cabeças vão para as estacas do Portão. A fila de grão anda um pouco mais rápido.',
    },
    {
      title: 'Cinza nos Ninhos',
      brief: 'Ninhos da Chaga pulsam nos Campos. Queime dois. A Guarda não tem homens para isso.',
      obj: { type: 'nest', region: 'any', n: 2 },
      need: { rep: 10 },
      reward: [{ op: 'rep', f: 'coroa', n: 15 }, { op: 'uniqueItem', key: 'estandarte_cinza' }, { op: 'flag', k: 'coroa_arsenal' }],
      done: 'O Marechal abre o arsenal. "Pegue o que precisar. Pague o que puder."',
    },
    {
      title: 'Segurar a Muralha',
      brief: 'Quando a horda vier, esteja nas ameias. A Coroa lembra quem sangrou na pedra.',
      obj: { type: 'siege' },
      need: { rep: 20 },
      reward: [{ op: 'rep', f: 'coroa', n: 15 }, { op: 'uniqueItem', key: 'martelo_juiz' }, { op: 'siegeDefense', n: 8 }],
      done: 'Seu nome é gritado no pátio. Um soldado te dá a mão que restou.',
    },
    {
      title: 'Fogo Sobre o Deus',
      brief: 'Entregue dois Fragmentos à Coroa. Os alquimistas do rei vão transformá-los em pólvora sagrada.',
      obj: { type: 'fragment', n: 2 },
      need: { rep: 40 },
      reward: [{ op: 'rep', f: 'coroa', n: 20 }, { op: 'flag', k: 'final_coroa' }, { op: 'item', id: 'bomba', n: 4 }],
      done: 'Barris de pólvora selados com cera vermelha. "Leve-os ao Coração. Acenda. Não olhe."',
    },
  ],
  guilda: [
    {
      title: 'Dívida de Sangue',
      brief: 'A Guilda quer prova de que você ainda colhe. Traga Icor — frascos cheios, sem diluir.',
      obj: { type: 'icor', n: 4 },
      need: { rep: -30 },
      reward: [{ op: 'rep', f: 'guilda', n: 10 }, { op: 'coin', n: 130 }, { op: 'flag', k: 'guilda_mapas' }],
      done: 'Ilse pesa cada frasco duas vezes. "Bom. A partir de hoje, mapas pela metade."',
    },
    {
      title: 'O Rival',
      brief: 'Um carniceiro de outra casa vende Icor aos Bebedores por fora. Encontre-o no Ermo e resolva.',
      obj: { type: 'flag', k: 'q_guilda_2_done' },
      flagOnStart: 'q_guilda_2',
      need: { rep: 10 },
      reward: [{ op: 'rep', f: 'guilda', n: 15 }, { op: 'uniqueItem', key: 'cutelo_mestre' }],
      done: '"Resolvido?" Você mostra o anel dele, ainda no dedo. Ilse sorri pela primeira vez.',
    },
    {
      title: 'Rota da Carcaça',
      brief: 'Ouro e osso: traga lascas divinas e ferro negro para a nova balança da Guilda.',
      obj: { type: 'bring', item: 'lasca_divina', n: 2 },
      need: { rep: 25, boss: 'r1' },
      reward: [{ op: 'rep', f: 'guilda', n: 15 }, { op: 'uniqueItem', key: 'balanca_corvo' }, { op: 'coin', n: 120 }],
      done: 'A balança nova brilha. Você pesa menos do que achava.',
    },
    {
      title: 'Leilão do Fim do Mundo',
      brief: 'Entregue dois Fragmentos à Guilda. Há compradores além do mar — e navios esperando.',
      obj: { type: 'fragment', n: 2 },
      need: { rep: 40 },
      reward: [{ op: 'rep', f: 'guilda', n: 20 }, { op: 'flag', k: 'final_guilda' }, { op: 'coin', n: 400 }],
      done: 'Contratos de passagem com o selo da Guilda. Lugares nos navios, se houver quem venda o Coração.',
    },
  ],
  bebedores: [
    {
      title: 'O Primeiro Gole',
      brief: 'O Sem-Pele quer ver o deus em você. Chegue a 20 de Corrupção e volte ao Antro.',
      obj: { type: 'corruption', min: 20 },
      need: { rep: -40 },
      reward: [{ op: 'rep', f: 'bebedores', n: 12 }, { op: 'ichor', n: 3 }],
      done: 'Ele lambe o suor da sua testa. "Doce. Você vai longe — ou vai fundo."',
    },
    {
      title: 'Sangue da Agulha',
      brief: 'Uma freira da Sutura carrega um frasco de Icor puro para o altar. Intercepte-a na estrada dos Enforcados.',
      obj: { type: 'flag', k: 'q_bebedores_2_done' },
      flagOnStart: 'q_bebedores_2',
      need: { rep: 10 },
      reward: [{ op: 'rep', f: 'bebedores', n: 15 }, { op: 'uniqueItem', key: 'calice_pele' }, { op: 'rep', f: 'sutura', n: -10 }],
      done: 'O frasco passa de boca em boca no Antro. Ninguém pergunta pela freira.',
    },
    {
      title: 'Carne Escolhida',
      brief: 'Traga carne de quem já mudou: filhos de Icor e bebedores ascendidos do Cadáver — ou aberrações.',
      obj: { type: 'kill', enemies: ['enguia_icor', 'filho_icor', 'bebedor_ascendido', 'aberracao', 'sereia_carcaca'], n: 3 },
      need: { rep: 25, boss: 'r2' },
      reward: [{ op: 'rep', f: 'bebedores', n: 15 }, { op: 'uniqueItem', key: 'dente_deus' }, { op: 'flag', k: 'bebedores_rito' }],
      done: 'Eles comem o que você trouxe. Depois te ensinam a beber sem morrer — quase.',
    },
    {
      title: 'A Boca do Deus',
      brief: 'Entregue dois Fragmentos aos Bebedores — ou devore-os você mesmo. O Coração deve ser bebido.',
      obj: { type: 'fragment', n: 2, orEaten: true },
      need: { rep: 40 },
      reward: [{ op: 'rep', f: 'bebedores', n: 20 }, { op: 'flag', k: 'final_bebedores' }, { op: 'ichor', n: 4 }],
      done: 'O Antro inteiro se ajoelha. Pela primeira vez, para você.',
    },
  ],
};
