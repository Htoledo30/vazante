// ICOR — Dádivas (talentos) (Área A). Escolhe-se 1 de 3 ao subir de nível bebendo Icor.
// req: { for:n, des:n, ..., talents:[ids], level:n, notTalents:[ids] }
// mods: sempre. when + whenMods: só se a condição de equipamento/estado valer (avaliada em derive):
//   when: { twoHand, shield, ranged, cls:[...], maxHeavy:n, dreadMin:n, corrMin:n, noOffhand, unarmed, torch, hpBelow:% (B) }
// tags: comportamentos que B/C leem (lista e semântica em docs/notes/A.md).
// special (A implementa em derive): perMutation:{mods}, perPermWound:{mods}, halveWoundPenalty.

const TL = (id, name, style, desc, o = {}) => ({ id, name, style, desc, req: {}, mods: {}, tags: [], ...o });

export const STYLES = {
  carniceiro: 'Carniceiro', duelista: 'Duelista', brutamontes: 'Brutamontes', atirador: 'Atirador',
  sobrevivente: 'Sobrevivente', ocultista: 'Ocultista', cirurgiao: 'Cirurgião', batedor: 'Batedor',
  executor: 'Executor', berserker: 'Berserker', escudeiro: 'Escudeiro', brigao: 'Brigão',
};

