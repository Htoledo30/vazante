// Tela de combate: HUD, Tábua de Marés, tabuleiro, painel de informação e barra de ações.
import { h, clear, toast, openSheet, confirmBox } from './dom.js';
import { BoardView } from './board.js';
import { sfx, vibrate } from './audio.js';
import { REG } from '../combat/registry.js';
import { key, DIRS } from '../core/util.js';
import { getHero, tileAt, depth, unitAt, defOf, hasTag } from '../combat/engine.js';
import {
  heroReach, heroMove, canUseSkill, useSkill, canUseItem, useItem, defend, endTurn, canUndo, undoMove,
  preview, forecastList, skillLevel, isQuick, skillCost,
} from '../combat/flow.js';
import { describeIntent, elName } from '../combat/attacks.js';
import { TIDE_NAMES } from '../data/maps.js';

const CONTEXT_SKILLS = ['free_captive', 'ending_concha', 'ending_versos'];

export class CombatUI {
  constructor(app) {
    this.app = app;
    this.mode = 'idle';
    this.sel = null; // id da unidade inspecionada
    this.pending = null; // { kind:'skill'|'item', id, idx, targets, tgt, preview }
    this.busy = false;
    this.endArmed = false;
    this.root = null;
  }

  get c() { return this.app.run.combat; }

  mount(container) {
    this.mountedC = this.c;
    clear(container);
    this.root = h('div', { class: 'combat screen' });
    this.hud = h('div', { class: 'chud' });
    this.tide = h('div', { class: 'tide' });
    this.cv = h('canvas', { class: 'board', 'aria-label': 'Tabuleiro de combate' });
    this.boardWrap = h('div', { class: 'boardwrap' }, this.cv);
    this.info = h('div', { class: 'info' });
    this.actions = h('div', { class: 'actions' });
    this.root.append(this.hud, this.tide, this.boardWrap, this.info, this.actions);
    container.appendChild(this.root);
    this.board = new BoardView(this.cv);
    this.board.speed = this.app.settings.speed || 1;
    this.board.setState(this.c);
    this.layout();
    this.cv.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.board.start();
    this.refresh();
    this.introHints();
  }

  unmount() { if (this.board) this.board.stop(); }

  layout() {
    const vv = window.visualViewport;
    const W = (vv ? vv.width : window.innerWidth);
    const Hh = (vv ? vv.height : window.innerHeight);
    const cs = getComputedStyle(document.documentElement);
    const safeT = parseFloat(cs.getPropertyValue('--safe-t')) || 0;
    const safeB = parseFloat(cs.getPropertyValue('--safe-b')) || 0;
    const reserved = 44 + 40 + 60 + 118 + 18 + safeT + safeB;
    const T = Math.max(30, Math.floor(Math.min((W - 10) / 7, (Hh - reserved) / 8)));
    this.board.resize(T);
  }

