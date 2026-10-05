// Narrativa: introdução, moradores desaparecidos, memórias de Aurélia, falas e finais.

export const INTRO = [
  { art: '🌊', title: 'Aurélia', text: 'Há trezentos anos, a cidade de Aurélia afundou numa única noite. Em Salgema, a vila no penhasco, todos cresceram ouvindo que o mar a engoliu por soberba.' },
  { art: '🏝', title: 'A Vazante', text: 'Há quarenta dias, o mar começou a recuar. Toda manhã a água se retira da baía por algumas horas — a Vazante — e as torres de Aurélia emergem, cobertas de cracas.' },
  { art: '🕯', title: 'Os Desaparecidos', text: 'Com a Vazante vieram coisas. Redes rasgadas, barcos virados. Seis moradores desceram às ruas afogadas e não voltaram.' },
  { art: '🔱', title: 'A Vazanteira', text: 'A Avó Zélia te entregou o arpão da sua mãe. "Desça, traga quem puder, e volte antes da maré." Hoje, o mar baixa de novo.' },
];

export const VILLAGERS = {
  tiao: { name: 'Tião', title: 'o mergulhador', district: 1, icon: '🤿', perk: 'Desbloqueia o ofício Mergulhadora.', thanks: '"Achei que ia virar peixe lá embaixo. Vem, te ensino a respirar debaixo d\'água."' },
  lia: { name: 'Lia', title: 'a menina dos mapas', district: 1, icon: '🗺', perk: '+1 opção nas recompensas de combate.', thanks: '"Eu desenhei TUDO que vi lá embaixo! Quer ver?"' },
  joaquim: { name: 'Joaquim', title: 'o pescador', district: 2, icon: '🐟', perk: 'Comece cada expedição com 2 Peixes Secos.', thanks: '"Devo a vida a você. E peixe seco nunca vai te faltar."' },
  cida: { name: 'Dona Cida', title: 'a costureira', district: 2, icon: '🧵', perk: 'Comece cada expedição vestindo a Capa de Algas.', thanks: '"Que trapo é esse que você veste? Deixa comigo."' },
  bento: { name: 'Mestre Bento', title: 'o sineiro velho', district: 3, icon: '🔔', perk: 'Comece cada expedição com um Sino de Mão.', thanks: '"Os sinos de lá cantam o nome dela. Leve um dos meus — ele canta o seu."' },
  ana: { name: 'Ana', title: 'a contrabandista', district: 3, icon: '🗝', perk: 'Mercador Tobias: preços −20% e um item a mais.', thanks: '"Conheço o Tobias desde antes dele se afogar. Vou falar bem de você."' },
};

export const MEMORIES = [
  { id: 1, title: 'O Mercado', text: 'Peixes de prata, cantoras nas varandas. A maré subia e descia ao som de um coro. Aurélia não temia o mar: conversava com ele.' },
  { id: 2, title: 'Os Servos', text: 'Nos porões, os servos remavam as barcaças das cantoras. Não tinham voz no coro. Alguns aprenderam a cantar escondidos.' },
  { id: 3, title: 'A Concha-Mãe', text: 'A Concha-Mãe ficava no altar da catedral. Quem a segurasse e cantasse os Três Versos podia mover o oceano.' },
  { id: 4, title: 'A Noite do Festival', text: 'Na noite do Grande Festival, um servo chamado Salvador roubou a Concha. Sem a voz, o mar avançou. As cantoras cantaram até se afogar.' },
  { id: 5, title: 'A Fuga', text: 'Os servos fugiram de barco para o penhasco, levando a Concha. Ali fundaram uma vila e a chamaram de Salgema — a joia de sal.' },
  { id: 6, title: 'Maren', text: 'A mais jovem cantora, Maren, ficou no altar. Jurou que cantaria até o mar devolver a cidade, nem que levasse séculos.' },
  { id: 7, title: 'O Preço', text: 'Se o mar devolver Aurélia por inteiro, a água que a cobre precisa ir para algum lugar. Uma Grande Ressaca cobriria a costa inteira.' },
  { id: 8, title: 'A Linhagem', text: 'Salvador teve uma filha com uma cantora. A criança cresceu em Salgema. O mar ainda reconhece o sangue que um dia cantou com ele.' },
];

export const VERSOS = [
  { title: 'Primeiro Verso', text: '"Mar que dorme sob a pedra, ouve a voz que te nomeia."', from: 'carranca' },
  { title: 'Segundo Verso', text: '"Coral que cresce, sino que dobra, devolve o que a noite tomou."', from: 'gardener' },
  { title: 'Terceiro Verso', text: '"Quem canta inteiro, governa a maré — e a maré governa quem canta."', from: 'sineiro' },
];

