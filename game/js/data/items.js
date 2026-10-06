// ICOR — Itens (Área A). Definições estáticas. Instâncias vivem em G (ver systems/items.js).
// Todo id canônico do contrato está aqui. Valores pensados para: Vida do herói ~60-120,
// armadura = redução fixa por golpe e por tipo de dano, dano de arma já recebe escala de atributo.

// ---------------------------------------------------------------- qualidade / escala
export const QUALITY = [
  { q: 0, name: 'ferrugem', mult: 0.8, durMult: 0.6, price: 0.45 },
  { q: 1, name: '', mult: 1, durMult: 1, price: 1 },
  { q: 2, name: 'boa forja', mult: 1.15, durMult: 1.25, price: 1.7 },
  { q: 3, name: 'obra-prima', mult: 1.3, durMult: 1.6, price: 2.8 },
];
export const SCALE_COEF = { S: 1.6, A: 1.3, B: 1.0, C: 0.7, D: 0.4, E: 0.2 };

export const CLASS_NAMES = {
  espada: 'Espada', machado: 'Machado', maca: 'Maça', lanca: 'Lança', adaga: 'Adaga', cutelo: 'Cutelo',
  montante: 'Montante', martelo: 'Martelo', mangual: 'Mangual', foice: 'Foice', besta: 'Besta',
  desarmado: 'Desarmado', gancho: 'Gancho',
};
export const DTYPE_NAMES = { corte: 'Corte', perf: 'Perfuração', impacto: 'Impacto', fogo: 'Fogo', icor: 'Icor' };
export const SLOT_NAMES = {
  main: 'Mão da arma', off: 'Mão secundária', cabeca: 'Cabeça', tronco: 'Tronco', bracos: 'Braços', pernas: 'Pernas',
  amuleto1: 'Amuleto', amuleto2: 'Amuleto',
};
export const TYPE_NAMES = {
  weapon: 'Arma', armor: 'Armadura', offhand: 'Mão secundária', consumable: 'Consumível', material: 'Material',
  trinket: 'Amuleto', key: 'Chave', ammo: 'Munição', tome: 'Tomo', prosthetic: 'Prótese',
};

// Propriedades de arma (B lê; A só descreve). Extras além do contrato documentados em docs/notes/A.md.
export const PROPS = {
  sangra: 'Sangra: golpes abrem feridas que sangram.',
  decepa: 'Decepa: chance maior de arrancar membros.',
  atordoa: 'Atordoa: golpes fortes deixam o alvo zonzo.',
  fura: 'Fura: atravessa parte da armadura.',
  alcance: 'Alcance: ataca a 1 de distância.',
  arremesso: 'Arremesso: pode ser lançada.',
  recarga: 'Recarga: precisa recarregar entre disparos.',
  varredura: 'Varredura: atinge todos os engajados.',
  quebra_escudo: 'Quebra-escudo: racha escudos e guardas.',
  ignora_bloqueio: 'Ignora bloqueio: a corrente contorna o escudo.',
  apara: 'Apara: boa para aparar.',
  pesada: 'Pesada: lenta, custa mais Fôlego.',
  silenciosa: 'Silenciosa: não acorda o que dorme.',
  execucao: 'Execução: execuções mais rápidas e certeiras.',
  puxa: 'Puxa: arrasta o inimigo para perto.',
  antiplaca: 'Antiplaca: ignora metade da armadura de impacto.',
  colheita: 'Colheita: dano maior em feridos.',
  versatil: 'Versátil: com a outra mão livre, golpe a duas mãos (+20% dano).',
  leve: 'Leve: pode ir na mão secundária.',
  maldita: 'Maldita: não sai da mão. Só o Templo tira.',
  sede: 'Sede: cada morte com ela custa 1 de Corrupção.',
  santa: 'Santa: fere mais o que é morto ou da Chaga.',
  autoflagelo: 'Autoflagelo: cada golpe também abre a sua carne.',
  ranged: 'Disparo: prefere distância 1 ou 2.',
};

// ---------------------------------------------------------------- armas
const CLS = {
  espada:   { hands: 1, dtype: 'corte',   time: 100, stam: 2, reach: 0, crit: 6,  props: ['apara'] },
  machado:  { hands: 1, dtype: 'corte',   time: 110, stam: 3, reach: 0, crit: 5,  props: ['decepa', 'quebra_escudo'] },
  maca:     { hands: 1, dtype: 'impacto', time: 110, stam: 3, reach: 0, crit: 4,  props: ['atordoa'] },
  lanca:    { hands: 1, dtype: 'perf',    time: 100, stam: 2, reach: 1, crit: 5,  props: ['alcance', 'fura'] },
  adaga:    { hands: 1, dtype: 'perf',    time: 70,  stam: 1, reach: 0, crit: 12, props: ['sangra', 'silenciosa', 'leve', 'execucao'] },
  cutelo:   { hands: 1, dtype: 'corte',   time: 115, stam: 3, reach: 0, crit: 5,  props: ['decepa', 'sangra'] },
  montante: { hands: 2, dtype: 'corte',   time: 150, stam: 5, reach: 0, crit: 6,  props: ['varredura', 'decepa', 'pesada'] },
  martelo:  { hands: 2, dtype: 'impacto', time: 160, stam: 5, reach: 0, crit: 5,  props: ['atordoa', 'pesada', 'quebra_escudo'] },
  mangual:  { hands: 1, dtype: 'impacto', time: 120, stam: 3, reach: 0, crit: 5,  props: ['ignora_bloqueio', 'atordoa'] },
  foice:    { hands: 2, dtype: 'corte',   time: 130, stam: 4, reach: 1, crit: 6,  props: ['alcance', 'sangra', 'colheita'] },
  besta:    { hands: 2, dtype: 'perf',    time: 100, stam: 2, reach: 2, crit: 8,  props: ['recarga', 'fura', 'ranged'], ranged: true },
  desarmado:{ hands: 1, dtype: 'impacto', time: 80,  stam: 1, reach: 0, crit: 4,  props: [] },
  gancho:   { hands: 1, dtype: 'perf',    time: 90,  stam: 2, reach: 0, crit: 7,  props: ['sangra', 'puxa'] },
};
const DUR_BY_TIER = [0, 40, 55, 70, 85, 100];

function W(id, cls, name, tier, dmg, scale, extra = {}) {
  const base = CLS[cls];
  const props = [...new Set([...(base.props || []), ...(extra.props || [])])].filter((p) => !(extra.noProps || []).includes(p));
  const def = {
    id, name, type: 'weapon', cls, tier, dmg, scale,
    hands: base.hands, dtype: base.dtype, time: base.time, stam: base.stam, reach: base.reach, crit: base.crit,
    weight: 2, value: 10 * tier * tier + 5, dur: DUR_BY_TIER[tier], rarity: 'comum', desc: '',
    ...base.ranged ? { ranged: true } : {},
    ...extra,
  };
  def.props = props;
  delete def.noProps;
  return def;
}

