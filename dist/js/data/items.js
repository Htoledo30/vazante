// Consumíveis, trajes e relíquias.
import { register } from '../combat/registry.js';
import { DIRS, DIR8, cheb, manhattan } from '../core/util.js';
import {
  unitAt, tileAt, inB, damage, addStatus, ev, log, heal, ignite, spreadOil, raiseTile, liveEnemies,
  setTide, tideAt, push, isWater, clearStatus,
} from '../combat/engine.js';
import { rangeTargets, selfTarget, lineTargets, projectile, dirOf } from './skilllib.js';

register('items', {
  tonic: {
    name: 'Tônico de Algas', icon: '🧪', quick: true, price: 18, rarity: 1,
    desc: 'Rápido. Cura 5 de vida.',
    targets: selfTarget, apply(c, h) { heal(c, h, 5); },
    outside: (hero) => { hero.hp = Math.min(hero.maxHp, hero.hp + 5); },
  },
  fish: {
    name: 'Peixe Seco', icon: '🐟', quick: true, price: 12, rarity: 1,
    desc: 'Rápido. Cura 3 e remove Veneno, Chamas e Sangramento.',
    targets: selfTarget,
    apply(c, h) { heal(c, h, 3); for (const s of ['poison', 'burn', 'bleed']) clearStatus(c, h, s); },
    outside: (hero) => { hero.hp = Math.min(hero.maxHp, hero.hp + 3); },
  },
  airbubble: {
    name: 'Bolha de Ar', icon: '🫧', quick: true, price: 14, rarity: 1,
    desc: 'Rápido. Recupera 3 de Fôlego.',
    targets: selfTarget, apply(c, h) { h.fol = Math.min(h.folMax, h.fol + 3); ev(c, { t: 'text', x: h.x, y: h.y, s: '+3 Fôlego', col: '#7fd' }); },
  },
  oilbomb: {
    name: 'Bomba de Óleo', icon: '💣', quick: false, price: 20, rarity: 1,
    desc: 'Arremesso (alcance 3): 2 de fogo no centro, espalha óleo em cruz e incendeia.',
    targets: (c, h) => rangeTargets(c, h, 3, () => true, 1),
    apply(c, h, x, y) {
      ev(c, { t: 'fx', k: 'bottle', from: { x: h.x, y: h.y }, to: { x, y } });
      ev(c, { t: 'fx', k: 'boom', x, y });
      for (const p of [{ x, y }, ...DIRS.map((d) => ({ x: x + d.x, y: y + d.y }))]) if (inB(c, p.x, p.y)) spreadOil(c, p.x, p.y);
      const v = unitAt(c, x, y);
      if (v) damage(c, v, 2, { src: h, el: 'fire', area: true });
      ignite(c, x, y, 2);
    },
  },
  eeljar: {
    name: 'Frasco de Enguia', icon: '⚡', quick: false, price: 20, rarity: 1,
    desc: 'Arremesso (alcance 3): 3 de choque no alvo. Na água, o choque se espalha por toda a água conectada — inclusive até você.',
    targets: (c, h) => rangeTargets(c, h, 3, () => true, 1),
    apply(c, h, x, y) {
      ev(c, { t: 'fx', k: 'zap', from: { x: h.x, y: h.y }, to: { x, y } });
      const v = unitAt(c, x, y);
      if (v) damage(c, v, 3, { src: h, el: 'shock' });
      else if (isWater(c, x, y)) chain(c, x, y, h); // choque solto na água: espalha mesmo sem alvo
      else ev(c, { t: 'text', x, y, s: 'Faísca no seco', col: '#ccc' });
    },
  },
  salt: {
    name: 'Sal Grosso', icon: '🧂', quick: true, price: 14, rarity: 1,
    desc: 'Rápido. Eleva em 1 nível um quadrado a até 2 casas (permanente).',
    targets: (c, h) => rangeTargets(c, h, 2, (x, y, u, t) => t.e < 2 && t.t !== 'pit' && !t.obj && t.t !== 'coral', 0),
    apply(c, h, x, y) { raiseTile(c, x, y, 1); },
  },
  handbell: {
    name: 'Sino de Mão', icon: '🔔', quick: false, price: 24, rarity: 2,
    desc: 'Todos os inimigos a até 2 casas (inclusive diagonais) ficam Atordoados.',
    targets: selfTarget,
    apply(c, h) {
      ev(c, { t: 'fx', k: 'ring', x: h.x, y: h.y, r: 2 });
      ev(c, { t: 'sfx', k: 'bell' });
      for (const u of liveEnemies(c)) if (cheb(u, h) <= 2) addStatus(c, u, 'stun', 1);
    },
  },
  anchorthrow: {
    name: 'Âncora Lançável', icon: '⚓', quick: false, price: 18, rarity: 1,
    desc: 'Linha até 4: 2 de dano e empurra o alvo 3 casas.',
    targets: (c, h) => lineTargets(c, h, 4),
    apply(c, h, x, y) {
      const dir = dirOf(h, x, y);
      const pr = projectile(c, h, dir, 4);
      ev(c, { t: 'fx', k: 'harpoon', from: { x: h.x, y: h.y }, to: pr.end || { x, y } });
      if (pr.unit) { damage(c, pr.unit, 2, { src: h }); if (pr.unit.hp > 0) push(c, pr.unit, dir, 3, { src: h }); }
    },
  },
  ebbpearl: {
    name: 'Pérola da Vazante', icon: '⚪', quick: true, price: 22, rarity: 2,
    desc: 'Rápido. A maré baixa 1 nível por 2 rodadas.',
    targets: selfTarget,
    apply(c) { c.tideMods.push({ d: -1, r: 2 }); setTide(c, tideAt(c, c.round)); },
  },
  floodpearl: {
    name: 'Pérola da Enchente', icon: '🔵', quick: true, price: 22, rarity: 2,
    desc: 'Rápido. A maré sobe 1 nível por 2 rodadas.',
    targets: selfTarget,
    apply(c) { c.tideMods.push({ d: 1, r: 2 }); setTide(c, tideAt(c, c.round)); },
  },
});