export const BOSS_INTRO = {
  carranca: { title: 'A Carranca', text: 'A proa de um navio-palácio, maior que uma casa, ergue-se da lama. A figura de madeira abre os olhos. Correntes a prendem ao casco.' },
  gardener: { title: 'O Jardineiro', text: 'Entre os canteiros de coral, algo se levanta: um colosso de galhos rubros que poda o mundo para que nada além dele cresça.' },
  sineiro: { title: 'O Sineiro', text: 'O campanário maior está de pé. Lá dentro, uma figura encapuzada abraça uma corda e sorri. "Ela pediu que eu chamasse a maré."' },
  maren: { title: 'Maren, a Última Cantora', text: 'No altar afogado, uma moça de cabelos de alga canta sem parar há trezentos anos. Ela para. Olha para você. "Você tem a voz dele."' },
};

// Diálogos condicionais por NPC. A primeira fala elegível não vista é mostrada com destaque.
// cond recebe (meta) e retorna boolean.
export const NPCS = {
  zelia: {
    name: 'Avó Zélia', role: 'a anciã', icon: '👵',
    story: [
      { id: 'z_intro', cond: (m) => m.runs >= 1, text: 'O mar te devolveu inteira. Bom. Amanhã a maré baixa de novo — desça, e traga de volta quem puder. Seis dos nossos ainda estão lá.' },
      { id: 'z_death', cond: (m) => m.deaths >= 1, text: 'Te acharam na areia, respirando, com a maré já cheia. A maré não devolve ninguém, menina. Ela devolveu você. Pense nisso.' },
      { id: 'z_mem1', cond: (m) => m.memoriesFound >= 1, text: 'Isso que brilha na sua mão... é uma memória da cidade. Deixe comigo: eu sei ler essas coisas. Cada uma que você me trouxer, eu te conto o que diz.' },
      { id: 'z_boss1', cond: (m) => m.bosses.includes('carranca'), text: 'A Carranca era a proa do navio da Rainha. Se ela te deu um verso, guarde-o na memória. E não o cante em voz alta. Ainda não.' },
      { id: 'z_boss2', cond: (m) => m.bosses.includes('gardener'), text: 'Dois versos. A canção está voltando para você, não está? Às vezes eu te ouço cantarolando enquanto dorme.' },
      { id: 'z_boss3a', cond: (m) => m.bosses.includes('sineiro') && m.memoriesGiven < 4, text: 'Há uma coisa que eu deveria ter te contado há muito tempo... mas ainda não tenho coragem. Traga mais memórias da cidade. (Entregue 4 memórias à Zélia.)' },
      { id: 'z_concha', cond: (m) => m.bosses.includes('sineiro') && m.memoriesGiven >= 4, gift: 'concha', text: 'Os fundadores de Salgema eram servos de Aurélia. Roubaram a Concha-Mãe — a voz que governa o mar — e a cidade afundou. Minha família a guarda há dez gerações. Tome. Devolva-a a quem ela pertence... ou não. A escolha é sua.' },
      { id: 'z_end', cond: (m) => m.endings.length >= 1, text: 'Você voltou da catedral. O mar está diferente — eu sinto nos ossos. Se quiser descer de novo, as Marés Vivas te esperam, mais bravas do que nunca.' },
    ],
    idle: [
      'Coma alguma coisa antes de descer. Ninguém luta bem de barriga vazia.',
      'Sua mãe também ouvia a cidade cantar. Ela nunca me contou o que ouvia.',
      'Quando a água começar a subir, não seja teimosa. Recue para o alto.',
      'Os velhos dizem que o sal guarda memória. Eu acredito.',
    ],
  },
  ilda: {
    name: 'Ilda', role: 'a ferreira', icon: '⚒', building: 'forja',
    story: [
      { id: 'i_intro', cond: (m) => m.runs >= 1, text: 'Traga conchas e eu forjo o que precisar. Bronze afogado é o melhor metal que já trabalhei — não enferruja nunca mais.' },
      { id: 'i_boss1', cond: (m) => m.bosses.includes('carranca'), text: 'Correntes da Carranca! Com isso consigo fazer armas que nem sonhei. Volte quando tiver conchas.' },
    ],
    idle: ['Arma boa é arma que volta pra mão. Fale isso pro seu arpão.', 'O bronze de Aurélia canta quando eu bato nele. Arrepia.', 'Empurrar um caranguejo contra a parede dói mais nele do que qualquer lâmina.'],
  },
  marisol: {
    name: 'Marisol', role: 'a boticária', icon: '🌿', building: 'botica',
    story: [
      { id: 'm_intro', cond: (m) => m.runs >= 1, text: 'Algas, sal e um pouco de paciência: é isso que fecha ferida. Quer que eu prepare algo para a próxima descida?' },
    ],
    idle: ['Veneno de pólipo passa com peixe seco. Sério.', 'Não beba a água de lá. Nem pensar.', 'Fogo e água não se misturam — a não ser que alguém derrame óleo.'],
  },
  anselmo: {
    name: 'Frei Anselmo', role: 'o arquivista', icon: '📜', building: 'arquivo',
    story: [
      { id: 'a_intro', cond: (m) => m.runs >= 1, text: 'Cada criatura que você derrota me conta algo. Anoto tudo aqui. Estudar o inimigo é metade da vitória — literalmente: você bate mais forte no que conhece.' },
      { id: 'a_mem', cond: (m) => m.memoriesGiven >= 2, text: 'A Zélia me mostrou as memórias. Servos, uma concha, um roubo... As crônicas da vila contam outra história. Alguém mentiu, e não foi o mar.' },
    ],
    idle: ['Um inimigo estudado (6 derrotas) recebe +1 de dano de você.', 'Os autômatos foram feitos para tocar sinos, não para lutar. Mas afundam igual.', 'Aurélia tinha mais sinos do que casas. Por quê?'],
  },
  gaspar: {
    name: 'Gaspar', role: 'o barqueiro', icon: '⛵', building: 'cais',
    story: [
      { id: 'g_intro', cond: (m) => m.runs >= 1, text: 'Se você abrir caminho lá embaixo, eu sei levar o barco por cima. Atalhos custam conchas — remo não é de graça.' },
    ],
    idle: ['Maré de Enchente: a água sobe rodada após rodada. De Vazante: o contrário. Leia a Tábua antes de entrar.', 'Já vi uma enguia encalhada morrer de vergonha.', 'Quem não sabe nadar não discute com a água funda.'],
  },
  benta: {
    name: 'Dona Benta', role: 'a taverneira', icon: '🍺', building: 'taverna',
    story: [
      { id: 'b_intro', cond: (m) => m.runs >= 1, text: 'Os pescadores pagam bem por quem faz trabalho difícil lá embaixo. Pegue um contrato antes de descer — conchas extras nunca fizeram mal a ninguém.' },
    ],
    idle: ['Dizem que pesados afundam como pedra na água funda.', 'Um bêbado jurou que viu uma água-viva encalhada chorando quando a maré baixou.', 'Tem gente que joga barril de óleo nos outros. Eu só sirvo.', 'Choque na água pega todo mundo que estiver molhado. Todo mundo.', 'O Capitão Cracas demora para atirar. Quem sabe se mexer, sobrevive.'],
  },
};