const WEAPONS = [
  // --- adagas
  W('faca', 'adaga', 'Faca', 1, [3, 6], { des: 'C', for: 'E' }, { weight: 0.5, value: 6, desc: 'Faca de cozinha. Já abriu mais gargantas que pão.' }),
  W('adaga', 'adaga', 'Adaga', 1, [4, 7], { des: 'B' }, { weight: 0.7, value: 16, props: ['arremesso'], desc: 'Fina, curta, feita para entrar entre costelas.' }),
  W('punhal_misericordia', 'adaga', 'Punhal de Misericórdia', 2, [4, 8], { des: 'B', ast: 'D' }, { weight: 0.8, value: 48, crit: 16, props: ['fura'], mods: { execute: 25 }, desc: 'Para o golpe final por baixo do elmo. Chamam de misericórdia.' }),
  W('estilete_tumulo', 'adaga', 'Estilete de Túmulo', 3, [5, 9], { des: 'A' }, { weight: 0.6, value: 95, crit: 20, props: ['fura'], region: 'r3', desc: 'Achado entre os dedos de um nobre salgado. Ainda afiado.' }),
  W('dente_cao', 'adaga', 'Dente de Cão da Chaga', 2, [3, 7], { des: 'B' }, { weight: 0.4, value: 40, dur: 22, rarity: 'raro', mods: { bleed: 35 }, desc: 'Presa enorme com cabo de osso. Sangramentos não fecham. Quebra fácil.' }),
  W('adaga_icor', 'adaga', 'Adaga Dourada dos Bebedores', 4, [5, 10], { des: 'B', von: 'C' }, { weight: 0.6, value: 260, dtype: 'icor', rarity: 'unico', props: ['sede'], mods: { lifesteal: 8, dmg_icor: 15 }, desc: 'O fio brilha quando sente sangue. Bebe por você. Você paga.' }),
  // --- espadas
  W('espada_curta', 'espada', 'Espada Curta', 1, [5, 9], { des: 'C', for: 'D' }, { weight: 1.5, value: 22, props: ['leve'], desc: 'Gládio de soldado raso. Simples, confiável.' }),
  W('espada_longa', 'espada', 'Espada Longa', 2, [7, 12], { for: 'C', des: 'C' }, { weight: 2.5, value: 58, desc: 'Aço de cavaleiro morto. Equilibrada para cortar e aparar.' }),
  W('sabre_guarda', 'espada', 'Sabre da Guarda Cinzenta', 3, [8, 13], { des: 'B', for: 'D' }, { weight: 2, value: 115, mods: { parry: 12 }, desc: 'Lâmina curva da Coroa. Guarda em cesto: apara quase tudo.' }),
  W('espada_bastarda', 'espada', 'Espada Bastarda', 3, [9, 15], { for: 'B', des: 'D' }, { weight: 3.5, value: 125, props: ['versatil'], req: { for: 5 }, desc: 'Mão e meia. Com a outra mão livre, corta como montante.' }),
  W('lamina_sutura', 'espada', 'Lâmina da Sutura', 4, [9, 14], { von: 'B', des: 'C' }, { weight: 2.5, value: 300, rarity: 'unico', props: ['santa'], req: { von: 5 }, mods: { dreadResist: 10, corrResist: 10 }, desc: 'A guarda é uma mão de santo costurada ao aço. Os dedos se mexem.' }),
  W('espada_peregrino', 'espada', 'Espada do Último Peregrino', 5, [12, 19], { for: 'B', des: 'B' }, { weight: 3, value: 420, rarity: 'raro', desc: 'Forjada para chegar ao Coração. O dono não chegou.' }),
  // --- machados
  W('machadinha', 'machado', 'Machadinha', 1, [5, 9], { for: 'C', des: 'D' }, { weight: 1.5, value: 15, props: ['arremesso'], desc: 'Racha lenha, racha crânio. Dá para arremessar.' }),
  W('machado_guerra', 'machado', 'Machado de Guerra', 2, [8, 14], { for: 'B' }, { weight: 3.5, value: 62, desc: 'Cabeça larga e pesada. Um braço por golpe, se o ângulo ajudar.' }),
  W('machado_barbado', 'machado', 'Machado Barbado', 3, [10, 16], { for: 'B', des: 'E' }, { weight: 4, value: 130, props: ['puxa'], mods: { sever: 10 }, desc: 'A barba engancha escudos, pernas e pescoços.' }),
  W('machado_enforcado', 'machado', 'Machado do Carrasco Enforcado', 3, [9, 17], { for: 'A' }, { weight: 4, value: 160, rarity: 'unico', region: 'r2', props: ['maldita'], mods: { sever: 22, dread_on_kill: -3 }, desc: 'Tirado das mãos de um enforcado. Agora ele não larga as suas.' }),
  W('machado_ferro_negro', 'machado', 'Machado de Ferro Negro', 5, [14, 22], { for: 'A' }, { weight: 4.5, value: 480, rarity: 'raro', mods: { sever: 10 }, desc: 'Metal que caiu do céu com o deus. Corta osso como sebo.' }),
  // --- maças
  W('porrete', 'maca', 'Porrete', 1, [4, 8], { for: 'C' }, { weight: 2, value: 4, desc: 'Pau de carvalho com pregos tortos. A arma dos pobres.' }),
  W('maca', 'maca', 'Maça', 2, [7, 11], { for: 'B' }, { weight: 3, value: 52, desc: 'Cabeça de ferro. Elmo não salva, só amassa.' }),
  W('maca_flangeada', 'maca', 'Maça Flangeada', 3, [9, 14], { for: 'B' }, { weight: 3.5, value: 125, props: ['antiplaca'], desc: 'Aletas que mordem placas. O homem de lata vira lata amassada.' }),
  W('estrela_manha', 'maca', 'Estrela-da-Manhã', 3, [8, 14], { for: 'B', des: 'E' }, { weight: 3.5, value: 120, props: ['sangra'], desc: 'Bola cravejada. Fura e esmaga ao mesmo tempo.' }),
  W('cetro_bispo', 'maca', 'Cetro do Bispo Costurado', 4, [10, 16], { von: 'B', for: 'C' }, { weight: 3, value: 320, rarity: 'unico', region: 'r3', props: ['santa'], mods: { dread_on_kill: -4, corrResist: -10 }, desc: 'Ouro, pele de herege e um dente de santo no topo. Fere o que já morreu.' }),
  // --- lanças
  W('forcado', 'lanca', 'Forcado', 1, [5, 8], { for: 'C', des: 'D' }, { weight: 2.5, value: 5, hands: 2, desc: 'Ferramenta de feno. Mantém a coisa longe da sua cara.' }),
  W('lanca', 'lanca', 'Lança', 1, [6, 10], { for: 'C', des: 'C' }, { weight: 2.5, value: 20, props: ['versatil', 'arremesso'], desc: 'Haste de freixo, ponta de ferro. A arma mais velha do mundo.' }),
  W('lanca_guarda', 'lanca', 'Lança da Guarda', 2, [7, 12], { for: 'C', des: 'C' }, { weight: 3, value: 60, props: ['versatil'], mods: { first_strike: 15 }, desc: 'Ponta com asas: o inimigo não desliza pela haste até você.' }),
  W('partasana', 'lanca', 'Partasana', 3, [10, 16], { for: 'B', des: 'D' }, { weight: 5, value: 140, hands: 2, time: 120, stam: 3, props: ['decepa'], desc: 'Lâmina larga na ponta da haste. Mantém e corta.' }),
  W('arpao_maren', 'lanca', 'Arpão de Vel-Maren', 4, [9, 15], { des: 'B', for: 'C' }, { weight: 3, value: 240, rarity: 'unico', region: 'r4', props: ['puxa', 'arremesso'], desc: 'Farpas de osso de baleia. Entra fácil. Sai com a carne.' }),
  // --- cutelos
  W('cutelo', 'cutelo', 'Cutelo', 1, [6, 10], { for: 'C' }, { weight: 1.5, value: 12, desc: 'Lâmina retangular de açougue. Separa juntas.' }),
  W('cutelo_acougue', 'cutelo', 'Cutelo de Açougue', 2, [8, 13], { for: 'B' }, { weight: 2.5, value: 42, mods: { sever: 8 }, desc: 'Do tamanho de um antebraço. Feito para porcos inteiros.' }),
  W('serra_ossos', 'cutelo', 'Serra de Ossos', 3, [7, 15], { for: 'C', des: 'C' }, { weight: 2.5, value: 110, time: 125, mods: { bleed: 40, sever: 15 }, desc: 'Ferramenta de barbeiro. No campo, serve para o oposto.' }),
  W('cutelo_mae', 'cutelo', 'Cutelo da Mãe-Colheita', 3, [10, 17], { for: 'B', von: 'D' }, { weight: 3.5, value: 220, rarity: 'unico', region: 'r1', stam: 4, mods: { sever: 25, hp_on_kill: 4 }, desc: 'Ela costurava corpos com isso. Ainda tem linha presa no cabo.' }),
  // --- montantes
  W('montante', 'montante', 'Montante', 3, [14, 22], { for: 'A', des: 'E' }, { weight: 6, value: 150, req: { for: 6 }, desc: 'Espada do tamanho de um homem. Abre espaço numa multidão.' }),
  W('espada_carrasco', 'montante', 'Espada de Carrasco', 4, [15, 24], { for: 'A' }, { weight: 6, value: 280, rarity: 'unico', crit: 3, props: ['execucao'], noProps: ['varredura'], req: { for: 6 }, mods: { execute: 50, dread_on_execute: -10, acc: -10 }, desc: 'Ponta reta, sem guarda. Feita para quem está ajoelhado, não para quem luta.' }),
  W('montante_ferro_negro', 'montante', 'Montante de Ferro Negro', 5, [18, 28], { for: 'A', des: 'D' }, { weight: 6.5, value: 560, rarity: 'raro', req: { for: 7 }, desc: 'Escuro como piche. Zumbe quando corta o ar.' }),
  // --- martelos
  W('marreta', 'martelo', 'Marreta', 1, [9, 15], { for: 'B' }, { weight: 5, value: 10, time: 165, req: { for: 5 }, desc: 'Marreta de pedreiro. Lenta. O que acerta, não levanta.' }),
  W('martelo_guerra', 'martelo', 'Martelo de Guerra', 3, [14, 22], { for: 'A' }, { weight: 6, value: 165, props: ['antiplaca'], req: { for: 6 }, desc: 'Bico de um lado, cabeça do outro. Abre armaduras como latas.' }),
  W('martelo_ferro_negro', 'martelo', 'Martelo de Ferro Negro', 5, [20, 30], { for: 'S' }, { weight: 7, value: 600, rarity: 'raro', props: ['antiplaca'], req: { for: 7 }, desc: 'Cada golpe faz o chão tremer. E o seu ombro.' }),
  // --- manguais
  W('flagelo', 'mangual', 'Flagelo de Penitente', 1, [4, 9], { von: 'C', for: 'D' }, { weight: 1.5, value: 10, props: ['sangra'], desc: 'Correntes com ganchos. Feito para as próprias costas.' }),
  W('mangual', 'mangual', 'Mangual', 2, [7, 13], { for: 'B', des: 'D' }, { weight: 3, value: 58, desc: 'Bola na corrente. Passa por cima do escudo.' }),
  W('mangual_correntes', 'mangual', 'Mangual de Três Correntes', 3, [9, 16], { for: 'B', des: 'D' }, { weight: 3.5, value: 125, desc: 'Três bolas. Uma sempre acha caminho.' }),
  W('mangual_penitente', 'mangual', 'Mangual do Penitente', 3, [10, 17], { for: 'B', von: 'C' }, { weight: 3.5, value: 180, rarity: 'unico', props: ['autoflagelo'], mods: { dreadResist: 25, dmg_all: 10 }, desc: 'A corrente passa pelo seu pulso. Cada golpe abre os dois.' }),
  // --- foices
  W('foice', 'foice', 'Foice', 1, [6, 11], { for: 'C', des: 'C' }, { weight: 3, value: 8, desc: 'Foice de trigo. O trigo morreu. Ainda há colheita.' }),
  W('foice_guerra', 'foice', 'Foice de Guerra', 3, [11, 18], { for: 'B', des: 'C' }, { weight: 4.5, value: 140, desc: 'Lâmina endireitada num cabo longo. Ceifa homens.' }),
  W('foice_ceifeiro', 'foice', 'Foice do Ceifeiro', 3, [12, 19], { for: 'B', des: 'B' }, { weight: 4.5, value: 230, rarity: 'unico', region: 'r1', mods: { hp_on_kill: 5, eva: -5 }, desc: 'Arrancada do Ceifeiro. Pesa como culpa. Cura quem colhe.' }),
  // --- bestas
  W('besta_mao', 'besta', 'Besta de Mão', 2, [7, 11], { des: 'C', ast: 'D' }, { weight: 2, value: 70, hands: 1, desc: 'Pequena, rápida de armar. Pouca força.' }),
  W('besta', 'besta', 'Besta', 2, [10, 16], { des: 'C', ast: 'D' }, { weight: 4, value: 75, desc: 'Arma de covarde, dizem os mortos.' }),
  W('besta_pesada', 'besta', 'Besta Pesada', 3, [15, 24], { des: 'C', for: 'D' }, { weight: 6.5, value: 165, time: 120, req: { for: 5 }, desc: 'Com manivela. Atravessa escudo e quem está atrás.' }),
  W('besta_inquisidor', 'besta', 'Besta do Inquisidor', 4, [13, 20], { des: 'B', ast: 'C' }, { weight: 4, value: 290, rarity: 'unico', props: ['santa'], mods: { acc: 8 }, desc: 'Virotes benzidos em sal. Bruxas sentem o cheiro.' }),
  // --- desarmado / gancho
  W('soqueira', 'desarmado', 'Soqueira de Ferro', 1, [3, 6], { for: 'C', des: 'D' }, { weight: 0.5, value: 9, props: ['atordoa'], mods: { unarmed: 30 }, desc: 'Anéis de ferro. Briga de taverna, versão final.' }),
  W('gancho_protese', 'gancho', 'Gancho (prótese)', 1, [5, 9], { for: 'C', des: 'D' }, { weight: 1, value: 25, prosthetic: 'braco', desc: 'Encaixado no coto. Rasga, puxa, não larga.' }),
  W('gancho_serrilhado', 'gancho', 'Gancho Serrilhado', 3, [8, 13], { for: 'C', des: 'C' }, { weight: 1.2, value: 140, dtype: 'corte', prosthetic: 'braco', rarity: 'raro', mods: { sever: 10 }, desc: 'Gancho com dentes de serra. O coto vira arma de verdade.' }),
];