function chain(c, x, y, h) {
  // dispara o choque a partir do quadrado (sem alvo direto)
  const seen = new Set([x + ',' + y]);
  const q = [{ x, y }];
  const tiles = [];
  while (q.length) {
    const p = q.shift(); tiles.push(p);
    for (const d of DIRS) {
      const nx = p.x + d.x, ny = p.y + d.y, k = nx + ',' + ny;
      if (seen.has(k) || !inB(c, nx, ny) || !isWater(c, nx, ny)) continue;
      seen.add(k); q.push({ x: nx, y: ny });
    }
  }
  ev(c, { t: 'fx', k: 'shock', tiles });
  for (const p of tiles) { const v = unitAt(c, p.x, p.y); if (v) damage(c, v, 3, { src: h, el: 'shock', noChain: true, area: true }); }
}

register('suits', {
  rags: { name: 'Roupa de Pesca', icon: '👕', desc: 'Roupa simples. Nenhum efeito.', mods: {}, price: 0 },
  diving: { name: 'Escafandro de Bronze', icon: '🤿', desc: 'Armadura +1 e água funda não drena Fôlego, mas Movimento −1.', mods: { armor: 1, move: -1, noDrain: 1 }, price: 55 },
  shark: { name: 'Couro de Tubarão', icon: '🦈', desc: 'A água não custa movimento extra para você.', mods: { waterWalk: 1 }, price: 50 },
  saltcloak: { name: 'Manto de Sal', icon: '🧥', desc: 'Imune a Chamas e Veneno.', mods: { noBurn: 1, noPoison: 1 }, price: 50 },
  kelpcape: { name: 'Capa de Algas', icon: '🌿', desc: 'Começa cada combate com 4 de Escudo.', mods: { startShield: 4 }, price: 45 },
  barnacle: { name: 'Gibão de Cracas', icon: '🐚', desc: 'Armadura +1 e quem te golpeia corpo a corpo leva 1. Fôlego máximo −1.', mods: { armor: 1, thorns: 1, fol: -1 }, price: 55 },
  choir: { name: 'Vestes do Coro', icon: '🥻', desc: '+1 Canto e +1 Fôlego máximo.', mods: { can: 1, fol: 1 }, price: 50 },
  rust: { name: 'Couraça de Ferrugem', icon: '🛡', desc: 'Armadura +2, mas Fôlego máximo −2.', mods: { armor: 2, fol: -2 }, price: 60 },
  eelskin: { name: 'Pele de Enguia', icon: '⚡', desc: 'Imune a choque. Seus ataques contra alvos Molhados causam +1.', mods: { noShock: 1, wetPlus: 1 }, price: 55 },
});

