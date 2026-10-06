// ICOR — Traços (Área A). Cicatrizes, vícios, fobias, juramentos, marcas de facção e traços de origem.
// mods: chaves canônicas. tags: lidas por B/C/E (ver docs/notes/A.md). when: condição para os mods valerem.
// addiction: { items:[ids], hours, craving:{mods} } — sem consumir por `hours`, entra em fissura (hero.flags.craving_<id>).
// kind: 'origem'|'cicatriz'|'vicio'|'fobia'|'juramento'|'marca'|'mente'|'corpo'. good: true/false/null (misto).

const TR = (id, name, kind, good, desc, mods = {}, extra = {}) => ({ id, name, kind, good, desc, mods, tags: [], ...extra });

export const TRAIT_LIST = [
  // ---------------- origem (exclusivos) ----------------
  TR('marca_desertor', 'Marca do Desertor', 'origem', null, 'Ferro em brasa na nuca. A Coroa enforca desertores. Você sabe fugir.',
    { eva: 4, ambush: -10 }, { tags: ['fuga_facil', 'procurado_coroa'], origin: 'desertor' }),
  TR('mao_acougue', 'Mão de Açougue', 'origem', true, 'Anos separando juntas. Você vê corpos como cortes.',
    { sever: 15, dmg_corte: 5, food_eff: 15 }, { tags: ['carnear'], origin: 'acougueiro' }),
  TR('carne_penitente', 'Carne Penitente', 'origem', null, 'As costas são uma só cicatriz. A dor é oração.',
    { dreadResist: 20, bleedResist: 15, price: -5 }, { tags: ['dor_reza'], origin: 'flagelante' }),
  TR('dedos_leves', 'Dedos Leves', 'origem', true, 'Anéis de defuntos, dentes de ouro. Ninguém revista os mortos como você.',
    { loot: 25, stealth: 20, check_ast: 5 }, { tags: ['profanadora', 'abre_fechaduras'], origin: 'ladra_tumulos' }),
  TR('olho_inquisidor', 'Olho do Inquisidor', 'origem', true, 'Você queimou dezessete. Sabe onde a Chaga se esconde num rosto.',
    { intent: 1, dreadResist: 10, dmg_fogo: 15 }, { tags: ['caca_bruxas', 'odiado_bebedores'], origin: 'cacador_bruxas' }),
  TR('maos_firmes', 'Mãos Firmes', 'origem', true, 'Costurou tripas sob chuva de flechas. Suas mãos não tremem.',
    { heal_rate: 40, camp_heal: 25, infectResist: 15 }, { tags: ['cirurgia_campo'], origin: 'cirurgia' }),
  TR('sede_velha', 'Sede Velha', 'origem', null, 'Você já bebeu o deus. Parou. O corpo não esqueceu.',
    { ichor_find: 25, corrResist: 10, level_corr: -1 }, { tags: ['ve_icor'], origin: 'ex_bebedor',
      addiction: { items: ['elixir_icor', 'bile_fermentada'], hours: 96, craving: { acc: -5, dreadResist: -15 } } }),
  TR('sangue_arena', 'Sangue de Arena', 'origem', true, 'Quarenta lutas no Fosso. O público ainda grita na sua cabeça.',
    { crit: 5, hp_on_execute: 5, dread_on_kill: -2, execute: 15 }, { tags: ['plateia'], origin: 'gladiador' }),

  // ---------------- cicatrizes / corpo ----------------
  TR('rosto_retalhado', 'Rosto Retalhado', 'cicatriz', null, 'Ninguém sustenta seu olhar. Nem os mercadores.',
    { check_von: 10, price: -10 }),
  TR('coxo', 'Coxo', 'cicatriz', false, 'Uma perna não dobra direito desde aquele inverno.',
    { eva: -5, travel: -15 }),
  TR('maos_tremulas', 'Mãos Trêmulas', 'cicatriz', false, 'Desde o colapso, as mãos não param.',
    { acc: -5, check_des: -10 }),
  TR('pele_curtida', 'Pele Curtida', 'cicatriz', true, 'Fogo e frio demais. A pele virou couro.',
    { fireResist: 20, armor_all: 1, check_von: -5 }),
  TR('corpo_cicatriz', 'Corpo de Cicatriz', 'cicatriz', true, 'Tanta ferida que o corpo aprendeu a fechar.',
    { bleedResist: 20, heal_rate: 15 }),
  TR('surdo', 'Meio Surdo', 'corpo', null, 'Um estouro tirou metade da audição. Os gritos não chegam inteiros.',
    { dreadResist: 15, intent: -1, ambush: 15 }),
  TR('estomago_podre', 'Estômago de Abutre', 'corpo', true, 'Comeu coisa pior que carniça e não morreu.',
    { food_eff: 25, poisonResist: 25 }, { tags: ['come_carnica'] }),

  // ---------------- vícios ----------------
  TR('alcoolatra', 'Alcoólatra', 'vicio', null, 'Aguardente acalma você em dobro. Sem beber há dois dias, as mãos tremem.',
    { dreadResist: 5 }, { tags: ['bebida_dobra'], addiction: { items: ['aguardente', 'vinho_sutura'], hours: 48, craving: { acc: -10, dreadResist: -15, check_von: -10 } } }),
  TR('viciado_papoula', 'Viciado em Papoula', 'vicio', false, 'O leite branco chama. Sem ele por três dias, a dor volta inteira.',
    {}, { addiction: { items: ['papoula'], hours: 72, craving: { staminaMax: -2, dreadResist: -20, heal_rate: -30 } } }),
  TR('jogador', 'Jogador', 'vicio', null, 'Dados de osso no bolso. Você aposta até o que não tem.',
    { check_ast: 5, price: -5 }, { tags: ['aposta'] }),
  TR('canibal', 'Comeu Gente', 'vicio', null, 'Na fome do cerco, você comeu. Não se arrepende o bastante.',
    { food_eff: 30, dreadResist: 10, check_von: -10 }, { tags: ['canibal', 'come_carnica'] }),

  // ---------------- fobias ----------------
  TR('medo_escuro', 'Medo do Escuro', 'fobia', false, 'Sem luz, o coração dispara.',
    { dark: -25 }, { tags: ['fobia_escuro'] }),
  TR('medo_mortos', 'Pavor dos Mortos', 'fobia', false, 'Coisas que deviam estar quietas. Você trava.',
    { dreadResist: -10 }, { tags: ['fobia_mortos'] }),
  TR('medo_agua', 'Medo de Água Funda', 'fobia', false, 'Afogou-se uma vez. Voltou. A água lembra.',
    {}, { tags: ['fobia_agua'], when: { region: 'r4' }, whenMods: { acc: -10, dreadResist: -25 } }),
  TR('medo_fogo', 'Medo de Fogo', 'fobia', false, 'O cheiro de carne queimada te desmonta.',
    { fireResist: -20 }, { tags: ['fobia_fogo'] }),
  TR('medo_sangue', 'Desmaia com Sangue', 'fobia', false, 'Profissão errada. Cada ferida sua sobe o pavor.',
    { dreadResist: -5 }, { tags: ['fobia_sangue'] }),

  // ---------------- mente ----------------
  TR('frio', 'Sangue-Frio', 'mente', true, 'Você não sente o que os outros sentem. Isso ajuda.',
    { dreadResist: 15, execute: 10, check_von: -5 }),
  TR('covarde', 'Covarde', 'mente', false, 'Suas pernas decidem antes de você.',
    { eva: 5, dreadResist: -15 }, { tags: ['fuga_facil'] }),
  TR('insone', 'Insone', 'mente', null, 'Dorme pouco, vigia bem.',
    { camp_heal: -30, ambush: -20 }),
  TR('perjuro', 'Perjuro', 'mente', false, 'Você quebrou um juramento. A culpa pesa em tudo.',
    { dreadResist: -15, check_von: -10 }),
  TR('sobrevivente_cerco', 'Sobrevivente do Cerco', 'mente', true, 'Viu a muralha cair uma vez. Não vai ver de novo.',
    { dreadResist: 10, block: 10 }, { tags: ['veterano_muralha'] }),
  TR('memoria_morto', 'Memória do Morto', 'mente', true, 'Sonha com a vida do antecessor. Sabe coisas que não aprendeu.',
    { intent: 1, scout: 1 }),
  TR('ressentido', 'Herdeiro Ressentido', 'mente', null, 'Não pediu a casa. Faz o serviço com ódio.',
    { dmg_all: 5, check_von: -5, price: -5 }),
  TR('visionario', 'Visões Douradas', 'mente', null, 'O Icor fala com você à noite. Às vezes mente.',
    { intent: 1, dreadResist: -10, corrResist: -5 }, { tags: ['visoes'] }),

  // ---------------- juramentos ----------------
  TR('juramento_carne_limpa', 'Juramento da Carne Limpa', 'juramento', true, 'Jurou nunca beber o deus. Se subir de nível bebendo Icor, quebra o juramento.',
    { corrResist: 25, dreadResist: 10 }, { tags: ['oath_noichor'], breaksInto: 'perjuro' }),
  TR('juramento_vinganca', 'Juramento de Vingança', 'juramento', true, 'Jurou matar o que matou o antecessor. Até lá, não descansa.',
    { dmg_all: 8, camp_heal: -15 }, { tags: ['vinganca'] }),
  TR('juramento_silencio', 'Voto de Silêncio', 'juramento', null, 'Não fala desde o voto. Os outros falam mais perto de você.',
    { check_von: 10, check_ast: -10, stealth: 15 }, { tags: ['mudo'] }),
  TR('juramento_nao_fugir', 'Juramento de Não Fugir', 'juramento', true, 'Jurou nunca dar as costas. Se fugir de um combate, quebra o juramento.',
    { dreadResist: 20, parry: 10 }, { tags: ['oath_noflee'], breaksInto: 'perjuro' }),

  // ---------------- marcas de facção ----------------
  TR('marca_coroa', 'Marca da Coroa', 'marca', null, 'Lobo de ferro tatuado no pulso. Guardas abrem caminho; Bebedores cospem.',
    { check_von: 5 }, { tags: ['marca_coroa'], faction: 'coroa' }),
  TR('marca_sutura', 'Pontos da Sutura', 'marca', null, 'Pontos rituais na pele do peito. Padres te ouvem; a Guilda desconfia.',
    { corrResist: 10 }, { tags: ['marca_sutura'], faction: 'sutura' }),
  TR('marca_bebedores', 'Tatuagem Dourada', 'marca', null, 'Icor sob a pele em forma de olho. Brilha no escuro.',
    { ichor_find: 15, stealth: -10 }, { tags: ['marca_bebedores'], faction: 'bebedores' }),
  TR('marca_guilda', 'Selo de Carniceiro', 'marca', true, 'Ferrete da Guilda no ombro. Crédito e respeito nas tavernas.',
    { price: 5, loot: 5 }, { tags: ['marca_guilda'], faction: 'guilda' }),
  TR('marcado_chaga', 'Marcado pela Chaga', 'corpo', null, 'Uma mancha cinza que não sai. Os bichos da Chaga hesitam em morder.',
    { infectResist: -20, corrResist: 10, ambush: -10 }, { tags: ['cheiro_chaga'] }),
  // ---------------- consequências de eventos ----------------
  TR('viciado_icor', 'Viciado em Icor', 'vicio', false, 'O ouro chama. Sem um gole por quatro dias, a pele coça por dentro.',
    { ichor_find: 10 }, { addiction: { items: ['elixir_icor', 'bile_fermentada'], hours: 96, craving: { acc: -8, dreadResist: -20, corrResist: -10 } } }),
  TR('carrasco', 'Carrasco', 'mente', null, 'Você já matou gente ajoelhada. Executar acalma. Gente comum foge de você.',
    { dread_on_execute: -8, execute: 20, price: -5 }, { tags: ['carrasco'] }),
  TR('piedoso', 'Piedoso', 'mente', true, 'Você ainda reza, e às vezes funciona. Matar rendidos te pesa.',
    { dreadResist: 12, check_von: 5 }, { tags: ['piedoso'] }),
  TR('impiedoso', 'Impiedoso', 'mente', null, 'Choro não te comove mais. Nada te comove.',
    { dreadResist: 8, dread_on_kill: -1, check_ast: -5 }, { tags: ['impiedoso'] }),
  TR('ouvido_do_deus', 'Ouvido do Deus', 'mente', null, 'O cadáver sussurra rotas no seu ouvido. E outras coisas.',
    { scout: 1, intent: 1, dreadResist: -10, corrResist: -5 }, { tags: ['ouve_deus'] }),
  TR('amaldicoado', 'Amaldiçoado', 'corpo', false, 'Uma bruxa cuspiu seu nome numa fogueira. Tudo dá um pouco errado.',
    { crit: -3, loot: -10, check_ast: -5 }, { tags: ['maldicao'] }),
  TR('faro_da_chaga', 'Faro da Chaga', 'corpo', true, 'Você sente o cheiro da podridão antes de vê-la.',
    { ambush: -12, scout: 1 }, { tags: ['faro'] }),
  TR('sobrevivente', 'Sobrevivente', 'corpo', true, 'Você já devia ter morrido três vezes. O corpo aprendeu a teimar.',
    { lastStand: 15, bleedResist: 10, hpMax: 4 }, { tags: ['teimoso'] }),
  TR('juramento_sangue', 'Juramento de Sangue', 'juramento', null, 'Você jurou sobre um morto que alguém pagaria. Até lá, não descansa.',
    { dmg_all: 8, dreadResist: 5, camp_heal: -15 }, { tags: ['vinganca'] }),
];

export const TRAITS = Object.fromEntries(TRAIT_LIST.map((t) => [t.id, t]));

// Traços sorteáveis em herdeiros (rollHeir) — sem origem, sem marcas pesadas.
export const HEIR_TRAITS = ['rosto_retalhado', 'coxo', 'pele_curtida', 'corpo_cicatriz', 'surdo', 'estomago_podre', 'alcoolatra',
  'jogador', 'medo_escuro', 'medo_mortos', 'medo_agua', 'medo_fogo', 'medo_sangue', 'frio', 'covarde', 'insone',
  'memoria_morto', 'ressentido', 'visionario', 'juramento_carne_limpa', 'juramento_vinganca', 'juramento_silencio', 'juramento_nao_fugir'];

// Consequências de Colapso fora de combate (addDread): traço possível.
export const COLLAPSE_TRAITS = ['maos_tremulas', 'medo_escuro', 'medo_mortos', 'medo_sangue', 'insone', 'covarde', 'visionario'];
