// Comportamentos únicos referenciados pelos dados: partes especiais (onBreak), mortes (onDeath)
// e intenções especiais (special). Cada função recebe (G, ator, ...).
import { R } from '../../core/rng.js';
import {
  heroActor, allyActor, foes, edef, log, emitEv, addStatus, removeStatus, hasStatus, stacks, partBroken, rangeRoll, rollPct, changeMorale,
} from './core.js';
import { heroD } from './deps.js';
import { damageHero, damageAlly, damageEnemy, dreadHero, corruptHero, killEnemy, healHero, summon } from './resolve.js';

/** Explosão de esporos do Lavrador Oco. */
function sporeBurst(G, a) {
  if (a.flags.sporesSpent) return;
  a.flags.sporesSpent = true;
  if (a.flags.lastDtype === 'fogo' || hasStatus(a, 'queimando')) {
    log(G, 'A bolsa de esporos estoura em chamas. Os esporos queimam no ar.', 'good');
    return;
  }
  log(G, `A bolsa de ${a.name} estoura: uma nuvem amarela e doce.`, 'rot');
  emitEv(G, { type: 'aoe', target: a.uid, kind: 'spores', sfx: 'squelch' });
  const h = heroActor(G);
  if (a.dist <= 1 && h) {
    if (rollPct(60)) addStatus(G, h, 'infectado', { turns: 99 }) && log(G, 'Você respira os esporos. A Chaga entra.', 'bad');
    addStatus(G, h, 'envenenado', { stacks: 1, turns: 3 });
    log(G, 'Você tosse sangue amarelo.', 'bad');
  } else log(G, 'Você está longe o bastante. Os esporos assentam na lama.', 'good');
  const al = allyActor(G);
  if (al && a.dist <= 1) addStatus(G, al, 'envenenado', { stacks: 2, turns: 3 });
  for (const f of foes(G)) {
    if (f === a || f.dist !== a.dist || edef(f)?.tags?.includes('morto')) continue;
    damageEnemy(G, f, 4, { part: 'tronco', dtype: 'icor', by: a.uid });
  }
}

export const PART_HOOKS = {
  esporos(G, a) { sporeBurst(G, a); },

  frascos(G, a) {
    a.flags.noDrink = true;
    a.flags.drunk = (a.flags.drunk || 0) + 2;
    log(G, `Os frascos de ${a.name} estouram. Icor ferve na pele dele.`, 'ichor');
    damageEnemy(G, a, 5, { part: 'tronco', dtype: 'icor', by: 'env' });
    if (!a.dead) addStatus(G, a, 'furioso', { stacks: 1, turns: 3 });
    if (a.dist === 0) {
      const dmg = R.int(3, 6);
      log(G, 'Respinga em você: queima como ouro derretido.', 'bad');
      damageHero(G, dmg, { part: 'tronco', dtype: 'icor', srcName: 'Icor derramado', noWound: true });
      corruptHero(G, 2, 'Icor na pele');
    }
  },

  boca(G, a) {
    log(G, `A boca no ventre de ${a.name} se fecha em pedaços. Ele uiva sem som.`, 'good');
    changeMorale(G, a, -10);
  },

  lanterna(G, a) {
    const c = G.combat;
    log(G, 'A lanterna se parte. O fogo escorre para dentro da palha — e a escuridão cai sobre o campo.', 'boss');
    addStatus(G, a, 'queimando', { stacks: 3, turns: 3 });
    damageEnemy(G, a, 10, { part: 'tronco', dtype: 'fogo', by: 'env' });
    if (!c.env.lit) {
      c.env.dark = true;
      dreadHero(G, 5, 'escuridão');
    } else log(G, 'Sua tocha ainda segura a noite.', 'info');
    if (a.dist === 0 && rollPct(40)) {
      const h = heroActor(G);
      addStatus(G, h, 'queimando', { stacks: 1, turns: 2 });
      log(G, 'Palha em chamas cai em você.', 'bad');
    }
  },

  mae_cabeca(G, a) {
    addStatus(G, a, 'cego', { turns: 999 });
    log(G, 'O saco da cabeça se rasga: dentes e estopa. Ela tateia o ar, cega.', 'boss');
  },

  estaca(G, a) {
    a.flags.fallen = true;
    log(G, 'A estaca se parte. A Mãe-Colheita desaba — e começa a rastejar na sua direção.', 'boss');
    dreadHero(G, 4, 'ela rasteja');
  },

  ventre(G, a) {
    log(G, 'O ventre se esvazia num jorro de restos. Ela não pare mais.', 'boss');
    damageEnemy(G, a, 15, { part: 'tronco', dtype: 'corte', by: 'env' });
    dreadHero(G, -5, 'ventre destruído');
  },
};