  // ---------- HUD ----------
  refresh() {
    const c = this.c;
    if (!c) return;
    const hero = getHero(c) || c.units.find((u) => u.side === 'player');
    // HUD
    clear(this.hud);
    const hpPct = Math.max(0, (hero.hp / hero.maxHp) * 100);
    const pips = [];
    for (let i = 0; i < hero.folMax; i++) pips.push(h('i', { class: i < hero.fol ? 'on' : '' }));
    this.hud.append(
      h('button', { class: 'btn icon ghost', 'aria-label': 'Menu', onTap: () => this.app.pauseMenu() }, '☰'),
      h('div', { class: 'hpbox' },
        h('div', { class: 'hpline' },
          h('span', null, `❤ ${Math.max(0, hero.hp)}/${hero.maxHp}`, hero.st.shield ? h('span', { class: 'gold' }, `  🛡${hero.st.shield}`) : null),
          h('span', { class: 'muted' }, `🫁 ${hero.fol}/${hero.folMax}`)),
        h('div', { class: 'bar' }, h('i', { style: { width: hpPct + '%' } })),
        h('div', { class: 'folpips' }, pips)),
      h('div', { class: 'pill', style: { flexDirection: 'column', gap: '0', padding: '2px 8px' } },
        h('span', { class: 'tiny muted' }, `Rodada ${c.round}`),
        h('span', { class: 'small gold' }, `⚪ ${this.app.run.pearls + (c.reward.pearls || 0)}`)),
      h('button', { class: 'btn icon ghost', 'aria-label': 'Ajuda', onTap: () => this.app.openHelp('combate') }, '?'),
    );
    // Tábua de marés
    clear(this.tide);
    const n = Math.min(7, c.forecast || 3);
    const fl = forecastList(c, n);
    const waves = (c.obj.waves || []).map((w) => w.round);
    if (c.obj.wavePool && waves.length) {
      const last = Math.max(...waves);
      for (let r = last + 3; r <= c.round + 8; r += 3) waves.push(r);
    }
    this.tide.append(h('div', { class: 'lbl' }, h('b', null, 'MARÉ'), h('span', null, c.tideName && TIDE_NAMES[c.tideName] ? TIDE_NAMES[c.tideName] : (c.tideName || ''))));
    fl.forEach((lv, i) => {
      const r = c.round + i;
      const cell = h('div', { class: 'cell' + (i === 0 ? ' now' : ''), role: 'button', 'aria-label': `Rodada ${r}: maré ${lv}` },
        h('div', { class: 'w', style: { height: (lv / 4) * 100 + '%' } }),
        h('span', { class: 'r' }, i === 0 ? 'agora' : 'R' + r),
        waves.includes(r) ? h('span', { class: 'wv' }, '⚠') : null,
        c.obj.type === 'survive' && r === c.obj.rounds ? h('span', { class: 'wv' }, '🏁') : null,
        h('span', { class: 'n' }, lv));
      cell.addEventListener('click', () => {
        sfx('tap');
        this.board.ghostTide = this.board.ghostTide === lv && this.ghostIdx === i ? null : lv;
        this.ghostIdx = this.board.ghostTide == null ? null : i;
        if (this.board.ghostTide != null) this.setInfo([h('b', null, `Prévia da maré na rodada ${r}: nível ${lv}. `), `Casas com elevação menor que ${lv} ficam alagadas (rasa); menor que ${lv - 1}, funda. Toque de novo para esconder.`]);
        else this.defaultInfo();
      });
      this.tide.appendChild(cell);
    });
    this.renderActions();
    this.updateOverlay();
    if (!this.pending && !this.sel) this.defaultInfo();
  }

  objectiveText() {
    const c = this.c;
    const o = c.obj;
    if (o.type === 'survive') return `Sobreviva até o fim da rodada ${o.rounds} (ou derrote todos).`;
    if (o.type === 'escape') return 'Alcance a saída marcada.';
    if (o.type === 'boss') return o.concha || o.versos ? 'Derrote o guardião… ou encontre outro caminho.' : 'Derrote o guardião.';
    if (o.rescue) return o.rescued ? `${o.rescueName} está livre! Derrote os inimigos.` : `Liberte ${o.rescueName} (fique ao lado e use 🔓) e derrote os inimigos.`;
    if (o.treasure) return 'Derrote todos. Baús 💰 no campo: pise neles para abrir.';
    return 'Derrote todos os inimigos.';
  }

  defaultInfo() {
    const c = this.c;
    if (!c) return;
    const t = c.turn;
    const parts = [];
    if (c.phase !== 'player') parts.push(h('b', null, 'Turno inimigo…'));
    else {
      parts.push(h('b', null, 'Seu turno. '));
      parts.push(`${t.moved ? '✓ moveu' : '👣 pode mover'} · ${t.acted ? '✓ agiu' : '⚔ pode agir'}. `);
    }
    parts.push(h('br'), h('span', { class: 'muted' }, this.objectiveText()));
    this.setInfo(parts);
  }

  setInfo(parts) { clear(this.info); this.info.append(...(Array.isArray(parts) ? parts : [parts])); }
  flashInfo(text) { this.setInfo([h('b', null, text)]); }

  banner(text) {
    const b = h('div', { class: 'banner' }, text);
    this.boardWrap.appendChild(b);
    setTimeout(() => b.remove(), 1200);
  }

  // ---------- ações ----------
  heroSkills() {
    const hero = getHero(this.c);
    if (!hero) return [];
    const list = hero.basics.map((id) => ({ id, basic: true }));
    for (const s of hero.skills) list.push({ id: s.id, lv: s.lv });
    for (const id of CONTEXT_SKILLS) {
      const d = REG.skills[id];
      const r = d.available(this.c, hero, 1);
      if (r === true) list.push({ id, ctx: true });
    }
    return list;
  }