// Arma padrão sem nada nas mãos.
export const UNARMED = W('desarmado', 'desarmado', 'Punhos', 0, [2, 4], { for: 'C' }, { weight: 0, value: 0, dur: 0, desc: 'Socos, cabeçadas, dentes.' });

// ---------------------------------------------------------------- armaduras
function A(id, slot, name, tier, armor, heavy, weight, value, extra = {}) {
  return { id, name, type: 'armor', slot, tier, armor: { corte: 0, perf: 0, impacto: 0, fogo: 0, ...armor }, heavy, weight, value, dur: DUR_BY_TIER[tier] + 10 * heavy, rarity: 'comum', desc: '', ...extra };
}
const ARMORS = [
  // cabeça
  A('capuz', 'cabeca', 'Capuz', 1, { corte: 1, impacto: 1 }, 0, 0.5, 4, { mods: { stealth: 5 }, desc: 'Lã encardida. Esconde o rosto, não o crânio.' }),
  A('touca_couro', 'cabeca', 'Touca de Couro', 1, { corte: 2, perf: 1, impacto: 1 }, 0, 1, 10, { desc: 'Couro fervido. Melhor que nada.' }),
  A('mascara_peste', 'cabeca', 'Máscara de Bico', 2, { corte: 1, perf: 1 }, 0, 1, 45, { mods: { infectResist: 30, poisonResist: 30, check_von: 5 }, desc: 'Bico cheio de ervas. O fedor da Chaga não entra.' }),
  A('elmo_ferro', 'cabeca', 'Elmo de Ferro', 2, { corte: 4, perf: 3, impacto: 2, fogo: 1 }, 1, 3, 50, { desc: 'Chapéu de ferro. Rosto livre, para ver e ser ferido.' }),
  A('elmo_fechado', 'cabeca', 'Elmo Fechado', 3, { corte: 6, perf: 5, impacto: 3, fogo: 1 }, 1, 4.5, 125, { mods: { intent: -1, dark: -10 }, desc: 'Fresta estreita. Protege tudo, inclusive da verdade do que vem.' }),
  A('capacete_cervo', 'cabeca', 'Crânio de Cervo Podre', 3, { corte: 4, perf: 4, impacto: 3 }, 1, 3, 150, { region: 'r2', rarity: 'raro', mods: { check_von: 10, dreadResist: -10 }, tags: ['intimida'], desc: 'Galhada e osso sobre a cabeça. Os outros recuam. Você sonha com floresta.' }),
  A('coroa_espinhos', 'cabeca', 'Coroa de Pregos', 3, { corte: 1, impacto: 1 }, 0, 1, 160, { rarity: 'unico', mods: { dreadResist: 30, hpMax: -8, corrResist: 10 }, desc: 'Pregos de templo cravados na testa. A dor afasta o medo.' }),
  A('elmo_mergulho', 'cabeca', 'Elmo de Mergulho Afogado', 4, { corte: 7, perf: 6, impacto: 4, fogo: 6 }, 2, 6, 280, { rarity: 'unico', region: 'r4', tags: ['guelras'], mods: { intent: -1, eva: -5, dreadResist: 10 }, desc: 'Bronze e vidro verde. Respira-se dentro dele. Algo respirou antes.' }),
  A('bacinete_ferro_negro', 'cabeca', 'Bacinete de Ferro Negro', 5, { corte: 9, perf: 8, impacto: 5, fogo: 3 }, 1, 4, 450, { rarity: 'raro', mods: { intent: -1 }, desc: 'Viseira de bico. Pesa menos do que deveria.' }),
  // tronco
  A('gibao', 'tronco', 'Gibão Acolchoado', 1, { corte: 2, perf: 1, impacto: 4, fogo: 1 }, 0, 3, 15, { desc: 'Camadas de linho e crina. Absorve pancada.' }),
  A('avental_acougueiro', 'tronco', 'Avental de Açougueiro', 1, { corte: 3, perf: 1, impacto: 1, fogo: 1 }, 0, 2, 8, { mods: { bleedResist: 10 }, desc: 'Couro grosso e manchado. Nunca vai limpar.' }),
  A('manto_penitente', 'tronco', 'Manto de Penitente', 1, { corte: 1, impacto: 1 }, 0, 1.5, 12, { mods: { corrResist: 10, dreadResist: 10 }, desc: 'Saco áspero, costurado com orações. Coça a alma.' }),
  A('couraca_couro', 'tronco', 'Couraça de Couro', 2, { corte: 4, perf: 3, impacto: 3, fogo: 1 }, 1, 5, 45, { desc: 'Couro duro em placas. O meio-termo dos vivos.' }),
  A('casaco_cacador', 'tronco', 'Casaco de Caçador de Bruxas', 2, { corte: 3, perf: 3, impacto: 2, fogo: 4 }, 1, 4, 75, { mods: { fireResist: 20, dreadResist: 5 }, desc: 'Couro encerado contra fogo de fogueira. A dele e a delas.' }),
  A('cota_malha', 'tronco', 'Cota de Malha', 2, { corte: 7, perf: 3, impacto: 2, fogo: 1 }, 2, 9, 110, { desc: 'Mil argolas. Lâminas escorregam; pancadas, não.' }),
  A('brigantina', 'tronco', 'Brigantina', 3, { corte: 6, perf: 5, impacto: 4, fogo: 1 }, 2, 8, 170, { desc: 'Placas rebitadas sob pano. Silenciosa e firme.' }),
  A('couraca_ossos', 'tronco', 'Couraça de Ossos Santos', 3, { corte: 5, perf: 4, impacto: 5 }, 1, 6, 165, { region: 'r3', rarity: 'raro', mods: { dreadResist: 10, corrResist: -5 }, desc: 'Costelas de santos amarradas com tendão. Rangem quando você respira.' }),
  A('peitoral_placas', 'tronco', 'Peitoral de Placas', 3, { corte: 9, perf: 7, impacto: 4, fogo: 2 }, 3, 13, 260, { desc: 'Aço moldado. Você vai ouvir o próprio coração lá dentro.' }),
  A('carapaca_ossario', 'tronco', 'Carapaça de Ossário', 4, { corte: 8, perf: 8, impacto: 6, fogo: 5 }, 2, 11, 300, { region: 'r4', rarity: 'raro', mods: { eva: -3 }, desc: 'Casca de caranguejo do tamanho de um homem. Cheira a maré morta.' }),
  A('armadura_ferro_negro', 'tronco', 'Armadura de Ferro Negro', 5, { corte: 12, perf: 10, impacto: 6, fogo: 4 }, 3, 14, 700, { rarity: 'raro', desc: 'Forjada do metal do céu. Quente ao toque, mesmo no inverno.' }),
  A('pele_anjo', 'tronco', 'Pele de Anjo de Carne', 5, { corte: 6, perf: 6, impacto: 6, fogo: 6 }, 0, 2, 650, { rarity: 'unico', region: 'r5', mods: { regen: 1, corrResist: -20 }, desc: 'Ainda quente. Ainda pulsa. Fecha suas feridas por você — e cola em você.' }),
  // braços
  A('luvas_couro', 'bracos', 'Luvas de Couro', 1, { corte: 1, perf: 1, impacto: 1 }, 0, 0.5, 8, { desc: 'Protegem do frio e das farpas.' }),
  A('luvas_cirurgiao', 'bracos', 'Luvas de Cirurgião', 1, { corte: 1 }, 0, 0.3, 30, { mods: { heal_rate: 15, check_des: 5 }, desc: 'Pelica fina, manchas que não saem. Mãos que sabem onde cortar.' }),
  A('bracadeiras_malha', 'bracos', 'Braçadeiras de Malha', 2, { corte: 3, perf: 1, impacto: 1 }, 0, 2, 40, { desc: 'Mangas de argolas. Lâminas deslizam.' }),
  A('manopla_cravos', 'bracos', 'Manoplas de Cravos', 2, { corte: 2, perf: 2, impacto: 2 }, 0, 1.5, 55, { mods: { unarmed: 40 }, desc: 'Couro com cravos nos nós dos dedos. Um soco vira ferida.' }),
  A('bracais_ferro', 'bracos', 'Braçais de Ferro', 2, { corte: 4, perf: 3, impacto: 2, fogo: 1 }, 1, 3, 60, { mods: { parry: 5 }, desc: 'Canos de ferro no antebraço. Desviam lâminas.' }),
  A('manoplas_placas', 'bracos', 'Manoplas de Placas', 3, { corte: 6, perf: 5, impacto: 3, fogo: 1 }, 1, 4, 140, { mods: { block: 10, acc: -3 }, desc: 'Dedos articulados de aço. Firmes, mas desajeitados.' }),
  A('bracais_ferro_negro', 'bracos', 'Braçais de Ferro Negro', 5, { corte: 9, perf: 7, impacto: 4, fogo: 3 }, 1, 3.5, 420, { rarity: 'raro', mods: { parry: 8 }, desc: 'Leves e duros. Lâminas lascam neles.' }),
  // pernas
  A('calcas_couro', 'pernas', 'Calças de Couro', 1, { corte: 1, perf: 1, impacto: 1 }, 0, 1.5, 10, { desc: 'Remendadas mais vezes que o dono.' }),
  A('botas_batedor', 'pernas', 'Botas de Batedor', 2, { corte: 1, perf: 1, impacto: 1 }, 0, 1, 50, { mods: { travel: 10, stealth: 10 }, desc: 'Sola macia, cano alto. Andam sem ser ouvidas.' }),
  A('perneiras_malha', 'pernas', 'Perneiras de Malha', 2, { corte: 4, perf: 2, impacto: 1 }, 1, 5, 60, { desc: 'Malha até o joelho. Cansa na marcha.' }),
  A('grevas_ferro', 'pernas', 'Grevas de Ferro', 2, { corte: 5, perf: 4, impacto: 3, fogo: 1 }, 1, 5, 70, { mods: { travel: -5 }, desc: 'Canelas de ferro. Cães quebram os dentes nelas.' }),
  A('coxotes_placas', 'pernas', 'Coxotes de Placas', 3, { corte: 7, perf: 6, impacto: 4, fogo: 2 }, 2, 8, 170, { mods: { travel: -10 }, desc: 'Placas da coxa ao pé. Fugir é para os outros.' }),
  A('grevas_ferro_negro', 'pernas', 'Grevas de Ferro Negro', 5, { corte: 10, perf: 8, impacto: 5, fogo: 3 }, 1, 5, 430, { rarity: 'raro', desc: 'Metal do céu moldado à canela.' }),
];

