// ICOR — Encontros por região (Área C).
// ENCOUNTERS[region] = [ { id, enemies:[id | {id, dist, elite, level}], w, minChaga?, maxChaga?, night?, day?, ambush?, dark?, text } ]
//   night:true  -> só à noite (ou na escuridão total da região)
//   day:true    -> só de dia
//   ambush:true -> pode ser usado em emboscadas de viagem/acampamento
//   dark:true   -> peso ×2 quando o herói está sem luz
// Escalada pela Chaga é aplicada por systems/expedition.js (pickEncounter): reforços e elites.
// Ids de inimigos são os canônicos do contrato (B). r2–r5 entram na Onda 2 de B com os mesmos ids.

export const ENCOUNTERS = {
  r1: [
    { id: 'r1_saq_dupla', enemies: ['saqueador', 'saqueador'], w: 10, ambush: true, text: 'Dois saqueadores repartem um morto. Levantam os olhos ao mesmo tempo.' },
    { id: 'r1_saq_besta', enemies: ['saqueador', { id: 'besteiro', dist: 2 }], w: 8, ambush: true, text: 'Um assobio. Depois o virote.' },
    { id: 'r1_bando', enemies: ['saqueador', 'saqueador', { id: 'besteiro', dist: 2 }], w: 3, minChaga: 20, ambush: true, text: 'Um bando inteiro, magro e com fome. Você é a janta.' },
    { id: 'r1_matilha', enemies: ['cao_chaga', 'cao_chaga'], w: 9, ambush: true, dark: true, text: 'Cães sem pelo, com dentes demais. Já sentiram seu sangue.' },
    { id: 'r1_matilha_noite', enemies: ['cao_chaga', 'cao_chaga', 'cao_chaga'], w: 8, night: true, ambush: true, dark: true, text: 'Olhos baixos no escuro. Muitos.' },
    { id: 'r1_ocos', enemies: ['lavrador_oco', 'lavrador_oco'], w: 8, text: 'Camponeses ocos ainda cuidam da colheita. Você é joio.' },
    { id: 'r1_ocos_noite', enemies: ['lavrador_oco', 'lavrador_oco', 'lavrador_oco'], w: 6, night: true, dark: true, text: 'Foices brilham no trigal. Eles saem à noite.' },
    { id: 'r1_corvos', enemies: ['corvos'], w: 6, day: true, text: 'Uma nuvem de corvos levanta de um corpo. Gostaram mais de você.' },
    { id: 'r1_corvos_ocos', enemies: ['corvos', 'lavrador_oco'], w: 5, day: true, text: 'Os corvos seguem o oco. Comem o que ele derruba.' },
    { id: 'r1_desertores', enemies: ['desertor', 'desertor'], w: 6, ambush: true, text: 'Desertores da Guarda. Ainda usam o tabardo. Já não usam a lei.' },
    { id: 'r1_rival', enemies: ['carniceiro_rival', { id: 'besteiro', dist: 2 }], w: 4, text: 'Outra casa de carniceiros. Esta terra é deles, dizem.' },
    { id: 'r1_zelotes', enemies: ['zelote', 'zelote'], w: 4, minChaga: 25, text: 'Zelotes se flagelando na estrada. Querem companhia na dor.' },
    { id: 'r1_cacador', enemies: ['cacador_bruxas'], w: 3, minChaga: 15, text: 'Um caçador de bruxas viu sua corrupção. Ou acha que viu.' },
    { id: 'r1_bebedor', enemies: ['bebedor', 'saqueador'], w: 4, minChaga: 35, text: 'Um Bebedor de Icor e seu cão humano.' },
    { id: 'r1_ceifeiro', enemies: [{ id: 'ceifeiro', elite: true }], w: 3, minChaga: 30, text: 'O Ceifeiro anda devagar. Não precisa correr.' },
    { id: 'r1_ceifeiro_noite', enemies: [{ id: 'ceifeiro', elite: true }, 'lavrador_oco'], w: 5, night: true, minChaga: 20, text: 'A colheita da noite tem um capataz.' },
    { id: 'r1_horda', enemies: ['lavrador_oco', 'lavrador_oco', 'cao_chaga', 'cao_chaga'], w: 4, minChaga: 55, ambush: true, text: 'A Chaga esvaziou outra aldeia. A aldeia veio junto.' },
  ],
  r2: [
    { id: 'r2_enforcados', enemies: ['enforcado', 'enforcado'], w: 9, ambush: true, dark: true, text: 'Eles caem das árvores com a corda ainda no pescoço.' },
    { id: 'r2_enforcados_noite', enemies: ['enforcado', 'enforcado', 'enforcado'], w: 8, night: true, ambush: true, text: 'À noite todos descem.' },
    { id: 'r2_lobos', enemies: ['lobo_tendao', 'lobo_tendao'], w: 9, ambush: true, dark: true, text: 'Lobos de carne viva, só tendão e fome.' },
    { id: 'r2_alcateia', enemies: ['lobo_tendao', 'lobo_tendao', 'lobo_tendao'], w: 5, night: true, ambush: true, text: 'Uivos em círculo. O círculo fecha.' },
    { id: 'r2_bruxa', enemies: ['bruxa_casca', 'enforcado'], w: 5, text: 'Uma bruxa de casca rega os enforcados com sangue.' },
    { id: 'r2_bruxa_lobos', enemies: ['bruxa_casca', 'lobo_tendao'], w: 4, minChaga: 25, text: 'A bruxa assobia. O lobo obedece.' },
    { id: 'r2_cacadores', enemies: ['cacador_cabecas', { id: 'cacador_cabecas', dist: 2 }], w: 6, ambush: true, text: 'Caçadores de cabeças. Colares de orelhas. Querem a sua.' },
    { id: 'r2_tecela', enemies: ['tecela'], w: 5, dark: true, text: 'Fios entre as árvores. Algo grande no centro da teia.' },
    { id: 'r2_tecela_casulos', enemies: ['tecela', 'enforcado'], w: 4, minChaga: 30, text: 'Os casulos se mexem. Um rasga.' },
    { id: 'r2_cervo', enemies: [{ id: 'cervo_podre', elite: true }], w: 3, minChaga: 25, text: 'O cervo podre. A galhada pinga.' },
    { id: 'r2_cervo_noite', enemies: [{ id: 'cervo_podre', elite: true }, 'lobo_tendao'], w: 4, night: true, minChaga: 15, text: 'Ele caça à noite com a matilha.' },
    { id: 'r2_desertores', enemies: ['desertor', 'desertor', 'desertor'], w: 4, ambush: true, text: 'Desertores escondidos na mata. Não querem testemunhas.' },
    { id: 'r2_caca_bruxas', enemies: ['cacador_bruxas', 'zelote'], w: 3, minChaga: 20, text: 'Caçadores de bruxas queimando a floresta árvore por árvore.' },
    { id: 'r2_horda', enemies: ['enforcado', 'enforcado', 'lobo_tendao', 'bruxa_casca'], w: 4, minChaga: 55, text: 'A floresta inteira se mexe ao seu redor.' },
  ],
  r3: [
    { id: 'r3_esqueletos', enemies: ['esqueleto_placas', 'esqueleto_placas'], w: 8, text: 'Cavaleiros de placas, sem carne dentro. Ainda guardam.' },
    { id: 'r3_carnicais', enemies: ['carnical', 'carnical'], w: 9, ambush: true, dark: true, text: 'Carniçais em volta de um corpo fresco. Querem outro.' },
    { id: 'r3_carnicais_bando', enemies: ['carnical', 'carnical', 'carnical'], w: 6, night: true, ambush: true, text: 'Mastigação na escuridão. De todos os lados.' },
    { id: 'r3_sacerdote', enemies: ['sacerdote_renegado', 'esqueleto_placas'], w: 6, text: 'Um padre da Sutura reza sobre os mortos. Eles levantam.' },
    { id: 'r3_sacerdote_carnicais', enemies: ['sacerdote_renegado', 'carnical', 'carnical'], w: 4, minChaga: 30, text: 'O padre alimenta os carniçais com fiéis.' },
    { id: 'r3_verme', enemies: ['verme_ossos'], w: 6, dark: true, ambush: true, text: 'O chão de ossos se abre. Algo sobe mastigando.' },
    { id: 'r3_costurados', enemies: ['costurado', 'costurado'], w: 6, text: 'Corpos costurados de três ou quatro mortos. Andam tortos e batem forte.' },
    { id: 'r3_costurado_padre', enemies: ['costurado', { id: 'sacerdote_renegado', dist: 2 }], w: 5, text: 'Ele costura enquanto o outro mata.' },
    { id: 'r3_guardiao', enemies: [{ id: 'guardiao_sal', elite: true }], w: 3, minChaga: 25, text: 'Uma estátua de sal com uma espada de verdade.' },
    { id: 'r3_guardiao_ossos', enemies: [{ id: 'guardiao_sal', elite: true }, 'esqueleto_placas'], w: 3, minChaga: 45, text: 'O guardião e sua guarda de honra.' },
    { id: 'r3_zelotes', enemies: ['zelote', 'zelote', 'cacador_bruxas'], w: 3, text: 'Inquisidores da Sutura caçando renegados. Você serve.' },
    { id: 'r3_horda', enemies: ['carnical', 'carnical', 'costurado', 'verme_ossos'], w: 4, minChaga: 55, text: 'O ossuário inteiro acorda.' },
  ],
  r4: [
    { id: 'r4_afogados', enemies: ['afogado', 'afogado'], w: 9, ambush: true, text: 'Afogados inchados saindo da água. Não toque neles. Eles estouram.' },
    { id: 'r4_afogados_mare', enemies: ['afogado', 'afogado', 'afogado'], w: 7, night: true, ambush: true, text: 'A maré da noite trouxe gente.' },
    { id: 'r4_pescadores', enemies: ['pescador', { id: 'pescador', dist: 2 }], w: 7, ambush: true, text: 'Pescadores de homens. Ganchos, redes e paciência.' },
    { id: 'r4_sereia', enemies: ['sereia_carcaca', 'afogado'], w: 5, text: 'O canto. Depois a coisa que canta.' },
    { id: 'r4_sereia_noite', enemies: ['sereia_carcaca', 'sereia_carcaca'], w: 3, night: true, minChaga: 20, text: 'Duas vozes. Você já está andando para a água.' },
    { id: 'r4_caranguejos', enemies: ['caranguejo_ossario', 'caranguejo_ossario'], w: 7, dark: true, text: 'Caranguejos que usam crânios como concha.' },
    { id: 'r4_enguia', enemies: ['enguia_icor'], w: 5, ambush: true, text: 'Um brilho dourado na água. Depois o choque.' },
    { id: 'r4_enguia_pescador', enemies: ['enguia_icor', 'pescador'], w: 4, minChaga: 30, text: 'O pescador trabalha com a enguia. Você é a isca.' },
    { id: 'r4_cavaleiro', enemies: [{ id: 'cavaleiro_mare', elite: true }], w: 3, minChaga: 25, text: 'Armadura cheia de água e cracas. Algo ainda a veste.' },
    { id: 'r4_cavaleiro_afogados', enemies: [{ id: 'cavaleiro_mare', elite: true }, 'afogado', 'afogado'], w: 3, night: true, minChaga: 40, text: 'O cavaleiro comanda a maré.' },
    { id: 'r4_bebedores', enemies: ['bebedor', 'bebedor'], w: 3, minChaga: 20, text: 'Bebedores colhendo Icor salgado. Não dividem.' },
    { id: 'r4_horda', enemies: ['afogado', 'afogado', 'pescador', 'caranguejo_ossario'], w: 4, minChaga: 55, text: 'A cidade afogada sobe à superfície.' },
  ],
  r5: [
    { id: 'r5_anticorpos', enemies: ['anticorpo', 'anticorpo'], w: 9, ambush: true, text: 'O corpo do deus te reconhece como doença.' },
    { id: 'r5_anticorpos_enxame', enemies: ['anticorpo', 'anticorpo', 'anticorpo'], w: 6, night: true, ambush: true, text: 'Enxame branco. A ferida fecha com você dentro.' },
    { id: 'r5_filhos', enemies: ['filho_icor', 'filho_icor'], w: 8, text: 'Crianças de Icor. Riem com a sua voz.' },
    { id: 'r5_verme', enemies: ['verme_divino'], w: 5, dark: true, ambush: true, text: 'Um verme do tamanho de uma rua, comendo o deus por dentro.' },
    { id: 'r5_verme_filhos', enemies: ['verme_divino', 'filho_icor'], w: 4, minChaga: 30, text: 'Os filhos seguem o verme como peixes seguem a baleia.' },
    { id: 'r5_ascendido', enemies: ['bebedor_ascendido', 'bebedor'], w: 5, text: 'Um Bebedor que bebeu o suficiente. Seus discípulos ainda tentam.' },
    { id: 'r5_ascendidos', enemies: ['bebedor_ascendido', 'bebedor_ascendido'], w: 3, minChaga: 40, text: 'Dois ascendidos disputando quem bebe primeiro de você.' },
    { id: 'r5_anjo', enemies: [{ id: 'anjo_carne', elite: true }], w: 3, minChaga: 20, text: 'Asas de pele. Rosto de ninguém. Ele canta o seu nome.' },
    { id: 'r5_anjo_coro', enemies: [{ id: 'anjo_carne', elite: true }, 'anticorpo', 'anticorpo'], w: 3, night: true, minChaga: 45, text: 'O anjo traz o coro.' },
    { id: 'r5_horda', enemies: ['anticorpo', 'anticorpo', 'filho_icor', 'filho_icor'], w: 4, minChaga: 55, text: 'O deus inteiro sabe que você está aqui.' },
  ],
};