  renderActions() {
    const c = this.c;
    clear(this.actions);
    const hero = getHero(c);
    if (!hero) return;
    const row1 = h('div', { class: 'actrow' });
    for (const s of this.heroSkills()) {
      const def = REG.skills[s.id];
      const chk = canUseSkill(c, s.id);
      const lv = s.lv || 1;
      const cost = skillCost(hero, def, lv);
      const on = this.pending && this.pending.kind === 'skill' && this.pending.id === s.id;
      const b = h('button', { class: 'act' + (on ? ' on' : '') + (chk.ok ? '' : ' off'), 'aria-label': def.name },
        h('span', { class: 'i' }, def.icon || '•'),
        h('span', { class: 't' }, shortName(def.name) + (lv > 1 ? '+' : '')),
        cost > 0 ? h('span', { class: 'c' }, cost + '🫁') : null,
        isQuick(def, lv) ? h('span', { class: 'q' }, '⚡') : null);
      b.addEventListener('click', () => this.onSkill(s.id, chk));
      row1.appendChild(b);
    }
    const row2 = h('div', { class: 'actrow' });
    const itemsBtn = h('button', { class: 'act' + (hero.items.length ? '' : ' off') }, h('span', { class: 'i' }, '🎒'), h('span', { class: 't' }, `Itens (${hero.items.length})`));
    itemsBtn.addEventListener('click', () => this.openItems());
    const defBtn = h('button', { class: 'act' + (c.phase === 'player' && !c.turn.acted ? '' : ' off') }, h('span', { class: 'i' }, '🛡'), h('span', { class: 't' }, 'Defender'));
    defBtn.addEventListener('click', () => this.onDefend());
    const undoBtn = h('button', { class: 'act' + (canUndo(c) ? '' : ' off') }, h('span', { class: 'i' }, '↩'), h('span', { class: 't' }, 'Desfazer'));
    undoBtn.addEventListener('click', () => this.onUndo());
    const endBtn = h('button', { class: 'act end' + (this.endArmed ? ' arm' : '') + (c.phase === 'player' ? '' : ' off'), style: { flex: '1.6' } },
      h('span', { class: 'i' }, this.endArmed ? '❓' : '⏭'), h('span', { class: 't' }, this.endArmed ? 'Confirmar fim' : 'Fim do turno'));
    endBtn.addEventListener('click', () => this.onEnd());
    row2.append(itemsBtn, defBtn, undoBtn, endBtn);
    this.actions.append(row1, row2);
  }

  onSkill(id, chk) {
    if (this.busy) return;
    sfx('tap');
    const def = REG.skills[id];
    const hero = getHero(this.c);
    const lv = skillLevel(hero, id);
    if (this.pending && this.pending.kind === 'skill' && this.pending.id === id) {
      if (this.pending.tgt) { this.execute(); return; }
      this.cancel();
      return;
    }
    if (!chk.ok) {
      this.setInfo([h('b', null, `${def.icon} ${def.name}: `), h('span', { class: 'bad' }, chk.why + '. '), h('br'), h('span', { class: 'muted' }, def.desc(lv, hero))]);
      sfx('error');
      return;
    }
    this.pending = { kind: 'skill', id, targets: chk.targets, tgt: null, preview: null, lv };
    this.sel = null;
    if (chk.targets.length === 1) this.pickTarget(chk.targets[0]);
    else this.showPendingInfo();
    this.renderActions();
    this.updateOverlay();
    this.app.hint('target', 'Escolha um alvo destacado em amarelo. Você verá uma PRÉVIA do resultado. Toque no mesmo alvo de novo (ou no botão da habilidade) para confirmar.');
  }

  showPendingInfo() {
    const p = this.pending;
    const hero = getHero(this.c);
    if (!p) return;
    let name, desc;
    if (p.kind === 'skill') { const d = REG.skills[p.id]; name = `${d.icon} ${d.name}`; desc = d.desc(p.lv, hero); }
    else { const d = REG.items[p.itemId]; name = `${d.icon} ${d.name}`; desc = d.desc; }
    const parts = [h('b', null, name + ': '), desc];
    if (p.preview) {
      const pv = p.preview;
      const hitE = pv.units.filter((u) => u.side === 'enemy' && (u.dmg > 0 || u.dead)).length;
      const kills = pv.units.filter((u) => u.side === 'enemy' && u.dead).length;
      const selfDmg = pv.units.filter((u) => u.side === 'player').reduce((s, u) => s + (u.dmg || 0), 0);
      parts.push(h('br'), h('span', { class: 'confirm' }, `Prévia: ${hitE} inimigo(s) atingido(s)${kills ? `, ${kills} derrotado(s)` : ''}${selfDmg > 0 ? `, VOCÊ sofre ${selfDmg}` : ''}${pv.win ? ' — VITÓRIA' : ''}. Toque de novo para confirmar.`));
    } else parts.push(h('br'), h('span', { class: 'muted' }, 'Toque em um alvo amarelo.'));
    this.setInfo(parts);
  }