export const DEATH_HOOKS = {
  esporos_morte(G, a) { sporeBurst(G, a); },

  mae_morte(G, a) {
    const c = G.combat;
    log(G, 'A Mãe-Colheita desaba. Os mortos que ela costurou caem junto, como marionetes sem fio.', 'boss');
    for (const f of c.actors) {
      if (f.side === 'enemy' && !f.dead && f.flags.master === a.uid) killEnemy(G, f, { by: 'env', how: 'default', silent: true });
    }
    dreadHero(G, -15, 'o silêncio dos campos');
  },
};

/** Intenções especiais de inimigos. Recebem (G, a, intentDef, intentState). Retornam true se trataram tudo. */
export const INTENT_SPECIALS = {
  reload(G, a) { a.flags.loaded = true; log(G, `${a.name} recarrega.`, 'info'); return true; },

  uivo(G, a, it) {
    for (const f of foes(G)) if (f.def === a.def && f !== a) changeMorale(G, f, 10);
    log(G, `${a.name} uiva. A matilha responde.`, 'warn');
    dreadHero(G, it.dread || 3, 'uivo');
    return true;
  },

  rosnar(G, a) { log(G, `${a.name} rosna para o fogo e não se aproxima.`, 'info'); return true; },

  lamento(G, a, it) { log(G, `${a.name}: um som que não devia sair de garganta nenhuma.`, 'dread'); dreadHero(G, it.dread || 4, a.name); return true; },

  pregacao(G, a, it) {
    log(G, `${a.name} grita o fim do mundo. Os outros respondem.`, 'dread');
    for (const f of foes(G)) if (f !== a) changeMorale(G, f, 15);
    dreadHero(G, it.dread || 5, a.name);
    return true;
  },

  chamado(G, a, it) {
    const dead = G.lineage?.dead || [];
    const name = dead.length ? dead[dead.length - 1].name : 'meu filho';
    log(G, `A Aberração chama você: "${name}..." com uma voz que você conhece.`, 'dread');
    dreadHero(G, it.dread || 10, 'voz conhecida');
    return true;
  },

  banquete(G, a) {
    const c = G.combat;
    if (c.env.corpses <= 0) return true;
    c.env.corpses -= 1;
    c.corpses.shift();
    const dead = Object.values(a.parts).find((p) => p.role === 'swarm' && partBroken(p));
    if (dead) { dead.hp = dead.max; dead.state = 'ok'; log(G, `${a.name} come um corpo. Mais corvos descem do céu.`, 'bad'); }
    else {
      for (const p of Object.values(a.parts)) if (p.role === 'swarm') p.hp = Math.min(p.max, p.hp + 3);
      log(G, `${a.name} se fartam num corpo.`, 'bad');
    }
    a.hp = Object.values(a.parts).filter((p) => p.role === 'swarm').reduce((t, p) => t + p.hp, 0);
    a.hpMax = Math.max(a.hpMax, a.hp);
    return true;
  },

  revoar(G, a) { a.dist = 2; log(G, `${a.name} sobem num redemoinho negro, fora do alcance.`, 'info'); return true; },

  shieldwall(G, a) { addStatus(G, a, 'guarda', { turns: 1 }); log(G, `${a.name} se fecha atrás do escudo.`, 'warn'); return true; },

  flagelar(G, a) {
    a.hp = Math.max(1, a.hp - 4);
    if (a.parts.tronco) a.parts.tronco.hp = Math.max(1, a.parts.tronco.hp - 4);
    addStatus(G, a, 'furioso', { stacks: 1, turns: 5 });
    log(G, `${a.name} rasga as próprias costas com o chicote. Sorri. (Fúria ${stacks(a, 'furioso')})`, 'warn');
    return true;
  },

  herege(G, a) {
    addStatus(G, a, 'furioso', { stacks: 2, turns: 4 });
    log(G, `${a.name} vê o Icor nos seus olhos: "HEREGE!"`, 'warn');
    return true;
  },

  untar(G, a) { addStatus(G, a, 'untado_oleo', { stacks: 3 }); log(G, `${a.name} unta o cutelo com óleo e acende.`, 'warn'); return true; },

  beber(G, a) {
    if (a.flags.noDrink) return true;
    a.flags.stage = (a.flags.stage || 0) + 1;
    a.flags.drunk = (a.flags.drunk || 0) + 1;
    emitEv(G, { type: 'mutate', target: a.uid, sfx: 'ichor' });
    if (a.flags.stage === 1) {
      a.name = a.name.replace('Bebedor de Icor', 'Bebedor Inchado');
      a.hpMax += 10;
      a.hp = Math.min(a.hpMax, a.hp + 14);
      if (a.parts.tronco) a.parts.tronco.hp = Math.min(a.parts.tronco.max, a.parts.tronco.hp + 10);
      a.flags.scale.dmg = +(a.flags.scale.dmg * 1.25).toFixed(3);
      log(G, `${a.name} vira um frasco inteiro. As veias acendem em ouro; o braço incha e se estica como um chicote.`, 'ichor');
      dreadHero(G, 4, 'mutação');
    } else {
      a.name = 'Abominação de Icor';
      a.hpMax += 25;
      a.hp = Math.min(a.hpMax, a.hp + 22);
      a.flags.speedBonus = (a.flags.speedBonus || 0) + 20;
      a.moraleMax = 0;
      a.morale = 0;
      a.parts.tentaculo = { hp: 14, max: 14, armor: { corte: 0, perf: 0, impacto: 0, fogo: 0 }, state: 'ok', role: 'special', name: 'Tentáculo', hitMod: 0, severable: true };
      log(G, 'Ele bebe o último frasco. A pele racha; algo dourado e cheio de dentes sai de dentro. Não há mais homem ali.', 'ichor');
      dreadHero(G, 8, 'mutação');
    }
    return true;
  },
};

