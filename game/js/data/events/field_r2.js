// r2 — Floresta dos Enforcados. Mortos pendurados, lobos de tendão, bruxas da casca, caçadores de cabeças.
import {
  BG, TR, COMP, FAC, MED, DIF, BRU, LT,
  hp, dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, healW, trait, untrait, mutation, rep, chaga, time, flag, fight,
  reveal, journal, rnd, attr, loseComp,
  has, bg, tr, fl, corrMin, dreadMin, any, not, COMPANION, ck, mod, res,
} from './_h.js';

const R2 = ['r2'];

export default [
  {
    id: 'r2_arvore_enforcados', pool: 'field', region: R2, tags: ['floresta', 'mortos'], w: 2,
    title: 'A árvore cheia',
    text: 'Um carvalho com cem galhos e um enforcado em cada. As cordas rangem juntas, como um coro. Um deles, de botas de cavaleiro, aponta com o braço duro para o leste.',
    options: [
      { label: 'Seguir para onde ele aponta (2h)', cost: [time(2)],
        success: res('', rnd(
          [55, [loot(LT.soldado), reveal(1)], 'O acampamento dele, intocado. Ele queria que alguém achasse.'],
          [45, [fight(['enforcado', 'enforcado'], { ambush: 'enemy' })], 'O leste está cheio de outros como ele. Esses descem das árvores.'],
        )) },
      { label: 'Cortar a corda do cavaleiro', check: ck('des', MED),
        success: res('Ele cai inteiro. Armadura boa, só um pouco podre.', item('@armor:2'), dread(4)),
        fail: res('Ele cai em cima de você. E não está tão morto.', fight(['enforcado'], { ambush: 'enemy' })) },
      { label: 'Passar por baixo sem olhar', check: ck('von', MED),
        success: res('Cem pares de pés balançam sobre sua cabeça. Você não olha.', dread(2)),
        fail: res('Você olha. Todos estão olhando para você.', dread(14)) },
    ],
  },
  {
    id: 'r2_bruxa_casca', pool: 'field', region: R2, tags: ['floresta', 'bruxa'], w: 2,
    title: 'A mulher dentro da árvore',
    text: 'Um rosto de mulher afundado no tronco de uma faia, a casca crescendo sobre as bochechas. Os olhos se abrem. “Me dá um ano da sua vida e eu te dou um ano de sorte.”',
    options: [
      { label: 'Aceitar o trato', kind: 'danger',
        success: res('Ela beija sua testa com lábios de madeira. Você sente o ano ir embora pelos dentes. Envelhece um pouco. Fica mais duro.', attr('vig', 1), dmg(10), trait(TR.amaldicoado), corr(3)) },
      { label: 'Pedir que tire uma maldição', cond: tr(TR.amaldicoado), tag: 'Amaldiçoado',
        success: res('“Essa? Essa é minha prima.” Ela suga a maldição pela sua boca e cospe na terra.', untrait(TR.amaldicoado), dmg(6), dread(6)) },
      { label: 'Queimar a árvore', cost: [take('oleo')],
        success: res('Ela grita por horas. A floresta inteira grita junto.', item('cabelo_bruxa'), chaga(-1), dread(10), rep('coroa', 4)) },
      { label: 'Cortar o cabelo dela', cond: bg(BG.cacador), tag: 'Caçador de Bruxas', check: ck('des', MED),
        success: res('Uma mecha de cabelo de bruxa vale ouro em Valdrem. Ela amaldiçoa você, mas sem cabelo a maldição não pega.', item('cabelo_bruxa', 2)),
        fail: res('Galhos te agarram pelo pescoço antes de você terminar.', fight(['bruxa_casca'], { ambush: 'enemy', onWin: [item('cabelo_bruxa')] })) },
      { label: 'Seguir', success: res('“Volta quando faltar sorte.”') },
    ],
  },
  {
    id: 'r2_trofeus', pool: 'field', region: R2, tags: ['floresta', 'humanos'], w: 2,
    title: 'Varal de cabeças',
    text: 'Um caçador de cabeças secou as presas num varal entre duas árvores. Cabeças de Carniceiros, ainda de capacete. Uma delas tem o brasão da {casa}. O dono do varal ronca numa rede logo ali.',
    options: [
      { label: 'Matá-lo dormindo', check: ck('des', MED),
        success: res('Ele acorda com sua lâmina no pescoço e não volta a dormir.', coin(20), item('@weapon:2'), dread(-6)),
        fail: res('Galho estala. Ele já tem o machado na mão.', fight(['cacador_cabecas'], { onWin: [coin(20), item('@weapon:2')] })) },
      { label: 'Pegar a cabeça da {casa} e sumir', check: ck('des', FAC),
        success: res('A cabeça vai na mochila. A {casa} vai poder enterrar alguém.', rep('guilda', 4), dread(-4), journal('Recuperei a cabeça de um parente num varal da Floresta.')),
        fail: res('A cabeça cai e rola. Ele abre os olhos.', fight(['cacador_cabecas'], { ambush: 'enemy' })) },
      { label: 'Recolher todas para a Guilda', cost: [time(1)],
        success: res('A Guilda paga por cada nome devolvido às famílias. Pesa, fede, rende.', rep('guilda', 8), coin(15), dread(6)) },
    ],
  },
  {
    id: 'r2_lobos_uivo', pool: 'field', region: R2, tags: ['floresta', 'fera'], w: 2,
    title: 'Uivo de tendão',
    text: 'Os lobos-de-tendão uivam com bocas que não fecham, porque não têm pele nas bochechas. São seis. Estão ganhando terreno pelas árvores, dos dois lados.',
    options: [
      { label: 'Subir numa árvore e esperar', check: ck('for', MED),
        success: res('Eles rodam a árvore até a noite cair e desistem. Você desce com câimbras e vivo.', time(4), dread(4)),
        fail: res('Você escorrega no primeiro galho.', fight(['lobo_tendao', 'lobo_tendao'], { ambush: 'enemy' })) },
      { label: 'Correr para o rio', check: ck('des', MED),
        success: res('Água até o peito. Eles não entram. Ficam na margem, uivando.', dmg(3)),
        fail: res('Eles são mais rápidos.', fight(['lobo_tendao', 'lobo_tendao'])) },
      { label: 'Mandar seu companheiro atrair a matilha', cond: COMPANION, kind: 'danger',
        success: res('Seu companheiro corre para o outro lado, latindo e ganindo. A matilha vai atrás. Ele não volta.', loseComp(), dread(10)) },
      { label: 'Firmar o pé e lutar', kind: 'blood',
        success: res('Costas numa árvore. Que venham.', fight(['lobo_tendao', 'lobo_tendao', 'lobo_tendao'], { onWin: [item('tendao', 3), item('couro', 2), dread(-10)] })) },
    ],
  },
];