  pickTarget(t) {
    const p = this.pending;
    p.tgt = { x: t.x, y: t.y };
    const c = this.c;
    if (p.kind === 'skill') p.preview = preview(c, (cc) => useSkill(cc, p.id, t.x, t.y));
    else p.preview = preview(c, (cc) => useItem(cc, p.idx, t.x, t.y));
    this.showPendingInfo();
    this.updateOverlay();
  }

  cancel() {
    this.pending = null;
    this.renderActions();
    this.updateOverlay();
    this.defaultInfo();
  }

  async execute() {
    const p = this.pending;
    if (!p || !p.tgt || this.busy) return;
    const c = this.c;
    let ok;
    if (p.kind === 'skill') ok = useSkill(c, p.id, p.tgt.x, p.tgt.y);
    else ok = useItem(c, p.idx, p.tgt.x, p.tgt.y);
    this.pending = null;
    if (!ok) { toast('Ação inválida.'); this.refresh(); return; }
    this.endArmed = false;
    await this.animate();
    this.afterAction();
  }

  openItems() {
    if (this.busy) return;
    const c = this.c;
    const hero = getHero(c);
    if (!hero.items.length) { toast('Sem consumíveis. Encontre ou compre no caminho.'); return; }
    const close = openSheet({
      title: '🎒 Consumíveis',
      body: () => h('div', null,
        h('p', { class: 'muted small' }, '⚡ = rápido (não gasta a ação do turno).'),
        ...hero.items.map((id, idx) => {
          const d = REG.items[id];
          const chk = canUseItem(c, idx);
          return h('div', { class: 'card' },
            h('div', { class: 'title' }, h('span', { class: 'ico' }, d.icon), d.name, d.quick ? h('span', { class: 'tag' }, '⚡ rápido') : null),
            h('div', { class: 'desc' }, d.desc),
            h('div', { class: 'row', style: { marginTop: '8px' } },
              h('button', { class: 'btn small ' + (chk.ok ? 'primary' : ''), disabled: !chk.ok, onTap: () => { close(); this.startItem(idx, chk); } }, chk.ok ? 'Usar' : chk.why)));
        })),
    });
  }

  startItem(idx, chk) {
    const hero = getHero(this.c);
    this.pending = { kind: 'item', idx, itemId: hero.items[idx], targets: chk.targets, tgt: null };
    if (chk.targets.length === 1) this.pickTarget(chk.targets[0]);
    else this.showPendingInfo();
    this.updateOverlay();
  }

  async onDefend() {
    if (this.busy) return;
    const c = this.c;
    if (c.turn.acted || c.phase !== 'player') { sfx('error'); return; }
    defend(c);
    this.pending = null;
    await this.animate();
    this.afterAction();
  }

  onUndo() {
    if (this.busy) return;
    const c = this.c;
    if (!canUndo(c)) { toast('Só dá para desfazer o movimento antes de agir.'); sfx('error'); return; }
    const restored = undoMove(c);
    this.app.run.combat = restored;
    this.mountedC = restored;
    this.board.setState(restored);
    this.pending = null;
    this.sel = null;
    this.app.save();
    this.refresh();
  }