/** Ganchos aplicados antes do dano de um ataque inimigo (modificam multiplicador). */
export const ATTACK_MODS = {
  prata(G, a) { return (G.hero.corruption || 0) >= 40 ? 1.35 : 1; },
};

/** Ganchos depois de um ataque inimigo que acertou o herói. */
export const AFTER_HIT = {
  shoot(G, a) { a.flags.loaded = false; },
  pull(G, a) {
    if (a.dist > 0) { a.dist = 0; log(G, `${a.name} te puxa para perto.`, 'bad'); emitEv(G, { type: 'move', target: a.uid }); }
  },
  bomba(G, a) { a.flags.bombs = Math.max(0, (a.flags.bombs || 0) - 1); },
  devorar(G, a, dealt) {
    if (dealt > 0) {
      const n = Math.round(dealt * 0.5);
      a.hp = Math.min(a.hpMax, a.hp + n);
      if (a.parts.tronco) a.parts.tronco.hp = Math.min(a.parts.tronco.max, a.parts.tronco.hp + n);
      log(G, `${a.name} engole um pedaço seu. (+${n} PV)`, 'blood');
    }
  },
  martirio(G, a) {
    addStatus(G, a, 'queimando', { stacks: 3, turns: 3 });
    log(G, `${a.name} te abraça em chamas, rindo.`, 'bad');
  },
};

/** Após o ataque (acertando ou não). */
export const AFTER_ATTACK = {
  shoot(G, a) { a.flags.loaded = false; },
  bomba(G, a) { a.flags.bombs = Math.max(0, (a.flags.bombs || 0) - 1); },
  martirio(G, a) { addStatus(G, a, 'queimando', { stacks: 2, turns: 3 }); },
};

/** Empurrão do Ceifeiro (afasta o herói para o alcance da foice). */
export function shoveHero(G, a) {
  if (a.dist !== 0) return;
  const h = heroActor(G);
  if (hasStatus(h, 'agarrado')) return;
  a.dist = 1;
  log(G, `${a.name} te empurra com o cabo para o alcance da lâmina.`, 'bad');
  emitEv(G, { type: 'move', target: a.uid });
}

export function heroHasFire(G) {
  const D = heroD(G);
  return D.offhand.kind === 'torch' || !!G.combat?.env?.torchInHand;
}