/** Encontro do chefe. escorts: reforços conforme a Chaga ([chagaMin, enemy]). */
export const BOSS_ENCOUNTERS = {
  r1: { enemies: ['mae_colheita'], escorts: [[35, 'lavrador_oco'], [65, 'lavrador_oco']], text: 'Um espantalho de cadáveres costurados se levanta do trigal. Ele embala os mortos como filhos.' },
  r2: { enemies: ['rei_galhado'], escorts: [[35, 'enforcado'], [65, 'lobo_tendao']], text: 'O Rei Galhado desce do trono. Cada galho é um braço de alguém.' },
  r3: { enemies: ['bispo_costurado'], escorts: [[35, 'costurado'], [65, 'esqueleto_placas']], text: 'O Bispo se levanta do altar. A linha dourada ainda sai das suas costas.' },
  r4: { enemies: ['voz_submersa'], escorts: [[35, 'afogado'], [65, 'sereia_carcaca']], text: 'A água para. A Voz canta. Seus pés andam sozinhos.' },
  r5: { enemies: ['coracao'], escorts: [[35, 'anticorpo'], [65, 'anjo_carne']], text: 'O Coração bate. A cada batida você esquece um nome.' },
};

/** Ninho: inimigos base + reforço por crescimento (growth 0..5). */
export const NEST_ENCOUNTERS = {
  r1: { base: ['cao_chaga', 'cao_chaga'], elite: 'cao_chaga', grow: ['cao_chaga', 'lavrador_oco', 'ceifeiro'], text: 'Ossos roídos em camadas. A matilha dorme sobre eles. Não por muito tempo.' },
  r2: { base: ['lobo_tendao', 'lobo_tendao'], elite: 'lobo_tendao', grow: ['lobo_tendao', 'enforcado', 'cervo_podre'], text: 'Uma toca forrada de pele humana. Filhotes de tendão mamam numa carcaça.' },
  r3: { base: ['carnical', 'carnical'], elite: 'carnical', grow: ['carnical', 'verme_ossos', 'costurado'], text: 'O fosso fede a carne velha. Eles estão comendo e se multiplicando.' },
  r4: { base: ['afogado', 'afogado'], elite: 'afogado', grow: ['afogado', 'caranguejo_ossario', 'sereia_carcaca'], text: 'Ovos de carne do tamanho de homens boiando na água. Alguns já abriram.' },
  r5: { base: ['filho_icor', 'filho_icor'], elite: 'filho_icor', grow: ['anticorpo', 'filho_icor', 'anjo_carne'], text: 'Um útero dourado pulsando. Algo nasce a cada batida.' },
};

/** Rótulo de risco por número de inimigos/elite (para a UI). */
export function encounterThreat(enc) {
  if (!enc) return 0;
  let t = 0;
  for (const e of enc.enemies || []) t += (typeof e === 'object' && e.elite) ? 3 : 1;
  return t;
}
