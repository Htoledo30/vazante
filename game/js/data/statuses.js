// ICOR — Estados de combate (Área B).
// STATUSES[id] = { id, name, kind:'bad'|'good'|'stance'|'info', icon, desc, turns (padrão), maxStacks,
//                  dot?: { dmg por pilha, dtype, ignoreArmor }, acc?, eva?, dmgPct?, timePct?, skip?, stance? }
// Os números aqui são lidos pelo motor (systems/combat). "turns" conta turnos do PORTADOR.

export const STATUSES = {
  sangrando: {
    id: 'sangrando', name: 'Sangrando', kind: 'bad', icon: '🩸', turns: 3, maxStacks: 6,
    dot: { dmg: 2, dtype: 'sangue' },
    desc: 'Perde 2 PV por pilha a cada turno. Bandagem ou ferro quente estancam.',
  },
  queimando: {
    id: 'queimando', name: 'Queimando', kind: 'bad', icon: '🔥', turns: 2, maxStacks: 3,
    dot: { dmg: 4, dtype: 'fogo' }, morale: -8,
    desc: 'Fogo na carne: 4 PV por pilha a cada turno. Feras entram em pânico. Rolar no chão apaga.',
  },
  envenenado: {
    id: 'envenenado', name: 'Envenenado', kind: 'bad', icon: '☠', turns: 4, maxStacks: 4,
    dot: { dmg: 2, dtype: 'veneno', ignoreArmor: true }, regen: -1,
    desc: '2 PV por pilha por turno, ignora armadura. −1 de recuperação de Fôlego.',
  },
  infectado: {
    id: 'infectado', name: 'Infectado', kind: 'bad', icon: '🦠', turns: 99, maxStacks: 1, regen: -1,
    desc: 'A Chaga entrou no sangue. −1 Fôlego por turno; ao fim da luta, uma ferida apodrece.',
  },
  atordoado: {
    id: 'atordoado', name: 'Atordoado', kind: 'bad', icon: '💫', turns: 1, maxStacks: 1, skip: true, eva: -25,
    desc: 'Perde o próximo turno. Ações carregadas são interrompidas.',
  },
  caido: {
    id: 'caido', name: 'Caído', kind: 'bad', icon: '⤓', turns: 99, maxStacks: 1, eva: -30, acc: -20, beHit: 20,
    desc: 'No chão: −30 esquiva, −20 precisão, atacantes +20. Precisa gastar tempo para levantar.',
  },
  cego: {
    id: 'cego', name: 'Cego', kind: 'bad', icon: '◌', turns: 2, maxStacks: 1, acc: -40, eva: -15,
    desc: '−40 precisão, −15 esquiva.',
  },
  aterrorizado: {
    id: 'aterrorizado', name: 'Aterrorizado', kind: 'bad', icon: '😱', turns: 2, maxStacks: 1, acc: -15, skipChance: 25,
    desc: '−15 precisão e 25% de chance de perder o turno travado de medo.',
  },
  enredado: {
    id: 'enredado', name: 'Enredado', kind: 'bad', icon: '🕸', turns: 2, maxStacks: 1, eva: -20, noMove: true,
    desc: 'Preso (rede, gancho, raízes): não se move, não foge, −20 esquiva.',
  },
  exausto: {
    id: 'exausto', name: 'Exausto', kind: 'bad', icon: '😮‍💨', turns: 99, maxStacks: 1, eva: -20, timePct: 25,
    desc: 'Sem Fôlego: −20 esquiva e ações 25% mais lentas até recuperar 3 de Fôlego.',
  },
  furioso: {
    id: 'furioso', name: 'Furioso', kind: 'good', icon: '😡', turns: 3, maxStacks: 3, dmgPct: 20, eva: -8,
    desc: '+20% de dano por pilha, −8 esquiva por pilha.',
  },
  untado_oleo: {
    id: 'untado_oleo', name: 'Lâmina com óleo', kind: 'good', icon: '🛢', turns: 99, maxStacks: 4,
    desc: 'Cada golpe gasta 1 carga: +4 de dano de fogo e chance de incendiar o alvo.',
  },
  untado_veneno: {
    id: 'untado_veneno', name: 'Lâmina envenenada', kind: 'good', icon: '🧪', turns: 99, maxStacks: 4,
    desc: 'Cada golpe que fere gasta 1 carga e envenena (2 pilhas).',
  },
  guarda: {
    id: 'guarda', name: 'Guarda', kind: 'stance', icon: '🛡', turns: 1, maxStacks: 1, stance: true,
    desc: 'Bloqueia parte do dano de cada golpe até o próximo turno. Cada bloqueio custa Fôlego.',
  },
  esquiva: {
    id: 'esquiva', name: 'Esquiva', kind: 'stance', icon: '↯', turns: 1, maxStacks: 1, stance: true,
    desc: 'Esquiva muito maior até o próximo turno. Inútil caído, preso ou com armadura pesada.',
  },
  aparando: {
    id: 'aparando', name: 'Aparando', kind: 'stance', icon: '⚔', turns: 1, maxStacks: 1, stance: true,
    desc: 'Contra o primeiro golpe corpo a corpo: sucesso anula, contra-ataca e atordoa. Falha: +25% de dano.',
  },
  agarrado: {
    id: 'agarrado', name: 'Agarrado', kind: 'bad', icon: '✊', turns: 99, maxStacks: 1, eva: -30, acc: -20, noMove: true, beHit: 15,
    desc: 'Preso por alguém: não se move nem foge, −20 precisão, −30 esquiva. Solte-se (FOR) ou mate quem segura.',
  },
  agarrando: {
    id: 'agarrando', name: 'Agarrando', kind: 'info', icon: '🤼', turns: 99, maxStacks: 1, eva: -20,
    desc: 'Segurando alguém. −20 esquiva.',
  },
  marcado: {
    id: 'marcado', name: 'Marcado', kind: 'bad', icon: '🎯', turns: 3, maxStacks: 1, beHit: 15, beCrit: 10,
    desc: 'Exposto: atacantes ganham +15 de precisão e +10 de crítico.',
  },
  regenerando: {
    id: 'regenerando', name: 'Regenerando', kind: 'good', icon: '✚', turns: 3, maxStacks: 3, heal: 3,
    desc: 'Recupera 3 PV por pilha a cada turno.',
  },
  carregando: {
    id: 'carregando', name: 'Carregando', kind: 'info', icon: '⏳', turns: 99, maxStacks: 1,
    desc: 'Prepara um golpe forte. Atordoar, derrubar, empurrar ou decepar o membro interrompe.',
  },
  rendido: {
    id: 'rendido', name: 'Rendido', kind: 'info', icon: '🏳', turns: 999, maxStacks: 1,
    desc: 'Largou a arma e implora. Poupe ou execute ao fim da luta.',
  },
  fugindo: {
    id: 'fugindo', name: 'Fugindo', kind: 'info', icon: '🏃', turns: 99, maxStacks: 1, eva: -10,
    desc: 'Vai fugir no próximo turno se não for detido.',
  },
  mantendo_distancia: {
    id: 'mantendo_distancia', name: 'Mantendo distância', kind: 'stance', icon: '⟂', turns: 1, maxStacks: 1, stance: true,
    desc: 'Lança em riste: quem avançar para o corpo a corpo leva uma estocada antes e pode ser detido.',
  },
  aleijado: {
    id: 'aleijado', name: 'Aleijado', kind: 'bad', icon: '🦿', turns: 999, maxStacks: 1, eva: -25, noMove: true,
    desc: 'Pernas destruídas: não avança, não foge, −25 esquiva.',
  },
  desarmado: {
    id: 'desarmado', name: 'Desarmado', kind: 'bad', icon: '✋', turns: 2, maxStacks: 1, dmgPct: -40,
    desc: 'Arma enrolada ou caída: golpes de braço causam −40% de dano.',
  },
  mirando: {
    id: 'mirando', name: 'Mirando', kind: 'good', icon: '◎', turns: 99, maxStacks: 1, acc: 25, crit: 25,
    desc: 'Próximo disparo +25 precisão e +25 crítico. Perde a mira se for ferido.',
  },
  inspirado: {
    id: 'inspirado', name: 'Inspirado', kind: 'good', icon: '📯', turns: 3, maxStacks: 1, acc: 10,
    desc: '+10 precisão; o medo escorre por um momento.',
  },
  entorpecido: {
    id: 'entorpecido', name: 'Entorpecido', kind: 'good', icon: '🌫', turns: 4, maxStacks: 1, acc: -5, flatReduce: 2,
    desc: 'Papoula no sangue: −2 de dano em cada golpe recebido, −5 precisão, imune a terror.',
  },
  desprevenido: {
    id: 'desprevenido', name: 'Desprevenido', kind: 'bad', icon: '❗', turns: 1, maxStacks: 1, beHit: 20, beCrit: 15,
    desc: 'Pego de surpresa: +20 para ser atingido e +15 de crítico contra ele.',
  },
  fraturado: {
    id: 'fraturado', name: 'Osso partido', kind: 'bad', icon: '🦴', turns: 999, maxStacks: 1,
    desc: 'Um membro fraturado: golpes daquele braço enfraquecem; pernas ficam lentas.',
  },
  coberto_sangue: {
    id: 'coberto_sangue', name: 'Banhado em sangue', kind: 'good', icon: '🩸', turns: 3, maxStacks: 1, morale: -10,
    desc: 'Coberto de sangue alheio após uma execução: inimigos vacilam (−moral).',
  },
};

export const STANCES = Object.values(STATUSES).filter((s) => s.stance).map((s) => s.id);

/** Status que impedem movimento. */
export const NO_MOVE = Object.values(STATUSES).filter((s) => s.noMove).map((s) => s.id);

export function statusName(id) { return STATUSES[id]?.name || id; }
