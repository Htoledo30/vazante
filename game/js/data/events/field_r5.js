// r5 — O Cadáver. Dentro da carne do deus.
import {
  BG, TR, FAC, MED, DIF, BRU, LT,
  hp, dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, healW, trait, mutation, rep, chaga, time, flag, fight,
  reveal, journal, rnd, attr,
  has, bg, tr, fl, corrMin, dreadMin, any, not, ck, mod, res,
} from './_h.js';

const R5 = ['r5'];

export default [
  {
    id: 'r5_arteria', pool: 'field', region: R5, tags: ['carne', 'icor'], w: 2,
    title: 'A artéria',
    text: 'Um túnel de carne viva pulsa à sua volta. Num ponto, a parede é fina e translúcida: lá dentro corre Icor puro, em torrente, quente como forja. Bater ali abriria um rio.',
    options: [
      { label: 'Furar e encher frascos', check: ck('des', DIF),
        success: res('Um furo do tamanho de um dedo. O jato dourado enche cinco frascos antes que você o tampe com a mão.', ichor(5), corr(6)),
        fail: res('O furo vira rasgo. A torrente te atinge no peito.', ichor(3), wound('icor', 2, 'tronco'), corr(10)) },
      { label: 'Abrir a artéria inteira', kind: 'danger',
        success: res('O rio de Icor arrasta você túnel abaixo. Quando acorda, está coberto de ouro e o deus está um pouco mais morto.', chaga(-4, 'Artéria do deus aberta'), corr(15), ichor(3), dmg(15)) },
      { label: 'Seguir sem tocar', success: res('O pulso dela segue você, como olhos.', dread(5)) },
    ],
  },
  {
    id: 'r5_ascendido', pool: 'field', region: R5, tags: ['carne', 'bebedores'], w: 2,
    title: 'Aquele que bebeu tudo',
    text: 'Um homem fundido à parede de carne até a cintura, a pele de ouro líquido. Foi um Bebedor. Agora é parte do deus. “Venha. Aqui dentro não dói. Aqui dentro não se morre.”',
    options: [
      { label: 'Tocar a mão dele', kind: 'danger',
        success: res('Você vê pelos olhos do deus por um instante: estrelas, queda, fome. Volta com algo a mais.', mutation(), mutation(), corr(10), dread(-20)) },
      { label: 'Perguntar o caminho do Coração', check: ck('ast', DIF),
        success: res('Ele aponta com o braço que ainda é braço. “Por onde dói mais.”', reveal(3), dread(6)),
        fail: res('Ele só ri, e a parede ri com ele.', dread(12)) },
      { label: 'Libertá-lo com a lâmina', kind: 'blood',
        success: res('Ele não quer ser libertado.', fight(['bebedor_ascendido'], { onWin: [ichor(4), rep('bebedores', -10)] })) },
    ],
  },
  {
    id: 'r5_batimento', pool: 'field', region: R5, tags: ['carne', 'pavor'], w: 2,
    title: 'O batimento',
    text: 'Aqui o batimento do Coração é tão forte que faz os dentes baterem. A cada pulso, o chão de carne sobe e desce. Seu próprio coração tenta acompanhar o ritmo.',
    options: [
      { label: 'Sincronizar a respiração', check: ck('von', DIF),
        success: res('Você respira com ele. Por um momento, vocês são o mesmo bicho. Depois, só você. Mais calmo.', dread(-20)),
        fail: res('Seu coração dispara para alcançar o dele. Você cai de joelhos.', dmg(12), dread(15)) },
      { label: 'Tapar os ouvidos e seguir', success: res('Não adianta. Ele bate nos ossos.', dread(10)) },
      { label: 'Gravar o ritmo', cond: tr(TR.ouvido), tag: 'Ouve o deus',
        success: res('Você conhece esse ritmo. Já ouvia em sonhos. Ele te diz para onde vai o sangue.', reveal(4), corr(3)) },
    ],
  },
  {
    id: 'r5_ninho_anjos', pool: 'field', region: R5, tags: ['carne', 'elite'], w: 2,
    title: 'Berçário',
    text: 'Bolsas de carne penduradas do teto, cada uma com algo se mexendo dentro. Anjos, dizem os loucos. Uma bolsa já está rasgada. Pegadas pequenas no chão úmido.',
    options: [
      { label: 'Queimar o berçário', cost: [take('oleo')],
        success: res('As bolsas guincham ao queimar. A Chaga lá fora sente.', chaga(-3, 'Berçário do deus queimado'), dread(10), rep('coroa', 6)) },
      { label: 'Abrir uma bolsa', kind: 'danger',
        success: res('', rnd([40, [item('lasca_divina', 3), corr(4)], 'Dentro, só ossos brancos e quentes.'], [60, [fight(['anjo_carne'], { ambush: 'enemy', onWin: [ichor(5)] })], 'Dentro, algo pronto para nascer.'])) },
      { label: 'Seguir as pegadas pequenas', check: ck('ast', DIF),
        success: res('Elas levam a um atalho. A coisa que as fez não está lá. Ainda.', reveal(3)),
        fail: res('Elas levam até ela.', fight(['filho_icor', 'filho_icor'], { ambush: 'enemy' })) },
    ],
  },
];
