// r3 — Catacumbas de Sal. Esqueletos de placas, carniçais, sacerdotes renegados, costurados.
import {
  BG, TR, FAC, MED, DIF, BRU, LT,
  hp, dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, healW, trait, untrait, mutation, rep, chaga, time, light, flag, fight,
  reveal, journal, rnd, attr,
  has, bg, tr, fl, corrMin, dreadMin, partOk, any, not, ck, mod, res,
} from './_h.js';

const R3 = ['r3'];

export default [
  {
    id: 'r3_sal_que_chora', pool: 'field', region: R3, tags: ['catacumba', 'sal'], w: 2,
    title: 'Paredes que choram sal',
    text: 'As paredes da galeria suam salmoura. Onde as gotas caem, o chão cresce em cristais. Dizem que esse sal foi abençoado pelos primeiros bispos. Dizem que ainda funciona.',
    options: [
      { label: 'Raspar sal das paredes (2h)', cost: [time(2)],
        success: res('Mãos rachadas, sacos cheios.', item('sal', 3)) },
      { label: 'Lamber o sal da parede', cond: corrMin(20), tag: 'Corrompido',
        success: res('Queima a língua, a garganta, o estômago. O que sobe de volta é preto e se mexe.', corr(-8), dmg(8), dread(6)) },
      { label: 'Rezar como os bispos', check: ck('von', MED, [mod(tr(TR.piedoso), 20, 'piedoso')]),
        success: res('Os cristais brilham fraco sob sua mão. Você leva um pouco do brilho.', item('sal_bento', 2), dread(-6)),
        fail: res('O eco devolve sua oração em vozes que não são suas.', dread(8)) },
    ],
  },
  {
    id: 'r3_banquete_carnicais', pool: 'field', region: R3, tags: ['catacumba', 'fera'], w: 2,
    title: 'Banquete',
    text: 'Numa câmara funerária, carniçais de costas magras roem um sacerdote ainda vestido. Cinco. Absortos. O caminho passa ao lado deles.',
    options: [
      { label: 'Passar em silêncio', check: ck('des', MED, [mod(has('sebo'), 10, 'sebo')]),
        success: res('Mastigação, estalos, gemidos de prazer. Nenhum levanta a cabeça.', dread(5)),
        fail: res('Um deles fareja o ar e para de mastigar.', fight(['carnical', 'carnical'], { ambush: 'enemy' })) },
      { label: 'Atacar enquanto comem', kind: 'blood',
        success: res('Eles estão de costas. Comida faz qualquer bicho burro.', fight(['carnical', 'carnical', 'carnical'], { ambush: 'hero', onWin: [item('@trinket:3'), coin(12)] })) },
      { label: 'Atirar a carne podre longe e passar', cost: [take('carne_podre')],
        success: res('Carniçais preferem carne velha. Eles correm atrás. Você passa.', dread(2)) },
    ],
  },
  {
    id: 'r3_sacerdote_costura', pool: 'field', region: R3, tags: ['catacumba', 'fe', 'mutilacao'], w: 2,
    title: 'O renegado oferece um braço',
    text: 'Um sacerdote expulso da Sutura opera numa cripta, entre membros conservados em salmoura. “Aquele braço era de um gladiador. Eu costuro no lugar do seu. Pague com Icor.”',
    options: [
      { label: 'Trocar o braço da arma (3 Icor)', cost: [ichor(-3)], check: ck('vig', MED),
        success: res('Dias de febre em cima de uma laje. Quando acorda, o braço novo obedece. Mais pesado. Mais forte. Não é seu.', attr('for', 2), corr(8), time(24), dread(8)),
        fail: res('A costura rejeita. O braço novo apodrece no ombro e ele precisa cortar os dois.', wound('corte', 3, 'bracoD'), corr(6), time(24)) },
      { label: 'Comprar óleo de embalsamar (10)', cost: [coin(-10)],
        success: res('Óleo grosso, cheiro de cravo. Queima bem.', item('oleo', 2)) },
      { label: 'Denunciar à Sutura depois', success: res('Você memoriza o caminho da cripta.', flag('r3_renegado_denunciar'), rep('sutura', 3)) },
      { label: 'Matá-lo', kind: 'blood',
        success: res('Os membros nas salmouras se mexem quando ele grita.', fight(['sacerdote_renegado', 'costurado'], { onWin: [rep('sutura', 6), item('oleo'), item('@trinket:3')] })) },
    ],
  },
  {
    id: 'r3_cavaleiro_sentado', pool: 'field', region: R3, tags: ['catacumba', 'mortos'], w: 2,
    title: 'O cavaleiro sentado',
    text: 'Um esqueleto de armadura completa sentado num trono de sal, espada sobre os joelhos. Uma placa: DEFENDEU A PORTA CINQUENTA ANOS. A porta atrás dele está fechada.',
    options: [
      { label: 'Fazer uma reverência e passar', check: ck('von', MED),
        success: res('A cabeça dele acompanha você. A espada não se move. A porta abre sozinha.', loot(LT.cripta)),
        fail: res('Ele se levanta. Cinquenta anos de prática.', fight(['esqueleto_placas'], { onWin: [item('@armor:3')] })) },
      { label: 'Tomar a espada dos joelhos dele', check: ck('des', DIF),
        success: res('Você puxa devagar. Ele não reage. É uma espada linda.', item('@weapon:3', 1, 2)),
        fail: res('A mão de osso fecha no seu pulso.', fight(['esqueleto_placas'], { ambush: 'enemy' })) },
      { label: 'Desafiá-lo para duelo honrado', kind: 'blood',
        success: res('Ele se levanta e saúda. Você também.', fight(['esqueleto_placas'], { canFlee: false, onWin: [item('@weapon:3', 1, 2), dread(-15)] })) },
    ],
  },
];