// ---------------------------------------------------------------- mão secundária
function O(id, kind, name, tier, extra) {
  return { id, name, type: 'offhand', kind, tier, weight: 2, value: 10, dur: DUR_BY_TIER[tier], rarity: 'comum', desc: '', ...extra };
}
const OFFHANDS = [
  O('escudo_madeira', 'shield', 'Escudo de Madeira', 1, { block: 35, stamBlock: 2, weight: 4, value: 12, dur: 35, desc: 'Tábuas e couro. Racha, mas compra tempo.' }),
  O('broquel', 'shield', 'Broquel', 1, { block: 22, stamBlock: 1, weight: 1.5, value: 18, mods: { parry: 15 }, desc: 'Escudo de punho. Não segura golpe: desvia.' }),
  O('escudo_ferro', 'shield', 'Escudo de Ferro', 2, { block: 50, stamBlock: 2, weight: 7, value: 62, dur: 80, desc: 'Ferro sobre carvalho. Pesa no braço o dia inteiro.' }),
  O('escudo_cravos', 'shield', 'Escudo de Cravos', 3, { block: 40, stamBlock: 2, weight: 5, value: 120, props: ['sangra'], dmg: [4, 8], dtype: 'perf', mods: { riposte: 20 }, desc: 'Cravos de ferro no centro. A defesa também fere.' }),
  O('escudo_torre', 'shield', 'Escudo-Torre', 3, { block: 70, stamBlock: 3, weight: 12, value: 140, heavy: 1, dur: 110, mods: { eva: -10, speed: -5 }, desc: 'Uma porta de ferro. Você se esconde atrás e anda devagar.' }),
  O('escudo_sutura', 'shield', 'Escudo da Sutura', 4, { block: 55, stamBlock: 2, weight: 6, value: 280, rarity: 'unico', mods: { dreadResist: 15, corrResist: 10 }, desc: 'Pele de mártir esticada sobre ferro. Os pontos ainda sangram.' }),
  O('tocha_mao', 'torch', 'Tocha (empunhada)', 1, { light: true, weight: 1, value: 3, dur: 12, dmg: [2, 4], dtype: 'fogo', props: ['fogo', 'assusta'], desc: 'Fogo na mão. Feras recuam. Mortos não ligam.' }),
  O('lanterna_icor', 'torch', 'Lanterna de Icor', 4, { light: true, weight: 1.5, value: 260, rarity: 'raro', region: 'r5', mods: { dark: 30, corrResist: -5 }, desc: 'Luz dourada que não queima. Ilumina coisas que preferiam o escuro.' }),
  O('adaga_aparar', 'weapon', 'Adaga de Aparar', 2, { cls: 'adaga', dmg: [3, 6], dtype: 'perf', weight: 0.8, value: 50, mods: { parry: 15 }, desc: 'Guarda larga e dentes. Prende a lâmina do outro.' }),
];

