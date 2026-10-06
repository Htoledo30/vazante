// r4 — Vel-Maren, a Cidade Afogada. Afogados que explodem, pescadores de homens, cantos que enlouquecem.
import {
  BG, TR, FAC, MED, DIF, BRU, LT,
  hp, dmg, heal, dread, corr, coin, ichor, item, take, loot, wound, trait, mutation, rep, chaga, time, flag, fight,
  reveal, journal, rnd, attr,
  has, bg, tr, fl, corrMin, dreadMin, any, not, ck, mod, res,
} from './_h.js';

const R4 = ['r4'];

export default [
  {
    id: 'r4_canto', pool: 'field', region: R4, tags: ['agua', 'pavor'], w: 2,
    title: 'O canto debaixo d’água',
    text: 'Da água escura entre as casas afundadas vem uma canção sem palavras, linda, numa voz que você lembra de quando era criança. Seus pés já estão molhados. Você não lembra de ter dado esses passos.',
    options: [
      { label: 'Tapar os ouvidos com sebo', cost: [take('sebo')],
        success: res('Silêncio. Você vê a coisa que cantava: uma carcaça de mulher com a boca aberta até o umbigo.', dread(6)) },
      { label: 'Resistir', check: ck('von', DIF, [mod(tr(TR.piedoso), 15, 'fé'), mod(tr(TR.insone), 10, 'insone')]),
        success: res('Você morde a língua até sangrar e a dor te puxa de volta.', dmg(3), dread(4)),
        fail: res('Água no peito. No queixo. A canção vira dentes.', fight(['sereia_carcaca'], { ambush: 'enemy', onWin: [ichor(2)] })) },
      { label: 'Cantar junto', cond: corrMin(50), tag: 'Corrompido',
        success: res('Ela para. Escuta. Responde. Vocês cantam até amanhecer. Ela te dá um presente do fundo.', item('@trinket:4', 1, 2), corr(4), dread(-10)) },
    ],
  },
  {
    id: 'r4_barqueiro', pool: 'field', region: R4, tags: ['agua', 'humanos'], w: 2,
    title: 'O barqueiro',
    text: 'Um pescador numa canoa de pele costurada, rede cheia de mãos. “Atravesso você pelo canal grande. O preço é uma libra. De carne. Sua.”',
    options: [
      { label: 'Pagar com carne', kind: 'blood',
        success: res('Ele corta da coxa com uma faca de escamar, rápido e limpo. Você atravessa sangrando, mas atravessa.', wound('corte', 2, 'pernas'), reveal(3), dread(6)) },
      { label: 'Pagar com Icor', cost: [ichor(-2)],
        success: res('Ele cheira o frasco, faz careta, aceita. “Carne era melhor.”', reveal(3)) },
      { label: 'Tomar a canoa', kind: 'danger',
        success: res('Ele puxa um arpão de debaixo da rede.', fight(['pescador'], { onWin: [reveal(3), item('@weapon:4')] })) },
      { label: 'Ir pela margem (4h)', cost: [time(4)],
        success: res('Lama, casas afundadas, afogados dormindo de pé.', dread(6)) },
    ],
  },
  {
    id: 'r4_torre_sino', pool: 'field', region: R4, tags: ['agua', 'tesouro'], w: 2,
    title: 'A torre afundada',
    text: 'Só o topo do campanário sai da água. Lá embaixo, onde ficava o tesouro da paróquia, algo dourado brilha. Afogados boiam em volta, de bruços, inchados como odres.',
    options: [
      { label: 'Mergulhar', check: ck('vig', DIF),
        success: res('Pulmões explodindo, dedos no ouro, de volta à superfície.', loot(LT.rico), dmg(4)),
        fail: res('Mãos inchadas te seguram lá embaixo.', fight(['afogado', 'afogado'], { ambush: 'enemy' }), dmg(6)) },
      { label: 'Explodir os afogados com fogo primeiro', cost: [take('oleo')],
        success: res('Eles estouram como bexigas cheias de bile. O caminho fica livre — e nojento.', loot(LT.rico), dread(4)) },
      { label: 'Deixar', success: res('O ouro não vai a lugar nenhum. Nem eles.') },
    ],
  },
  {
    id: 'r4_mare_baixa', pool: 'field', region: R4, tags: ['agua'], w: 2,
    title: 'Maré baixa',
    text: 'A maré recua de uma vez e revela uma rua inteira de Vel-Maren: lojas, carroças, gente sentada nas portas como se esperasse. Você tem pouco tempo antes da água voltar.',
    options: [
      { label: 'Saquear rápido as lojas (1h)', cost: [time(1)], check: ck('des', MED),
        success: res('Prata, ferramentas, um cofre de mercador. Você sai quando a água já está na canela.', loot(LT.rico)),
        fail: res('A água volta antes. Você perde metade e quase tudo.', loot(LT.pobre), dmg(6)) },
      { label: 'Revistar os sentados', kind: 'danger',
        success: res('', rnd([50, [coin(25), item('@trinket:4')], 'Bolsas cheias. Ninguém reclama.'], [50, [fight(['afogado', 'afogado', 'afogado'], { ambush: 'enemy' })], 'Eles levantam quando você toca o primeiro.'])) },
      { label: 'Observar de longe', success: res('Quando a maré volta, os sentados acenam.', dread(5)) },
    ],
  },
];