register('relics', {
  anchor_charm: { name: 'Âncora de Bolso', icon: '⚓', rarity: 1, desc: 'Colisões que você causa fazem +1 de dano.', mods: { collide: 1 } },
  mermaid_scale: { name: 'Escama de Sereia', icon: '🧜', rarity: 1, desc: 'A água funda não drena seu Fôlego.', mods: { noDrain: 1 } },
  broken_compass: { name: 'Bússola Partida', icon: '🧭', rarity: 1, desc: 'Você enxerga 2 rodadas a mais na Tábua de Marés.', mods: { forecast: 2 } },
  black_pearl: { name: 'Pérola Negra', icon: '⚫', rarity: 1, desc: '+30% de pérolas ganhas em combate.', mods: { pearlBonus: 30 } },
  shark_tooth: { name: 'Dente de Tubarão', icon: '🦷', rarity: 1, desc: 'Seu primeiro golpe físico de cada combate causa +2.', mods: { firstStrike: 2 } },
  amber: { name: 'Âmbar Ardente', icon: '🟠', rarity: 2, desc: 'Inimigos Em Chamas sofrem +1 dos seus ataques.', mods: { burnPlus: 1 } },
  pocket_bell: {
    name: 'Sino de Bolso', icon: '🔔', rarity: 2, desc: 'A cada 3 rodadas, no início do seu turno, inimigos adjacentes ficam Atordoados.',
    onTurnStart(c, h) {
      if (c.round % 3 !== 0) return;
      ev(c, { t: 'fx', k: 'ring', x: h.x, y: h.y, r: 1 });
      for (const u of liveEnemies(c)) if (cheb(u, h) <= 1) addStatus(c, u, 'stun', 1);
    },
  },
  sound_shell: { name: 'Concha Sonora', icon: '🐚', rarity: 1, desc: 'Sempre que a maré muda, você recupera 1 de Fôlego.', onTide(c, h) { h.fol = Math.min(h.folMax, h.fol + 1); } },
  living_coral: { name: 'Coral Vivo', icon: '🪸', rarity: 1, desc: 'Ao derrotar um inimigo, cura 1.', onKill(c, h) { heal(c, h, 1); } },
  whale_lung: { name: 'Pulmão de Baleia', icon: '🐋', rarity: 1, desc: '+2 de Fôlego máximo.', mods: { fol: 2 } },
  sunken_anvil: { name: 'Bigorna Afundada', icon: '🔨', rarity: 1, desc: '+6 de Vida máxima.', mods: { hp: 6 } },
  hermit_shell: { name: 'Concha de Ermitão', icon: '🦀', rarity: 1, desc: '+1 de armadura nos turnos em que você não se move.', mods: { stillArmor: 1 } },
  urchin_spine: { name: 'Espinho de Ouriço', icon: '🦔', rarity: 1, desc: 'Quem te golpeia corpo a corpo sofre 1.', mods: { thorns: 1 } },
  eel_heart: {
    name: 'Coração de Enguia', icon: '💛', rarity: 2, desc: 'Quando você joga um inimigo contra outro, ambos sofrem 1 de choque (que se espalha na água).',
    onCollideUnits(c, h, a, b) { if (a.hp > 0) damage(c, a, 1, { src: h, el: 'shock' }); if (b.hp > 0 && b !== h) damage(c, b, 1, { src: h, el: 'shock' }); },
  },
  hourglass: { name: 'Ampulheta de Areia', icon: '⏳', rarity: 2, desc: 'A maré começa cada combate atrasada em 2 rodadas.', mods: { tideDelay: 2 } },
  stevedore: { name: 'Luva de Estivador', icon: '🧤', rarity: 2, desc: 'Seus empurrões levam o alvo 1 casa mais longe.', mods: { pushPlus: 1 } },
  fish_eye: { name: 'Olho de Peixe', icon: '👁', rarity: 1, desc: 'Seus ataques contra alvos a 3+ casas causam +1.', mods: { farSight: 1 } },
  mercury: { name: 'Gota de Mercúrio', icon: '💧', rarity: 2, desc: 'A primeira habilidade de cada combate não custa Fôlego.', mods: { freeFirstSkill: 1 } },
  live_barnacles: { name: 'Cracas Vivas', icon: '🪨', rarity: 1, desc: 'Começa cada combate com 3 de Escudo.', mods: { startShield: 3 } },
  rosary: { name: 'Rosário de Conchas', icon: '📿', rarity: 1, desc: 'Defender dá +2 de Escudo extra e cura 1.', mods: { defendBonus: 2, defendHeal: 1 } },
  totem: { name: 'Totem do Afogado', icon: '🗿', rarity: 3, desc: 'Uma vez: ao cair, você volta com metade da vida. (Se quebra ao ser usado.)', mods: { revive: 1 }, consumable: true },
  old_map: { name: 'Mapa Antigo', icon: '🗺', rarity: 1, desc: 'Revela o tipo de todos os locais do mapa do distrito.', mods: { revealMap: 1 } },
  medal: { name: 'Medalha do Vazanteiro', icon: '🎖', rarity: 1, desc: '+25% de experiência.', mods: { xpBonus: 25 } },
  lead_boots: { name: 'Botas de Chumbo', icon: '🥾', rarity: 2, desc: 'Você não pode ser empurrado nem puxado. Movimento −1.', mods: { immovable: 1, move: -1 } },
  gull_feather: { name: 'Pena de Gaivota', icon: '🪶', rarity: 2, desc: '+1 de Movimento.', mods: { move: 1 } },
  low_charm: { name: 'Amuleto da Maré Baixa', icon: '🌘', rarity: 2, desc: 'A maré fica 1 nível mais baixa em todos os combates.', mods: { tideShift: -1 } },
  high_charm: { name: 'Amuleto da Maré Alta', icon: '🌒', rarity: 2, desc: 'A maré fica 1 nível mais alta em todos os combates, e seus ataques contra alvos Molhados causam +1.', mods: { tideShift: 1, wetPlus: 1 } },
  bloodstone: { name: 'Pedra-Sangue', icon: '🩸', rarity: 2, desc: 'Com metade da vida ou menos, seus ataques causam +2.', mods: { lowHpPlus: 2 } },
  flint: { name: 'Pederneira', icon: '🪨', rarity: 2, desc: 'Seus golpes corpo a corpo deixam o alvo Em Chamas.', mods: { meleeBurn: 1 } },
  salt_heart: { name: 'Coração de Sal', icon: '🤍', rarity: 3, desc: '+1 de Fôlego por turno.', mods: { folRegen: 1 } },
  drowned_lantern: { name: 'Lampião Afogado', icon: '🏮', rarity: 2, desc: 'Inimigos derrotados por você explodem em óleo (mancha em cruz).', onKill(c, h, u) { for (const p of [{ x: u.x, y: u.y }, ...DIRS.map((d) => ({ x: u.x + d.x, y: u.y + d.y }))]) if (inB(c, p.x, p.y)) spreadOil(c, p.x, p.y); } },
  // Itens de história (não aparecem no saque)
  concha_mae: { name: 'Concha-Mãe', icon: '🐚', rarity: 9, story: true, desc: 'A voz roubada de Aurélia. Pesa como uma promessa.' },
});
