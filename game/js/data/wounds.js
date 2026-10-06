// ICOR — Feridas (Área A). Escolhidas por parte × tipo de dano × gravidade (systems/wounds.inflictWound).
// Campos:
//   parts, dtypes, sev (1 leve, 2 grave, 3 mutilante), w (peso no sorteio)
//   days: dias para curar (-1 = permanente). bleed: PV/hora fora de combate até estancar (coagula sozinha em ~6h salvo noClot).
//   infect: % ao dia de infeccionar sem tratamento. treat: métodos aceitos. needs: método obrigatório para começar a curar.
//   mods / modsByPart / flags / flagsByPart: penalidades. flags: noTwoHand noShield noFlee noRanged.
//   loses: parte perdida para sempre (bracoD, bracoE, pernas, olho). spawn: ferida temporária criada junto (coto aberto).
//   status: estado de combate sugerido para B ('sangrando', 'atordoado', 'caido', 'cego', 'queimando').
//   dread: Pavor ao sofrer. corrPerDay: Corrupção diária enquanto aberta. onHealTrait: traço ganho ao curar.
//   hpLossPerDay: dano diário enquanto aberta (gangrena).

const LIMBS = ['bracoD', 'bracoE', 'pernas'];
const ARMS = ['bracoD', 'bracoE'];
const BODY = ['tronco', 'bracoD', 'bracoE', 'pernas'];
const ALL = ['cabeca', 'tronco', 'bracoD', 'bracoE', 'pernas'];

const WD = (id, name, o) => ({ id, name, w: 1, mods: {}, flags: [], treat: [], infect: 0, bleed: 0, days: 5, dread: 0, ...o });

