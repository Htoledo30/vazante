// ICOR — Técnicas de combate (Área B).
//
// Formato (lido por systems/combat/hero.js):
// { id, name, cls: classe de arma | 'geral', mastery: 0..3,
//   stam: custo de Fôlego, time: multiplicador do tempo da arma (<= 3) ou tempo absoluto (> 3),
//   dmgMult: multiplicador de dano (0 = sem dano), dtype?: força tipo de dano, hitMod: ± precisão, crit?: ± crítico,
//   target: 'part' (mira parte) | 'enemy' (alvo sem escolher parte) | 'self' | 'engaged' (todos a dist 0) | 'near' (todos a dist <= 1),
//   parts?: [ids/papéis permitidos: 'cabeca','tronco','pernas','braco' (qualquer braço), 'membro'],
//   reach?: alcance (sobrescreve a arma), ranged?: true,
//   armorPierce?: 0..1, sever?: +% decepar, fracture?: +% fraturar, stun?: % atordoar, prone?: % derrubar,
//   push?: n, pull?: n, bleed?: pilhas, status?: [{ id, chance, stacks, turns, self }],
//   hits?: n golpes, vs?: { statuses:[...], mult }, perWound?: +% por parte ferida, perBleed?: +% por pilha de sangramento,
//   req?: { offhand, loaded, notLoaded, ammo, item, targetStatus:[...], targetHpBelow, notEngaged, engaged },
//   kill?: { hpBelow, chance }, morale?: dano de moral no alvo, moraleAll?: em todos os inimigos, windup?: tempo de carga,
//   interrupt?: true (interrompe carga no acerto), special?: 'id' (comportamento único no motor), desc }

export const MASTERY_THRESHOLDS = [0, 12, 35, 80];
export const MASTERY_NAMES = ['Novato', 'Calejado', 'Veterano', 'Mestre'];

export function masteryLevel(uses = 0) {
  let lv = 0;
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) if (uses >= MASTERY_THRESHOLDS[i]) lv = i;
  return lv;
}

const T = (o) => ({ stam: 2, time: 1, dmgMult: 1, hitMod: 0, target: 'part', ...o });