// ---------------------------------------------------------------- consumíveis
// use.effects usam a linguagem de efeitos (systems/effects.js). use.combat: true ou id especial que B trata.
function C(id, name, tier, weight, value, use, desc, extra = {}) {
  return { id, name, type: 'consumable', tier, weight, value, use, desc, stack: true, rarity: 'comum', ...extra };
}
const CONSUMABLES = [
  C('racao', 'Ração', 1, 0.5, 4, { field: true, combat: false, effects: [{ op: 'eat', hours: 0 }, { op: 'hp', n: 3 }] }, 'Pão duro, toucinho rançoso. Doze horas de vida.'),
  C('carne_seca', 'Carne Seca', 1, 0.4, 8, { field: true, combat: false, effects: [{ op: 'eat', hours: 0 }, { op: 'hp', n: 6 }] }, 'Melhor não perguntar de quê. Nutre bem.'),
  C('tocha', 'Tocha', 1, 1, 3, { field: true, combat: false, cond: { inExpedition: true }, effects: [{ op: 'light', h: 6 }] }, 'Seis horas de luz. No Ermo, a luz é a vida.'),
  C('vela_sebo', 'Vela de Sebo', 1, 0.2, 2, { field: true, combat: false, cond: { inExpedition: true }, effects: [{ op: 'light', h: 2 }] }, 'Fedorenta e fraca. Duas horas antes do escuro.'),
  C('bandagem', 'Bandagem', 1, 0.2, 5, { field: true, combat: 'stop_bleed', time: 100, effects: [{ op: 'treat', method: 'bandagem' }] }, 'Trapos fervidos. Estanca sangue, segura a infecção.'),
  C('tala', 'Tala', 1, 0.5, 8, { field: true, combat: false, effects: [{ op: 'treat', method: 'tala' }] }, 'Duas tábuas e corda. Fratura alinhada cura mais rápido.'),
  C('ferro_quente', 'Ferro de Cauterizar', 2, 1, 15, { field: true, combat: 'cauterize', time: 120, effects: [{ op: 'treat', method: 'ferro_quente' }] }, 'Esquente e encoste. Fecha tudo. Você vai gritar.'),
  C('aguardente', 'Aguardente', 1, 0.6, 6, { field: true, combat: 'drink', time: 90, effects: [{ op: 'drink' }, { op: 'dread', n: -12 }] }, 'Queima a garganta, apaga o medo. Por um tempo.'),
  C('vinho_sutura', 'Vinho da Sutura', 2, 0.6, 18, { field: true, combat: false, effects: [{ op: 'drink' }, { op: 'dread', n: -10 }, { op: 'corruption', n: -1 }] }, 'Vinho de missa com sal. Os padres juram que limpa.'),
  C('unguento', 'Unguento', 1, 0.3, 10, { field: true, combat: 'salve', time: 110, effects: [{ op: 'hp', n: 12 }, { op: 'treat', method: 'unguento', soft: true }] }, 'Gordura de carneiro e ervas. Alivia queimaduras e cortes.'),
  C('pasta_cicatrizante', 'Pasta Cicatrizante', 2, 0.3, 30, { field: true, combat: false, effects: [{ op: 'woundDays', n: 3 }] }, 'Mel, teia e cinza. Encurta a cura de todas as feridas.'),
  C('tonico', 'Tônico de Fel', 1, 0.4, 10, { field: true, combat: 'second_wind', time: 80, effects: [{ op: 'hp', n: 6 }, { op: 'stamina', n: 5 }] }, 'Amargo como traição. Devolve o fôlego.'),
  C('mel_negro', 'Mel Negro', 2, 0.4, 25, { field: true, combat: 'cure_poison', time: 90, effects: [{ op: 'hp', n: 15 }, { op: 'cure', what: 'veneno' }] }, 'Mel de abelhas da Chaga. Doce, escuro, cura veneno.'),
  C('raiz_amarga', 'Raiz Amarga', 1, 0.2, 12, { field: true, combat: false, effects: [{ op: 'cure', what: 'infeccao' }, { op: 'hp', n: -3 }] }, 'Mascar até vomitar. Mata a febre de uma ferida.'),
  C('coagulante', 'Pó Coagulante', 2, 0.2, 22, { field: true, combat: 'stop_bleed_all', time: 90, effects: [{ op: 'cure', what: 'sangramento' }] }, 'Pó de sangue seco e cal. Estanca todos os sangramentos.'),
  C('papoula', 'Leite de Papoula', 2, 0.3, 20, { field: true, combat: 'numb', time: 100, effects: [{ op: 'dread', n: -25 }, { op: 'hp', n: 5 }, { op: 'addict', id: 'viciado_papoula', pct: 15 }] }, 'Sono sem sonhos e sem dor. Volta-se por mais.'),
  C('cogumelo_cinza', 'Cogumelo de Cinza', 2, 0.1, 15, { field: true, combat: false, effects: [{ op: 'random', table: [{ w: 3, text: 'Visões claras. O medo some.', effects: [{ op: 'dread', n: -30 }] }, { w: 2, text: 'O chão abre olhos. Você grita.', effects: [{ op: 'dread', n: 20 }] }, { w: 1, text: 'Você vê os caminhos.', effects: [{ op: 'reveal', n: 2 }] }] }] }, 'Nasce nos campos queimados. Ninguém sabe o que vai ver.'),
  C('sanguessuga', 'Sanguessugas', 1, 0.2, 9, { field: true, combat: false, effects: [{ op: 'hp', n: -6 }, { op: 'corruption', n: -4 }, { op: 'cure', what: 'veneno' }] }, 'Elas bebem o Icor junto com o sangue. Morrem douradas.'),
  C('elixir_icor', 'Elixir de Icor', 3, 0.3, 45, { field: true, combat: 'ichor_drink', time: 90, effects: [{ op: 'hp', n: 25 }, { op: 'dread', n: -10 }, { op: 'corruption', n: 4 }] }, 'Icor cortado com vinho. Fecha feridas. Abre outras portas.'),
  C('bile_fermentada', 'Bile Fermentada', 2, 0.4, 18, { field: true, combat: 'rage', time: 80, effects: [{ op: 'hp', n: 8 }, { op: 'dread', n: -15 }, { op: 'corruption', n: 2 }] }, 'Dos sacos de bile das coisas inchadas. Fúria em gole.'),
  C('agua_benta', 'Água Benta da Sutura', 2, 0.5, 20, { field: true, combat: 'holy_water', time: 90, effects: [{ op: 'dread', n: -15 }, { op: 'corruption', n: -1 }], throw: { dmg: [8, 14], dtype: 'fogo', vsTags: ['morto', 'chaga'] } }, 'Água com sal e sangue de mártir. Queima o que não devia andar.'),
  C('sal_bento', 'Sal Bento', 2, 0.4, 16, { field: true, combat: 'salt_line', time: 100, effects: [{ op: 'cure', what: 'chaga' }, { op: 'corruption', n: -2 }] }, 'Um punhado na ferida da Chaga. Um círculo contra os mortos.'),
  C('oleo', 'Óleo de Lamparina', 1, 0.5, 7, { field: true, combat: 'coat_oil', time: 90, effects: [{ op: 'coat', kind: 'oleo', hits: 3 }] }, 'Unte a lâmina. Com fogo por perto, ela arde.'),
  C('veneno', 'Veneno de Beladona', 2, 0.2, 20, { field: true, combat: 'coat_poison', time: 90, effects: [{ op: 'coat', kind: 'veneno', hits: 3 }] }, 'Três golpes envenenados. Não lamba os dedos.'),
  C('bomba', 'Bomba de Pólvora', 2, 1, 25, { field: false, combat: 'throw_bomb', time: 110 }, 'Pólvora, pregos e um pavio curto. Atinge todos perto.', { throw: { dmg: [12, 20], dtype: 'fogo', area: true, statuses: ['queimando'] } }),
  C('bomba_cal', 'Bomba de Cal', 1, 0.8, 14, { field: false, combat: 'throw_lime', time: 100 }, 'Cal viva nos olhos. Todos perto ficam cegos.', { throw: { dmg: [1, 3], dtype: 'impacto', area: true, statuses: ['cego'] } }),
  C('fumo_bruxa', 'Fumo de Bruxa', 2, 0.3, 24, { field: true, combat: 'smoke', time: 90, effects: [{ op: 'dread', n: -5 }, { op: 'reveal', n: 1 }] }, 'Erva da casca queimada. Esconde você; mostra caminhos.', { throw: { area: true, statuses: ['cego'] } }),
  C('faca_arremesso', 'Faca de Arremesso', 1, 0.3, 6, { field: false, combat: 'throw_knife', time: 70 }, 'Pesada na ponta. Recuperável, se sobrar quem colher.', { throw: { dmg: [4, 8], dtype: 'perf', statuses: ['sangrando'] } }),
];