  async onEnd() {
    if (this.busy) return;
    const c = this.c;
    if (c.phase !== 'player') return;
    sfx('tap');
    const unused = !c.turn.acted || !c.turn.moved;
    if (this.app.settings.confirmEnd && unused && !this.endArmed) {
      this.endArmed = true;
      this.renderActions();
      this.setInfo([h('b', null, 'Encerrar o turno? '), `Você ainda ${!c.turn.moved ? 'pode se mover' : ''}${!c.turn.moved && !c.turn.acted ? ' e ' : ''}${!c.turn.acted ? 'pode agir (Defender dá Escudo)' : ''}. Toque de novo para confirmar.`]);
      clearTimeout(this.armTimer);
      this.armTimer = setTimeout(() => { this.endArmed = false; if (!this.busy) { this.renderActions(); this.defaultInfo(); } }, 3500);
      return;
    }
    this.endArmed = false;
    this.pending = null;
    this.sel = null;
    this.board.ghostTide = null;
    endTurn(c);
    this.banner('Turno inimigo');
    await this.animate();
    this.afterAction();
    if (this.c && this.c.phase === 'player') {
      this.banner('Seu turno');
      this.app.contextHints(this.c);
    }
  }

  async animate() {
    this.busy = true;
    const c = this.c;
    const evs = c.ev.slice();
    c.ev = [];
    this.updateOverlay();
    this.renderActions();
    try { await this.board.play(evs, this); } catch (e) { console.error(e); this.board.sync(); }
    this.busy = false;
  }

  afterAction() {
    const c = this.c;
    this.app.save();
    if (c.phase === 'win' || c.phase === 'lose') {
      this.board.sync();
      this.updateOverlay();
      setTimeout(() => this.app.combatOver(), 450);
      return;
    }
    this.refresh();
  }

  // ---------- toque no tabuleiro ----------
  onPointer(e) {
    e.preventDefault();
    if (this.busy) return;
    const r = this.cv.getBoundingClientRect();
    const t = this.board.tileAtPoint(e.clientX - r.left, e.clientY - r.top);
    if (!t) return;
    const c = this.c;
    const p = this.pending;
    if (p) {
      const valid = p.targets.find((q) => q.x === t.x && q.y === t.y);
      if (valid) {
        if (p.tgt && p.tgt.x === t.x && p.tgt.y === t.y) { this.execute(); return; }
        sfx('tap');
        this.pickTarget(valid);
        return;
      }
      this.pending = null;
      this.renderActions();
    }
    const u = unitAt(c, t.x, t.y);
    const hero = getHero(c);
    if (c.phase === 'player' && !c.turn.moved && hero && !(u && u !== hero)) {
      const reach = heroReach(c);
      if (reach.has(key(t.x, t.y)) && !(t.x === hero.x && t.y === hero.y)) {
        this.doMove(t.x, t.y);
        return;
      }
    }
    if (u) {
      sfx('tap');
      this.sel = this.sel === u.id && u.side !== 'player' ? null : u.id;
      if (this.sel) this.inspectUnit(u); else this.defaultInfo();
      this.updateOverlay();
      return;
    }
    this.sel = null;
    this.inspectTile(t.x, t.y);
    this.updateOverlay();
  }

  async doMove(x, y) {
    const c = this.c;
    if (!heroMove(c, x, y)) return;
    this.sel = null;
    await this.animate();
    this.afterAction();
    this.app.contextHints(this.c);
  }

  inspectUnit(u) {
    const c = this.c;
    const parts = [];
    if (u.side === 'player') {
      parts.push(h('b', null, `${u.name} — ${REG.classes[u.cls].name}`), ` ❤${u.hp}/${u.maxHp} 🫁${u.fol}/${u.folMax} · Mov ${u.move}${u.armor ? ` · Arm ${u.armor}` : ''}`);
      const st = Object.keys(u.st).map((s) => REG.statuses[s] ? `${REG.statuses[s].icon}${REG.statuses[s].name}` : '').filter(Boolean);
      if (st.length) parts.push(h('br'), st.join(' · '));
      parts.push(h('br'), h('span', { class: 'muted' }, 'Toque em ☰ → Ficha para ver habilidades e relíquias.'));
    } else if (u.captive) {
      parts.push(h('b', null, `🆘 ${u.name}`), ` ❤${u.hp}/${u.maxHp}. Fique ao lado e use 🔓 Libertar.`);
    } else {
      const d = defOf(u);
      const kn = (c.knowledge || {})[u.def] || 0;
      parts.push(h('b', null, `${u.name}`), ` ❤${u.hp}/${u.maxHp}${u.armor ? ` · Arm ${u.armor}` : ''} · Mov ${u.move}${kn >= 2 ? ' · 📖 Estudado (+1 dano seu)' : ''}`);
      const tags = (u.tags || []).filter((t) => TAG_NAMES[t]).map((t) => TAG_NAMES[t]);
      const st = Object.keys(u.st).map((s) => REG.statuses[s] ? `${REG.statuses[s].icon}${REG.statuses[s].name}${s === 'shield' ? ' ' + u.st[s] : ''}` : '').filter(Boolean);
      if (tags.length || st.length) parts.push(h('br'), h('span', { class: 'small' }, [...tags, ...st].join(' · ')));
      const inked = tileAt(c, u.x, u.y).ink > 0;
      parts.push(h('br'), h('span', { class: 'gold small' }, inked ? '🦑 Intenção oculta pela tinta.' : `${u.intent ? u.intent.order + 'º · ' : ''}${describeIntent(c, u)}`));
      parts.push(h('br'), h('span', { class: 'muted small' }, d.desc));
    }
    this.setInfo(parts);
  }

