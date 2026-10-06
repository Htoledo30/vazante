// ICOR — testes de atributo (Área A).
// chance% = clamp(5, 95, 35 + atributo×8 + bônus − dificuldade). Sempre mostrada ao jogador antes de rolar.
import { R } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { derive } from './character.js';

export const DIFFS = [
  { diff: 0, label: 'Fácil' },
  { diff: 20, label: 'Média' },
  { diff: 40, label: 'Difícil' },
  { diff: 60, label: 'Brutal' },
];

export function diffLabel(diff = 0) {
  let best = DIFFS[0];
  for (const d of DIFFS) if (diff >= d.diff) best = d;
  return best.label;
}

/** Chance (%) de um teste. check = { attr, diff=0, bonus=0 }. */
export function checkChance(G, check = {}) {
  const hero = G?.hero;
  const attr = check.attr || 'for';
  if (!hero) return clamp(35 + 3 * 8 - (check.diff || 0), 5, 95);
  const D = derive(hero);
  const a = D.attrs?.[attr] ?? hero.attrs?.[attr] ?? 3;
  const bonus = (D.checkBonus?.[attr] || 0) + (check.bonus || 0);
  return clamp(Math.round(35 + a * 8 + bonus - (check.diff || 0)), 5, 95);
}

/** Rola o teste. Retorna { ok, roll, chance, crit, fumble }. crit = roll ≤ chance/5; fumble = roll > 95. */
export function rollCheck(G, check = {}) {
  const chance = checkChance(G, check);
  const roll = R.int(1, 100);
  const ok = roll <= chance;
  return { ok, roll, chance, crit: ok && roll <= Math.max(1, Math.floor(chance / 5)), fumble: !ok && roll > 95, attr: check.attr };
}