export const ENDINGS = {
  silencio: {
    title: 'Silêncio', icon: '🌑',
    text: [
      'Maren cai sobre o altar e, pela primeira vez em trezentos anos, a catedral fica em silêncio.',
      'Na manhã seguinte, o mar volta à baía e não recua mais. Aurélia afunda para sempre na escuridão.',
      'Salgema está salva. Ninguém pergunta o que você viu lá embaixo, e você não conta.',
      'Às vezes, nas noites sem vento, você ouve um coro distante vindo do fundo da baía. Ele não canta mais o nome de ninguém.',
    ],
  },
  concha: {
    title: 'Maré Mansa', icon: '🐚',
    text: [
      'Você estende a Concha-Mãe. Maren hesita — e então a segura contra o peito, como quem reencontra um filho.',
      'Ela canta uma canção que você nunca ouviu, mas conhece. Os afogados se deitam nas ruas e fecham os olhos. O mar respira fundo.',
      'A Grande Ressaca nunca vem. A maré volta devagar, mansa, e Aurélia passa a surgir só nas luas novas — um memorial de pedra e coral.',
      'A Avó Zélia chora quando você conta. "Dez gerações esperando alguém com coragem de devolver." Salgema, enfim, faz as pazes com o mar.',
    ],
  },
  versos: {
    title: 'Coroa de Sal', icon: '👑',
    text: [
      'Você canta os Três Versos. Sua voz cobre a de Maren, e o oceano inteiro se volta para ouvir você.',
      'Maren se desfaz em espuma. A Grande Ressaca para no meio do caminho e recua, obediente.',
      'Salgema nunca mais conhece fome: os cardumes vêm quando você chama, as tempestades passam longe.',
      'Mas toda noite a maré sobe até a sua porta e espera. Você não consegue mais ficar longe da água. A coroa de sal é leve — e não sai mais.',
    ],
  },
};

export const RUMORS = [
  'Pesados (autômatos, ouriços, guardiões de sal) afundam instantaneamente na água funda.',
  'Afogados que morrem dentro d\'água se levantam uma vez. Mate-os no seco ou com fogo.',
  'Enguias e águas-vivas encalham quando a maré baixa: ficam paradas e indefesas.',
  'O choque se espalha por toda a água conectada — inclusive até você, se estiver molhada.',
  'Óleo flutua: até sobre a água ele pega fogo.',
  'Ataques de arremesso miram o quadrado; os outros acompanham o monstro se ele for empurrado.',
  'Colisões ignoram armadura. Caranguejos que batem em algo ficam virados.',
  'Golpear um sino atordoa quem estiver ao redor dele (menos você).',
  'A Tábua de Marés mostra o nível da água das próximas rodadas. Planeje o caminho pelo alto.',
  'Os reforços chegam pelas bordas: quadrados marcados com ⚠ serão ocupados na próxima rodada. Fique em cima para impedir (você leva 1 de dano).',
  'Água funda drena 1 de Fôlego por rodada. Sem Fôlego, você se afoga.',
  'Atordoar um inimigo cancela o ataque que ele estava preparando.',
];
