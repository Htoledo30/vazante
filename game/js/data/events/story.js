// Eventos de história (Área D, formato da Área E): chegada às regiões, o Rito do Enterro, sussurros dos fragmentos.
import {
  BG, TR, FAC, MED, DIF, BRU, LT,
  dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, trait, rep, chaga, time, flag, fight, reveal, journal, rnd, attr,
  has, bg, tr, fl, nfl, corrMin, any, all, not, ck, mod, res,
} from './_h.js';

export default [
  // ---------------------------------------------------------------- chegadas
  {
    id: 'st_r2_cordas', pool: 'field', region: ['r2'], tags: ['floresta'], w: 10, once: true,
    title: 'A floresta que pende',
    text: 'Depois dos Campos, as árvores começam. Em cada galho, uma corda. Em cada corda, alguém. Uns são velhos, outros ainda pingam. Ninguém sabe quem enforca tanta gente — ou se eles sobem sozinhos.',
    options: [
      { label: 'Contar os mortos para o diário', cost: [time(1)],
        success: res('Você para em cento e doze. Não chega à metade da primeira clareira.', dread(5), reveal(2), journal('A Floresta dos Enforcados. Parei de contar em cento e doze.')) },
      { label: 'Procurar rostos da {casa}', check: ck('ast', MED),
        success: res('Um primo. Ou alguém com o nariz dele. Você corta a corda e ele cai leve como um saco de folhas.', dread(4), item('@trinket:2')),
        fail: res('Todos têm o rosto de alguém que você conhece. Isso é pior.', dread(10)) },
      { label: 'Seguir em frente, de olhos baixos', success: res('As cordas rangem atrás de você até o fim do dia.', dread(3)) },
    ],
  },
  {
    id: 'st_r3_sal', pool: 'field', region: ['r3'], tags: ['catacumbas'], w: 10, once: true,
    title: 'O sal que lembra',
    text: 'As Catacumbas foram minas de sal antes de serem túmulos, e túmulos antes de serem isso. Nas paredes, ossos de santos incrustados no sal, todos virados para o mesmo lado: para o deus.',
    options: [
      { label: 'Raspar sal consagrado das paredes', cost: [time(2)],
        success: res('Sal dos santos. Arde nos mortos.', item('sal_bento', 2), item('sal', 2), rep('sutura', -2)) },
      { label: 'Ler as inscrições', check: ck('ast', MED),
        success: res('“Aqui deitamos o primeiro. Que a terra feche.” Alguém enterrou um deus aqui antes. E funcionou.', flag('rumor_enterro'), journal('As paredes de sal falam de um deus enterrado antes do nosso.')),
        fail: res('Letras demais, luz de menos.', dread(4)) },
      { label: 'Seguir pela galeria', success: res('Os santos olham você passar.') },
    ],
  },
  {
    id: 'st_r4_sinos', pool: 'field', region: ['r4'], tags: ['agua'], w: 10, once: true,
    title: 'Sinos debaixo d’água',
    text: 'Vel-Maren afundou quando o deus caiu e a terra cedeu. A cidade inteira está sob a água preta, e os sinos das torres ainda tocam quando a maré mexe. Você conta as badaladas. Não batem com nenhuma hora.',
    options: [
      { label: 'Tapar os ouvidos com cera', cost: [take('sebo')],
        success: res('O silêncio é bom. Você vai sentir falta dele.', { op: 'trait', id: 'surdo' }, dread(-8)) },
      { label: 'Ouvir até entender', check: ck('von', DIF),
        success: res('Não é música. É um nome. O nome de quem afundou a cidade. Você guarda.', reveal(3), flag('nome_voz'), journal('Os sinos de Vel-Maren repetem um nome.')),
        fail: res('Você acorda com água até a cintura, andando para dentro.', dread(15), dmg(6)) },
      { label: 'Seguir pelas pontes podres', success: res('As tábuas gemem. Os sinos também.', dread(3)) },
    ],
  },
  {
    id: 'st_r5_carne', pool: 'field', region: ['r5'], tags: ['carne'], w: 10, once: true,
    title: 'Dentro do deus',
    text: 'Não há mais chão. Há carne, quente, que cede sob a bota e respira. As paredes são costelas do tamanho de torres. Em algum lugar, muito longe, uma batida. Depois outra. O Coração.',
    options: [
      { label: 'Tocar a carne com a mão nua', kind: 'danger',
        success: res('Ela reconhece você. Pelo Icor nas suas veias. Um calor sobe pelo braço.', corr(6), heal(20), { op: 'attr', a: 'vig', n: 1 }) },
      { label: 'Marcar o caminho com sal', cond: has('sal'), tag: 'sal', cost: [take('sal')],
        success: res('A carne recua do sal como de uma queimadura. Você deixa uma trilha branca para voltar.', reveal(4)) },
      { label: 'Andar sem tocar em nada', check: ck('des', MED),
        success: res('Você pisa só nas cartilagens secas. Mais lento. Mais limpo.', time(1)),
        fail: res('A carne se fecha no seu tornozelo e morde.', wound('perf', 1, 'pernas'), corr(3)) },
    ],
  },
  // ---------------------------------------------------------------- o Rito do Enterro
  {
    id: 'st_rito_enterro', pool: 'field', region: ['r3'], tags: ['catacumbas', 'mortos'], w: 6, once: true,
    cond: fl('rumor_enterro'),
    title: 'O coveiro de sal',
    text: 'No fundo da galeria, um velho de pele branca de sal cava uma cova que não termina. Ele não é vivo, mas não ataca. “Veio perguntar como se enterra um deus”, diz, sem parar de cavar. “Todos vêm, no fim.”',
    options: [
      { label: 'Cavar com ele por um dia', cost: [time(12)], check: ck('vig', MED),
        success: res('Às mãos sangrando, ele ensina: os pedaços voltam ao peito, quem carrega deita junto, a terra fecha sobre os dois. Ninguém lembra o nome do enterrado. Nem o do coveiro.', flag('rito_enterro'), dread(-10), journal('Aprendi o Rito do Enterro com um coveiro de sal. Exige os fragmentos — e quem os carrega.')),
        fail: res('Você desmaia antes da metade. Acorda sozinho, com terra na boca e meia lição.', dread(8), dmg(8)) },
      { label: 'Oferecer Icor pelo segredo', cost: [ichor(-3)],
        success: res('Ele bebe e fala rápido, como quem tem pressa de esquecer. “Os pedaços. O peito. Você junto. A terra.”', flag('rito_enterro'), corr(2), journal('Paguei Icor por um segredo: o Rito do Enterro.')) },
      { label: 'Ir embora', success: res('“Você volta”, ele diz para a cova.') },
    ],
  },
  // ---------------------------------------------------------------- fragmentos sussurram
  {
    id: 'st_fragmento_sonho', pool: 'camp', region: 'any', tags: ['noite'], w: 3, once: true,
    cond: any(has('fragmento_olho'), has('fragmento_lingua'), has('fragmento_mao'), has('fragmento_ventre')),
    title: 'O pedaço fala',
    text: 'No escuro do acampamento, o fragmento do deus na mochila se mexe. Uma voz que não usa ouvidos pergunta se você quer saber para onde ele quer voltar.',
    options: [
      { label: 'Ouvir', check: ck('von', DIF),
        success: res('Ele mostra o caminho até o Coração. E o que há em volta.', reveal(4), corr(3), flag('ouviu_fragmento')),
        fail: res('Ele mostra demais. Você acorda gritando.', dread(18), corr(4)) },
      { label: 'Embrulhar em sal e dormir longe dele', cond: has('sal'), tag: 'sal', cost: [take('sal')],
        success: res('A voz abafa. O sono vem, ruim, mas vem.', dread(-5)) },
      { label: 'Ignorar', success: res('Ele não insiste. Ele tem tempo.', dread(6)) },
    ],
  },
];