  inspectTile(x, y) {
    const c = this.c;
    const t = tileAt(c, x, y);
    const dep = depth(c, x, y);
    const parts = [h('b', null, terrainName(t)), ` · elevação ${t.e}`];
    if (dep > 0) parts.push(dep >= 2 ? ' · 🌊 água FUNDA (drena Fôlego, afunda pesados)' : ' · 💧 água rasa (custa 2 de movimento)');
    if (t.fire) parts.push(` · 🔥 em chamas (${t.fire})`);
    if (t.oil) parts.push(' · 🛢 óleo (inflamável, flutua)');
    if (t.obj) parts.push(' · ' + objName(t.obj));
    if (t.loot) parts.push(' · 💰 pise para pegar');
    if (t.ink) parts.push(' · 🦑 tinta (esconde intenções)');
    if ((c.incoming || []).some((s) => s.x === x && s.y === y)) parts.push(h('br'), h('span', { class: 'gold' }, '⚠ Reforço chega aqui na próxima rodada. Ficar em cima bloqueia (você leva 1).'));
    this.setInfo(parts);
  }

  updateOverlay() {
    const c = this.c;
    if (!c || !this.board) return;
    const ov = { selected: this.sel, showThreat: true };
    if (this.pending) {
      ov.targets = this.pending.targets;
      ov.tgt = this.pending.tgt;
      ov.preview = this.pending.preview;
    } else if (c.phase === 'player' && !c.turn.moved && !this.busy) {
      ov.reach = [...heroReach(c).values()].filter((n) => n.cost > 0);
    }
    this.board.setOverlay(ov);
  }

  introHints() {
    const c = this.c;
    if (c.tutorial) {
      this.app.hint('t_move', 'Bem-vinda à praia! As casas azuis mostram onde você pode se mover. Toque numa delas para andar (dá para Desfazer antes de agir).');
    }
    this.app.contextHints(c);
  }
}

const TAG_NAMES = {
  heavy: '⚓ Pesado (afunda em água funda)', aquatic: '🐟 Aquático', waterOnly: '💧 Só na água', flying: '🪽 Voa', revive: '♻ Ergue-se na água',
  carapace: '🦀 Carapaça', spiky: '✴ Espinhoso', stinging: '⚡ Urticante', immobile: '📌 Imóvel', boss: '👁 Guardião', drowned: '🌊 Afogado (não se afoga)',
};

function shortName(n) {
  const s = n.replace(/^(Arremessar|Golpe de|Facho de|Estocada de|Canto da|Canto do) /, '');
  return s.length > 11 ? s.slice(0, 10) + '…' : s;
}

function terrainName(t) {
  if (t.t === 'wall') return '🧱 Parede';
  if (t.t === 'pit') return '🕳 Ralo (quem cair é tragado)';
  if (t.t === 'coral') return `🪸 Coral (${t.hp || 2} de resistência; colidir fere +1)`;
  if (t.t === 'kelp') return '🌿 Algas (param o movimento)';
  return t.e >= 2 ? '⛰ Terreno alto' : t.e === 1 ? '🧱 Rua' : '〰 Terreno baixo';
}

function objName(o) {
  return {
    barrel: '🛢 Barril de óleo (explode ao ser atingido)', bell: o.big ? '🔔 Sino grande (golpeie para atordoar ao redor)' : '🔔 Sino (golpeie: atordoa vizinhos)',
    crate: '📦 Caixote (pode ter pérolas)', chain: '⛓ Corrente da Carranca', statue: '🗿 Estátua', beacon: '🗼 Farol portátil',
  }[o.k] || o.k;
}