export { healHero, damageAlly };

// ───────────────────────── Onda 2: regiões 2–5 e chefes ─────────────────────────

function healEnemy(G, a, n) {
  if (!a || a.dead) return 0;
  const before = a.hp;
  a.hp = Math.min(a.hpMax, a.hp + n);
  if (a.parts.tronco) a.parts.tronco.hp = Math.min(a.parts.tronco.max, a.parts.tronco.hp + n);
  const got = Math.round(a.hp - before);
  if (got > 0) emitEv(G, { type: 'heal', target: a.uid, n: got });
  return got;
}

Object.assign(PART_HOOKS, {
  corda(G, a) {
    log(G, `A corda de ${a.name} arrebenta. Agora ele só tem as mãos.`, 'good');
    const h = heroActor(G);
    const g = h && h.statuses.find((s) => s.id === 'agarrado' && s.src === a.uid);
    if (g) { removeStatus(h, 'agarrado'); removeStatus(a, 'agarrando'); log(G, 'O laço afrouxa no seu pescoço.', 'good'); }
  },
  galhos_bruxa(G, a) { log(G, `Os galhos de ${a.name} se partem com um grito de madeira. A casca não fecha mais nada.`, 'good'); },
  fios(G, a) {
    log(G, `Os fios dourados se soltam. ${a.name} desmonta em três ou quatro corpos menores, que param de mexer.`, 'good');
    killEnemy(G, a, { by: 'hero', how: 'default', silent: true });
  },
  barriga(G, a) { explode(G, a, 'A barriga estoura.'); },
  asas(G, a) {
    a.flags.fallen = true;
    addStatus(G, a, 'caido', { turns: 99 });
    log(G, `${a.name} perde as asas e despenca. No chão, é só carne.`, 'boss');
    dreadHero(G, -6, 'o anjo caiu');
  },
  galhada_rei(G, a) {
    log(G, 'A galhada se parte com um estalo de árvore velha. O Rei urra — a floresta para de alimentá-lo.', 'boss');
    damageEnemy(G, a, 18, { part: 'tronco', dtype: 'corte', by: 'env' });
    dreadHero(G, -8, 'a coroa caiu');
    a.flags.speedBonus = (a.flags.speedBonus || 0) - 10;
  },
  fios_bispo(G, a) {
    log(G, 'A linha dourada arrebenta. Em toda a cripta, os costurados caem como roupa no varal cortado.', 'boss');
    for (const f of G.combat.actors) if (f.side === 'enemy' && !f.dead && f.def === 'costurado') killEnemy(G, f, { by: 'env', how: 'default', silent: true });
    dreadHero(G, -10, 'os fios cortados');
  },
  garganta(G, a) {
    log(G, 'A garganta da Voz se abre num rasgo luminoso. O canto vira um gorgolejo. O silêncio é a melhor coisa que você já ouviu.', 'boss');
    dreadHero(G, -15, 'o silêncio');
    damageEnemy(G, a, 20, { part: 'tronco', dtype: 'corte', by: 'env' });
  },
  valvula(G, a) {
    a.flags.valves = (a.flags.valves || 0) + 1;
    a.flags.speedBonus = (a.flags.speedBonus || 0) - 12;
    a.flags.scale.dmg = +(a.flags.scale.dmg * 0.88).toFixed(3);
    log(G, a.flags.valves >= 2 ? 'A segunda válvula rompe. O Coração bate fora de ritmo, fraco, desesperado.' : 'Uma válvula rompe num jorro dourado. A batida falha.', 'boss');
    damageEnemy(G, a, 25, { part: 'tronco', dtype: 'corte', by: 'env' });
  },
});

function explode(G, a, txt) {
  if (a.flags.exploded) return;
  a.flags.exploded = true;
  log(G, `${txt} Água podre, bile e pedaços para todo lado.`, 'rot');
  emitEv(G, { type: 'aoe', target: a.uid, kind: 'bile', sfx: 'squelch' });
  const h = heroActor(G);
  if (a.dist <= 1 && h) {
    damageHero(G, R.int(10, 16), { part: 'tronco', dtype: 'impacto', srcName: 'a explosão', noWound: false });
    addStatus(G, h, 'cego', { turns: 1 });
    if (rollPct(40)) addStatus(G, h, 'infectado', { turns: 99 });
    log(G, 'Você é atingido em cheio.', 'bad');
  } else log(G, 'Longe o bastante: só o fedor chega.', 'good');
  const al = allyActor(G);
  if (al && a.dist <= 1) damageAlly(G, al, R.int(8, 12), { srcName: 'a explosão' });
  for (const f of foes(G)) if (f !== a && f.dist === a.dist) damageEnemy(G, f, R.int(6, 10), { part: 'tronco', dtype: 'impacto', by: a.uid });
  if (!a.dead) killEnemy(G, a, { by: 'env', how: 'default', silent: true });
}

