// Construção do herói: atributos derivados, modificadores e unidade de combate.
import { REG } from '../combat/registry.js';

export const ATTRS = {
  vig: { name: 'Vigor', icon: '❤', desc: '+2 de Vida máxima por ponto.' },
  imp: { name: 'Ímpeto', icon: '💪', desc: '+1 de dano de colisão a cada 2 pontos. Habilidades marcadas [Ímp] ficam mais fortes.' },
  fol: { name: 'Fôlego', icon: '🫁', desc: '+1 de Fôlego máximo por ponto (energia das habilidades e ar na água funda).' },
  can: { name: 'Canto', icon: '🎵', desc: 'Habilidades [Canto] ficam mais fortes. +1 rodada de previsão da maré a cada 2 pontos.' },
};

const NUM_MODS = ['hp', 'fol', 'move', 'armor', 'can', 'forecast', 'collide', 'firstStrike', 'burnPlus', 'markPlus', 'hookPlus', 'fireDmg', 'fireLong',
  'ambush', 'waterMove', 'stillArmor', 'thorns', 'dmgTakenMinus', 'defendBonus', 'defendHeal', 'folRegen', 'pushPlus', 'farSight', 'wetPlus',
  'lowHpPlus', 'startShield', 'tideDelay', 'tideShift', 'pearlBonus', 'xpBonus', 'imp', 'vig'];

export function collectMods(hero, metaBonus = {}) {
  const m = {};
  const add = (src) => {
    if (!src) return;
    for (const [k, v] of Object.entries(src)) {
      if (NUM_MODS.includes(k)) m[k] = (m[k] || 0) + v;
      else m[k] = m[k] || v;
    }
  };
  add(metaBonus);
  const suit = REG.suits[hero.suit];
  if (suit) add(suit.mods);
  for (const id of hero.relics) { const r = REG.relics[id]; if (r && r.mods) add(r.mods); }
  for (const s of hero.skills) {
    const d = REG.skills[s.id];
    if (d && d.kind === 'passive' && d.mods) add(d.mods(s.lv));
  }
  return m;
}

export function heroStats(hero, metaBonus = {}) {
  const cls = REG.classes[hero.cls];
  const mods = collectMods(hero, metaBonus);
  const attrs = { ...hero.attrs };
  attrs.can += mods.can || 0;
  attrs.imp += mods.imp || 0;
  attrs.vig += mods.vig || 0;
  const maxHp = cls.hp + attrs.vig * 2 + (mods.hp || 0);
  const folMax = Math.max(1, cls.fol + attrs.fol + (mods.fol || 0));
  const move = Math.max(1, cls.move + (mods.move || 0));
  const armor = Math.max(0, (cls.armor || 0) + (mods.armor || 0));
  const forecast = 3 + Math.floor(attrs.can / 2) + (cls.forecast || 0) + (mods.forecast || 0);
  return { maxHp, folMax, move, armor, forecast, attrs, mods };
}

export function makeHeroUnit(hero, metaBonus = {}) {
  const st = heroStats(hero, metaBonus);
  const cls = REG.classes[hero.cls];
  const wpn = REG.weapons[hero.weapon];
  const passives = hero.skills.filter((s) => REG.skills[s.id] && REG.skills[s.id].kind === 'passive').map((s) => s.id);
  const actives = hero.skills.filter((s) => REG.skills[s.id] && REG.skills[s.id].kind === 'active').map((s) => ({ id: s.id, lv: s.lv, cd: 0 }));
  return {
    side: 'player', def: 'hero', name: hero.name, cls: hero.cls, sprite: cls.sprite,
    hp: Math.min(hero.hp, st.maxHp), maxHp: st.maxHp, armor: st.armor, move: st.move,
    fol: st.folMax, folMax: st.folMax, attrs: st.attrs, mods: st.mods,
    st: {}, tags: (cls.tags || []).slice(),
    basics: wpn.basics.slice(), wp: { ...wpn.params }, weapon: hero.weapon,
    skills: actives, passives, relics: hero.relics.slice(), items: hero.items.slice(),
    cs: {}, mem: {},
  };
}

// Escreve de volta no herói da expedição o que mudou durante o combate.
export function writeBackHero(hero, u, c) {
  hero.hp = Math.max(0, u.hp);
  hero.items = u.items.slice();
  if (c.flags.usedRevive) {
    const i = hero.relics.indexOf('totem');
    if (i >= 0) hero.relics.splice(i, 1);
    else hero.flags.reviveUsed = true;
  }
}

export function xpForLevel(lv) {
  // XP total necessário para alcançar o nível lv
  const t = [0, 0, 8, 18, 30, 44, 60, 78, 98, 120, 145, 172, 200, 230, 262, 296];
  return t[Math.min(lv, t.length - 1)] + Math.max(0, lv - 15) * 36;
}
