// Aplicação: estado global, navegação entre telas, salvamento, dicas e ciclo de vida no iPhone.
import { h, clear, toast, openSheet, closeAllSheets, sheetOpen } from './dom.js';
import { saveGame, loadGame, loadSettings, saveSettings, saveError } from '../core/save.js';
import { newMeta, migrateMeta } from '../run/meta.js';
import { finishCombat } from '../run/run.js';
import { CombatUI } from './combatui.js';
import { unlockAudio, configureAudio, playAmbient, stopAmbient, suspendAudio, resumeAudio, sfx } from './audio.js';
import * as S from './screens.js';
import { isWater, isDeep, getHero, liveEnemies, hasTag } from '../combat/engine.js';

export class App {
  constructor() {
    this.el = document.getElementById('app');
    this.meta = null;
    this.run = null;
    this.settings = loadSettings();
    this.view = 'title';
    this.combatUI = null;
    this.param = null;
  }

  boot() {
    const d = loadGame();
    if (d) {
      this.meta = migrateMeta(d.meta);
      this.run = d.run || null;
      if (d.recovered) setTimeout(() => toast('Save principal danificado: recuperamos a cópia de segurança.', 4000), 600);
      if (this.run && this.run.screen === 'combat' && !this.run.combat) this.run.screen = 'map';
    }
    configureAudio(this.settings);
    const unlock = () => { unlockAudio(); this.ambient(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.save(); suspendAudio(); if (this.combatUI && this.combatUI.board) this.combatUI.board.stop(); }
      else { resumeAudio(); if (this.combatUI && this.combatUI.board) { this.combatUI.layout(); this.combatUI.board.start(); } }
    });
    window.addEventListener('pagehide', () => this.save());
    const onResize = () => {
      clearTimeout(this.rz);
      this.rz = setTimeout(() => {
        if (this.combatUI && this.view === 'run' && this.run && this.run.screen === 'combat') { this.combatUI.layout(); this.combatUI.board.draw(); }
      }, 120);
    };
    window.addEventListener('resize', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    this.render();
  }