const AMMO = [
  { id: 'virote', name: 'Virote', type: 'ammo', tier: 1, weight: 0.1, value: 2, stack: true, ammoFor: 'besta', desc: 'Ponta de ferro quadrada. Munição de besta.' },
  { id: 'virote_serrilhado', name: 'Virote Serrilhado', type: 'ammo', tier: 2, weight: 0.1, value: 5, stack: true, ammoFor: 'besta', mods: { bleed: 25 }, desc: 'Farpas que não saem sem levar carne.' },
  { id: 'virote_sal', name: 'Virote de Sal', type: 'ammo', tier: 3, weight: 0.1, value: 8, stack: true, ammoFor: 'besta', props: ['santa'], desc: 'Ponta de sal endurecido. Mortos sentem.' },
];

// ---------------------------------------------------------------- materiais
function M(id, name, tier, value, desc, weight = 0.3) {
  return { id, name, type: 'material', tier, weight, value, stack: true, rarity: 'comum', desc };
}
const MATERIALS = [
  M('sucata', 'Sucata', 1, 2, 'Ferro torto e pregos. O ferreiro aproveita.', 0.5),
  M('couro', 'Couro', 1, 4, 'Pele curtida. De bicho, quase sempre.', 0.5),
  M('osso', 'Osso', 1, 1, 'Fêmures bons para cabos e amuletos.'),
  M('tendao', 'Tendão', 1, 3, 'Corda de carne seca. Arcos, bestas, amarras.'),
  M('pano', 'Pano', 1, 1, 'Trapos. Viram bandagem.', 0.2),
  M('sebo', 'Sebo', 1, 2, 'Gordura derretida. Velas, óleo, unguento.'),
  M('ervas', 'Ervas', 1, 3, 'Folhas amargas. O boticário sabe o nome.', 0.1),
  M('polvora', 'Pólvora', 2, 8, 'Negra e seca. Não acenda perto.', 0.3),
  M('sal', 'Sal', 1, 4, 'Sal grosso das catacumbas. Conserva carne e afasta mortos.'),
  M('bile', 'Bile', 2, 6, 'Fel amarelo das coisas inchadas. Fede a ovo e cobre.'),
  M('ferro_negro', 'Ferro Negro', 4, 60, 'Metal que caiu com o deus. Quente ao toque.', 1),
  M('lasca_divina', 'Lasca Divina', 5, 120, 'Osso do deus. Sussurra quando ninguém fala.', 0.2),
  M('carne_podre', 'Carne Podre', 1, 1, 'Isca. Ou comida, para os desesperados.', 0.4),
  M('cabelo_bruxa', 'Cabelo de Bruxa', 2, 12, 'Trança cinza que ainda se mexe. Ritos e amuletos.', 0.1),
  M('dente', 'Dentes', 1, 2, 'Um punhado. Moeda dos Bebedores; contas de rosário.', 0.1),
  M('chifre', 'Chifre', 2, 7, 'Chifre de cervo podre. Cabos e pó.', 0.5),
  M('seda_tecela', 'Seda de Tecelã', 3, 25, 'Fio de aranha do tamanho de cão. Mais forte que aço.', 0.1),
  M('escama', 'Escama Afogada', 3, 18, 'Escama de coisa de Vel-Maren. Dura como bronze.', 0.3),
  M('ambar_icor', 'Âmbar de Icor', 4, 70, 'Icor que endureceu em pedra. Valioso. Morno.', 0.2),
  M('pele_lobo', 'Pele de Lobo de Tendão', 2, 14, 'Pele sem pelo, só músculo à mostra. Couro excelente.', 0.6),
];

