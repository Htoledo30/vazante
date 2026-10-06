// História: intro, legados da casa, atos, fragmentos, finais e epílogos.
// Dono: Área D. Lógica em systems/campaign.js.

export const HOUSE_NAMES = ['Vharn', 'Morrowgaunt', 'Kessel', 'Ardo', 'Salgueda', 'Corvara', 'Blackmere', 'Ruthven', 'Dorne', 'Ystrel', 'Malvas', 'Grieve'];

/** Telas da introdução (curtas). Cada uma: { id, title, text, kind:'text'|'house'|'legacy'|'go' }. */
export const INTRO = [
  {
    id: 'queda', kind: 'text', title: 'A Queda',
    text: 'Há trinta anos, um deus caiu do céu.\n\nNão morreu. Apodrece. Seu cadáver é uma cordilheira de carne no centro do Ermo, e do corpo escorre o Icor — sangue dourado que dá força a quem bebe e transforma quem bebe demais.',
    btn: 'Continuar',
  },
  {
    id: 'chaga', kind: 'text', title: 'A Chaga',
    text: 'A podridão se espalha. Corrompe a terra, os bichos, os mortos. Chamam isso de Chaga.\n\nValdrem é a última cidade murada. Quando a Chaga chegar à muralha de vez, não haverá mais nada.',
    btn: 'Continuar',
  },
  {
    id: 'casa', kind: 'house', title: 'Sua Casa',
    text: 'Você nasceu numa casa de Carniceiros: gente que entra no Ermo e volta com o sangue do deus em frascos. Ou não volta.\n\nQual é o nome da sua casa?',
  },
  {
    id: 'legado', kind: 'legacy', title: 'O que restou',
    text: 'Seu pai morreu no Ermo. Seu avô também. O que a Casa {house} deixou para você?',
  },
  {
    id: 'ir', kind: 'go', title: 'O Primeiro',
    text: 'A Chaga avança um pouco todo dia. Alguém da Casa {house} precisa entrar no Ermo.\n\nQuando você morrer — e vai — seu sangue continua.',
    btn: 'Escolher quem vai primeiro',
  },
];

/**
 * Legados da casa (bônus inicial). effects: aplicados na campanha (ao criar o primeiro herói).
 * heroEffects: aplicados a TODO herdeiro da casa ao nascer. houseTrait: traço D aplicado a todo herdeiro.
 */
export const LEGACIES = [
  {
    id: 'divida', name: 'Uma dívida com a Guilda',
    desc: 'Ouro emprestado, juros de sangue. +140 moedas agora. A Guilda cobra 200 até o dia 25.',
    effects: [{ op: 'coin', n: 140 }, { op: 'rep', f: 'guilda', n: -5 }],
    loan: { owe: 200, dueDay: 25 },
  },
  {
    id: 'sangue', name: 'Sangue de Bebedor',
    desc: 'Sua mãe bebia. Você nasceu com olhos meio dourados. +3 Icor, Bebedores te conhecem. A Sutura, também.',
    effects: [{ op: 'ichor', n: 3 }, { op: 'rep', f: 'bebedores', n: 15 }, { op: 'rep', f: 'sutura', n: -10 }, { op: 'unlock', k: 'antro' }],
    houseTrait: 'casa_dourada',
  },
  {
    id: 'juramento', name: 'Juramento à Sutura',
    desc: 'Sua avó foi freira. A Igreja lembra. Água benta, e herdeiros que aguentam o escuro.',
    effects: [{ op: 'rep', f: 'sutura', n: 15 }, { op: 'item', id: 'agua_benta', n: 2 }, { op: 'item', id: 'bandagem', n: 2 }],
    houseTrait: 'casa_devota',
  },
  {
    id: 'patente', name: 'Uma velha patente da Guarda',
    desc: 'Seu pai foi sargento antes de ser carniceiro. A Coroa te deve, e a muralha é mais forte.',
    effects: [{ op: 'rep', f: 'coroa', n: 15 }, { op: 'siegeDefense', n: 10 }, { op: 'item', id: 'racao', n: 3 }],
    houseTrait: 'casa_soldada',
  },
  {
    id: 'mapas', name: 'Os mapas do avô',
    desc: 'Pergaminhos manchados de Icor. Trilhas dos Campos e da Floresta que ninguém mais conhece.',
    effects: [{ op: 'mapReveal', region: 'r1', n: 5 }, { op: 'mapReveal', region: 'r2', n: 3 }, { op: 'item', id: 'tocha', n: 2 }],
    houseTrait: 'casa_batedora',
  },
  {
    id: 'acougue', name: 'O açougue da família',
    desc: 'Ganchos, cutelos, carne salgada. Seus herdeiros sabem abrir um corpo.',
    effects: [{ op: 'item', id: 'racao', n: 4 }, { op: 'item', id: 'sebo', n: 2 }, { op: 'coin', n: 40 }],
    houseTrait: 'casa_carniceira',
  },
];