export const WOUND_LIST = [
  // ===================== CORTE =====================
  WD('corte_couro_cabeludo', 'Couro Cabeludo Aberto', { parts: ['cabeca'], dtypes: ['corte'], sev: 1, days: 3, bleed: 2, infect: 8,
    mods: { acc: -4 }, treat: ['bandagem', 'ferro_quente', 'cirurgia'], status: 'sangrando', desc: 'Sangue escorre nos olhos.' }),
  WD('corte_profundo', 'Corte Profundo', { parts: BODY, dtypes: ['corte'], sev: 1, w: 3, days: 4, bleed: 2, infect: 10,
    modsByPart: { tronco: { staminaMax: -1 }, bracoD: { acc: -4 }, bracoE: { block: -10 }, pernas: { eva: -4 } },
    treat: ['bandagem', 'ferro_quente', 'cirurgia', 'unguento'], status: 'sangrando', desc: 'Carne aberta até a gordura.' }),
  WD('tendao_cortado', 'Tendão Cortado', { parts: LIMBS, dtypes: ['corte'], sev: 2, days: 18, bleed: 1, infect: 10, dread: 4,
    modsByPart: { bracoD: { acc: -10, dmg_all: -20 }, bracoE: { block: -40 }, pernas: { eva: -15, speed: -10, travel: -25 } },
    flagsByPart: { bracoE: ['noTwoHand'], pernas: ['noFlee'] },
    treat: ['tala', 'cirurgia', 'bandagem'], status: 'sangrando', desc: 'O membro não obedece. Pende.' }),
  WD('rosto_aberto', 'Rosto Aberto', { parts: ['cabeca'], dtypes: ['corte'], sev: 2, days: 10, bleed: 3, infect: 15, dread: 6,
    mods: { acc: -6, check_von: -5 }, treat: ['bandagem', 'ferro_quente', 'cirurgia'], onHealTrait: 'rosto_retalhado', status: 'sangrando',
    desc: 'Da testa ao queixo. Vai fechar torto.' }),
  WD('orelha_decepada', 'Orelha Decepada', { parts: ['cabeca'], dtypes: ['corte'], sev: 2, w: 0.6, days: -1, bleed: 2, infect: 10, dread: 6,
    mods: { ambush: 10, check_von: 5 }, treat: ['bandagem', 'ferro_quente'], spawn: 'coto_aberto', status: 'sangrando',
    desc: 'Ficou no chão. Você ouve tudo de um lado só.' }),
  WD('dedos_decepados', 'Dedos Decepados', { parts: ARMS, dtypes: ['corte'], sev: 2, w: 0.8, days: -1, bleed: 2, infect: 10, dread: 8,
    modsByPart: { bracoD: { acc: -8, parry: -15 }, bracoE: { block: -15 } },
    treat: ['bandagem', 'ferro_quente'], spawn: 'coto_aberto', status: 'sangrando', desc: 'Faltam dois. A mão fecha pela metade.' }),
  WD('tripas_expostas', 'Tripas Expostas', { parts: ['tronco'], dtypes: ['corte'], sev: 3, days: 22, bleed: 4, infect: 35, dread: 15,
    mods: { hpMaxPct: -20, staminaMax: -3 }, needs: 'cirurgia', treat: ['bandagem', 'cirurgia'], status: 'sangrando',
    desc: 'Você segura as próprias entranhas com a mão.' }),
  WD('garganta_cortada', 'Garganta Cortada', { parts: ['cabeca'], dtypes: ['corte'], sev: 3, w: 0.6, days: 16, bleed: 6, infect: 20, dread: 15,
    mods: { staminaMax: -2, check_von: -15 }, treat: ['bandagem', 'ferro_quente', 'cirurgia'], status: 'sangrando',
    desc: 'O ar assobia pelo corte. Falar dói. Respirar dói.' }),
  WD('mao_decepada', 'Mão Decepada', { parts: ARMS, dtypes: ['corte'], sev: 3, w: 1.2, days: -1, bleed: 5, dread: 20,
    loses: true, spawn: 'coto_aberto', treat: ['protese'], status: 'sangrando', desc: 'O pulso termina num toco que jorra.' }),
  WD('braco_decepado', 'Braço Decepado', { parts: ARMS, dtypes: ['corte'], sev: 3, w: 0.6, days: -1, bleed: 7, dread: 25,
    loses: true, spawn: 'coto_aberto', treat: ['protese'], status: 'sangrando', desc: 'Do cotovelo para baixo, não há nada.' }),
  WD('perna_decepada', 'Perna Decepada', { parts: ['pernas'], dtypes: ['corte'], sev: 3, w: 0.8, days: -1, bleed: 7, dread: 25,
    loses: true, spawn: 'coto_aberto', treat: ['protese'], status: 'caido', desc: 'Abaixo do joelho, só osso e tendão.' }),

  // ===================== PERFURAÇÃO =====================
  WD('perfuracao', 'Perfuração', { parts: BODY, dtypes: ['perf'], sev: 1, w: 3, days: 5, bleed: 1, infect: 20,
    modsByPart: { tronco: { staminaRegen: -1 }, bracoD: { acc: -3 }, bracoE: { block: -8 }, pernas: { eva: -3 } },
    treat: ['bandagem', 'ferro_quente', 'cirurgia', 'unguento'], status: 'sangrando', desc: 'Furo estreito e fundo. Sujo por dentro.' }),
  WD('mordida_infecta', 'Mordida Suja', { parts: LIMBS, dtypes: ['perf'], sev: 1, days: 6, bleed: 1, infect: 45,
    modsByPart: { bracoD: { acc: -3 }, bracoE: { block: -5 }, pernas: { eva: -4 } },
    treat: ['bandagem', 'ferro_quente', 'cirurgia', 'unguento'], desc: 'Marcas de dente. A baba da Chaga já está lá dentro.' }),
  WD('bochecha_furada', 'Bochecha Varada', { parts: ['cabeca'], dtypes: ['perf'], sev: 1, days: 6, bleed: 1, infect: 20,
    mods: { food_eff: -20, check_von: -5 }, treat: ['bandagem', 'ferro_quente', 'cirurgia'], desc: 'A língua acha o buraco.' }),
  WD('virote_alojado', 'Ponta Alojada', { parts: BODY, dtypes: ['perf'], sev: 2, w: 1.5, days: 8, bleed: 1, infect: 30, dread: 4,
    modsByPart: { tronco: { staminaMax: -2 }, bracoD: { acc: -8 }, bracoE: { block: -20 }, pernas: { eva: -10, travel: -10 } },
    needs: 'cirurgia', treat: ['cirurgia', 'ferro_quente', 'bandagem'], desc: 'O ferro ficou lá dentro. Não cura enquanto estiver.' }),
  WD('mao_atravessada', 'Mão Atravessada', { parts: ARMS, dtypes: ['perf'], sev: 2, days: 10, bleed: 2, infect: 25, dread: 5,
    modsByPart: { bracoD: { acc: -10, parry: -10 }, bracoE: { block: -25 } }, flagsByPart: { bracoD: ['noRanged'] },
    treat: ['bandagem', 'cirurgia', 'ferro_quente'], status: 'sangrando', desc: 'Dá para ver a luz pelo buraco.' }),
  WD('coxa_atravessada', 'Coxa Atravessada', { parts: ['pernas'], dtypes: ['perf'], sev: 2, days: 10, bleed: 3, infect: 25, dread: 5,
    mods: { eva: -10, travel: -15 }, treat: ['bandagem', 'cirurgia', 'ferro_quente'], status: 'sangrando', desc: 'Atravessou de lado a lado. Mancar é otimismo.' }),
  WD('pulmao_perfurado', 'Pulmão Perfurado', { parts: ['tronco'], dtypes: ['perf'], sev: 3, days: 25, bleed: 4, infect: 25, dread: 12,
    mods: { staminaMax: -4, staminaRegen: -2 }, needs: 'cirurgia', treat: ['cirurgia', 'bandagem'], status: 'sangrando',
    desc: 'Cada respiração borbulha sangue.' }),
  WD('olho_perdido', 'Olho Perdido', { parts: ['cabeca'], dtypes: ['perf', 'corte'], sev: 3, days: -1, bleed: 2, dread: 20,
    loses: 'olho', mods: { acc: -8, crit: -3, intent: -1 }, spawn: 'orbita_aberta', treat: ['protese'],
    desc: 'Estourou na órbita. O mundo ficou plano.' }),

  // ===================== IMPACTO =====================
  WD('contusao', 'Contusão Feia', { parts: BODY, dtypes: ['impacto'], sev: 1, w: 3, days: 3,
    modsByPart: { tronco: { staminaMax: -1 }, bracoD: { acc: -4 }, bracoE: { block: -10 }, pernas: { eva: -4 } },
    treat: ['unguento', 'tala'], desc: 'Roxo e inchado. Mexer dói.' }),
  WD('concussao', 'Concussão', { parts: ['cabeca'], dtypes: ['impacto'], sev: 1, days: 3, dread: 3,
    mods: { acc: -8, intent: -1, check_ast: -15 }, treat: ['cirurgia'], status: 'atordoado', desc: 'Zumbido. Duas imagens de tudo.' }),
  WD('concussao_grave', 'Concussão Grave', { parts: ['cabeca'], dtypes: ['impacto'], sev: 2, days: 7, dread: 8,
    mods: { acc: -12, intent: -1, dreadResist: -20, check_ast: -20 }, treat: ['cirurgia'], status: 'atordoado', desc: 'Vomita. Esquece nomes. Vê coisas.' }),
  WD('mandibula_partida', 'Mandíbula Partida', { parts: ['cabeca'], dtypes: ['impacto'], sev: 2, days: 14, dread: 6,
    mods: { food_eff: -40, check_ast: -10, check_von: -10 }, treat: ['tala', 'cirurgia'], desc: 'O queixo pende torto. Comer é sopa ou nada.' }),
  WD('costelas_quebradas', 'Costelas Quebradas', { parts: ['tronco'], dtypes: ['impacto'], sev: 2, w: 2, days: 14, dread: 5,
    mods: { staminaMax: -3, staminaRegen: -1 }, treat: ['tala', 'cirurgia'], desc: 'Cada respiração é uma faca.' }),
  WD('braco_fraturado', 'Braço Fraturado', { parts: ARMS, dtypes: ['impacto'], sev: 2, w: 2, days: 20, dread: 6,
    modsByPart: { bracoD: { dmg_all: -30, acc: -6 }, bracoE: {} }, flags: ['noTwoHand'], flagsByPart: { bracoE: ['noShield'] },
    treat: ['tala', 'cirurgia'], desc: 'O osso estalou. O braço dobra onde não devia.' }),
  WD('perna_fraturada', 'Perna Fraturada', { parts: ['pernas'], dtypes: ['impacto'], sev: 2, w: 2, days: 25, dread: 6,
    mods: { eva: -15, speed: -10, travel: -35 }, flags: ['noFlee'], treat: ['tala', 'cirurgia'], status: 'caido',
    desc: 'Não aguenta peso. Cada passo é um grito.' }),
  WD('cranio_rachado', 'Crânio Rachado', { parts: ['cabeca'], dtypes: ['impacto'], sev: 3, days: 25, infect: 10, dread: 15,
    mods: { acc: -15, staminaMax: -2, intent: -1, check_ast: -20 }, needs: 'cirurgia', treat: ['cirurgia'], status: 'atordoado',
    desc: 'Dá para sentir a borda do osso com o dedo.' }),
  WD('hemorragia_interna', 'Hemorragia Interna', { parts: ['tronco'], dtypes: ['impacto'], sev: 3, days: 12, bleed: 2, noClot: true, dread: 10,
    mods: { hpMaxPct: -15, staminaMax: -2 }, needs: 'cirurgia', treat: ['cirurgia'], desc: 'Nada escorre. A barriga incha e escurece.' }),
  WD('mao_esmagada', 'Mão Esmagada', { parts: ARMS, dtypes: ['impacto'], sev: 3, days: 45, infect: 15, dread: 12,
    modsByPart: { bracoD: { acc: -15, dmg_all: -25, parry: -20 }, bracoE: { block: -40 } }, flagsByPart: { bracoE: ['noShield'], bracoD: ['noRanged'] },
    flags: ['noTwoHand'], treat: ['tala', 'cirurgia', 'amputar'], desc: 'Uma bolsa de ossos moídos. Talvez seja melhor tirar.' }),
  WD('fratura_exposta', 'Fratura Exposta', { parts: LIMBS, dtypes: ['impacto'], sev: 3, days: 35, bleed: 3, infect: 40, dread: 15,
    modsByPart: { bracoD: { dmg_all: -35, acc: -10 }, bracoE: { block: -50 }, pernas: { eva: -20, speed: -15, travel: -45 } },
    flags: ['noTwoHand'], flagsByPart: { bracoE: ['noShield'], pernas: ['noFlee'] },
    needs: 'tala', treat: ['tala', 'cirurgia', 'bandagem', 'ferro_quente', 'amputar'], status: 'sangrando', desc: 'O osso branco furou a pele.' }),
  WD('joelho_estourado', 'Joelho Estourado', { parts: ['pernas'], dtypes: ['impacto'], sev: 3, w: 0.8, days: 60, dread: 12,
    mods: { eva: -12, speed: -10, travel: -25 }, flags: ['noFlee'], treat: ['tala', 'cirurgia', 'amputar'], status: 'caido',
    desc: 'A rótula está do lado. Talvez nunca volte.' }),

  // ===================== FOGO =====================
  WD('queimadura', 'Queimadura', { parts: ALL, dtypes: ['fogo'], sev: 1, w: 2, days: 5, infect: 15,
    modsByPart: { cabeca: { check_von: -5 }, tronco: { staminaMax: -1 }, bracoD: { acc: -4 }, bracoE: { block: -10 }, pernas: { eva: -4 } },
    treat: ['unguento', 'bandagem', 'cirurgia'], desc: 'Bolhas e pele solta.' }),
  WD('queimadura_grave', 'Queimadura Grave', { parts: ALL, dtypes: ['fogo'], sev: 2, days: 14, infect: 30, dread: 8,
    mods: { hpMaxPct: -10, fireResist: -10 },
    modsByPart: { cabeca: { acc: -8 }, bracoD: { acc: -8 }, bracoE: { block: -20 }, pernas: { eva: -8 } },
    treat: ['unguento', 'bandagem', 'cirurgia'], desc: 'Carne vermelha, viva, cheirando a porco.' }),
  WD('carne_carbonizada', 'Carne Carbonizada', { parts: ALL, dtypes: ['fogo'], sev: 3, days: 30, infect: 40, dread: 15,
    mods: { hpMaxPct: -15 }, modsByPart: { cabeca: { acc: -10, check_von: 10 }, bracoD: { acc: -12, dmg_all: -20 }, bracoE: { block: -40 }, pernas: { eva: -12, travel: -20 } },
    flagsByPart: { bracoD: ['noTwoHand'], bracoE: ['noShield', 'noTwoHand'] },
    treat: ['unguento', 'cirurgia', 'amputar'], onHealTraitByPart: { cabeca: 'rosto_retalhado' }, desc: 'Preta e rachada. Não dói mais. Isso é ruim.' }),

  // ===================== ICOR =====================
  WD('chaga_carne', 'Chaga na Carne', { parts: ALL, dtypes: ['icor'], sev: 1, w: 2, days: 6, infect: 10, corrPerDay: 1,
    mods: { corrResist: -10 }, treat: ['sal', 'cirurgia', 'ferro_quente'], desc: 'Uma mancha cinza que cresce. Sobe Corrupção até ser salgada ou queimada.' }),
  WD('icor_nas_veias', 'Icor nas Veias', { parts: ['tronco', 'bracoD', 'bracoE'], dtypes: ['icor'], sev: 2, days: 10, corrPerDay: 2, dread: 6,
    mods: { dmg_icor: 15, dreadResist: -10 }, treat: ['sanguessuga', 'sal', 'cirurgia'], desc: 'As veias brilham. Dá força. Cobra caro.' }),
  WD('necrose', 'Necrose', { parts: ALL, dtypes: ['icor'], sev: 2, days: 15, infect: 60, dread: 8,
    mods: { hpMaxPct: -10, staminaMax: -1 }, needs: 'cirurgia', treat: ['cirurgia', 'ferro_quente', 'amputar'], desc: 'Carne morta e verde. O cheiro chega antes de você.' }),
  WD('carne_divina', 'Carne do Deus', { parts: ALL, dtypes: ['icor'], sev: 3, days: 20, corrPerDay: 3, dread: 15,
    mods: { hpMaxPct: 10, dmg_icor: 25, corrResist: -20 }, treat: ['cirurgia', 'amputar', 'sal'],
    desc: 'A ferida não fecha: cresce carne dourada que não é sua.' }),

  // ===================== ESPECIAIS (gerados pelo sistema) =====================
  WD('gangrena', 'Gangrena', { parts: ALL, dtypes: [], sev: 3, w: 0, days: -1, infect: 0, dread: 15, hpLossPerDay: 6,
    mods: { hpMaxPct: -20, staminaMax: -2 }, treat: ['amputar', 'cirurgia'], desc: 'Preto, inchado, fétido. Mata em dias.' }),
  WD('coto_aberto', 'Coto Aberto', { parts: ALL, dtypes: [], sev: 2, w: 0, days: 12, bleed: 3, infect: 30,
    treat: ['ferro_quente', 'bandagem', 'cirurgia'], status: 'sangrando', desc: 'Onde havia carne, há um buraco que pinga.' }),
  WD('orbita_aberta', 'Órbita Aberta', { parts: ['cabeca'], dtypes: [], sev: 2, w: 0, days: 10, bleed: 1, infect: 30,
    treat: ['bandagem', 'ferro_quente', 'cirurgia'], desc: 'Um buraco úmido onde havia um olho.' }),
  WD('amputado', 'Membro Amputado', { parts: LIMBS, dtypes: [], sev: 3, w: 0, days: -1, dread: 0,
    loses: true, treat: ['protese'], desc: 'Serrado. Limpo, ao menos.' }),
  WD('cego', 'Cego', { parts: ['cabeca'], dtypes: [], sev: 3, w: 0, days: -1, dread: 30,
    mods: { acc: -35, intent: -3, eva: -15, dark: 100 }, treat: [], desc: 'Os dois olhos se foram. Só sons e cheiros.' }),
  WD('cicatriz_funda', 'Cicatriz Funda', { parts: ALL, dtypes: [], sev: 1, w: 0, days: 3, treat: [], desc: 'Fechou. Repuxa.' }),
];