const LIST = [
  // ───────────── ESPADA ─────────────
  T({ id: 'estocada', name: 'Estocada', cls: 'espada', mastery: 0, stam: 2, time: 0.9, dmgMult: 1.0, dtype: 'perf', hitMod: 10, armorPierce: 0.35,
    desc: 'Ponta entre as placas. +10 precisão, ignora 35% da armadura, dano de perfuração.' }),
  T({ id: 'corte_tendao', name: 'Corte no Tendão', cls: 'espada', mastery: 1, stam: 3, time: 1, dmgMult: 0.8, hitMod: 0, parts: ['pernas', 'braco'],
    bleed: 2, fracture: 25, special: 'tendao',
    desc: 'Só membros. Sangra (2) e o membro fica inútil por um tempo: braço −40% dano, pernas não avançam.' }),
  T({ id: 'riposta', name: 'Guarda de Riposta', cls: 'espada', mastery: 2, stam: 2, time: 0.6, dmgMult: 0, target: 'self', special: 'riposta',
    desc: 'Postura de aparar com +25% de chance; o contra-ataque causa dano dobrado.' }),
  T({ id: 'danca_aco', name: 'Dança de Aço', cls: 'espada', mastery: 3, stam: 5, time: 1.3, dmgMult: 0.7, hitMod: -5, hits: 3,
    desc: 'Três cortes seguidos na mesma parte, cada um a 70% do dano.' }),

  // ───────────── MACHADO ─────────────
  T({ id: 'decepar', name: 'Decepar', cls: 'machado', mastery: 0, stam: 3, time: 1.15, dmgMult: 1.15, dtype: 'corte', hitMod: -15, sever: 45,
    parts: ['cabeca', 'braco', 'pernas', 'membro'],
    desc: 'Golpe para arrancar. +45% de chance de decepar, −15 precisão. Só cabeça e membros.' }),
  T({ id: 'rachar_escudo', name: 'Rachar Escudo', cls: 'machado', mastery: 1, stam: 3, time: 1.1, dmgMult: 1.3, hitMod: 5, parts: ['bracoE'],
    special: 'rachar_escudo',
    desc: 'Mira o braço do escudo: o escudo racha (alvo perde a guarda) e o braço sofre 130%.' }),
  T({ id: 'gancho_machado', name: 'Barba do Machado', cls: 'machado', mastery: 2, stam: 3, time: 1, dmgMult: 0.6, hitMod: 0, reach: 1, pull: 1, prone: 45,
    target: 'enemy', parts: ['pernas'],
    desc: 'Engancha o pé de quem está perto: puxa para o corpo a corpo e derruba (45%).' }),
  T({ id: 'machadada_final', name: 'Machadada Final', cls: 'machado', mastery: 3, stam: 4, time: 1.25, dmgMult: 1.4, hitMod: -5, perWound: 30, sever: 25,
    desc: '+30% de dano por parte já ferida ou destruída do alvo; +25% decepar.' }),

  // ───────────── MAÇA ─────────────
  T({ id: 'esmagar_cranio', name: 'Esmagar Crânio', cls: 'maca', mastery: 0, stam: 3, time: 1.1, dmgMult: 1.1, dtype: 'impacto', hitMod: -10, stun: 40,
    parts: ['cabeca'], interrupt: true,
    desc: 'Só cabeça. −10 precisão, +40% de atordoar. Interrompe cargas.' }),
  T({ id: 'quebrar_joelho', name: 'Quebrar Joelho', cls: 'maca', mastery: 1, stam: 3, time: 1, dmgMult: 0.9, dtype: 'impacto', parts: ['pernas'], fracture: 45, prone: 40,
    desc: 'Só pernas. +45% de fraturar e 40% de derrubar.' }),
  T({ id: 'amassar_armadura', name: 'Amassar Armadura', cls: 'maca', mastery: 2, stam: 3, time: 1.1, dmgMult: 1.0, dtype: 'impacto', special: 'amassar',
    desc: 'A placa afunda na carne: a parte perde 3 de armadura em todos os tipos até o fim da luta.' }),
  T({ id: 'sino_ferro', name: 'Sino de Ferro', cls: 'maca', mastery: 3, stam: 5, time: 1.3, dmgMult: 1.3, dtype: 'impacto', hitMod: -10, stun: 70, moraleAll: -15,
    parts: ['cabeca'], interrupt: true,
    desc: 'O crânio toca como um sino. 70% de atordoar e todos os inimigos perdem moral.' }),

  // ───────────── LANÇA ─────────────
  T({ id: 'manter_distancia', name: 'Manter Distância', cls: 'lanca', mastery: 0, stam: 2, time: 0.9, dmgMult: 0.7, push: 1, reach: 1, special: 'manter_distancia',
    desc: 'Estoca e empurra o alvo para Perto; até seu turno, quem avançar leva uma estocada e pode ser detido.' }),
  T({ id: 'estocada_longa', name: 'Estocada Longa', cls: 'lanca', mastery: 1, stam: 3, time: 1, dmgMult: 1.0, dtype: 'perf', hitMod: -15, reach: 2,
    desc: 'Alcança até Longe. −15 precisão.' }),
  T({ id: 'empalar', name: 'Empalar', cls: 'lanca', mastery: 2, stam: 4, time: 1.2, dmgMult: 1.6, dtype: 'perf', hitMod: -5, parts: ['tronco'],
    status: [{ id: 'enredado', chance: 100, turns: 2 }], bleed: 2,
    desc: 'Atravessa o tronco: 160% de dano, sangra e prende o alvo (não avança nem foge) por 2 turnos.' }),
  T({ id: 'muralha_pontas', name: 'Muralha de Pontas', cls: 'lanca', mastery: 3, stam: 3, time: 0.7, dmgMult: 0, target: 'self', special: 'muralha_pontas',
    desc: 'Postura: todo inimigo que te atacar corpo a corpo leva uma estocada ANTES do golpe dele.' }),

  // ───────────── ADAGA ─────────────
  T({ id: 'golpe_baixo', name: 'Golpe Baixo', cls: 'adaga', mastery: 0, stam: 2, time: 0.9, dmgMult: 1.0, hitMod: 5,
    vs: { statuses: ['caido', 'atordoado', 'agarrado', 'cego', 'enredado', 'desprevenido'], mult: 3 },
    desc: 'Dano TRIPLO contra caído, atordoado, agarrado, cego, preso ou desprevenido.' }),
  T({ id: 'mil_cortes', name: 'Mil Cortes', cls: 'adaga', mastery: 1, stam: 3, time: 1.1, dmgMult: 0.55, hits: 3, bleed: 1, dtype: 'corte',
    desc: 'Três cortes rápidos, cada um abre sangramento.' }),
  T({ id: 'abrir_garganta', name: 'Abrir a Garganta', cls: 'adaga', mastery: 2, stam: 3, time: 1, dmgMult: 1.5, dtype: 'corte', parts: ['cabeca'],
    req: { targetStatus: ['caido', 'atordoado', 'agarrado', 'rendido', 'enredado', 'desprevenido'] }, kill: { hpBelow: 0.5, chance: 75 }, bleed: 4,
    desc: 'Só em alvo indefeso. Abaixo de 50% PV: 75% de morte instantânea; senão, sangramento brutal.' }),
  T({ id: 'passo_sombra', name: 'Passo na Sombra', cls: 'adaga', mastery: 3, stam: 3, time: 0.6, dmgMult: 0, target: 'self', special: 'passo_sombra',
    desc: 'Some do olhar: esquiva total até o próximo turno e seu próximo golpe é crítico garantido.' }),

  // ───────────── CUTELO ─────────────
  T({ id: 'talho', name: 'Talho de Açougueiro', cls: 'cutelo', mastery: 0, stam: 2, time: 1, dmgMult: 1.15, dtype: 'corte', bleed: 2, sever: 15,
    desc: '115% de dano, sangra (2), +15% decepar.' }),
  T({ id: 'desossar', name: 'Desossar', cls: 'cutelo', mastery: 1, stam: 3, time: 1.1, dmgMult: 1.0, perWound: 0, special: 'desossar', sever: 30,
    desc: 'Contra parte já ferida: 180% de dano e +30% decepar. Parte intacta: dano normal.' }),
  T({ id: 'carne_viva', name: 'Carne Viva', cls: 'cutelo', mastery: 2, stam: 3, time: 1, dmgMult: 1.0, perBleed: 20, special: 'consome_sangue',
    desc: '+20% de dano por pilha de sangramento do alvo (consome as pilhas).' }),
  T({ id: 'abate', name: 'Abate', cls: 'cutelo', mastery: 3, stam: 4, time: 1.2, dmgMult: 1.2, target: 'enemy', parts: ['cabeca'],
    req: { targetHpBelow: 0.4 }, kill: { hpBelow: 0.4, chance: 100 }, special: 'abate',
    desc: 'Alvo abaixo de 40% PV: abatido como gado. Você recupera 6 PV e perde Pavor.' }),

  // ───────────── MONTANTE ─────────────
  T({ id: 'varredura', name: 'Varredura', cls: 'montante', mastery: 0, stam: 4, time: 1.15, dmgMult: 0.8, hitMod: -5, target: 'engaged', dtype: 'corte',
    desc: 'Atinge todos no corpo a corpo (80% do dano). Ótima contra enxames.' }),
  T({ id: 'meia_espada', name: 'Meia-Espada', cls: 'montante', mastery: 1, stam: 2, time: 0.8, dmgMult: 0.9, dtype: 'perf', armorPierce: 0.5, hitMod: 5,
    desc: 'Segura a lâmina com a mão: rápido, perfura e ignora 50% da armadura.' }),
  T({ id: 'golpe_carrasco', name: 'Golpe do Carrasco', cls: 'montante', mastery: 2, stam: 5, time: 1, dmgMult: 2.5, hitMod: 0, windup: 70, sever: 50, parts: ['cabeca', 'tronco', 'membro', 'braco', 'pernas'],
    desc: 'Carrega (70 de tempo) e desce 250% de dano com +50% decepar. Ser ferido forte, atordoado ou derrubado interrompe.' }),
  T({ id: 'roda_ferro', name: 'Roda de Ferro', cls: 'montante', mastery: 3, stam: 5, time: 1.3, dmgMult: 1.1, target: 'engaged', push: 1, prone: 35,
    desc: 'Giro completo: 110% em todos no corpo a corpo, empurra e derruba (35%).' }),

  // ───────────── MARTELO ─────────────
  T({ id: 'derrubar', name: 'Derrubar', cls: 'martelo', mastery: 0, stam: 3, time: 1, dmgMult: 0.8, dtype: 'impacto', parts: ['pernas'], prone: 65, interrupt: true,
    desc: 'Só pernas. 65% de derrubar. Interrompe cargas.' }),
  T({ id: 'esmagar', name: 'Esmagar', cls: 'martelo', mastery: 1, stam: 4, time: 1.2, dmgMult: 1.4, dtype: 'impacto', fracture: 35,
    desc: '140% de dano de impacto, +35% de fraturar.' }),
  T({ id: 'tremor', name: 'Golpe no Chão', cls: 'martelo', mastery: 2, stam: 4, time: 1.2, dmgMult: 0.5, dtype: 'impacto', target: 'engaged', prone: 50, interrupt: true, hitMod: 15,
    desc: 'A terra treme: todos no corpo a corpo sofrem 50% e podem cair (50%). Interrompe cargas.' }),
  T({ id: 'pregar', name: 'Pregar no Chão', cls: 'martelo', mastery: 3, stam: 4, time: 1.2, dmgMult: 2.5, dtype: 'impacto', crit: 100, parts: ['cabeca', 'tronco'],
    req: { targetStatus: ['caido'] },
    desc: 'Só em alvo caído: 250% de dano, crítico garantido.' }),

  // ───────────── MANGUAL ─────────────
  T({ id: 'por_cima_escudo', name: 'Por Cima do Escudo', cls: 'mangual', mastery: 0, stam: 2, time: 1, dmgMult: 1.1, dtype: 'impacto', special: 'ignora_guarda', parts: ['cabeca', 'tronco'],
    desc: 'A bola passa por cima: ignora guarda e escudo; +30% contra quem estava em guarda.' }),
  T({ id: 'enrolar', name: 'Enrolar a Arma', cls: 'mangual', mastery: 1, stam: 3, time: 1, dmgMult: 0.4, parts: ['bracoD', 'braco'], status: [{ id: 'desarmado', chance: 70, turns: 2 }], interrupt: true,
    desc: 'A corrente prende o braço armado: 70% de desarmar (−40% dano) por 2 turnos. Interrompe cargas.' }),
  T({ id: 'giro_corrente', name: 'Giro de Corrente', cls: 'mangual', mastery: 2, stam: 4, time: 1.15, dmgMult: 0.85, target: 'near', dtype: 'impacto', hitMod: -5, special: 'ignora_guarda',
    desc: 'Todos a Perto ou no corpo a corpo: 85% de dano, ignora guarda.' }),
  T({ id: 'quebra_dentes', name: 'Quebra-Dentes', cls: 'mangual', mastery: 3, stam: 4, time: 1.2, dmgMult: 1.4, dtype: 'impacto', parts: ['cabeca'], stun: 55, morale: -25, fracture: 40, special: 'ignora_guarda',
    desc: 'Dentes no chão. 55% atordoar, −25 moral, ignora guarda.' }),

  // ───────────── FOICE ─────────────
  T({ id: 'colheita', name: 'Colheita', cls: 'foice', mastery: 0, stam: 3, time: 1.1, dmgMult: 0.9, dtype: 'corte', perWound: 25, perBleed: 10, reach: 1,
    desc: '+25% por parte ferida/destruída e +10% por pilha de sangramento no alvo. Alcança Perto.' }),
  T({ id: 'arco_foice', name: 'Arco da Foice', cls: 'foice', mastery: 1, stam: 4, time: 1.2, dmgMult: 0.7, target: 'near', bleed: 1, dtype: 'corte',
    desc: 'Corta em arco todos a Perto ou no corpo a corpo: 70% e sangra.' }),
  T({ id: 'puxar_foice', name: 'Gancho da Foice', cls: 'foice', mastery: 2, stam: 3, time: 1, dmgMult: 0.7, reach: 1, pull: 1, prone: 40, parts: ['pernas'], target: 'enemy', bleed: 1,
    desc: 'Puxa pelas pernas para o corpo a corpo e derruba (40%).' }),
  T({ id: 'ceifar', name: 'Ceifar', cls: 'foice', mastery: 3, stam: 4, time: 1.2, dmgMult: 1.5, reach: 1, kill: { hpBelow: 0.3, chance: 100 }, target: 'enemy', parts: ['cabeca'],
    desc: 'Alvo abaixo de 30% PV: ceifado na hora. Senão, 150% na cabeça.' }),

  // ───────────── BESTA ─────────────
  T({ id: 'recarregar', name: 'Recarregar', cls: 'besta', mastery: 0, stam: 1, time: 110, dmgMult: 0, target: 'self', req: { notLoaded: true, ammo: 'virote' }, special: 'recarregar',
    desc: 'Arma a besta (gasta 1 virote). Lento: 110 de tempo.' }),
  T({ id: 'coronhada', name: 'Coronhada', cls: 'besta', mastery: 0, stam: 2, time: 70, dmgMult: 0, dtype: 'impacto', special: 'coronhada', reach: 0, stun: 20, push: 1,
    desc: 'Coronha na cara de quem chega perto: dano leve de impacto, empurra e pode atordoar.' }),
  T({ id: 'disparo_junta', name: 'Disparo na Junta', cls: 'besta', mastery: 1, stam: 2, time: 1.1, dmgMult: 1.0, ranged: true, hitMod: -10, armorPierce: 1, parts: ['braco', 'pernas', 'membro'],
    req: { loaded: true }, fracture: 30,
    desc: 'No vão da armadura de um membro: ignora TODA a armadura, +30% fraturar. −10 precisão.' }),
  T({ id: 'mira_firme', name: 'Mira Firme', cls: 'besta', mastery: 2, stam: 1, time: 0.5, dmgMult: 0, target: 'self', special: 'mirar', req: { loaded: true },
    desc: 'Respira e mira: próximo disparo +25 precisão e +25 crítico. Perde a mira se for ferido.' }),
  T({ id: 'virote_farpado', name: 'Virote Farpado', cls: 'besta', mastery: 3, stam: 2, time: 1, dmgMult: 1.2, ranged: true, bleed: 4, morale: -15, req: { loaded: true },
    desc: 'Farpas que rasgam ao sair: sangramento 4 e −15 moral.' }),

  // ───────────── DESARMADO ─────────────
  T({ id: 'cabecada', name: 'Cabeçada', cls: 'desarmado', mastery: 0, stam: 2, time: 0.8, dmgMult: 0.9, dtype: 'impacto', parts: ['cabeca'], stun: 35, special: 'cabecada', interrupt: true,
    desc: 'Testa contra nariz. 35% atordoar; você sofre 3 de dano.' }),
  T({ id: 'estrangular', name: 'Estrangular', cls: 'desarmado', mastery: 1, stam: 3, time: 1.1, dmgMult: 1.4, armorPierce: 1, parts: ['cabeca'], stun: 40, req: { targetStatus: ['agarrado', 'caido'] },
    desc: 'Alvo agarrado ou caído: dedos na garganta, ignora armadura, 40% atordoar.' }),
  T({ id: 'quebrar_braco', name: 'Quebrar o Braço', cls: 'desarmado', mastery: 2, stam: 3, time: 1, dmgMult: 1.0, dtype: 'impacto', parts: ['braco'], fracture: 80, req: { targetStatus: ['agarrado', 'caido', 'atordoado'] },
    desc: 'Alvo indefeso: 80% de partir o braço.' }),
  T({ id: 'arrancar_olho', name: 'Arrancar o Olho', cls: 'desarmado', mastery: 3, stam: 3, time: 1, dmgMult: 0.6, armorPierce: 1, parts: ['cabeca'], special: 'arrancar_olho', morale: -30,
    req: { targetStatus: ['agarrado', 'caido', 'atordoado'] },
    desc: 'Polegar no olho. O alvo fica cego para sempre; todos perdem moral.' }),

  // ───────────── GANCHO (prótese) ─────────────
  T({ id: 'puxar', name: 'Puxar', cls: 'gancho', mastery: 0, stam: 2, time: 0.9, dmgMult: 0.5, reach: 2, pull: 2, prone: 25, target: 'enemy',
    desc: 'O gancho fisga e arrasta o alvo (até Longe) para o corpo a corpo; 25% de derrubar.' }),
  T({ id: 'fisgar', name: 'Fisgar', cls: 'gancho', mastery: 1, stam: 2, time: 1, dmgMult: 0.8, dtype: 'perf', bleed: 2, status: [{ id: 'enredado', chance: 100, turns: 2 }],
    desc: 'Crava na carne: sangra (2) e o alvo não consegue recuar nem fugir por 2 turnos.' }),
  T({ id: 'rasgar', name: 'Rasgar', cls: 'gancho', mastery: 2, stam: 3, time: 1, dmgMult: 1.0, dtype: 'corte', vs: { statuses: ['sangrando'], mult: 1.6 }, sever: 20,
    desc: 'Contra quem sangra: 160% de dano, +20% decepar.' }),
  T({ id: 'eviscerar', name: 'Eviscerar', cls: 'gancho', mastery: 3, stam: 4, time: 1.2, dmgMult: 2.0, parts: ['tronco'], hitMod: -10, special: 'eviscerar',
    desc: 'Abre o ventre: 200% no tronco. Se matar, todos os inimigos perdem 30 de moral e você perde Pavor.' }),

  // ───────────── GERAIS ─────────────
  T({ id: 'chutar', name: 'Chutar', cls: 'geral', mastery: 0, stam: 2, time: 70, dmgMult: 0, dtype: 'impacto', special: 'chute', reach: 0, push: 1, prone: 25, interrupt: true, target: 'enemy',
    desc: 'Chute no peito: dano leve, empurra para Perto, pode derrubar (FOR). Interrompe cargas.' }),
  T({ id: 'empurrar', name: 'Empurrar', cls: 'geral', mastery: 0, stam: 1, time: 50, dmgMult: 0, special: 'empurrar', reach: 0, push: 1, prone: 10, interrupt: true, target: 'enemy',
    desc: 'Rápido e barato: empurra para Perto e interrompe a carga. Sem dano.' }),
  T({ id: 'executar', name: 'Executar', cls: 'geral', mastery: 0, stam: 2, time: 1.2, dmgMult: 0, special: 'executar', reach: 0, target: 'enemy',
    desc: 'Mata quem está caído, atordoado, preso, rendido ou moribundo (≤25% PV). −Pavor, os outros perdem moral.' }),
  T({ id: 'agarrar', name: 'Agarrar', cls: 'geral', mastery: 0, stam: 3, time: 80, dmgMult: 0, special: 'agarrar', reach: 0, target: 'enemy',
    desc: 'Teste de FOR: prende o alvo (não age bem, não foge, −30 esquiva). Você fica −20 esquiva.' }),
  T({ id: 'grito_guerra', name: 'Grito de Guerra', cls: 'geral', mastery: 0, stam: 3, time: 60, dmgMult: 0, special: 'grito', target: 'self', tome: true,
    desc: 'Urro de açougue: −10 moral em feras e humanos, −8 Pavor, Inspirado (+10 precisão).' }),

  // ───────────── TOMOS (aprendidas por tomos, mestres e eventos — servem a qualquer arma) ─────────────
  T({ id: 'decapitar', name: 'Decapitação', cls: 'geral', mastery: 0, tome: true, stam: 4, time: 1.25, dmgMult: 1.6, dtype: 'corte', hitMod: -10, sever: 60, parts: ['cabeca'],
    req: { targetHpBelow: 0.5 }, desc: 'Alvo abaixo de 50% PV: golpe no pescoço, 160% de dano, +60% decepar (cabeça decepada mata).' }),
  T({ id: 'quebra_joelho', name: 'Quebra-Joelho', cls: 'geral', mastery: 0, tome: true, stam: 3, time: 1, dmgMult: 0.7, dtype: 'impacto', parts: ['pernas'], fracture: 60, prone: 50, interrupt: true,
    desc: 'Pisão ou golpe de lado no joelho: 60% de fraturar, 50% de derrubar. Qualquer arma.' }),
  T({ id: 'estocada_coracao', name: 'Estocada ao Coração', cls: 'geral', mastery: 0, tome: true, stam: 4, time: 1.1, dmgMult: 1.5, dtype: 'perf', hitMod: -15, crit: 15, armorPierce: 0.5, parts: ['tronco'],
    desc: 'Entre as costelas soltas: 150% de perfuração, ignora metade da armadura, +15% crítico.' }),
  T({ id: 'desarmar', name: 'Desarme', cls: 'geral', mastery: 0, tome: true, stam: 2, time: 0.9, dmgMult: 0.3, hitMod: -5, parts: ['braco'], interrupt: true,
    status: [{ id: 'desarmado', chance: 100, turns: 3 }], desc: 'Arranca a arma (ou os dedos): desarmado por 3 turnos (−40% dano). Interrompe cargas.' }),
  T({ id: 'sangria', name: 'Sangria', cls: 'geral', mastery: 0, tome: true, stam: 2, time: 0.9, dmgMult: 0.6, dtype: 'corte', bleed: 4,
    desc: 'Abre as veias certas: pouco dano, sangramento 4.' }),
  T({ id: 'golpe_icor', name: 'Golpe de Icor', cls: 'geral', mastery: 0, tome: true, stam: 3, time: 1, dmgMult: 1.6, dtype: 'icor', armorPierce: 1, special: 'golpe_icor',
    desc: 'O Icor do seu sangue sobe pela arma: 160% de dano de Icor, ignora armadura. Custa 2 de Corrupção.' }),
  T({ id: 'muralha_escudo', name: 'Muralha de Escudo', cls: 'geral', mastery: 0, tome: true, stam: 2, time: 0.6, dmgMult: 0, target: 'self', special: 'muralha_escudo', req: { offhand: 'shield' },
    desc: 'Guarda total: bloqueio +30% e o bloqueio não custa Fôlego até o seu próximo turno.' }),
  T({ id: 'arremessar', name: 'Arremessar Faca', cls: 'geral', mastery: 0, stam: 1, time: 60, dmgMult: 0, special: 'arremesso', ranged: true, reach: 2, req: { item: 'faca_arremesso' },
    desc: 'Gasta 1 faca de arremesso. Perfura qualquer distância.' }),
  T({ id: 'golpe_escudo', name: 'Golpe de Escudo', cls: 'geral', mastery: 0, stam: 2, time: 70, dmgMult: 0, special: 'golpe_escudo', reach: 0, stun: 35, interrupt: true, req: { offhand: 'shield' }, target: 'enemy',
    desc: 'Borda do escudo no rosto: dano leve, 35% atordoar. Interrompe cargas.' }),
  T({ id: 'golpe_tocha', name: 'Golpe de Tocha', cls: 'geral', mastery: 0, stam: 2, time: 70, dmgMult: 0, special: 'golpe_tocha', reach: 0, req: { offhand: 'torch' },
    desc: 'Fogo na cara: dano de fogo, incendeia (60%), feras perdem 20 de moral.' }),
  T({ id: 'pisotear', name: 'Pisotear', cls: 'geral', mastery: 0, stam: 2, time: 70, dmgMult: 0, special: 'pisotear', reach: 0, parts: ['cabeca', 'tronco'], req: { targetStatus: ['caido'] },
    desc: 'Bota no crânio de quem está no chão. Rápido, ignora metade da armadura.' }),
  T({ id: 'recobrar', name: 'Recobrar Fôlego', cls: 'geral', mastery: 0, stam: 0, time: 70, dmgMult: 0, special: 'recobrar', target: 'self',
    desc: 'Recua o peito e respira: +5 Fôlego (além do normal). Fica −10 esquiva até o próximo turno.' }),
];