/** Traços de casa e outros traços de D (registrados em TRAITS de A por systems/campaign.js, se ausentes). */
export const D_TRAITS = {
  casa_dourada: { id: 'casa_dourada', name: 'Sangue Dourado', kind: 'mixed', desc: 'Beber Icor dói menos. A Sutura sente o cheiro.', mods: { corrResist: 15, dreadResist: -5 } },
  casa_devota: { id: 'casa_devota', name: 'Criado na Fé', kind: 'good', desc: 'Orações de criança ainda funcionam no escuro.', mods: { dreadResist: 15 } },
  casa_soldada: { id: 'casa_soldada', name: 'Filho de Soldado', kind: 'good', desc: 'Sabe segurar uma linha.', mods: { block: 10, staminaMax: 1 } },
  casa_batedora: { id: 'casa_batedora', name: 'Olho de Batedor', kind: 'good', desc: 'Lê trilhas como quem lê cartas.', mods: { scout: 15, ambush: 10 } },
  casa_carniceira: { id: 'casa_carniceira', name: 'Mão de Açougueiro', kind: 'good', desc: 'Sabe onde a carne cede.', mods: { sever: 8, loot: 10 } },
  sangrado: { id: 'sangrado', name: 'Sangrado', kind: 'bad', desc: 'O barbeiro tirou sangue podre. E sangue bom junto.', mods: { hpMaxPct: -15 } },
  marcado_faccao: { id: 'marcado_faccao', name: 'Marcado', kind: 'bad', desc: 'Uma facção te quer morto. Todos sabem.', mods: {} },
  veterano_cerco: { id: 'veterano_cerco', name: 'Veterano da Muralha', kind: 'good', desc: 'Sobreviveu a uma horda nas ameias.', mods: { dreadResist: 10, hpMax: 5 } },
  devorador: { id: 'devorador', name: 'Devorador de Deus', kind: 'mixed', desc: 'Comeu um pedaço do deus. Ele ainda está lá dentro.', mods: { corrResist: -10 } },
};

/** Atos: definidos por chefes derrotados. */
export const ACTS = [
  { act: 1, minBosses: 0, title: 'Ato I — Cinza', text: 'Os Campos de Cinza são a porta do Ermo. A Mãe-Colheita guarda a estrada.' },
  { act: 2, minBosses: 1, title: 'Ato II — Cordas', text: 'Os mortos pendem das árvores. Alguém coroou um rei na Floresta.' },
  { act: 3, minBosses: 3, title: 'Ato III — Sal e Água', text: 'Sob o sal, sob a água: as feridas mais antigas do deus.' },
  { act: 4, minBosses: 4, title: 'Ato IV — O Cadáver', text: 'Só resta entrar na carne. O Coração ainda bate.' },
];

/** Chefe -> fragmento. */
export const BOSS_FRAGMENT = { r1: 'ventre', r2: 'mao', r3: 'olho', r4: 'lingua' };
export const BOSS_NAMES = { r1: 'Mãe-Colheita', r2: 'O Rei Galhado', r3: 'O Bispo Costurado', r4: 'A Voz Submersa', r5: 'O Coração' };
export const NEXT_REGION = { r1: 'r2', r2: 'r3', r3: 'r4', r4: 'r5' };

export const FRAGMENTS = {
  ventre: { id: 'ventre', item: 'fragmento_ventre', name: 'Ventre do Deus', desc: 'Um útero de pedra quente. Algo dentro se mexe quando chove.' },
  mao: { id: 'mao', item: 'fragmento_mao', name: 'Mão do Deus', desc: 'Dedos de osso dourado que se fecham sozinhos à noite.' },
  olho: { id: 'olho', item: 'fragmento_olho', name: 'Olho do Deus', desc: 'Do tamanho de um punho. Ele te segue pela sala.' },
  lingua: { id: 'lingua', item: 'fragmento_lingua', name: 'Língua do Deus', desc: 'Ainda úmida. Às vezes forma palavras que você entende.' },
};