// ---------------------------------------------------------------- amuletos / relíquias
function T(id, name, tier, value, mods, desc, extra = {}) {
  return { id, name, type: 'trinket', tier, weight: 0.1, value, mods, desc, rarity: 'comum', ...extra };
}
const TRINKETS = [
  T('amuleto_dente_lobo', 'Dente de Lobo', 1, 20, { dread_on_kill: -3, check_vig: 5 }, 'Arrancado à mão. Lembra que você morde também.'),
  T('amuleto_olho_vidro', 'Olho de Vidro no Cordão', 1, 25, { intent: 1, dreadResist: -5 }, 'Ele olha por você. Às vezes, para você.'),
  T('amuleto_sutura', 'Ponto de Sutura', 2, 45, { corrResist: 15 }, 'Linha benta costurada na pele do peito.', { faction: 'sutura' }),
  T('amuleto_corvo', 'Crânio de Corvo', 1, 18, { scout: 1, ambush: -10 }, 'Corvos sabem onde estão os mortos. E os vivos.'),
  T('amuleto_dedo_santo', 'Dedo de Santo', 3, 90, { dreadResist: 15, camp_heal: 15 }, 'Relíquia roubada de um ossuário. Unha ainda cresce.'),
  T('amuleto_saco_sal', 'Saquinho de Sal', 1, 12, { infectResist: 15, corrResist: 5 }, 'Sal grosso num saquinho de couro. Superstição barata.'),
  T('amuleto_cinza', 'Cinza de Vilarejo', 1, 10, { fireResist: 25, check_von: 5 }, 'Cinza de uma casa que queimou com a família dentro.'),
  T('amuleto_forca', 'Nó de Forca', 2, 40, { crit: 4, dreadResist: -5, hp_on_kill: 2 }, 'Corda de enforcado. Dá sorte a quem não tem nenhuma.'),
  T('amuleto_coracao_seco', 'Coração Seco', 3, 80, { hpMax: 12, regen: 1, heal_rate: -15 }, 'Coração de cão, seco ao sol. Bate quando você dorme.'),
  T('amuleto_moeda_furada', 'Moeda Furada', 1, 15, { price: 10, loot: 5 }, 'Moeda da velha Coroa. Mercadores confiam nela.'),
  T('amuleto_bebedor', 'Gota Dourada', 3, 110, { ichor_find: 25, corrResist: -10 }, 'Icor preso em vidro. Chama outros Icores.', { faction: 'bebedores' }),
  T('amuleto_lingua', 'Língua Seca', 2, 50, { check_ast: 10, intent: 1, check_von: -5 }, 'Língua de mentiroso. Ensina a ouvir o que não é dito.'),
  T('amuleto_ferro_frio', 'Prego de Ferro Frio', 2, 40, { armor_all: 1, eva: -3 }, 'Ferro de túmulo. Pesa mais do que pesa.'),
  T('amuleto_tranca', 'Trança de Bruxa', 3, 95, { dmg_fogo: 15, dmg_icor: 15, dreadResist: -10 }, 'Cabelo vivo. Murmura feitiços no seu ouvido.'),
  T('amuleto_ampulheta', 'Ampulheta Quebrada', 2, 60, { speed: 6, staminaMax: -1 }, 'A areia cai mais rápido para você.'),
  T('amuleto_coroa', 'Insígnia da Coroa', 2, 40, { check_von: 10, block: 5 }, 'Lobo de ferro da Guarda Cinzenta. Abre portas e fecha bocas.', { faction: 'coroa' }),
  T('amuleto_guilda', 'Selo da Guilda', 2, 40, { price: 12, loot: 10 }, 'Selo de cera dos Carniceiros. Bom crédito, má fama.', { faction: 'guilda' }),
  T('amuleto_osso_ouvido', 'Ossinhos do Ouvido', 3, 85, { ambush: -25, stealth: 10, intent: 1 }, 'Três ossinhos num fio. Ouvem por você.'),
  T('amuleto_unha_deus', 'Unha do Deus', 5, 300, { dmg_all: 10, hpMaxPct: 10, corrResist: -15 }, 'Do tamanho de uma mão. Arranha o peito por dentro.', { rarity: 'raro' }),
  // Fragmentos do deus — relíquias de missão. Equipados: poder enorme, Corrupção diária (ver systems/wounds tickWounds).
  T('fragmento_olho', 'Fragmento: o Olho', 5, 0, { intent: 2, crit: 10, dark: 40 }, 'Um olho do tamanho de um punho, fechado. Às vezes, não.', { rarity: 'unico', quest: true, relic: true, corrPerDay: 1 }),
  T('fragmento_lingua', 'Fragmento: a Língua', 5, 0, { check_von: 20, check_ast: 20, price: 15 }, 'Carne roxa que tenta falar. Todos acreditam no que você diz.', { rarity: 'unico', quest: true, relic: true, corrPerDay: 1 }),
  T('fragmento_mao', 'Fragmento: a Mão', 5, 0, { dmg_all: 20, sever: 15, fracture: 15 }, 'Três dedos e uma garra. Fecha sobre a sua quando você golpeia.', { rarity: 'unico', quest: true, relic: true, corrPerDay: 1 }),
  T('fragmento_ventre', 'Fragmento: o Ventre', 5, 0, { hpMaxPct: 25, regen: 2, food_eff: 50 }, 'Uma bolsa de carne que ronca. Alimenta você. Cresce.', { rarity: 'unico', quest: true, relic: true, corrPerDay: 1 }),
];

// ---------------------------------------------------------------- próteses
const PROSTHETICS = [
  { id: 'perna_pau', name: 'Perna de Pau', type: 'prosthetic', prosthetic: 'pernas', tier: 1, weight: 2, value: 20, desc: 'Toco de carvalho com tiras. Dá para fugir. Mal.' },
  { id: 'perna_ferro', name: 'Perna de Ferro', type: 'prosthetic', prosthetic: 'pernas', tier: 3, weight: 3, value: 160, rarity: 'raro', desc: 'Articulada, com mola de besta. Quase uma perna.' },
  { id: 'olho_vidro', name: 'Olho de Vidro', type: 'prosthetic', prosthetic: 'olho', tier: 1, weight: 0, value: 15, desc: 'Fecha o buraco. Encara quem encara você.' },
  { id: 'olho_icor', name: 'Olho de Âmbar Dourado', type: 'prosthetic', prosthetic: 'olho', tier: 4, weight: 0, value: 240, rarity: 'unico', desc: 'Âmbar de Icor polido. Vê o que vai acontecer. Vê demais.' },
];

