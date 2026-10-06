// Eventos das linhas de missão das facções (Área D, formato da Área E).
// Aparecem no Ermo quando a etapa está ativa (flagOnStart) e cumprem o objetivo 'flag' via questStep.
import {
  BG, TR, FAC, MED, DIF, BRU, LT,
  dmg, dread, corr, coin, ichor, item, take, loot, wound, trait, rep, chaga, time, flag, fight, reveal, journal, rnd,
  has, bg, tr, fl, nfl, any, all, not, ck, mod, res,
} from './_h.js';

const step = (f, s) => ({ op: 'questStep', f, step: s });

export default [
  // ---------------------------------------------------------------- Sutura 2: A Freira Pendurada
  {
    id: 'q_sutura_freira', pool: 'field', region: ['r2'], tags: ['floresta', 'mortos'], w: 8, once: true,
    cond: all(fl('q_sutura_2'), nfl('q_sutura_2_done')),
    title: 'Irmã Calva',
    text: 'Ela pende de um galho alto, hábito cinza, a boca cosida com fio preto. O rosário de dentes balança no pescoço. Os pés se mexem. Devagar. Como quem sonha que anda.',
    options: [
      { label: 'Subir e cortar a corda', check: ck('des', MED, [mod(has('tendao'), 10, 'corda de tendão')]),
        success: res('Você corta e a segura antes que toque o chão. Arranca o rosário. Ela não abre os olhos — ainda.', item('agua_benta'), step('sutura', 2), dread(6)),
        fail: res('O galho quebra. Vocês dois caem. Ela levanta primeiro.', fight([{ id: 'enforcado', elite: true }], { ambush: 'enemy', onWin: [step('sutura', 2)] })) },
      { label: 'Queimar o galho e pegar o rosário das cinzas', cost: [take('oleo')],
        success: res('A corda arde, ela cai em chamas e para de se mexer. O rosário sobrevive, preto de fuligem. A Madre não vai gostar do jeito.', step('sutura', 2), rep('sutura', -4), dread(4)) },
      { label: 'Rezar com ela antes', check: ck('von', DIF, [mod(tr(TR.piedoso), 15, 'Piedoso'), mod(bg(BG.flagelante), 10, 'Flagelante')]),
        success: res('Pelos pontos da boca ela sussurra: “Não se mata um deus. Se enterra. Pergunte ao sal.” Depois fica quieta, e você pega o rosário.', step('sutura', 2), flag('rumor_enterro'), dread(-6), journal('A freira enforcada falou de enterrar o deus. "Pergunte ao sal."')),
        fail: res('Você reza. Ela canta junto, com a boca costurada. Você não esquece o som.', dread(14), step('sutura', 2)) },
      { label: 'Deixar para depois', success: res('Ela continua balançando. Vai estar ali. Elas sempre estão.') },
    ],
  },
  // ---------------------------------------------------------------- Guilda 2: O Rival
  {
    id: 'q_guilda_rival', pool: 'field', region: ['r1', 'r2', 'r3'], tags: ['humanos'], w: 8, once: true,
    cond: all(fl('q_guilda_2'), nfl('q_guilda_2_done')),
    title: 'Oskar Dente-Torto',
    text: 'O carniceiro rival tem uma carroça cheia de frascos e um Bebedor de olhos dourados contando moedas. Ele te vê e sorri com metade da boca. “A Ilse te mandou? Ela paga mal. Eu pago melhor.”',
    options: [
      { label: 'Resolver como a Guilda quer', kind: 'blood',
        success: res('“Que pena.” Ele saca o cutelo.', fight(['carniceiro_rival', 'bebedor'], { onWin: [step('guilda', 2), ichor(3), coin(25)] })) },
      { label: 'Chantagear: a Guilda vai saber de tudo', check: ck('ast', MED, [mod(has('amuleto_guilda'), 10, 'selo da Guilda')]),
        success: res('Ele calcula. Entrega a carroça e jura sumir para Moenda. Você leva as provas para a Ilse.', step('guilda', 2), ichor(2), rep('bebedores', -5)),
        fail: res('“Mentira mal contada.” O Bebedor já está atrás de você.', fight(['carniceiro_rival', 'bebedor'], { ambush: 'enemy', onWin: [step('guilda', 2)] })) },
      { label: 'Aceitar a parceria (60 moedas)', kind: 'danger',
        success: res('Vocês apertam as mãos. A Guilda nunca vai saber. Até saber.', coin(60), rep('bebedores', 10), flag('traiu_guilda'), journal('Fiz negócio com o rival da Guilda pelas costas da Ilse.')) },
    ],
  },
  // ---------------------------------------------------------------- Bebedores 2: Sangue da Agulha
  {
    id: 'q_bebedores_freira', pool: 'field', region: ['r1', 'r2'], tags: ['humanos', 'estrada'], w: 8, once: true,
    cond: all(fl('q_bebedores_2'), nfl('q_bebedores_2_done')),
    title: 'O frasco da Madre',
    text: 'Uma freira jovem, dois zelotes de costas sangrando e uma caixa de chumbo amarrada ao peito dela. Lá dentro, Icor puro para o altar da Sutura. Ela reza baixinho. Os zelotes rezam alto.',
    options: [
      { label: 'Emboscar a procissão', kind: 'blood',
        success: res('Eles não fogem. Fanáticos nunca fogem.', fight(['zelote', 'zelote'], { ambush: 'hero', onWin: [step('bebedores', 2), rep('sutura', -15), ichor(1)] })) },
      { label: 'Fingir ser da Sutura e pedir o frasco', check: ck('ast', DIF, [mod(tr('marca_sutura'), 25, 'pontos da Sutura'), mod(bg(BG.flagelante), 15, 'Flagelante')]),
        success: res('Você recita a ladainha certa. Ela entrega a caixa com lágrimas de alívio. Vai descobrir no altar.', step('bebedores', 2), rep('sutura', -6)),
        fail: res('“Você não tem os pontos.” Os zelotes avançam.', fight(['zelote', 'zelote'], { onWin: [step('bebedores', 2), rep('sutura', -15)] })) },
      { label: 'Beber o frasco você mesmo', kind: 'danger', check: ck('for', MED),
        success: res('Você arranca a caixa e bebe ali mesmo. O mundo vira ouro por um minuto inteiro. Os Bebedores vão ficar furiosos — e impressionados.', corr(12), rep('sutura', -10), rep('bebedores', -5), { op: 'heal', n: 30 }),
        fail: res('Um zelote crava os dentes no seu braço.', fight(['zelote', 'zelote'], { ambush: 'enemy' })) },
      { label: 'Deixar passar', success: res('Ela te abençoa sem saber. Você sente o peso disso mais do que gostaria.', rep('sutura', 3)) },
    ],
  },
];