export const WOUNDS = Object.fromEntries(WOUND_LIST.map((w) => [w.id, w]));

// Partes: nome e peso de acerto quando a parte não é dada.
export const PARTS = {
  cabeca: { name: 'Cabeça', w: 10 },
  tronco: { name: 'Tronco', w: 40 },
  bracoD: { name: 'Braço da arma', w: 17 },
  bracoE: { name: 'Braço do escudo', w: 17 },
  pernas: { name: 'Pernas', w: 16 },
};
export const PART_IDS = Object.keys(PARTS);

// Métodos de tratamento: o que cada um faz (systems/wounds.treatWound).
export const TREATMENTS = {
  bandagem: { name: 'Enfaixar', item: 'bandagem', desc: 'Estanca, reduz infecção à metade.' },
  tala: { name: 'Imobilizar', item: 'tala', desc: 'Fraturas curam 40% mais rápido.' },
  ferro_quente: { name: 'Cauterizar', item: 'ferro_quente', desc: 'Fecha o sangue e mata a infecção. 6 de dano, +8 Pavor.' },
  unguento: { name: 'Untar', item: 'unguento', desc: 'Queimaduras e cortes leves curam mais rápido.' },
  sal: { name: 'Salgar', item: 'sal_bento', desc: 'Para a Chaga na carne.' },
  sanguessuga: { name: 'Sangrar', item: 'sanguessuga', desc: 'Puxa o Icor das veias.' },
  cirurgia: { name: 'Cirurgia', item: null, desc: 'Remove o que não deve estar lá. Cura tudo pela metade do tempo.' },
  amputar: { name: 'Amputar', item: null, desc: 'Tira o membro e a podridão junto. Para sempre.' },
  protese: { name: 'Prótese', item: null, desc: 'Gancho, perna de pau ou olho de vidro.' },
};