/** Texto ao matar cada chefe (journal + aviso). */
export const BOSS_TEXT = {
  r1: 'A Mãe-Colheita caiu. Dentro da palha, um ventre de pedra ainda morno. Os Campos respiram menos podre.',
  r2: 'O Rei Galhado tombou com um estalo de mil galhos. Na coroa, uma mão de osso dourado agarrava o céu.',
  r3: 'O Bispo Costurado desfez-se em fios. No altar de sal, um olho enorme te encarava.',
  r4: 'A Voz Submersa calou. A água de Vel-Maren baixou um palmo. Na lama, uma língua ainda se mexia.',
  r5: 'O Coração parou de lutar. Ainda bate. Na sua frente. Esperando.',
};

/**
 * Finais. cond (formato de checkCond de A + extensões de D avaliadas por campaign.js):
 *   fragGiven:{f, n}   fragmentos entregues à facção f
 *   fragKept:n         fragmentos guardados ou devorados (não entregues)
 *   questDone:f        linha de missão concluída
 * sacrifice: o herói morre no final.
 */
export const ENDINGS = {
  sutura: {
    id: 'sutura', name: 'A Sutura', faction: 'sutura', icon: '✚',
    choice: 'Costurar o Coração com a Agulha da Madre',
    req: 'Sutura ≥ 50 e linha da Sutura concluída (ou 2 fragmentos entregues a ela).',
    cond: { any: [{ questDone: 'sutura' }, { all: [{ rep: { f: 'sutura', min: 50 } }, { fragGiven: { f: 'sutura', n: 2 } }] }] },
    text: 'Você costura. Cada ponto custa um dedo de pele. O Coração aceita a linha.\n\nNo Ermo, a cordilheira de carne geme e se fecha. O deus desperta — remendado, cego, faminto de gratidão.',
  },
  coroa: {
    id: 'coroa', name: 'Fogo e Cinza', faction: 'coroa', icon: '♜',
    choice: 'Acender a pólvora sagrada da Coroa',
    req: 'Coroa ≥ 50 e linha da Coroa concluída (ou 2 fragmentos entregues a ela).',
    cond: { any: [{ questDone: 'coroa' }, { all: [{ rep: { f: 'coroa', min: 50 } }, { fragGiven: { f: 'coroa', n: 2 } }] }] },
    text: 'O fogo começa dentro do Coração e não para. Por quarenta dias o Ermo queima.\n\nDo deus sobra cinza. Do Ermo, também. A Coroa chama isso de vitória.',
  },
  guilda: {
    id: 'guilda', name: 'O Leilão', faction: 'guilda', icon: '⚖',
    choice: 'Arrancar o Coração e vendê-lo à Guilda',
    req: 'Guilda ≥ 50 e linha da Guilda concluída (ou 2 fragmentos entregues a ela).',
    cond: { any: [{ questDone: 'guilda' }, { all: [{ rep: { f: 'guilda', min: 50 } }, { fragGiven: { f: 'guilda', n: 2 } }] }] },
    text: 'O Coração vai para um baú forrado de chumbo. Os navios da Guilda partem na maré da manhã.\n\nValdrem é abandonada a quem não pagou passagem. Em algum porto distante, alguém compra um deus.',
  },
  bebedores: {
    id: 'bebedores', name: 'O Gole', faction: 'bebedores', icon: '☩',
    choice: 'Beber o Coração',
    req: 'Bebedores ≥ 50 e (linha dos Bebedores concluída ou Corrupção ≥ 60).',
    cond: { all: [{ rep: { f: 'bebedores', min: 50 } }, { any: [{ questDone: 'bebedores' }, { corruption: { min: 60 } }] }] },
    text: 'É quente. É doce. É tudo.\n\nSua pele se abre como uma flor. Valdrem acorda com um novo deus de pé sobre o Ermo — e ele tem o seu rosto.',
  },
  enterro: {
    id: 'enterro', name: 'O Enterro', faction: null, icon: '⚱',
    choice: 'Deitar-se com o deus e fechar a terra sobre os dois',
    req: 'Conhecer o Rito do Enterro e ter guardado ou devorado 3 fragmentos. Exige sua vida.',
    cond: { all: [{ flag: 'rito_enterro' }, { fragKept: 3 }] },
    sacrifice: true,
    text: 'Deuses não se matam. Se enterram.\n\nVocê põe os pedaços de volta no peito do deus e deita junto. A terra de sal fecha por cima. Ninguém reza pelo seu nome. A Chaga para.',
  },
  carniceiro: {
    id: 'carniceiro', name: 'O Carniceiro', faction: null, icon: '🗡',
    choice: 'Cortar o Coração em pedaços, sozinho',
    req: 'Sempre possível.',
    cond: null,
    text: 'Sem agulha, sem fogo, sem compradores. Só um cutelo e muitas horas.\n\nO Coração para de bater no quinto dia. A Chaga para de crescer — mas não recua. Valdrem sobrevive num mundo que continua podre.',
  },
};