export const TECHNIQUES = Object.fromEntries(LIST.map((t) => [t.id, t]));

/** Técnicas por classe, ordenadas por maestria. */
export const CLASS_TECHNIQUES = {};
for (const t of LIST) {
  (CLASS_TECHNIQUES[t.cls] ||= []).push(t.id);
}
for (const k of Object.keys(CLASS_TECHNIQUES)) {
  CLASS_TECHNIQUES[k].sort((a, b) => TECHNIQUES[a].mastery - TECHNIQUES[b].mastery);
}

export const GENERAL_TECHNIQUES = CLASS_TECHNIQUES.geral;

export const WEAPON_CLASSES = ['espada', 'machado', 'maca', 'lanca', 'adaga', 'cutelo', 'montante', 'martelo', 'mangual', 'foice', 'besta', 'desarmado', 'gancho'];
export const CLASS_NAMES = {
  espada: 'Espada', machado: 'Machado', maca: 'Maça', lanca: 'Lança', adaga: 'Adaga', cutelo: 'Cutelo', montante: 'Montante',
  martelo: 'Martelo', mangual: 'Mangual', foice: 'Foice', besta: 'Besta', desarmado: 'Desarmado', gancho: 'Gancho', geral: 'Geral',
};

/** Técnicas que uma classe libera em um dado nível de maestria. */
export function techniquesUnlocked(cls, level) {
  return (CLASS_TECHNIQUES[cls] || []).filter((id) => TECHNIQUES[id].mastery <= level);
}