export const TALENT_LIST = [
  // ---------------- carniceiro (decepar) ----------------
  TL('lamina_faminta', 'Lâmina Faminta', 'carniceiro', 'Seus cortes procuram juntas. +15% de chance de decepar.',
    { mods: { sever: 15 } }),
  TL('desossador', 'Desossador', 'carniceiro', 'Decepar um membro devolve 2 de Fôlego e tira 5 de Pavor.',
    { req: { talents: ['lamina_faminta'] }, mods: { sever: 5 }, tags: ['sever_refresh'] }),
  TL('trofeus', 'Colar de Orelhas', 'carniceiro', 'Cada membro decepado na expedição: +2% de dano (máx. +20%). Inimigos humanos têm −moral.',
    { req: { talents: ['lamina_faminta'] }, tags: ['trophies'], mods: { dread_on_kill: -1 } }),
  TL('golpe_de_cutelo', 'Golpe de Cutelo', 'carniceiro', 'Com cutelo ou machado: +10% dano de corte e golpes em membros feridos decepam mais.',
    { req: { for: 5 }, when: { cls: ['cutelo', 'machado'] }, whenMods: { dmg_corte: 10, sever: 15 } }),

  // ---------------- duelista (aparar) ----------------
  TL('mao_aparar', 'Mão de Aparar', 'duelista', 'Aparar fica mais fácil (+15) e o contra-ataque dói mais (+25%).',
    { req: { des: 5 }, mods: { parry: 15, riposte: 25 } }),
  TL('resposta_imediata', 'Resposta Imediata', 'duelista', 'Aparar com sucesso dá um golpe grátis na hora, sem gastar tempo.',
    { req: { des: 6, talents: ['mao_aparar'] }, tags: ['riposte_free'] }),
  TL('pes_leves', 'Pés Leves', 'duelista', 'Sem armadura pesada (peso total ≤ 2): +10 esquiva, +20% esquiva ativa, +8% velocidade.',
    { req: { des: 5 }, when: { maxHeavy: 2 }, whenMods: { eva: 10, dodge: 20, speed: 8 } }),
  TL('leitor_ombros', 'Leitor de Ombros', 'duelista', 'Você lê o golpe antes do golpe. +1 detalhe de intenção, começa adiantado.',
    { req: { ast: 5 }, mods: { intent: 1, first_strike: 20 } }),
  TL('esgrima_suja', 'Esgrima Suja', 'duelista', 'Com espada ou adaga: aparar bem-sucedido também cega ou sangra o inimigo.',
    { req: { des: 6 }, when: { cls: ['espada', 'adaga'] }, whenMods: { parry: 5 }, tags: ['dirty_parry'] }),

  // ---------------- brutamontes ----------------
  TL('couro_grosso', 'Couro Grosso', 'brutamontes', '+1 de armadura em tudo e +10% de Vida.',
    { req: { vig: 5 }, mods: { armor_all: 1, hpMaxPct: 10 } }),
  TL('pulmoes_fole', 'Pulmões de Fole', 'brutamontes', '+2 Fôlego máximo e +1 de recuperação por turno.',
    { mods: { staminaMax: 2, staminaRegen: 1 } }),
  TL('ombro_ariete', 'Ombro de Aríete', 'brutamontes', 'Chutes e empurrões derrubam. +10% de fraturar.',
    { req: { for: 5 }, mods: { fracture: 10 }, tags: ['kick_knockdown'] }),
  TL('costas_mula', 'Costas de Mula', 'brutamontes', '+15 de carga. Sobrecarga não tira Fôlego.',
    { req: { for: 4 }, mods: { carry: 15 }, tags: ['mula'] }),
  TL('quebra_ossos', 'Quebra-Ossos', 'brutamontes', 'Impacto: +10% dano e +20% de fraturar.',
    { req: { for: 6 }, mods: { fracture: 20, dmg_impacto: 10 } }),
  TL('placas_segunda_pele', 'Placas como Pele', 'brutamontes', 'Armadura pesada pesa metade no Fôlego e na esquiva.',
    { req: { for: 6, vig: 5 }, tags: ['heavy_half'] }),

  // ---------------- atirador ----------------
  TL('olho_firme', 'Olho Firme', 'atirador', 'Com arma de disparo: +10 precisão, +5 crítico.',
    { req: { des: 5 }, when: { ranged: true }, whenMods: { acc: 10, crit: 5 } }),
  TL('recarga_rapida', 'Recarga Rápida', 'atirador', 'Recarregar a besta leva 40% menos tempo.',
    { req: { des: 5 }, tags: ['fast_reload'] }),
  TL('tiro_joelho', 'Tiro no Joelho', 'atirador', 'Disparos nas pernas derrubam. +10% dano de perfuração.',
    { req: { talents: ['olho_firme'] }, mods: { dmg_perf: 10 }, tags: ['ranged_knockdown'] }),
  TL('mao_rapida', 'Arremessador', 'atirador', 'Arremessos (facas, bombas, machadinhas) custam −30% de tempo e acertam mais.',
    { req: { des: 6 }, tags: ['fast_throw'], mods: { acc: 3 } }),

  // ---------------- sobrevivente ----------------
  TL('teimoso', 'Teimoso Demais para Morrer', 'sobrevivente', 'Uma vez por combate, um golpe mortal deixa você com 1 de Vida.',
    { req: { vig: 5 }, tags: ['last_stand'] }),
  TL('estomago_ferro', 'Estômago de Ferro', 'sobrevivente', 'Rações rendem 30% mais. +25% contra infecção e veneno.',
    { mods: { food_eff: 30, infectResist: 25, poisonResist: 25 } }),
  TL('sono_leve', 'Sono Leve', 'sobrevivente', '−30% chance de emboscada. Acampar cura 20% mais.',
    { mods: { ambush: -30, camp_heal: 20 } }),
  TL('sangue_grosso', 'Sangue Grosso', 'sobrevivente', '+40% contra sangramento. Feridas que sangram fecham sozinhas mais rápido.',
    { req: { vig: 6 }, mods: { bleedResist: 40 }, tags: ['clot'] }),
  TL('ignorar_dor', 'Ignorar a Dor', 'sobrevivente', 'Penalidades de feridas pela metade.',
    { req: { von: 6 }, special: { halveWoundPenalty: true } }),
  TL('corpo_cicatriz_t', 'Corpo de Cicatriz', 'sobrevivente', 'Cada perda permanente (membro, olho) dá +1 armadura e +4% Vida.',
    { req: { vig: 5 }, special: { perPermWound: { armor_all: 1, hpMaxPct: 4 } } }),

  // ---------------- ocultista / icor ----------------
  TL('comunhao', 'Comunhão', 'ocultista', 'Dano de Icor +25%. Golpes de Icor custam menos Fôlego.',
    { req: { von: 5 }, mods: { dmg_icor: 25 }, tags: ['icor_strike'] }),
  TL('bebedor_contido', 'Bebedor Contido', 'ocultista', 'Subir de nível custa −2 de Corrupção.',
    { mods: { level_corr: -2 } }),
  TL('sede_sangue', 'Sede de Sangue', 'ocultista', 'Rouba 6% do dano causado como Vida. −10% resistência à Corrupção.',
    { mods: { lifesteal: 6, corrResist: -10 } }),
  TL('olhos_dentro', 'Olhos de Dentro', 'ocultista', 'Com Corrupção ≥ 50: intenções exatas e +15% resistência a Pavor.',
    { req: { ast: 4 }, when: { corrMin: 50 }, whenMods: { intent: 2, dreadResist: 15 } }),
  TL('carne_aceita', 'Carne Aceita', 'ocultista', 'Cada mutação: +6% de Vida e +5% resistência a Pavor.',
    { special: { perMutation: { hpMaxPct: 6, dreadResist: 5 } } }),
  TL('farejar_icor', 'Farejar Icor', 'ocultista', '+25% Icor encontrado.',
    { mods: { ichor_find: 25 } }),

  // ---------------- cirurgião ----------------
  TL('maos_limpas', 'Mãos Limpas', 'cirurgiao', 'Feridas curam 40% mais rápido. Pode operar a si mesmo no campo.',
    { req: { ast: 5 }, mods: { heal_rate: 40, infectResist: 20 }, tags: ['cirurgia_campo'] }),
  TL('torniquete', 'Torniquete', 'cirurgiao', 'Sangramentos param 1 turno mais cedo; enfaixar em combate custa metade do tempo.',
    { mods: { bleedResist: 20 }, tags: ['fast_bandage'] }),
  TL('serra_rapida', 'Serra Rápida', 'cirurgiao', 'Amputação no campo sem teste e sem morrer de choque. +10% decepar.',
    { req: { des: 5 }, mods: { sever: 10 }, tags: ['amputacao_segura'] }),
  TL('anatomista', 'Anatomista', 'cirurgiao', '+6 crítico. Críticos na cabeça e no tronco abrem feridas mais graves.',
    { req: { ast: 6 }, mods: { crit: 6 }, tags: ['crit_wound'] }),

  // ---------------- batedor ----------------
  TL('trilheiro', 'Trilheiro', 'batedor', 'Viagens 15% mais rápidas; revela 1 nó a mais.',
    { mods: { travel: 15, scout: 1 } }),
  TL('olho_noturno', 'Olho Noturno', 'batedor', 'Noite e escuro pesam menos (+15).',
    { mods: { night_acc: 15, dark: 15 } }),
  TL('furtivo', 'Furtivo', 'batedor', '+25 furtividade, começa o combate bem adiantado.',
    { req: { des: 5 }, mods: { stealth: 25, first_strike: 30 } }),
  TL('faro_saque', 'Faro para Saque', 'batedor', '+20% saque, +10% Icor.',
    { mods: { loot: 20, ichor_find: 10 } }),
  TL('tocha_baixa', 'Tocha Baixa', 'batedor', 'Tochas duram 30% mais.',
    { mods: { light_eff: 30 } }),

  // ---------------- executor ----------------
  TL('carrasco', 'Carrasco', 'executor', 'Execuções +30% e −10 Pavor cada.',
    { mods: { execute: 30, dread_on_execute: -10 } }),
  TL('misericordia_nenhuma', 'Nenhuma Misericórdia', 'executor', 'Executar cura 8 e não gasta Fôlego.',
    { req: { talents: ['carrasco'] }, mods: { hp_on_execute: 8 }, tags: ['execute_free'] }),
  TL('semear_medo', 'Semear Medo', 'executor', 'Execuções quebram a moral de todos os humanos e feras que veem.',
    { req: { von: 5 }, mods: { dread_on_execute: -5 }, tags: ['execute_morale'] }),
  TL('golpe_baixo', 'Golpe Baixo', 'executor', 'Inimigos caídos ou atordoados: +25% dano contra eles.',
    { tags: ['kick_the_down'], mods: { execute: 10 } }),

  // ---------------- berserker ----------------
  TL('furia_ferida', 'Fúria da Ferida', 'berserker', '+2% dano para cada 10% de Vida faltando.',
    { req: { vig: 4 }, tags: ['wounded_rage'] }),
  TL('pavor_alimenta', 'O Pavor Alimenta', 'berserker', 'Com Pavor ≥ 50: +15% dano e o Pavor não reduz precisão.',
    { req: { von: 4 }, when: { dreadMin: 50 }, whenMods: { dmg_all: 15, acc: 5 } }),
  TL('pegada_dupla', 'Pegada Dupla', 'berserker', 'Armas de duas mãos: +15% dano, +5% velocidade.',
    { req: { for: 5 }, when: { twoHand: true }, whenMods: { dmg_all: 15, speed: 5 } }),
  TL('sangue_quente', 'Sangue Quente', 'berserker', 'Matar devolve 3 de Vida e reduz 3 de Pavor.',
    { mods: { hp_on_kill: 3, dread_on_kill: -3 } }),

  // ---------------- escudeiro ----------------
  TL('parede', 'Parede', 'escudeiro', 'Com escudo: +20 bloqueio; bloquear custa −1 Fôlego.',
    { req: { for: 4 }, when: { shield: true }, whenMods: { block: 20 }, tags: ['cheap_block'] }),
  TL('golpe_escudo', 'Golpe de Escudo', 'escudeiro', 'Com escudo, chutar vira pancada de escudo que atordoa.',
    { req: { talents: ['parede'] }, when: { shield: true }, whenMods: { fracture: 5 }, tags: ['shield_bash'] }),

  // ---------------- brigão ----------------
  TL('punhos_pedra', 'Punhos de Pedra', 'brigao', 'Desarmado: +50% dano, socos atordoam. Agarrar fica fácil.',
    { mods: { unarmed: 50 }, tags: ['brawler'] }),
  TL('ambidestro', 'Ambidestro', 'brigao', 'Sem penalidade com a mão ruim; arma na mão secundária ataca junto.',
    { req: { des: 6 }, tags: ['ambidestro'] }),
  TL('tocha_e_aco', 'Tocha e Aço', 'brigao', 'Com tocha na mão: +15% dano de fogo, feras fogem mais rápido.',
    { when: { torch: true }, whenMods: { dmg_fogo: 15, dreadResist: 10 }, tags: ['torch_fighter'] }),

  // ---------------- social / outros ----------------
  TL('presenca', 'Presença Sombria', 'executor', '+10 em testes de Vontade. Humanos intimidados se rendem mais.',
    { req: { von: 5 }, mods: { check_von: 10 }, tags: ['intimidate'] }),
  TL('lingua_prata', 'Língua de Prata', 'batedor', '−10% preços. +10 em testes de Astúcia.',
    { req: { ast: 5 }, mods: { price: 10, check_ast: 10 } }),
];

export const TALENTS = Object.fromEntries(TALENT_LIST.map((t) => [t.id, t]));