Object.assign(DEATH_HOOKS, {
  chefe_morte(G, a) {
    log(G, `${a.name} desaba. O que ele chamou para a luta desaba junto.`, 'boss');
    for (const f of G.combat.actors) if (f.side === 'enemy' && !f.dead && f.flags.master === a.uid) killEnemy(G, f, { by: 'env', how: 'default', silent: true });
    dreadHero(G, -20, 'o silêncio depois do monstro');
  },
});

Object.assign(INTENT_SPECIALS, {
  regenerar(G, a) {
    const n = Math.round(a.hpMax * 0.08);
    const got = healEnemy(G, a, n);
    addStatus(G, a, 'regenerando', { stacks: 1, turns: 2 });
    log(G, `${a.name} se fecha. (+${got} PV)`, 'bad');
    return true;
  },
  banquete_carnical(G, a) {
    const c = G.combat;
    if (c.env.corpses <= 0) return true;
    c.env.corpses -= 1;
    c.corpses.shift();
    const got = healEnemy(G, a, 18);
    addStatus(G, a, 'furioso', { stacks: 1, turns: 3 });
    log(G, `${a.name} enfia a cara num cadáver e mastiga. (+${got} PV)`, 'bad');
    dreadHero(G, 3, 'o banquete');
    return true;
  },
  curar_aliados(G, a) {
    const hurt = foes(G).filter((f) => f !== a && f.hp < f.hpMax);
    if (!hurt.length) { log(G, `${a.name} reza sobre ninguém.`, 'info'); return true; }
    for (const f of hurt) healEnemy(G, f, Math.round(f.hpMax * 0.2));
    log(G, `${a.name} unge os seus com sangue. As feridas deles fecham.`, 'bad');
    return true;
  },
  cavar(G, a) {
    a.dist = 2;
    a.flags.used = a.flags.used || {};
    delete a.flags.used.emergir;
    addStatus(G, a, 'esquiva', { turns: 1 });
    log(G, `${a.name} some no chão de ossos.`, 'warn');
    return true;
  },
  explodir(G, a) { explode(G, a, `${a.name} estoura como um odre.`); return true; },
  canto(G, a, it) {
    const h = heroActor(G);
    const deaf = (G.hero.traits || []).includes('surdo');
    const known = !!G.campaign?.flags?.nome_voz && a.def === 'voz_submersa';
    let n = it.dread || 8;
    if (deaf) n = Math.round(n / 3);
    if (known) n = Math.round(n / 2);
    log(G, deaf ? `${a.name} canta. Você quase não ouve. Ainda bem.` : `${a.name} canta. Suas pernas querem andar para a água.`, 'dread');
    dreadHero(G, n, a.name);
    if (!deaf && h && rollPct(known ? 15 : 35)) addStatus(G, h, 'aterrorizado', { turns: 2 });
    return true;
  },
  dividir(G, a) {
    const s = summon(G, a, a.def, { delay: 40 });
    s.hp = Math.round(s.hpMax * 0.5);
    if (s.parts.tronco) s.parts.tronco.hp = Math.round(s.parts.tronco.max * 0.5);
    s.flags.used = { dividir: true };
    log(G, `${a.name} se rasga em dois. Os dois vêm.`, 'bad');
    return true;
  },
});

Object.assign(AFTER_ATTACK, {
  charge(G, a) { if (a.dist > 0) { a.dist = 0; log(G, `${a.name} termina a investida colado em você.`, 'warn'); emitEv(G, { type: 'move', target: a.uid }); } },
  shove_after(G, a) { if (a.dist === 0 && rollPct(50)) { a.dist = 1; log(G, `O coice te joga para trás.`, 'bad'); } },
});