// ---------------------------------------------------------------- chaves, tomos
const KEYS = [
  { id: 'chave_ferrugem', name: 'Chave Enferrujada', type: 'key', tier: 1, weight: 0.1, value: 0, quest: true, desc: 'Abre algum baú por aí. Ou nenhum.' },
  { id: 'chave_cripta', name: 'Chave da Cripta de Sal', type: 'key', tier: 3, weight: 0.2, value: 0, quest: true, desc: 'Ferro branco de sal. Abre a cripta funda das Catacumbas.' },
  { id: 'chave_comporta', name: 'Chave da Comporta', type: 'key', tier: 4, weight: 0.4, value: 0, quest: true, desc: 'Abre as comportas de Vel-Maren. O que está atrás quer sair.' },
  { id: 'chave_jaula', name: 'Chave de Jaula', type: 'key', tier: 2, weight: 0.1, value: 0, quest: true, desc: 'Das jaulas dos caçadores de cabeças.' },
  { id: 'chave_capela', name: 'Chave da Capela Queimada', type: 'key', tier: 1, weight: 0.1, value: 0, quest: true, desc: 'Fuligem nos dentes da chave.' },
];
// teaches = id de técnica em data/techniques.js (B). Ver docs/notes/A.md.
function TO(id, name, teaches, cls, tier, desc) {
  return { id, name, type: 'tome', teaches, cls, tier, weight: 0.8, value: 40 + tier * 30, desc };
}
const TOMES = [
  TO('tomo_decapitar', 'Tomo: Decapitação', 'decapitar', 'geral', 3, 'Manual de carrasco. Ângulo, peso, um só golpe.'),
  TO('tomo_quebra_joelho', 'Tomo: Quebra-Joelho', 'quebra_joelho', 'geral', 1, 'Gravuras de pernas dobrando para o lado errado.'),
  TO('tomo_estocada', 'Tomo: Estocada ao Coração', 'estocada_coracao', 'geral', 2, 'Onde ficam as costelas soltas. Onde o aço passa.'),
  TO('tomo_desarmar', 'Tomo: Desarme', 'desarmar', 'geral', 2, 'Esgrima de rua. Tirar a arma, ou os dedos.'),
  TO('tomo_grito', 'Tomo: Grito de Guerra', 'grito_guerra', 'geral', 1, 'Mais berro que tomo. Funciona.'),
  TO('tomo_sangria', 'Tomo: Sangria', 'sangria', 'geral', 2, 'Anatomia de barbeiro, usada ao contrário.'),
  TO('tomo_golpe_icor', 'Tomo: Golpe de Icor', 'golpe_icor', 'geral', 4, 'Escrito pelos Bebedores. A tinta é dourada e morna.'),
  TO('tomo_muralha', 'Tomo: Muralha de Escudo', 'muralha_escudo', 'geral', 2, 'Doutrina da Guarda Cinzenta. Ninguém passa.'),
];

// ---------------------------------------------------------------- unções (encantamentos com Icor)
// D (ferreiro/antro) aplica com items.anoint(). Afetam derive() pelos mods/tags.
export const ENCHANTS = {
  uncao_fogo: { id: 'uncao_fogo', name: 'Unção de Brasa', applies: 'weapon', cost: { ichor: 1, coin: 30 }, mods: { dmg_fogo: 15 }, extraDmg: { dtype: 'fogo', n: 3 }, tags: ['arma_fogo'], desc: 'A lâmina fumega. +3 de fogo por golpe; feras recuam.' },
  uncao_icor: { id: 'uncao_icor', name: 'Unção Dourada', applies: 'weapon', cost: { ichor: 2, coin: 20 }, mods: { dmg_icor: 20, lifesteal: 3 }, extraDmg: { dtype: 'icor', n: 4 }, corrOnUse: 1, desc: '+4 Icor por golpe e roubo de vida. Ao ungir: +1 Corrupção.' },
  uncao_sal: { id: 'uncao_sal', name: 'Unção de Sal', applies: 'weapon', cost: { ichor: 1, coin: 25 }, mods: {}, tags: ['arma_santa'], desc: 'Fere mais mortos e coisas da Chaga (+30%).' },
  uncao_sangue: { id: 'uncao_sangue', name: 'Unção de Sangue', applies: 'weapon', cost: { ichor: 1, coin: 35 }, mods: { bleed: 30, lifesteal: 4 }, desc: 'Sangramentos mais fortes; a arma bebe um pouco.' },
  uncao_bile: { id: 'uncao_bile', name: 'Unção de Bile', applies: 'weapon', cost: { ichor: 1, coin: 30 }, mods: {}, tags: ['arma_veneno'], desc: 'Envenena no golpe (B: status veneno).' },
  uncao_ferro: { id: 'uncao_ferro', name: 'Unção de Ferro', applies: 'armor', cost: { ichor: 1, coin: 40 }, mods: {}, armorBonus: 2, desc: '+2 de armadura nesta peça contra tudo.' },
  uncao_cinza: { id: 'uncao_cinza', name: 'Unção de Cinza', applies: 'armor', cost: { ichor: 1, coin: 25 }, mods: { fireResist: 15 }, armorFire: 4, desc: '+4 contra fogo nesta peça.' },
};

// ---------------------------------------------------------------- índice
export const ITEM_LIST = [...WEAPONS, ...ARMORS, ...OFFHANDS, ...CONSUMABLES, ...AMMO, ...MATERIALS, ...TRINKETS, ...PROSTHETICS, ...KEYS, ...TOMES];
export const ITEMS = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));
ITEMS.desarmado = UNARMED;

// Ids de consumíveis com uso em combate e seu significado (para B).
export const COMBAT_SPECIALS = {
  stop_bleed: 'Remove 1 sangramento do herói; trata 1 ferida que sangra.',
  stop_bleed_all: 'Remove todos os sangramentos.',
  cauterize: 'Remove sangramento e infecção; 6 de dano e +8 Pavor.',
  drink: 'Bêbado por 3 turnos: −5 precisão, +20% resistência a Pavor.',
  salve: 'Cura 12 e remove Queimando.',
  second_wind: '+5 Fôlego imediato.',
  cure_poison: 'Remove Envenenado; cura 15.',
  numb: 'Sem dor por 4 turnos: ignora penalidades de feridas; −25 Pavor.',
  ichor_drink: 'Cura 25, −10 Pavor, +4 Corrupção.',
  rage: 'Furioso por 3 turnos (+dano, −defesa).',
  holy_water: 'Arremesso: dano de fogo extra em mortos/Chaga (throw).',
  salt_line: 'Mortos não avançam até você por 2 turnos.',
  coat_oil: 'Arma untada: 3 golpes com fogo se houver chama (tocha).',
  coat_poison: 'Arma envenenada: 3 golpes aplicam Envenenado.',
  throw_bomb: 'Arremesso em área (throw).',
  throw_lime: 'Arremesso em área: cega (throw).',
  smoke: 'Fumaça: inimigos −precisão, fuga mais fácil.',
  throw_knife: 'Arremesso: dano perf + sangramento (throw).',
};

export const STACK_TYPES = ['consumable', 'material', 'ammo'];