export const FALL = {
  id: 'fall', name: 'A Queda de Valdrem', icon: '☠',
  text: 'A Chaga chegou à muralha e não parou. Os sinos tocaram até os sineiros mudarem.\n\nValdrem caiu. A Casa {house} acabou com ela.',
};

export const EXTINCT = {
  id: 'extinct', name: 'Fim da Linhagem', icon: '⚰',
  text: 'Não sobrou ninguém com o sangue da Casa {house}. A porta foi pregada por fora.\n\nA Chaga continuou sem você.',
};

/** Epílogo: blocos condicionais (cond no formato de D/A). Mostra no máximo ~6 linhas. */
export const EPILOGUE = [
  { cond: { chaga: { max: 40 } }, text: 'A Chaga recuou para longe da muralha. Crianças voltaram a brincar no fosso.' },
  { cond: { chaga: { min: 75 } }, text: 'A Chaga já lambia as pedras quando tudo acabou. Metade da cidade tossia sangue dourado.' },
  { cond: { lostDistricts: 3 }, text: 'Os distritos perdidos nos cercos nunca foram reconstruídos. Valdrem encolheu para dentro de si.' },
  { cond: { siegesWon: 3 }, text: 'Três hordas quebraram contra a Muralha. Os nomes dos que lutaram foram gravados no Portão.' },
  { cond: { deadCount: 4 }, text: 'A Casa enterrou {dead} dos seus. Os retratos cobrem uma parede inteira.' },
  { cond: { deadCount: 1, deadMax: 0 }, text: 'Ninguém da Casa morreu no Ermo. Ninguém acredita.' },
  { cond: { rep: { f: 'sutura', max: -50 } }, text: 'A Sutura amaldiçoou seu nome do púlpito. Ninguém da Casa será costurado.' },
  { cond: { rep: { f: 'coroa', max: -50 } }, text: 'A Coroa pregou seu retrato na forca vazia. Recompensa ainda paga.' },
  { cond: { rep: { f: 'guilda', min: 60 } }, text: 'A Guilda batizou um navio com o nome da Casa.' },
  { cond: { rep: { f: 'bebedores', min: 60 } }, text: 'No Antro, ainda bebem em seu nome.' },
  { cond: { fragEaten: 1 }, text: 'Os pedaços do deus que você comeu nunca saíram. Seus herdeiros nascem com os olhos dourados.' },
  { cond: { flag: 'poupou_rendidos' }, text: 'Os homens que você poupou no Ermo contaram a história. Às vezes, bem.' },
  { cond: { flag: 'traiu_guilda' }, text: 'A Guilda não esquece quem mente na balança.' },
  { cond: { flag: 'sutura_cura_gratis' }, text: 'A enfermaria da Sutura guardou uma cama com o nome da Casa.' },
];

/** Marcos (diário). */
export const MILESTONES = {
  first_expedition: 'Primeira descida ao Ermo.',
  first_ichor: 'Primeiro frasco de Icor vendido.',
  first_level: 'Primeiro gole do deus.',
  first_amputation: 'Primeira perda de membro.',
  first_siege: 'Primeiro cerco.',
  first_death: 'O primeiro da Casa morreu no Ermo.',
  antro: 'Descobri o Antro dos Bebedores.',
};
