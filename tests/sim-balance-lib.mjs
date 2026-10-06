import * as CB from '../game/js/systems/combat/index.js';
export function smartAct(G) {
  const acts = CB.heroActions(G).filter((a) => !a.disabled);
  const h = CB.heroActor(G);
  const foes = CB.foes(G);
  const by = (id) => acts.find((x) => x.id === id);
  const D = G.hero;
  const threats = foes.filter((f) => f.dist <= (f.intent?.reach ?? 0) && f.intent?.kind === 'attack');
  const charging = foes.find((f) => f.flags.charging && f.dist <= 1);
  if (CB.hasStatus(h, 'caido') && by('levantar')) return { action: 'levantar' };
  if (CB.hasStatus(h, 'agarrado') && by('soltar')) return { action: 'soltar' };
  if (charging) {
    // interrompe se puder, senão defende
    const interr = acts.find((a) => ['chutar', 'empurrar', 'golpe_escudo'].includes(a.id) && CB.targetsFor(G, a.id).find((t) => t.uid === charging.uid && t.valid));
    if (interr) return { action: interr.id, target: charging.uid };
    if (by('esquiva')) return { action: 'esquiva' };
    if (by('guarda')) return { action: 'guarda' };
  }
  if (h.stamina < 3 && by('esperar')) return { action: 'esperar' };
  // executa se possível
  const ex = by('executar');
  if (ex) { const t = CB.targetsFor(G, 'executar').find((t) => t.valid && foes.find((f) => f.uid === t.uid && (CB.hasStatus(f, 'caido') || CB.hasStatus(f, 'atordoado') || f.hp <= f.hpMax * 0.25))); if (t) return { action: 'executar', target: t.uid }; }
  const hpFrac = G.hero.hp / CB.heroActor(G).hpMax;
  if (threats.length >= 2 && hpFrac < 0.5 && by('guarda') && Math.random() < 0.5) return { action: 'guarda' };
  // enxame fraco a um passo: vai até ele
  const sw = foes.find((f) => f.dist === 1 && CB.swarmAlive(f) > 0 && f.hp < 25);
  if (sw && by('avancar') && !foes.some((f) => f.dist === 0 && f.intent?.kind === 'attack' && f.flags.charging)) return { action: 'avancar', target: sw.uid };
  const atk = [...acts.filter((x) => x.kind === 'tech' && x.target === 'part'), by('atacar')].filter(Boolean);
  let best = null;
  for (const a of atk) {
    for (const t of CB.targetsFor(G, a.id).filter((t) => t.valid)) {
      const f = foes.find((x) => x.uid === t.uid);
      for (const p of t.parts) {
        let v = (p.hit / 100) * ((p.est[0] + p.est[1]) / 2) / Math.max(1, a.cost?.stam || 1) ** 0.3;
        if (p.role === 'special' && p.hit >= 40) v *= 1.6;
        if (f && f.hp < f.hpMax * 0.35) v *= 1.3;
        if (!best || v > best.v) best = { v, action: a.id, target: t.uid, part: p.id };
      }
    }
  }
  if (best) return { action: best.action, target: best.target, part: best.part };
  if (by('avancar')) { const t = CB.targetsFor(G, 'avancar').find((t) => t.valid); if (t) return { action: 'avancar', target: t.uid }; }
  return { action: (by('guarda') || acts[0]).id };
}