  save() {
    if (!this.meta) return;
    const ok = saveGame(this.meta, this.run);
    if (!ok && !this.saveWarned) { this.saveWarned = true; toast(saveError() || 'Falha ao salvar.', 4000); }
  }

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    configureAudio(this.settings);
    if (this.combatUI && this.combatUI.board) this.combatUI.board.speed = this.settings.speed || 1;
  }

  go(view, param = null) {
    document.querySelectorAll('.hint').forEach((b) => b.remove());
    this.hintQueue = [];
    this.view = view;
    this.param = param;
    closeAllSheets();
    this.render();
  }

  render() {
    const run = this.run;
    const inCombat = this.view === 'run' && run && run.screen === 'combat' && run.combat;
    if (this.combatUI && !inCombat) { this.combatUI.unmount(); this.combatUI = null; }
    this.el.scrollTop = 0;
    if (inCombat) {
      if (!this.combatUI || this.combatUI.mountedC !== run.combat || !this.combatUI.root || !this.combatUI.root.isConnected) {
        if (this.combatUI) this.combatUI.unmount();
        this.combatUI = new CombatUI(this);
        this.combatUI.mount(this.el);
      } else this.combatUI.refresh();
      this.ambient();
      return;
    }
    clear(this.el);
    let node;
    if (this.view === 'run' && run) node = S.renderRun(this);
    else node = (S.VIEWS[this.view] || S.VIEWS.title)(this, this.param);
    this.el.appendChild(node);
    this.ambient();
  }

  ambient() {
    if (!this.settings.music) { stopAmbient(); return; }
    if (this.view === 'run' && this.run) playAmbient(this.run.district);
    else playAmbient(0);
  }

  // ---------- combate ----------
  combatOver() {
    const run = this.run;
    const c = run.combat;
    if (!c) return;
    const won = c.phase === 'win';
    sfx(won ? 'win' : 'lose');
    if (run.tutorial) {
      finishCombat(run, this.meta);
      this.meta.tutorialDone = true;
      this.run = null;
      this.save();
      this.go('tutorialEnd', { won });
      return;
    }
    finishCombat(run, this.meta);
    this.save();
    this.render();
  }

  pauseMenu() { S.pauseMenu(this); }
  openHelp(topic) { S.openManual(this, topic); }

  // ---------- dicas ----------
  hint(id, text) {
    if (!this.settings.hints || !this.meta) return;
    if (this.meta.hints[id]) return;
    if (document.querySelector('.hint')) return;
    this.meta.hints[id] = 1;
    this.save();
    const box = h('div', { class: 'hint', role: 'note' },
      h('div', null, '💡 ', text),
      h('div', { class: 'hb' }, h('button', { class: 'btn small', onTap: () => { box.remove(); this.nextHint(); } }, 'Entendi')));
    document.body.appendChild(box);
  }

  nextHint() {
    // reavalia o contexto atual em vez de mostrar dicas atrasadas
    if (this.view === 'run' && this.run && this.run.combat && this.combatUI) setTimeout(() => this.contextHints(this.run.combat), 150);
  }

  contextHints(c) {
    if (!c || !this.settings.hints) return;
    const hero = getHero(c);
    if (!hero) return;
    const foes = liveEnemies(c);
    if (foes.some((u) => u.intent)) this.hint('threat', 'Casas VERMELHAS serão atingidas quando você encerrar o turno. O número é o dano e o círculo sobre o inimigo, a ordem. Saia delas — ou empurre o inimigo para mudar o alvo!');
    if (c.tutorial && c.turn.moved && !c.turn.acted) this.hint('t_attack', 'Agora ataque: toque numa habilidade (ex.: Arremessar Arpão) e depois num alvo amarelo. Empurrar inimigos contra paredes causa dano extra e ignora armadura.');
    if (c.tutorial && c.turn.acted) this.hint('t_end', 'Quando terminar, toque em "Fim do turno". Os inimigos agem na ordem numerada e a maré pode subir.');
    if (c.round >= 2 && c.tiles.some((t, i) => isWater(c, i % 7, Math.floor(i / 7)))) this.hint('water', 'A água subiu! Água custa 2 de movimento e deixa Molhado. Veja a Tábua de Marés no topo: ela mostra o nível das próximas rodadas (toque numa rodada para ver o alagamento).');
    if (c.tiles.some((t, i) => isDeep(c, i % 7, Math.floor(i / 7)))) this.hint('deep', 'Água FUNDA (azul-escuro): drena seu Fôlego, afoga inimigos de terra e AFUNDA os pesados na hora. Empurre-os para lá!');
    if (c.tiles.some((t) => t.fire > 0)) this.hint('fire', 'Fogo! Quem estiver em chamas sofre 1 por rodada. A água apaga — mas óleo flutua e queima até sobre ela.');
    if (c.tiles.some((t) => t.obj && t.obj.k === 'barrel')) this.hint('barrel', 'Barris de óleo explodem quando atingidos ou empurrados contra algo: 2 de fogo ao redor.');
    if (c.tiles.some((t) => t.obj && t.obj.k === 'bell')) this.hint('bell', 'Sinos: golpeie um sino (ou empurre algo contra ele) para atordoar todos ao redor — o ataque deles é cancelado.');
    if (foes.some((u) => u.intent && u.intent.windup > 0)) this.hint('windup', 'Contorno LARANJA tracejado: ataque carregando. Ele só dispara na rodada seguinte — tempo de sobra para empurrar o atirador.');
    if (c.incoming && c.incoming.length) this.hint('incoming', 'Os ⚠ no campo são reforços chegando. Parar em cima bloqueia a chegada (você leva 1 de dano).');
    if (hero.fol <= 0) this.hint('nofol', 'Sem Fôlego! Habilidades custam Fôlego, que volta 1 por turno. Golpes básicos e Defender são grátis.');
    if (hero.cs && hero.cs.harpoon) this.hint('harpoon', 'O arpão está fora! Use "Puxar Corda" para trazer o alvo fisgado (e o arpão) — ou pise no arpão caído para recolhê-lo.');
    if (foes.some((u) => hasTag(u, 'boss'))) this.hint('boss', 'Guardião! Toque nele para ler suas regras especiais — cada chefe tem uma fraqueza.');
    if (c.obj.rescue && !c.obj.rescued) this.hint('rescue', 'Um morador está preso! Fique ao lado dele e use 🔓 Libertar. Se ele morrer, o resgate falha.');
    if (foes.some((u) => tileAtInk(c, u))) this.hint('ink', 'Tinta de lula: inimigos dentro dela têm a intenção oculta (?). Cuidado ao chegar perto.');
  }
}

function tileAtInk(c, u) { const t = c.tiles[u.y * 7 + u.x]; return t && t.ink > 0; }

export { sheetOpen, openSheet, newMeta };
