// Eventos diários de Valdrem (pool 'city', source 'daily'). Execuções, portões, motins, pregadores, peste, facções, mercado negro.
// Vários fecham cadeias abertas no Ermo (flags r1_*, mercador_carne_conhecido...).
import {
  BG, TR, COMP, FAC, MED, DIF, BRU, LT,
  hp, dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, healW, trait, untrait, mutation, rep, chaga, time, flag, fight,
  chain, journal, rnd, companion, loseComp, unlock, attr, siege, count,
  has, bg, tr, notTr, fl, nfl, repMin, repMax, corrMin, dreadMin, chagaMin, dayMin, coinMin, any, all, not, COMPANION, ck, mod, res,
} from './_h.js';

const C = 'any';

export default [
  // ---------------- execuções ----------------
  {
    id: 'city_execucao', pool: 'city', region: C, tags: ['execucao', 'coroa'], w: 3, cooldown: 5,
    title: 'Dia de forca',
    text: 'A praça está cheia. No cadafalso, um homem de olho vazado: roubou um saco de cevada da reserva da Coroa. O carrasco está bêbado demais para dar o nó. O capitão procura um voluntário.',
    options: [
      { label: 'Voluntariar-se como carrasco', kind: 'danger',
        success: res('O nó sai perfeito. A multidão aplaude a sua mão firme. O capitão paga em prata.', coin(15), rep('coroa', 6), rep('sutura', -2), dread(-8), rnd([40, [trait(TR.carrasco)], 'Você dorme bem demais nessa noite.'], [60, []])) },
      { label: 'Assistir', success: res('O pescoço estala. A multidão suspira. É o que passa por diversão em Valdrem.', dread(-4)) },
      { label: 'Bater carteiras na multidão', check: ck('des', MED, [mod(bg(BG.ladra), 20, 'ladra')]),
        success: res('Todos olham para cima. Ninguém olha para os bolsos.', coin(18)),
        fail: res('Mão agarrada. “Ladrão!” Você leva o ferrete na frente da mesma multidão.', wound('fogo', 1, 'bracoD'), trait(TR.marcado), rep('coroa', -8)) },
      { label: 'Jogar pão para o condenado', cost: [take('racao')],
        success: res('Ele pega no ar e come rápido, chorando, com a corda já no pescoço. Uma última refeição. A Guarda anota seu rosto.', rep('sutura', 4), rep('coroa', -3), dread(-6)) },
    ],
  },
  {
    id: 'city_crianca_forca', pool: 'city', region: C, tags: ['execucao', 'criancas'], w: 2, cooldown: 10,
    title: 'Pequeno demais para a corda',
    text: 'Uma menina de uns dez anos no cadafalso, os pés não chegam ao banquinho. Roubou um pão do armazém do quartel. A lei é a lei, diz o magistrado. A multidão está quieta.',
    options: [
      { label: 'Pagar a multa (20 moedas)', cost: [coin(-20)],
        success: res('O magistrado aceita, aliviado. A menina corre sem olhar para trás.', rep('sutura', 6), dread(-8)) },
      { label: 'Falar por ela', cond: repMin('coroa', 15), tag: 'Coroa ≥ 15', check: ck('von', MED),
        success: res('Seu nome pesa. Ela leva chicotadas em vez da corda. Vai viver, com as costas marcadas.', rep('coroa', -2), rep('sutura', 4), dread(-4)),
        fail: res('“A lei não tem amigos.” O banquinho cai.', dread(12)) },
      { label: 'Cortar a corda e sumir na multidão', check: ck('des', DIF),
        success: res('Um talho, um empurrão, e a menina some com você entre as pernas da multidão.', rep('coroa', -10), rep('sutura', 6), flag('city_menina_forca_salva'), dread(-6)),
        fail: res('Você corta a corda. A Guarda corta você.', fight(['desertor', 'cacador_bruxas'], { onWin: [rep('coroa', -15)] }), rep('coroa', -10)) },
      { label: 'Virar as costas', success: res('O silêncio da praça diz mais que o estalo.', dread(10)) },
    ],
  },
  // ---------------- portão ----------------
  {
    id: 'city_portao', pool: 'city', region: C, tags: ['portao', 'refugiados'], w: 3, cooldown: 4,
    title: 'O portão fechado',
    text: 'Do lado de fora das muralhas, centenas de refugiados. Do lado de dentro, a Guarda com lanças. Uma mulher passa uma criança por cima da paliçada. Um soldado ergue a lança para devolvê-la.',
    options: [
      { label: 'Pegar a criança antes do soldado', check: ck('des', MED),
        success: res('Ela cai nos seus braços. O soldado te olha, decide que não vale a briga, cospe.', rep('sutura', 5), rep('coroa', -3), dread(-6), flag('city_crianca_portao')),
        fail: res('A lança é mais rápida. Ninguém da multidão grita. Já gritaram tudo.', dread(14)) },
      { label: 'Subornar a abertura para uma família (15)', cost: [coin(-15)],
        success: res('Uma família entra. Atrás dela, a Chaga também entra, um pouco.', rep('sutura', 4), chaga(1, 'Refugiados doentes entraram'), dread(-5)) },
      { label: 'Ajudar a Guarda a afastá-los', success: res('Lanças, gritos, um homem pisoteado. A ordem se mantém.', rep('coroa', 6), rep('sutura', -4), dread(6)) },
      { label: 'Contrabando pelos esgotos da Guilda', cond: repMin('guilda', 20), tag: 'Guilda ≥ 20',
        success: res('Pelos túneis, vinte pessoas entram. A Guilda cobra delas depois, com juros.', coin(10), rep('guilda', 4), rep('sutura', 3), chaga(1)) },
    ],
  },
  {
    id: 'city_refugiados_gratidao', pool: 'city', region: C, tags: ['refugiados'], w: 4, once: true, cond: fl('r1_refugiados_ajudados'),
    title: 'Alguém lembrou',
    text: 'Uma velha do lado de fora do portão te reconhece do Ermo. Ela conseguiu entrar. Aperta sua mão e põe nela um embrulho: tudo o que sobrou da casa dela.',
    options: [
      { label: 'Aceitar', success: res('Dentro, um amuleto de família e um bilhete com o nome de cada um que morreu no caminho.', item('@trinket:1'), dread(-8)) },
      { label: 'Recusar e devolver', success: res('Ela chora, guarda, e diz que vai rezar por você. Num lugar como Valdrem, isso vale algo.', rep('sutura', 6), dread(-12)) },
    ],
  },
  // ---------------- fome ----------------
  {
    id: 'city_motim_pao', pool: 'city', region: C, tags: ['fome', 'motim'], w: 3, cooldown: 6,
    title: 'Motim do pão',
    text: 'A fila da padaria da Coroa virou turba. Arrombaram a porta. O padeiro sangra na calçada, abraçado a um saco de farinha. Soldados vêm descendo a rua.',
    options: [
      { label: 'Pegar o que der', check: ck('des', MED),
        success: res('Você sai pelos fundos com pão debaixo do braço antes dos soldados.', item('racao', 3), rep('coroa', -3)),
        fail: res('Uma bota no peito, uma clava no braço. Você sai sem pão.', wound('impacto', 1, 'bracoE'), rep('coroa', -5)) },
      { label: 'Defender o padeiro', kind: 'blood',
        success: res('A fome tem dentes.', fight(['saqueador', 'saqueador'], { onWin: [rep('coroa', 5), coin(12), item('racao', 2)] })) },
      { label: 'Distribuir suas rações para acalmar', cost: [take('racao', 2)],
        success: res('Você sobe num barril e reparte. A turba vira fila de novo, por um minuto. Basta para os soldados não chegarem matando.', rep('sutura', 6), rep('coroa', 3), dread(-8)) },
      { label: 'Sair da rua', success: res('Atrás de você, o som de lanças entrando em carne magra.', dread(5)) },
    ],
  },
  // ---------------- pregador (cadeia) ----------------
  {
    id: 'city_pregador', pool: 'city', region: C, tags: ['fe', 'bebedores'], w: 3, once: true,
    title: 'O pregador da sede',
    text: 'Em cima de um caixote, um homem magro de veias douradas: “O deus não caiu! Ele se OFERECEU! Quem bebe dele não morre — se transforma!” A multidão escuta demais.',
    options: [
      { label: 'Ouvir o sermão inteiro', success: res('Faz sentido de um jeito que dá medo. Ele te nota no fim. “Volte amanhã à noite.”', corr(1), rep('bebedores', 4), flag('city_pregador_ouvido')) },
      { label: 'Denunciá-lo à Sutura', success: res('Os irmãos da agulha o arrastam pelos cabelos. Você recebe uma bênção e um olhar de ódio da multidão.', rep('sutura', 6), rep('bebedores', -6), flag('city_pregador_preso')) },
      { label: 'Derrubar o caixote', check: ck('for', FAC),
        success: res('Ele cai feio. A multidão ri e se dispersa. Ele te olha do chão como quem anota.', rep('coroa', 3), rep('bebedores', -3)),
        fail: res('A multidão te empurra para longe. Ninguém toca no pregador.', dmg(3)) },
    ],
  },
  {
    id: 'city_pregador_fogueira', pool: 'city', region: C, tags: ['fe', 'execucao'], w: 5, once: true, cond: fl('city_pregador_preso'),
    title: 'A fogueira do pregador',
    text: 'A Sutura vai queimar o pregador ao meio-dia. Os fiéis dele estão na praça, muitos, de veias douradas. A Guarda está nervosa. Alguém vai começar alguma coisa.',
    options: [
      { label: 'Ficar com a Sutura na linha de frente', kind: 'blood',
        success: res('Começa. Os Bebedores avançam sem medo de dor.', fight(['bebedor', 'bebedor'], { onWin: [rep('sutura', 8), rep('bebedores', -8), chaga(-1)] })) },
      { label: 'Libertar o pregador no tumulto', check: ck('des', DIF),
        success: res('No caos, você corta as cordas. Ele some nos becos. “O deus lembra de você.”', rep('bebedores', 12), rep('sutura', -10), unlock('antro'), journal('Libertei o pregador da fogueira. Os Bebedores me devem.')),
        fail: res('Pego com a faca na corda dele.', rep('sutura', -12), wound('impacto', 1), rep('coroa', -4)) },
      { label: 'Ficar longe', success: res('A fumaça cheira a Icor queimando. Três morrem no tumulto.', dread(4)) },
    ],
  },
  {
    id: 'city_comunhao', pool: 'city', region: C, tags: ['bebedores', 'icor'], w: 5, once: true, cond: fl('city_pregador_ouvido'),
    title: 'A comunhão',
    text: 'Uma porta vermelha atrás do matadouro. Dentro, velas, gente nua até a cintura, uma taça passando de boca em boca. O pregador te estende a taça. “Uma vez. Só para saber.”',
    options: [
      { label: 'Beber da taça', kind: 'danger',
        success: res('Você entende por que eles não têm medo. Entende por que alguns não voltam. Agora você sabe o caminho do Antro.', corr(8), dread(-25), rep('bebedores', 12), unlock('antro'), rnd([30, [mutation()], 'Algo floresce dentro de você.'], [70, []])) },
      { label: 'Fingir que bebe', check: ck('des', MED),
        success: res('Lábios molhados, garganta fechada. Eles te aceitam.', rep('bebedores', 6), unlock('antro')),
        fail: res('“Ele não bebeu.” Silêncio. Facas.', fight(['bebedor', 'bebedor'], { onWin: [ichor(2), rep('bebedores', -15)] })) },
      { label: 'Ir embora e avisar a Coroa', success: res('No dia seguinte, a porta vermelha está queimada. Nem todos estavam lá dentro.', rep('coroa', 8), rep('bebedores', -12)) },
    ],
  },
  // ---------------- peste ----------------
  {
    id: 'city_casa_selada', pool: 'city', region: C, tags: ['peste'], w: 3, cooldown: 8,
    title: 'Porta pregada',
    text: 'Uma casa com X de piche na porta e tábuas nas janelas. De dentro, uma voz de menino pede água. Faz três dias que ninguém traz. A tosse para e volta.',
    options: [
      { label: 'Passar água pela fresta', success: res('Mãos magras pegam o odre. Você lava as suas três vezes depois.', rep('sutura', 3), dread(-4), rnd([25, [dmg(6), corr(2)], 'No dia seguinte, você tosse também.'], [75, []])) },
      { label: 'Arrancar as tábuas', kind: 'danger',
        success: res('Dois mortos e dois vivos lá dentro. Os vivos fogem para a rua. A Guarda não perdoa quem abre casa selada.', rep('coroa', -8), rep('sutura', 5), chaga(1, 'Casa de peste aberta'), dread(-4)) },
      { label: 'Tratar os doentes', cond: bg(BG.cirurgia), tag: 'Cirurgiã', check: ck('ast', MED),
        success: res('Lancetar, drenar, queimar. Um menino vai viver. A Sutura paga pelo serviço e espalha seu nome.', rep('sutura', 10), coin(15), dread(-8)),
        fail: res('Tarde demais para todos. E você respirou fundo demais lá dentro.', dmg(8), corr(2)) },
      { label: 'Avisar a Guarda que ainda há vivos', success: res('Eles vêm com piche e fogo. Resolvem do jeito deles.', rep('coroa', 4), dread(8)) },
    ],
  },
  {
    id: 'city_medico_bico', pool: 'city', region: C, tags: ['peste', 'cura'], w: 2, cooldown: 7,
    title: 'O médico de bico',
    text: 'Máscara de couro com bico cheio de ervas, luvas até o cotovelo. Ele vende “remédio contra a Chaga” numa garrafinha verde. Atrás dele, uma fila de desesperados.',
    options: [
      { label: 'Comprar o remédio (10)', cost: [coin(-10)],
        success: res('', rnd([50, [heal(10), dread(-4)], 'Aguardente com hortelã. Mas você se sente melhor.'], [50, [dmg(4)], 'Urina de cavalo com corante. Ele já foi embora.'])) },
      { label: 'Desmascará-lo', check: ck('ast', MED, [mod(bg(BG.cirurgia), 20, 'cirurgiã')]),
        success: res('Você prova, cospe e diz em voz alta o que é. A fila vira turba. Ele foge sem a bolsa.', coin(14), rep('sutura', 3)),
        fail: res('Ninguém acredita em você. Esperança é mais forte que razão.', dread(2)) },
      { label: 'Pagar para ele tratar suas feridas (25)', cost: [coin(-25)],
        success: res('Charlatão para a Chaga, mas sabe costurar.', healW(1), heal(8)) },
    ],
  },
  // ---------------- mercado negro ----------------
  {
    id: 'city_mercado_negro', pool: 'city', region: C, tags: ['icor', 'guilda'], w: 3, cooldown: 4,
    title: 'Icor de beco',
    text: 'Um vendedor de capuz abre o casaco num beco: frascos de Icor, mais baratos que na Guilda. “Sem perguntas. Sem selos. Sem impostos.”',
    options: [
      { label: 'Comprar um frasco (22)', cost: [coin(-22)],
        success: res('', rnd([65, [ichor(1)], 'Parece bom. É bom.'], [35, [ichor(1), corr(5)], 'Batizado com bile. Você só descobre depois de beber.'])) },
      { label: 'Vender um frasco (26)', cost: [ichor(-1)],
        success: res('Mais do que a Guilda paga. A Guilda não precisa saber.', coin(26), rep('guilda', -2)) },
      { label: 'Denunciar à Guilda', success: res('Os cobradores da Guilda o encontram antes do pôr do sol. Você recebe uma comissão.', coin(8), rep('guilda', 6), rep('bebedores', -2)) },
      { label: 'Roubar o estoque', kind: 'blood',
        success: res('Ele não está sozinho.', fight(['saqueador', 'bebedor'], { onWin: [ichor(2), coin(10)] })) },
    ],
  },
  // ---------------- facções ----------------
  {
    id: 'city_briga_faccoes', pool: 'city', region: C, tags: ['faccao'], w: 3, cooldown: 6,
    title: 'O corpo de ninguém',
    text: 'No meio da rua, um Carniceiro morto de veias douradas. Irmãos da Sutura querem costurá-lo “para o deus”. A Guarda quer queimá-lo. As mãos já estão nas armas.',
    options: [
      { label: 'Ficar ao lado da Sutura', success: res('Sua espada pesa na balança. A Guarda recua. O corpo vai para a agulha.', rep('sutura', 7), rep('coroa', -5)) },
      { label: 'Ficar ao lado da Coroa', success: res('O fogo vence. Cheiro de Icor queimado na rua toda.', rep('coroa', 7), rep('sutura', -5), chaga(-1)) },
      { label: 'Separar os dois', check: ck('von', DIF, [mod(tr(TR.cicatriz), 15, 'cicatriz')]),
        success: res('Você grita mais alto que eles. Decidem dividir: cabeça para o fogo, corpo para a agulha. Ninguém fica feliz. Ninguém morre.', rep('sutura', 3), rep('coroa', 3), dread(-4)),
        fail: res('Os dois lados te empurram. Alguém te acerta no meio da confusão.', wound('impacto', 1), dread(4)) },
      { label: 'Pegar o Icor do morto enquanto discutem', check: ck('des', MED),
        success: res('Ninguém percebe o frasco a menos.', ichor(1), rep('guilda', 1)),
        fail: res('Os dois lados percebem. Pela primeira vez concordam em algo: você.', rep('sutura', -5), rep('coroa', -5), wound('impacto', 1)) },
    ],
  },
  {
    id: 'city_dizimo', pool: 'city', region: C, tags: ['fe', 'sutura'], w: 2, cooldown: 8,
    title: 'O dízimo',
    text: 'Dois irmãos da Sutura batem à porta da {casa}, sacola de couro na mão. “O deus se costura com a ajuda de todos. A sua parte, por favor.”',
    options: [
      { label: 'Pagar 10 moedas', cost: [coin(-10)], success: res('Eles abençoam sua porta com um ponto de linha vermelha.', rep('sutura', 4)) },
      { label: 'Ofertar Icor', cost: [ichor(-1)], success: res('Eles se ajoelham ali mesmo. “O deus sente.” A Chaga recua um passo.', rep('sutura', 10), chaga(-1, 'Icor ofertado à Sutura')) },
      { label: 'Recusar', success: res('Eles anotam o nome da casa num livro grosso.', rep('sutura', -4)) },
    ],
  },
  {
    id: 'city_muralha', pool: 'city', region: C, tags: ['coroa', 'cerco'], w: 2, cooldown: 7,
    title: 'Mãos para a muralha',
    text: 'Um sargento grita na praça: precisam de braços para reforçar a muralha antes do próximo cerco. Paga pouco. Paga em pão.',
    options: [
      { label: 'Trabalhar o dia todo (8h)', cost: [time(8)], success: res('Pedras, argamassa, um homem esmagado por um bloco. A muralha está mais forte.', siege(3), rep('coroa', 4), item('racao', 2), dmg(4)) },
      { label: 'Doar sucata (3)', cost: [take('sucata', 3)], success: res('Pontas, pregos, lâminas quebradas — tudo vira estaca no fosso.', siege(2), rep('coroa', 3)) },
      { label: 'Ensinar os recrutas a matar ocos (4h)', cond: any(bg(BG.desertor), bg(BG.gladiador)), tag: 'Veterano', cost: [time(4)],
        success: res('Garotos de quinze anos com lanças. Agora sabem onde enfiar.', siege(3), rep('coroa', 6)) },
      { label: 'Ignorar', success: res('Os outros vão fazer. Talvez.') },
    ],
  },
  // ---------------- taverna e vício ----------------
  {
    id: 'city_aposta_faca', pool: 'city', region: C, tags: ['taverna', 'aposta'], w: 2, cooldown: 4,
    title: 'Jogo da faca',
    text: 'Na Taverna do Enforcado, um mercenário espalma a mão na mesa e bate a faca entre os dedos, rápido. “Dez moedas que você não faz igual.”',
    options: [
      { label: 'Aceitar a aposta (10)', cost: [coin(-10)], check: ck('des', MED),
        success: res('Tac-tac-tac-tac. Dedos inteiros. A taverna urra.', coin(25), dread(-5)),
        fail: res('Tac-tac-tac-crac. A faca entra no dedo mínimo. Sai sem ele.', wound('corte', 2, 'bracoE'), dread(6)) },
      { label: 'Queda de braço em vez disso (10)', cost: [coin(-10)], check: ck('for', MED, [mod(bg(BG.gladiador), 20, 'gladiador')]),
        success: res('O braço dele bate na mesa com estalo. A taverna paga a rodada.', coin(25), dread(-6)),
        fail: res('Seu cotovelo estala antes do braço dele.', wound('impacto', 1, 'bracoD'), dread(3)) },
      { label: 'Recusar', success: res('Chamam você de covarde. Covardes vivem mais.') },
    ],
  },
  {
    id: 'city_carne_beco', pool: 'city', region: C, tags: ['fome', 'canibal'], w: 4, cond: tr(TR.canibal), cooldown: 6,
    title: 'Cheiro de assado',
    text: 'Um cheiro adocicado vem de uma porta baixa no beco dos curtumes. Você conhece esse cheiro. Seu estômago também. A fome sobe pela garganta como um animal.',
    options: [
      { label: 'Entrar e comer (5)', cost: [coin(-5)], success: res('Ninguém fala lá dentro. Todos sabem. A carne é macia.', heal(20), dread(-10), corr(2), rep('coroa', -2)) },
      { label: 'Resistir', check: ck('von', DIF),
        success: res('Você segue andando. Um dia, talvez, isso passe.', dread(4), rnd([25, [untrait(TR.canibal)], 'O cheiro, pela primeira vez, só te dá nojo.'], [75, []])),
        fail: res('Você para na porta. Entra. Sai uma hora depois sem lembrar do caminho.', heal(20), corr(3), dread(5)) },
      { label: 'Denunciar o lugar', success: res('A Guarda queima a casa. Você assiste com a boca cheia d’água.', rep('coroa', 6), dread(6)) },
    ],
  },
  // ---------------- cadeias do Ermo ----------------
  {
    id: 'city_recompensa_desertor', pool: 'city', region: C, tags: ['coroa'], w: 6, once: true, cond: fl('r1_cabeca_desertor'),
    title: 'Cabeça a prêmio',
    text: 'O saco já fede. No quartel, o escrivão confere o ferrete no rosto da cabeça contra um livro de nomes. Na porta, uma mulher de luto reconhece o rosto e cai de joelhos.',
    options: [
      { label: 'Receber a recompensa', success: res('Vinte e cinco moedas. O escrivão risca o nome. A mulher não para de gritar.', coin(25), rep('coroa', 6), dread(5)) },
      { label: 'Entregar a cabeça à viúva', success: res('Ela enterra o marido inteiro, ou quase. Você sai sem moedas e um pouco mais leve.', rep('sutura', 5), rep('coroa', -3), dread(-10)) },
    ],
  },
  {
    id: 'city_moinho_denuncia', pool: 'city', region: C, tags: ['coroa', 'guilda'], w: 6, once: true, cond: fl('r1_moinho_denunciar'),
    title: 'O moinho de ossos',
    text: 'Você sabe de um moinho que mói gente nos Campos de Cinza. A Coroa pagaria pela informação. A Guilda também — por razões diferentes.',
    options: [
      { label: 'Contar à Guarda', success: res('Uma patrulha parte ao amanhecer. Volta com quatro cabeças e farinha para queimar.', coin(15), rep('coroa', 7), dread(-6)) },
      { label: 'Vender o lugar à Guilda', success: res('O mestre-açougueiro sorri. “Fornecedores são sempre bem-vindos.” Você não pergunta o que vão vender.', coin(35), rep('guilda', 6), rep('sutura', -4), dread(6), corr(1)) },
      { label: 'Esquecer', success: res('Alguns segredos é melhor deixar moer.', dread(3)) },
    ],
  },
  {
    id: 'city_mercador_carne', pool: 'city', region: C, tags: ['fome', 'coroa'], w: 6, once: true, cond: fl('mercador_carne_conhecido'),
    title: 'O gordo no mercado',
    text: 'O mercador de carne do Ermo agora tem banca no mercado de Valdrem. Fila longa de mães com crianças. “Porco. Porco do bom.” Ele te vê. Para de sorrir.',
    options: [
      { label: 'Denunciar em voz alta', check: ck('von', MED),
        success: res('A multidão vira a carroça. Debaixo da carne salgada, uma mão com anel. Enforcam o gordo antes do pôr do sol.', rep('coroa', 8), rep('sutura', 4), dread(-10)),
        fail: res('Ninguém quer acreditar: é a carne mais barata da cidade. Ele manda alguém te seguir.', fight(['saqueador'], { onWin: [rep('coroa', 3)] })) },
      { label: 'Chantagear', success: res('Ele paga sem discutir, e vai pagar de novo. Você come em outro lugar.', coin(30), flag('chantagem_mercador'), dread(4)) },
      { label: 'Deixar estar', success: res('As crianças da fila estão gordas pela primeira vez em anos.', dread(6)) },
    ],
  },
  {
    id: 'city_mira', pool: 'city', region: C, tags: ['criancas'], w: 6, once: true, cond: fl('r1_mira_salva'),
    title: 'Mira',
    text: 'Mira, a menina do poço, dorme na escadaria do Templo. Roubou duas vezes nesta semana; a Guarda já tem o rosto dela. Ela te vê e não sabe se corre para você ou de você.',
    options: [
      { label: 'Pagar para a Sutura acolhê-la (12)', cost: [coin(-12)],
        success: res('As irmãs a recebem. Pão, sabão, oração. Ela vai odiar. Vai viver.', rep('sutura', 5), dread(-8), flag('mira_templo')) },
      { label: 'Levá-la para a {casa} como aprendiz', success: res('Ela aprende rápido: abrir trancas, ler rastros, ficar quieta. Um dia vai sair com você para o Ermo.', flag('mira_aprendiz'), dread(-6), journal('Mira agora mora na {casa}. Aprende o ofício.')) },
      { label: 'Ignorá-la', success: res('Na semana seguinte, a Guarda a pega. Você não pergunta o que aconteceu.', dread(6)) },
    ],
  },
  {
    id: 'city_mira_batedora', pool: 'city', region: C, tags: ['criancas', 'sequaz'], w: 6, once: true, cond: all(fl('mira_aprendiz'), dayMin(12), not(COMPANION)),
    title: 'Mira quer ir',
    text: 'Mira apareceu de botas cortadas para o tamanho dela, uma faca no cinto e um mapa que copiou do seu. “Eu conheço o Ermo melhor que você. Me leva.”',
    options: [
      { label: 'Levá-la como batedora', success: res('Ela anda na frente, leve como sombra. Você se pergunta se fez certo.', companion(COMP.batedora), dread(-4)) },
      { label: '“Ainda não.”', success: res('Ela bate a porta. Vai tentar de novo.') },
    ],
  },
  {
    id: 'city_bebe', pool: 'city', region: C, tags: ['criancas', 'fe'], w: 6, once: true, cond: fl('r1_bebe_levado'),
    title: 'O bebê do Ermo',
    text: 'O bebê que você trouxe sobreviveu à viagem. Duas portas querem ele: as irmãs da Sutura, que criam órfãos para o claustro, e um homem da Guilda, que paga bem por “sangue limpo de Chaga” — para estudos.',
    options: [
      { label: 'Entregar às irmãs', success: res('Ele vai crescer costurando cadáveres e rezando. Há destinos piores.', rep('sutura', 8), dread(-8)) },
      { label: 'Vender à Guilda (40)', kind: 'danger', success: res('Quarenta moedas. O homem embrulha o bebê num pano limpo, o mais limpo que você já viu.', coin(40), rep('guilda', 6), dread(10), corr(2), rnd([50, [trait(TR.impiedoso)]], [50, []])) },
      { label: 'Criar na {casa}', success: res('A {casa} tem um herdeiro a mais. Ou uma boca a mais. Depende do inverno.', flag('casa_bebe'), dread(-12), coin(-5), journal('Adotei o bebê do Ermo na {casa}.')) },
    ],
  },
  {
    id: 'city_bruxa_salva', pool: 'city', region: C, tags: ['fe', 'cura'], w: 6, once: true, cond: fl('r1_bruxa_salva'),
    title: 'A moça da fogueira',
    text: 'A moça que você tirou da procissão agora vende ervas perto do curtume. As manchas sumiram. Ela te reconhece e fecha a banca. “Para você, não é venda.”',
    options: [
      { label: 'Aceitar o presente', success: res('Unguento, ervas e um aviso: “Os penitentes ainda me procuram. E procuram você.”', item('unguento', 2), item('ervas', 2)) },
      { label: 'Pedir que trate suas feridas', success: res('Mãos firmes, cheiro de alecrim. Ela cobra só um sorriso, que você não tem.', healW(), heal(10)) },
    ],
  },
  // ---------------- casa ----------------
  {
    id: 'city_ladrao_casa', pool: 'city', region: C, tags: ['casa', 'criancas'], w: 2, cooldown: 12,
    title: 'Mão no baú',
    text: 'Você pega um moleque de uns doze anos com a mão dentro do baú da {casa}. Magro, sem dois dedos, olhos de quem já apanhou de gente pior. A lei de Valdrem diz: a mão.',
    options: [
      { label: 'Cumprir a lei', kind: 'danger', success: res('Um golpe de cutelo. Ele desmaia sem gritar. A Guarda elogia sua firmeza.', rep('coroa', 5), rep('sutura', -4), dread(6), rnd([35, [trait(TR.carrasco)]], [65, []])) },
      { label: 'Soltar com um aviso', success: res('Ele corre. Amanhã vai roubar outra casa. Talvez uma que corte.', rep('sutura', 2), dread(-2)) },
      { label: 'Dar trabalho a ele', success: res('Ele vira seus olhos na cidade. Nada acontece em Valdrem sem que um moleque veja.', flag('casa_moleque'), coin(-5), rep('guilda', 2)) },
    ],
  },
  {
    id: 'city_insulto_casa', pool: 'city', region: C, tags: ['honra', 'guilda'], w: 2, cooldown: 10,
    title: 'Insulto à casa',
    text: 'No salão da Guilda, um Carniceiro do corvo cospe no chão perto dos seus pés. “A {casa} manda crianças e aleijados pro Ermo. Por isso morre tanto.” Silêncio na sala.',
    options: [
      { label: 'Desafiar para duelo', kind: 'blood',
        success: res('Pátio dos fundos. Sem regras.', fight(['carniceiro_rival'], { canFlee: false, onWin: [rep('guilda', 6), dread(-10), coin(10)] })) },
      { label: 'Responder à altura', check: ck('ast', MED),
        success: res('Uma frase só, sobre a mãe dele e um porco. A sala explode em risada. Ele sai vermelho.', rep('guilda', 4), dread(-4)),
        fail: res('Ninguém ri. Você engole.', rep('guilda', -2), dread(4)) },
      { label: 'Engolir', success: res('A Guilda lembra quem engole.', rep('guilda', -4), dread(3)) },
      { label: 'Cobrar o sangue jurado', cond: tr(TR.jurado), tag: 'Juramento',
        success: res('Sua lâmina já está no pescoço dele antes que alguém se mexa. Agora, sem regras.', fight(['carniceiro_rival'], { ambush: 'hero', canFlee: false, onWin: [untrait(TR.jurado), dread(-20), rep('guilda', 2)] })) },
    ],
  },
  {
    id: 'city_barbeiro_tendoes', pool: 'city', region: C, tags: ['cirurgia', 'cura'], w: 2, cooldown: 14,
    title: 'Tendões de lobo',
    text: 'Um barbeiro sem licença, de avental preto, oferece “a operação dos campeões do fosso”: costurar tendões de lobo-da-Chaga nos seus. Mais rápido, mais forte. “Quase ninguém morre.”',
    options: [
      { label: 'Fazer a operação (30)', cost: [coin(-30)], check: ck('vig', MED),
        success: res('Uma semana de febre. Depois, suas pernas respondem antes de você pensar.', attr('des', 1), corr(3), time(12)),
        fail: res('A costura apodrece. Você perde a febre — e alguma coisa da perna.', wound('corte', 3, 'pernas'), corr(3), time(12)) },
      { label: 'Recusar', success: res('“Volte quando quiser viver mais.”') },
      { label: 'Conhecer o truque dele', cond: bg(BG.cirurgia), tag: 'Cirurgiã',
        success: res('Você vê os pontos que ele erra. Ele te paga para calar, e para ensinar o certo.', coin(15), rep('guilda', 2)) },
    ],
  },
  {
    id: 'city_sermao_sutura', pool: 'city', region: C, tags: ['fe', 'sutura'], w: 2, cooldown: 6,
    title: 'Missa da Agulha',
    text: 'Na catedral, o Bispo prega diante de um altar onde pedaços de gente estão costurados em forma de anjo. “Cada ponto é uma prece. Cada prece é um ponto.” Fiéis furam os próprios dedos.',
    options: [
      { label: 'Furar o dedo e ofertar sangue', success: res('Uma gota no altar. Uma paz estranha, emprestada.', dmg(2), dread(-12), rep('sutura', 4)) },
      { label: 'Confessar o que fez no Ermo', check: ck('von', MED, [mod(tr(TR.piedoso), 15, 'piedoso')]),
        success: res('O padre escuta tudo sem piscar. Dá penitência leve. Parece pouco para o tanto que você contou.', dread(-18), rep('sutura', 3)),
        fail: res('Você não consegue falar. As palavras ficam presas como um osso.', dread(4)) },
      { label: 'Roubar a caixa das esmolas', check: ck('des', DIF, [mod(bg(BG.ladra), 20, 'ladra')]),
        success: res('Moedas de quem não tem nada, dadas a quem tem tudo. Agora são suas.', coin(20), rep('sutura', -3)),
        fail: res('Mãos de irmão no seu pulso. Agulha no seu dedo. Muitas vezes.', rep('sutura', -10), dmg(5)) },
    ],
  },
  {
    id: 'city_chaga_avanca', pool: 'city', region: C, tags: ['chaga'], w: 2, cond: chagaMin(40), cooldown: 8,
    title: 'A Chaga dentro dos muros',
    text: 'Manchas negras na pedra do Bairro Baixo. Musgo dourado nas sarjetas. Um poço inteiro amanheceu com água grossa e doce. A Chaga não está mais lá fora.',
    options: [
      { label: 'Ajudar a queimar o bairro contaminado', success: res('Casas, móveis, um cachorro velho que não quis sair. A mancha recua.', chaga(-2, 'Bairro contaminado queimado'), rep('coroa', 5), rep('sutura', -3), dread(8)) },
      { label: 'Salgar o poço', cost: [take('sal', 2)], success: res('Dois sacos de sal. A água volta a ser só água ruim.', chaga(-1), rep('sutura', 4)) },
      { label: 'Colher o musgo dourado', success: res('Tem Icor nele. Pouco. O suficiente para você não pensar no resto.', ichor(1), corr(3)) },
      { label: 'Cuidar da própria vida', success: res('Mais um dia.', dread(3)) },
    ],
  },
];
