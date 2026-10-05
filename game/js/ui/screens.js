// Telas fora do combate: título, introdução, vila, cais, mapa, recompensas, eventos, loja, finais.
import { h, clear, toast, openSheet, confirmBox, alertBox, closeAllSheets } from './dom.js';
import { sfx } from './audio.js';
import { spriteDataURL } from './sprites.js';
import { REG } from '../combat/registry.js';
import { MANUAL, INSTALL_HTML } from './help.js';
import { INTRO, NPCS, VILLAGERS, MEMORIES, VERSOS, ENDINGS, BOSS_INTRO, RUMORS } from '../data/story.js';
import { BUILDINGS, UPGRADES, CONTRACTS, HEAT } from '../data/hub.js';
import { eventById, checkReq, reqLabel } from '../data/events.js';
import {
  newRun, DISTRICTS, NODE_INFO, selectable, nodeVisible, enterNode, nodeById, startBossFight, takeReward,
  levelOptions, applyLevel, buy, buyService, sellItem, leaveShop, rest, restHealAmount, resolveEvent, continueEvent,
  descend, endRun, contractProgress, tutorialCombat, allNodes,
} from '../run/run.js';
import { classUnlocked, weaponUnlocked, upgradeAvailable, studyThreshold, newMeta } from '../run/meta.js';
import { heroStats, ATTRS, xpForLevel } from '../run/hero.js';
import { stats, maxHp, upgradableSkills } from '../run/ops.js';
import { exportSave, importSave, wipeSave, hasSave } from '../core/save.js';
import { newSeed } from '../core/rng.js';

const VERSION = '1.0.0';

function screen(app, { title, sub, back, right, body, bottom, cls = '' }) {
  return h('div', { class: 'screen ' + cls },
    h('div', { class: 'topbar' },
      back ? h('button', { class: 'btn icon ghost', 'aria-label': 'Voltar', onTap: back }, '‹') : null,
      h('div', { style: { flex: 1, minWidth: 0 } }, h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null),
      right || null),
    h('div', { class: 'scroll' }, body),
    bottom ? h('div', { class: 'bottombar' }, bottom) : null);
}

const img = (name, size = 48) => h('img', { class: 'unit-portrait', src: spriteDataURL(name, 6), width: size, height: size, alt: '' });

// ======================= TÍTULO =======================
function renderTitle(app) {
  const hasRun = !!app.run;
  const hasMeta = !!app.meta && app.meta.tutorialDone;
  const menu = h('div', { class: 'title-menu' });
  if (hasRun) menu.appendChild(h('button', { class: 'btn primary', onTap: () => app.go('run') }, '▶ Continuar expedição'));
  else if (hasMeta) menu.appendChild(h('button', { class: 'btn primary', onTap: () => app.go('hub') }, '▶ Continuar em Salgema'));
  else if (app.meta && !app.meta.tutorialDone) menu.appendChild(h('button', { class: 'btn primary', onTap: () => startTutorial(app) }, '▶ Continuar'));
  menu.appendChild(h('button', { class: 'btn' + (hasRun || hasMeta ? '' : ' primary'), onTap: async () => {
    if (app.meta && (await confirmBox('Começar um jogo novo apaga todo o progresso atual. Tem certeza?', 'Apagar e começar', true)) === false) return;
    app.meta = null; app.run = null; wipeSave();
    app.go('intro', { step: 0 });
  } }, '✦ Novo jogo'));
  menu.appendChild(h('div', { class: 'row' },
    h('button', { class: 'btn', style: { flex: 1 }, onTap: () => openInstall(app) }, '📲 Instalar'),
    h('button', { class: 'btn', style: { flex: 1 }, onTap: () => openManual(app) }, '📖 Manual'),
    h('button', { class: 'btn', style: { flex: 1 }, onTap: () => openSettings(app) }, '⚙ Opções')));
  return h('div', { class: 'screen title-screen' },
    h('div', { class: 'logo' },
      h('div', { class: 'name' }, 'VAZANTE'),
      h('div', { class: 'tag2' }, 'A Cidade sob a Maré'),
      h('p', { class: 'muted small', style: { maxWidth: '320px', margin: '18px auto 0' } }, 'Todo dia o mar recua e revela Aurélia, a cidade afogada. Desça antes que a maré volte.')),
    wavesSVG(),
    h('div', { style: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' } }, menu, h('div', { class: 'version' }, `v${VERSION} · feito para iPhone · salva automaticamente`)));
}

function wavesSVG() {
  const div = h('div', { class: 'title-waves' });
  div.innerHTML = `<svg viewBox="0 0 400 90" preserveAspectRatio="none" width="100%" height="90">
  <path d="M0 50 Q 50 30 100 50 T 200 50 T 300 50 T 400 50 V90 H0 Z" fill="#163a5a"><animate attributeName="d" dur="6s" repeatCount="indefinite" values="M0 50 Q 50 30 100 50 T 200 50 T 300 50 T 400 50 V90 H0 Z;M0 50 Q 50 70 100 50 T 200 50 T 300 50 T 400 50 V90 H0 Z;M0 50 Q 50 30 100 50 T 200 50 T 300 50 T 400 50 V90 H0 Z"/></path>
  <path d="M0 62 Q 60 48 120 62 T 240 62 T 360 62 T 480 62 V90 H0 Z" fill="#1f5076" opacity=".8"><animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0 62 Q 60 48 120 62 T 240 62 T 360 62 T 480 62 V90 H0 Z;M0 62 Q 60 76 120 62 T 240 62 T 360 62 T 480 62 V90 H0 Z;M0 62 Q 60 48 120 62 T 240 62 T 360 62 T 480 62 V90 H0 Z"/></path>
  <rect x="180" y="18" width="10" height="34" fill="#2a3a4a"/><rect x="176" y="12" width="18" height="8" fill="#e8c170"/>
  <rect x="230" y="28" width="8" height="24" fill="#22303e"/><rect x="140" y="32" width="7" height="20" fill="#22303e"/>
</svg>`;
  return div;
}

// ======================= INTRODUÇÃO =======================
function renderIntro(app, p = { step: 0 }) {
  const step = p.step || 0;
  if (step >= INTRO.length) return renderName(app);
  const panel = INTRO[step];
  const dots = h('div', { class: 'dots' }, INTRO.map((_, i) => h('i', { class: i === step ? 'on' : '' })));
  const next = () => { sfx('page'); app.go('intro', { step: step + 1 }); };
  const el = h('div', { class: 'screen', onclick: next },
    h('div', { class: 'story-panel' },
      h('div', { class: 'art' }, panel.art),
      h('h2', null, panel.title),
      h('p', null, panel.text),
      dots,
      h('p', { class: 'muted small' }, 'Toque para continuar')),
    h('div', { class: 'bottombar' }, h('button', { class: 'btn ghost', onTap: (e) => { e.stopPropagation(); app.go('intro', { step: INTRO.length }); } }, 'Pular')));
  return el;
}

function renderName(app) {
  const input = h('input', { class: 'name', maxlength: 16, value: 'Iara', 'aria-label': 'Nome da vazanteira', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done' });
  const go = () => {
    const name = (input.value || '').trim().slice(0, 16) || 'Iara';
    input.blur();
    app.meta = newMeta(name);
    app.meta.introDone = true;
    app.save();
    startTutorial(app);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
  return h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('div', { class: 'story-panel' },
        h('div', { class: 'art' }, '🔱'),
        h('h2', null, 'Qual é o seu nome?'),
        h('p', null, 'A Avó Zélia te chama pelo nome antes de você descer.'),
        input,
        h('button', { class: 'btn primary block', style: { marginTop: '16px' }, onTap: go }, 'Descer à praia'))));
}

function startTutorial(app) {
  if (!app.meta) app.meta = newMeta();
  app.run = newRun(app.meta, { cls: 'arpoadora', weapon: 'harpoon_iron', start: 1, seed: newSeed() });
  tutorialCombat(app.run, app.meta);
  app.save();
  app.go('run');
}

function renderTutorialEnd(app, p) {
  return screen(app, {
    title: 'A primeira maré',
    body: h('div', { class: 'story-panel' },
      h('div', { class: 'art' }, p && p.won ? '🦀' : '🌊'),
      h('p', null, p && p.won ? 'Os caranguejos fogem para a lama. A Avó Zélia observa do alto do penhasco e acena para você subir.' : 'A maré te arrasta de volta para a areia. A Avó Zélia te ajuda a levantar. "De novo, amanhã. Todos caem na primeira vez."'),
      h('p', { class: 'muted' }, 'Em Salgema você prepara as expedições, gasta Conchas em melhorias e descobre o que está acontecendo com o mar.')),
    bottom: [h('button', { class: 'btn primary', onTap: () => app.go('hub') }, 'Subir para Salgema')],
  });
}

// ======================= VILA =======================
function npcPending(meta, npcId) {
  const npc = NPCS[npcId];
  return npc.story.find((l) => !meta.seenStory.includes(l.id) && l.cond(meta));
}

function renderHub(app) {
  const m = app.meta;
  const zeliaBadge = (npcPending(m, 'zelia') ? 1 : 0) + Math.max(0, m.memoriesFound - m.memoriesGiven);
  const loc = (id, icon, name, desc, badge, onTap, extra) => h('div', { class: 'card tap', onclick: () => { sfx('tap'); onTap(); } },
    h('div', { class: 'loc' }, h('span', { class: 'ico' }, icon),
      h('div', { style: { flex: 1 } }, h('div', { class: 'title' }, name, badge ? h('span', { class: 'badge' }, badge) : null), h('div', { class: 'desc' }, desc)),
      extra || h('span', { class: 'muted' }, '›')));
  const bpend = (b) => { const npc = BUILDINGS[b].npc; return npc && npcPending(m, npc) ? '!' : null; };
  const affordable = (b) => Object.entries(UPGRADES).filter(([id, u]) => u.b === b && upgradeAvailable(m, id, u) === true && m.conchas >= u.cost).length;
  const list = [
    h('div', { class: 'card tap', style: { borderColor: '#e8c170' }, onclick: () => { sfx('tap'); app.go('dock'); } },
      h('div', { class: 'loc' }, h('span', { class: 'ico' }, '⛵'),
        h('div', { style: { flex: 1 } }, h('div', { class: 'title' }, 'Descer à cidade'), h('div', { class: 'desc' }, 'Preparar uma expedição no cais.')),
        h('span', { class: 'gold' }, '›'))),
    loc('zelia', '👵', 'Casa da Avó Zélia', m.hasConcha ? 'A Concha-Mãe está com você.' : 'Histórias, memórias e verdades.', zeliaBadge || null, () => app.go('location', 'zelia')),
    loc('forja', '⚒', BUILDINGS.forja.name, BUILDINGS.forja.desc, bpend('forja') || (affordable('forja') ? '$' : null), () => app.go('location', 'forja')),
    loc('botica', '🌿', BUILDINGS.botica.name, BUILDINGS.botica.desc, bpend('botica') || (affordable('botica') ? '$' : null), () => app.go('location', 'botica')),
    loc('farol', '🗼', BUILDINGS.farol.name, m.upgrades.light_relight ? 'O farol brilha de novo.' : 'Apagado há anos. Reacenda-o (desbloqueia o Faroleiro).', affordable('farol') ? '$' : null, () => app.go('location', 'farol')),
    loc('arquivo', '📜', BUILDINGS.arquivo.name, 'Bestiário, memórias, versos.', bpend('arquivo') || (affordable('arquivo') ? '$' : null), () => app.go('location', 'arquivo')),
    loc('taverna', '🍺', BUILDINGS.taverna.name, BUILDINGS.taverna.desc, bpend('taverna'), () => app.go('location', 'taverna')),
    loc('cais', '🚣', BUILDINGS.cais.name, BUILDINGS.cais.desc, bpend('cais') || (affordable('cais') ? '$' : null), () => app.go('location', 'cais')),
    loc('pedra', '🪨', BUILDINGS.pedra.name, BUILDINGS.pedra.desc, affordable('pedra') ? '$' : null, () => app.go('location', 'pedra')),
    loc('moradores', '🏘', 'Moradores', `${m.rescued.length}/6 resgatados.`, null, () => app.go('location', 'moradores')),
  ];
  const last = m.lastRun ? h('div', { class: 'card' },
    h('div', { class: 'small muted' }, 'Última expedição'),
    h('div', null, `${outcomeLabel(m.lastRun.outcome)} · ${REG.classes[m.lastRun.cls].name} nv ${m.lastRun.lvl} · ${DISTRICTS[m.lastRun.district].name} · +${m.lastRun.conchas} 🐚`)) : null;
  const progress = h('div', { class: 'row wrap', style: { gap: '6px', margin: '4px 0 6px' } },
    h('span', { class: 'pill' }, `📜 Versos ${m.bosses.filter((b) => b !== 'maren').length}/3`),
    h('span', { class: 'pill' }, `✦ Memórias ${m.memoriesFound}/8`),
    h('span', { class: 'pill' }, `🆘 ${m.rescued.length}/6`),
    m.endings.length ? h('span', { class: 'pill' }, `🏁 Finais ${m.endings.length}/3`) : null);
  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('div', { style: { flex: 1 } }, h('h1', null, '🏘 Salgema'), h('div', { class: 'sub' }, `${m.name} · expedições: ${m.runs}`)),
      h('span', { class: 'pill conchas' }, `🐚 ${m.conchas}`),
      h('button', { class: 'btn icon ghost', 'aria-label': 'Menu', onTap: () => hubMenu(app) }, '☰')),
    h('div', { class: 'scroll' }, progress, ...list, last));
}

function outcomeLabel(o) { return { extract: '⬆ Voltou à superfície', death: '🌊 Levada pela maré', ending: '🏁 Final', abandon: '↩ Abandonou' }[o] || o; }

function hubMenu(app) {
  openSheet({
    title: 'Menu',
    body: (close) => h('div', { class: 'btnlist' },
      h('button', { class: 'btn', onTap: () => { close(); openCodex(app); } }, '📜 Códice (bestiário, memórias)'),
      h('button', { class: 'btn', onTap: () => { close(); openManual(app); } }, '📖 Manual'),
      h('button', { class: 'btn', onTap: () => { close(); openSettings(app); } }, '⚙ Opções'),
      h('button', { class: 'btn', onTap: () => { close(); openInstall(app); } }, '📲 Instalar no iPhone'),
      h('button', { class: 'btn ghost', onTap: () => { close(); app.go('title'); } }, '⌂ Tela de título')),
  });
}

// ---------- locais ----------
function npcBlock(app, npcId) {
  const m = app.meta;
  const npc = NPCS[npcId];
  const pending = npcPending(m, npcId);
  let line, isNew = false;
  if (pending) {
    line = pending.text; isNew = true;
    m.seenStory.push(pending.id);
    if (pending.gift === 'concha' && !m.hasConcha) { m.hasConcha = true; setTimeout(() => toast('🐚 Você recebeu a Concha-Mãe.', 3500), 300); }
    app.save();
  } else {
    const told = npc.story.filter((l) => m.seenStory.includes(l.id));
    const pool = [...npc.idle, ...told.slice(-1).map((l) => l.text)];
    line = pool[(m.runs + npcId.length + new Date().getMinutes()) % pool.length];
  }
  return h('div', null,
    h('div', { class: 'row' }, h('span', { style: { fontSize: '34px' } }, npc.icon), h('div', null, h('b', null, npc.name), h('div', { class: 'small muted' }, npc.role))),
    h('div', { class: 'npc-line' + (isNew ? ' new' : '') }, `“${line}”`));
}

function upgradeList(app, building) {
  const m = app.meta;
  const ups = Object.entries(UPGRADES).filter(([, u]) => u.b === building);
  return h('div', null, h('h3', null, 'Melhorias permanentes'),
    ...ups.map(([id, u]) => {
      const av = upgradeAvailable(m, id, u);
      const owned = !!m.upgrades[id];
      const can = av === true && m.conchas >= u.cost;
      return h('div', { class: 'card' + (owned ? ' sel' : av !== true ? ' locked' : '') },
        h('div', { class: 'title' }, owned ? '✓' : '◇', u.name, h('span', { class: 'spacer' }), owned ? h('span', { class: 'good small' }, 'Adquirido') : h('span', { class: 'conchas small' }, `🐚 ${u.cost}`)),
        h('div', { class: 'desc' }, u.desc),
        !owned ? h('div', { style: { marginTop: '8px' } },
          av !== true ? h('div', { class: 'small bad' }, '🔒 ' + av)
            : h('button', { class: 'btn small ' + (can ? 'primary' : ''), disabled: !can, onTap: () => {
              if (!can) return;
              m.conchas -= u.cost; m.upgrades[id] = 1; app.save(); sfx('level');
              toast(`${u.name} adquirido!`);
              app.render();
            } }, can ? 'Comprar' : 'Conchas insuficientes')) : null);
    }));
}

function renderLocation(app, id) {
  const m = app.meta;
  const back = () => app.go('hub');
  let body = [];
  let title = '';
  if (id === 'zelia') {
    title = 'Casa da Avó Zélia';
    body.push(npcBlock(app, 'zelia'));
    const toGive = m.memoriesFound - m.memoriesGiven;
    if (toGive > 0) {
      body.push(h('button', { class: 'btn primary block', onTap: () => {
        const given = MEMORIES.filter((mm) => m.memoryIds.includes(mm.id)).slice(m.memoriesGiven);
        m.memoriesGiven = m.memoriesFound;
        app.save();
        sfx('page');
        alertBox('Memórias de Aurélia', [h('p', { class: 'muted' }, 'Zélia segura cada memória contra a luz e lê em voz baixa:'), ...given.map((g) => h('div', { class: 'npc-line' }, h('b', null, g.title + ': '), g.text))], 'Continuar').then(() => app.render());
      } }, `✦ Entregar ${toGive} memória(s)`));
    }
    body.push(h('h3', null, 'O que você sabe'));
    body.push(h('div', { class: 'small muted' }, `Memórias entregues: ${m.memoriesGiven}/8 · Versos: ${m.bosses.filter((b) => b !== 'maren').length}/3`));
    if (m.hasConcha) body.push(h('div', { class: 'card' }, h('div', { class: 'title' }, '🐚 Concha-Mãe'), h('div', { class: 'desc' }, 'No altar da Catedral, você poderá devolvê-la a Maren.')));
    if (m.memoriesGiven > 0) body.push(h('button', { class: 'btn block', style: { marginTop: '10px' }, onTap: () => openCodex(app, 'memorias') }, 'Reler memórias'));
  } else if (id === 'moradores') {
    title = 'Moradores de Salgema';
    body.push(h('p', { class: 'muted' }, 'Seis moradores desapareceram nas ruas afogadas. Encontre-os nos nós 🆘 do mapa e liberte-os durante o combate.'));
    for (const [vid, v] of Object.entries(VILLAGERS)) {
      const ok = m.rescued.includes(vid);
      body.push(h('div', { class: 'card' + (ok ? '' : ' locked') },
        h('div', { class: 'title' }, h('span', { class: 'ico' }, ok ? v.icon : '❔'), ok ? `${v.name}, ${v.title}` : `Desaparecido (${DISTRICTS[v.district].name})`),
        h('div', { class: 'desc' }, ok ? v.thanks : 'Ainda perdido na cidade.'),
        h('div', { class: 'small ' + (ok ? 'good' : 'muted'), style: { marginTop: '4px' } }, (ok ? '✓ ' : 'Ao resgatar: ') + v.perk)));
    }
  } else {
    const B = BUILDINGS[id];
    title = B.name;
    if (B.npc) body.push(npcBlock(app, B.npc));
    if (id === 'farol' && !m.upgrades.light_relight) body.push(h('p', { class: 'npc-line' }, 'A lente está coberta de sal, o pavio seco. Com 60 Conchas de óleo e vidro, o farol volta a guiar — e alguém aprenderia a lutar com a lanterna.'));
    if (id === 'arquivo') {
      body.push(h('div', { class: 'grid2' },
        h('button', { class: 'btn', onTap: () => openCodex(app, 'bestiario') }, '🐚 Bestiário'),
        h('button', { class: 'btn', onTap: () => openCodex(app, 'memorias') }, '✦ Memórias'),
        h('button', { class: 'btn', onTap: () => openCodex(app, 'versos') }, '📜 Versos e finais'),
        h('button', { class: 'btn', onTap: () => openManual(app) }, '📖 Manual')));
    }
    if (id === 'taverna') {
      body.push(h('h3', null, 'Boatos'));
      const k = m.runs % RUMORS.length;
      for (const r of [RUMORS[k], RUMORS[(k + 5) % RUMORS.length], RUMORS[(k + 9) % RUMORS.length]]) body.push(h('div', { class: 'npc-line' }, `“${r}”`));
      body.push(h('h3', null, 'Contratos'));
      body.push(h('p', { class: 'muted small' }, 'Escolha um contrato no Cais antes de partir. Cumpra-o para ganhar Conchas extras (mesmo se cair, desde que cumprido).'));
      for (const c of Object.values(CONTRACTS)) body.push(h('div', { class: 'kv' }, h('span', null, `${c.name}: ${c.desc}`), h('span', { class: 'conchas' }, `+${c.reward}`)));
    }
    if (UPGRADES && Object.values(UPGRADES).some((u) => u.b === id)) body.push(upgradeList(app, id));
  }
  return screen(app, { title, back, right: h('span', { class: 'pill conchas' }, `🐚 ${m.conchas}`), body });
}

// ======================= CAIS (preparação) =======================
function contractOffer(m) {
  const keys = Object.keys(CONTRACTS);
  const out = [];
  for (let i = 0; i < 3; i++) out.push(keys[(m.runs * 3 + i * 4) % keys.length]);
  return [...new Set(out)];
}

function renderDock(app) {
  const m = app.meta;
  const sel = app.dockSel = app.dockSel || { cls: m.lastClass && classUnlocked(m, m.lastClass) ? m.lastClass : 'arpoadora', weapon: null, contract: null, start: 1, heat: 0 };
  if (!classUnlocked(m, sel.cls)) sel.cls = 'arpoadora';
  const C = REG.classes[sel.cls];
  if (!sel.weapon || REG.weapons[sel.weapon].cls !== sel.cls || !weaponUnlocked(m, sel.weapon)) sel.weapon = m.lastWeapon[sel.cls] && weaponUnlocked(m, m.lastWeapon[sel.cls]) ? m.lastWeapon[sel.cls] : C.weapons[0];
  const body = [];
  body.push(h('h3', null, '1 · Ofício'));
  for (const [cid, cl] of Object.entries(REG.classes)) {
    const ok = classUnlocked(m, cid);
    body.push(h('div', { class: 'card tap' + (sel.cls === cid ? ' sel' : '') + (ok ? '' : ' locked'), onclick: () => { if (!ok) { toast('🔒 ' + cl.unlock); return; } sfx('tap'); sel.cls = cid; sel.weapon = null; app.render(); } },
      h('div', { class: 'title' }, img(cl.sprite, 40), h('div', null, h('div', null, `${cl.icon} ${cl.name}`), h('div', { class: 'small muted' }, ok ? cl.tagline : '🔒 ' + cl.unlock))),
      sel.cls === cid ? h('div', null,
        h('div', { class: 'desc' }, cl.desc),
        h('div', { class: 'small', style: { marginTop: '6px' } }, `❤ ${cl.hp}  🫁 ${cl.fol}  👣 ${cl.move}  ·  Vig ${cl.attrs.vig} · Ímp ${cl.attrs.imp} · Fôl ${cl.attrs.fol} · Can ${cl.attrs.can}`),
        h('div', { class: 'small gold', style: { marginTop: '4px' } }, '💡 ' + cl.style)) : null));
  }
  body.push(h('h3', null, '2 · Arma'));
  for (const wid of C.weapons) {
    const w = REG.weapons[wid];
    const ok = weaponUnlocked(m, wid);
    body.push(h('div', { class: 'card tap' + (sel.weapon === wid ? ' sel' : '') + (ok ? '' : ' locked'), onclick: () => { if (!ok) { toast('🔒 Desbloqueie na Forja da Ilda.'); return; } sfx('tap'); sel.weapon = wid; app.render(); } },
      h('div', { class: 'title' }, w.name, ok ? null : h('span', { class: 'tag' }, '🔒 Forja')),
      h('div', { class: 'desc' }, w.desc),
      h('div', { class: 'small muted' }, 'Básicas: ' + w.basics.map((b) => REG.skills[b].name).join(', '))));
  }
  body.push(h('h3', null, '3 · Contrato (opcional)'));
  if (m.runs < 1) body.push(h('p', { class: 'muted small' }, 'Contratos ficam disponíveis após a primeira expedição.'));
  else {
    const offer = contractOffer(m);
    body.push(h('div', { class: 'card tap' + (!sel.contract ? ' sel' : ''), onclick: () => { sel.contract = null; app.render(); } }, h('div', { class: 'title' }, 'Sem contrato')));
    for (const k of offer) {
      const c = CONTRACTS[k];
      body.push(h('div', { class: 'card tap' + (sel.contract === k ? ' sel' : ''), onclick: () => { sfx('tap'); sel.contract = k; app.render(); } },
        h('div', { class: 'title' }, '📃 ' + c.name, h('span', { class: 'spacer' }), h('span', { class: 'conchas small' }, `+${c.reward} 🐚`)), h('div', { class: 'desc' }, c.desc)));
    }
  }
  const starts = [1];
  if (m.upgrades.dock_r2) starts.push(2);
  if (m.upgrades.dock_r3) starts.push(3);
  if (m.upgrades.dock_r4) starts.push(4);
  if (starts.length > 1) {
    body.push(h('h3', null, '4 · Ponto de partida'));
    body.push(h('div', { class: 'row wrap' }, ...starts.map((s) => h('button', { class: 'btn small' + (sel.start === s ? ' primary' : ''), onTap: () => { sel.start = s; app.render(); } }, `${DISTRICTS[s].icon} ${DISTRICTS[s].short}`))));
    if (sel.start > 1) body.push(h('p', { class: 'small muted' }, 'Atalho: você começa num nível maior, com algumas pérolas e relíquias, mas perde os tesouros dos distritos anteriores.'));
  }
  if (m.heatUnlocked > 0) {
    body.push(h('h3', null, '🌊 Marés Vivas'));
    const opts = [];
    for (let i = 0; i <= m.heatUnlocked; i++) opts.push(i);
    body.push(h('div', { class: 'row wrap' }, ...opts.map((i) => h('button', { class: 'btn small' + (sel.heat === i ? ' primary' : ''), onTap: () => { sel.heat = i; app.render(); } }, i === 0 ? 'Normal' : 'MV ' + i))));
    if (sel.heat > 0) body.push(h('div', { class: 'small' }, ...HEAT.slice(1, sel.heat + 1).map((x) => h('div', { class: 'muted' }, '• ' + x.desc)), h('div', { class: 'gold' }, `Conchas +${sel.heat * 10}%`)));
  }
  return screen(app, {
    title: '⛵ Cais — Preparar expedição', back: () => app.go('hub'), body,
    bottom: [h('button', { class: 'btn primary', onTap: () => {
      m.lastClass = sel.cls; m.lastWeapon[sel.cls] = sel.weapon;
      app.run = newRun(m, { cls: sel.cls, weapon: sel.weapon, start: sel.start, heat: sel.heat, contract: sel.contract });
      app.save();
      sfx('wave');
      app.go('run');
    } }, `Descer: ${DISTRICTS[sel.start].name}`)],
  });
}

// ======================= EXPEDIÇÃO =======================
export function renderRun(app) {
  const run = app.run;
  switch (run.screen) {
    case 'map': return renderMap(app);
    case 'reward': return renderReward(app);
    case 'levelup': return renderLevelUp(app);
    case 'event': return renderEvent(app);
    case 'shop': return renderShop(app);
    case 'rest': return renderRest(app);
    case 'bossintro': return renderBossIntro(app);
    case 'extract': return renderExtract(app);
    case 'dead': return renderDead(app);
    case 'ending': return renderEnding(app);
    default: run.screen = 'map'; return renderMap(app);
  }
}

function runHud(app) {
  const run = app.run;
  const st = stats(run);
  const lvXp = xpForLevel(run.hero.lvl), nxXp = xpForLevel(run.hero.lvl + 1);
  const xpPct = Math.min(100, ((run.hero.xp - lvXp) / Math.max(1, nxXp - lvXp)) * 100);
  const cp = contractProgress(run);
  return h('div', null,
    h('div', { class: 'hudline' },
      h('span', { class: 'pill' }, `❤ ${run.hero.hp}/${st.maxHp}`),
      h('span', { class: 'pill gold' }, `⚪ ${run.pearls}`),
      h('span', { class: 'pill' }, `Nv ${run.hero.lvl}`),
      h('span', { class: 'pill' }, `🎒 ${run.hero.items.length}/${run.hero.slots}`),
      h('span', { class: 'pill' }, `✨ ${run.hero.relics.length}`),
      run.heat ? h('span', { class: 'pill' }, `🌊MV${run.heat}`) : null),
    h('div', { style: { padding: '0 10px' } },
      h('div', { class: 'bar' }, h('i', { style: { width: (run.hero.hp / st.maxHp) * 100 + '%' } })),
      h('div', { class: 'bar xp', style: { height: '5px', marginTop: '3px' } }, h('i', { style: { width: xpPct + '%' } }))),
    cp ? h('div', { class: 'hudline small' }, `📃 ${cp.C.name}: ${cp.v}/${cp.goal}`, cp.done || run.contractDone ? h('span', { class: 'good' }, ' ✓') : null) : null);
}

function renderMap(app) {
  const run = app.run;
  const D = DISTRICTS[run.district];
  const rows = run.map.rows;
  const sel = selectable(run);
  const rowH = 96;
  const W = Math.min(window.innerWidth, 420);
  const height = rows.length * rowH + 40;
  const pos = (n) => ({ x: (0.17 + n.x * 0.33) * W, y: 44 + n.row * rowH });
  const wrap = h('div', { class: 'map-wrap', style: { height: height + 'px', width: W + 'px' } });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'map-svg'); svg.setAttribute('width', W); svg.setAttribute('height', height);
  for (const n of allNodes(run)) {
    for (const lid of n.links) {
      const t = nodeById(run, lid);
      const a = pos(n), b = pos(t);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const active = run.cur === n.id && sel.includes(t.id);
      line.setAttribute('stroke', active ? '#e8c170' : n.done ? '#3f6b8f' : '#284766');
      line.setAttribute('stroke-width', active ? 3 : 2);
      line.setAttribute('stroke-dasharray', active ? '' : '5 5');
      svg.appendChild(line);
    }
  }
  wrap.appendChild(svg);
  for (const n of allNodes(run)) {
    const p = pos(n);
    const vis = nodeVisible(run, n);
    const info = NODE_INFO[n.type];
    const isSel = sel.includes(n.id);
    const el = h('div', {
      class: 'map-node' + (isSel ? ' sel' : '') + (n.done ? ' done' : '') + (run.cur === n.id ? ' cur' : '') + (vis ? '' : ' fog') + (n.type === 'boss' ? ' boss' : ''),
      style: { left: p.x + 'px', top: p.y + 'px' }, role: 'button', 'aria-label': vis ? info.name : 'Desconhecido',
    }, vis ? info.icon : '·', vis ? h('span', { class: 'lbl' }, n.type === 'rescue' && n.villager ? VILLAGERS[n.villager].name : info.name) : null);
    el.addEventListener('click', () => {
      sfx('tap');
      if (!isSel) { toast(vis ? `${info.icon} ${info.name}: ${info.desc}` : 'Ainda na névoa.'); return; }
      openSheet({
        centered: true, title: `${vis ? info.icon + ' ' + info.name : '❔ Desconhecido'}`,
        body: (close) => h('div', null,
          h('p', null, vis ? info.desc : 'A névoa esconde o que há ali.'),
          n.type === 'rescue' && n.villager ? h('p', { class: 'gold' }, `${VILLAGERS[n.villager].name}, ${VILLAGERS[n.villager].title}, está preso aqui. Recompensa: ${VILLAGERS[n.villager].perk}`) : null,
          h('div', { class: 'row', style: { marginTop: '12px' } },
            h('button', { class: 'btn ghost', style: { flex: 1 }, onTap: close }, 'Voltar'),
            h('button', { class: 'btn primary', style: { flex: 1 }, onTap: () => { close(); enterNode(run, app.meta, n.id); app.save(); app.render(); } }, 'Ir'))),
      });
    });
    wrap.appendChild(el);
  }
  const scroll = h('div', { class: 'scroll', style: { padding: '0' } }, wrap);
  const scr = h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('div', { style: { flex: 1 } }, h('h1', null, `${D.icon} ${D.name}`), h('div', { class: 'sub' }, `Distrito ${run.district}/4 · escolha o próximo local`)),
      h('button', { class: 'btn icon ghost', 'aria-label': 'Ficha', onTap: () => openCharacter(app) }, '🧾'),
      h('button', { class: 'btn icon ghost', 'aria-label': 'Menu', onTap: () => pauseMenu(app) }, '☰')),
    runHud(app),
    scroll);
  // rola até o nó atual
  setTimeout(() => {
    const cur = run.cur != null ? nodeById(run, run.cur) : null;
    if (cur) scroll.scrollTop = Math.max(0, pos(cur).y - 120);
  }, 30);
  setTimeout(() => app.hint('map', 'Este é o mapa do distrito. Toque num local dourado para seguir. ☠ Elites dão relíquias, 🫧 Bolsões de Ar curam, ❓ Mistérios trazem escolhas. No fim, o 👁 Guardião.'), 400);
  return scr;
}

function choiceCard(ch, selected, onclick) {
  let icon, name, desc, kind;
  if (ch.type === 'relic') { const r = REG.relics[ch.id]; icon = r.icon; name = r.name; desc = r.desc; kind = 'Relíquia'; }
  else if (ch.type === 'item') { const r = REG.items[ch.id]; icon = r.icon; name = r.name; desc = r.desc; kind = 'Consumível'; }
  else if (ch.type === 'suit') { const r = REG.suits[ch.id]; icon = r.icon; name = r.name; desc = r.desc + ' (substitui o traje atual)'; kind = 'Traje'; }
  return h('div', { class: 'card tap' + (selected ? ' sel' : ''), onclick },
    h('div', { class: 'title' }, h('span', { class: 'ico' }, icon), h('div', null, h('div', null, name), h('div', { class: 'tiny muted' }, kind))),
    h('div', { class: 'desc' }, desc));
}

function renderReward(app) {
  const run = app.run;
  const rw = run.reward;
  if (!rw) { run.screen = 'map'; return renderMap(app); }
  app.rewardSel = app.rewardSel ?? null;
  const body = [];
  if (rw.kind === 'treasure') body.push(h('p', null, rw.text), h('p', { class: 'gold' }, `+${rw.pearls} pérolas`));
  else {
    body.push(h('div', { class: 'center' }, h('div', { style: { fontSize: '48px' } }, rw.kind === 'boss' ? '👑' : '⚔'), h('h2', null, rw.kind === 'boss' ? 'Guardião derrotado!' : 'Vitória!'), h('p', { class: 'muted' }, rw.winMsg || '')));
    body.push(h('div', { class: 'statgrid' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Pérolas'), h('div', { class: 'v gold' }, '+' + rw.pearls)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Experiência'), h('div', { class: 'v' }, '+' + rw.xp)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Rodadas'), h('div', { class: 'v' }, rw.rounds)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Dano sofrido'), h('div', { class: 'v ' + (rw.taken ? '' : 'good') }, rw.taken || 'nenhum'))));
  }
  for (const n of rw.notes || []) body.push(h('div', { class: 'npc-line' }, n));
  if (rw.choices.length) {
    body.push(h('h3', null, 'Escolha um achado'));
    rw.choices.forEach((ch, i) => body.push(choiceCard(ch, app.rewardSel === i, () => { sfx('tap'); app.rewardSel = i; app.render(); })));
  }
  const take = () => {
    const i = app.rewardSel;
    app.rewardSel = null;
    if (rw.choices.length && i != null) { const ch = rw.choices[i]; if (ch.type === 'item' && run.hero.items.length >= run.hero.slots) toast('Bolsa cheia: trocado por 8 pérolas.'); }
    takeReward(run, app.meta, i);
    app.save();
    app.render();
  };
  return screen(app, {
    title: rw.kind === 'treasure' ? '💎 Tesouro' : 'Recompensa',
    body,
    bottom: rw.choices.length ? [
      h('button', { class: 'btn ghost', onTap: () => { app.rewardSel = null; takeReward(run, app.meta, null); app.save(); app.render(); } }, 'Pular (+8 ⚪)'),
      h('button', { class: 'btn primary', disabled: app.rewardSel == null, onTap: () => { if (app.rewardSel == null) { toast('Escolha um achado (ou pule).'); return; } take(); } }, 'Pegar'),
    ] : [h('button', { class: 'btn primary', onTap: take }, 'Continuar')],
  });
}

function levelCard(app, o, i, selected) {
  const run = app.run;
  let icon, name, desc, kind;
  if (o.type === 'skill') { const d = REG.skills[o.id]; icon = d.icon; name = d.name; desc = d.desc(1, run.hero); kind = d.kind === 'passive' ? 'Nova passiva' : `Nova habilidade · ${typeof d.cost === 'function' ? d.cost(1) : d.cost || 0} 🫁${d.quick === true ? ' · ⚡' : ''}`; }
  else if (o.type === 'up') { const d = REG.skills[o.id]; icon = d.icon; name = d.name + '+'; desc = 'Melhoria: ' + d.up + ' → ' + d.desc(2, run.hero); kind = 'Aprimorar'; }
  else { const a = ATTRS[o.k]; icon = a.icon; name = `+1 ${a.name}`; desc = a.desc + ` (atual: ${run.hero.attrs[o.k]})`; kind = 'Atributo'; }
  return h('div', { class: 'card tap' + (selected ? ' sel' : ''), onclick: () => { sfx('tap'); app.levelSel = i; app.render(); } },
    h('div', { class: 'title' }, h('span', { class: 'ico' }, icon), h('div', null, h('div', null, name), h('div', { class: 'tiny muted' }, kind))),
    h('div', { class: 'desc' }, desc));
}

function renderLevelUp(app) {
  const run = app.run;
  const opts = levelOptions(run, app.meta);
  const body = [
    h('div', { class: 'center' }, h('div', { style: { fontSize: '44px' } }, '⭐'), h('h2', null, `Nível ${run.hero.lvl + 1}!`), h('p', { class: 'muted' }, 'Escolha como evoluir. (+3 de vida)')),
    ...opts.map((o, i) => levelCard(app, o, i, app.levelSel === i)),
  ];
  setTimeout(() => sfx('level'), 50);
  return screen(app, {
    title: 'Subiu de nível', body,
    right: h('button', { class: 'btn icon ghost', onTap: () => openCharacter(app) }, '🧾'),
    bottom: [h('button', { class: 'btn primary', disabled: app.levelSel == null, onTap: () => {
      if (app.levelSel == null) { toast('Escolha uma carta.'); return; }
      applyLevel(run, app.meta, app.levelSel); app.levelSel = null; app.save(); app.render();
    } }, 'Confirmar')],
  });
}

function renderEvent(app) {
  const run = app.run;
  const ev = eventById(run.event.id);
  const body = [h('div', { class: 'center' }, h('div', { style: { fontSize: '56px' } }, ev.art)), h('p', { style: { fontFamily: 'var(--serif)', fontSize: '17px' } }, ev.text)];
  if (run.event.result != null) {
    body.push(h('div', { class: 'npc-line' }, ...run.event.result.split('\n').map((l, i) => (i ? [h('br'), l] : l))));
    return screen(app, { title: ev.title, body, bottom: [h('button', { class: 'btn primary', onTap: () => { continueEvent(run, app.meta); app.save(); app.render(); } }, run.event.fight ? '⚔ Lutar!' : 'Continuar')] });
  }
  const list = h('div', { class: 'btnlist' });
  ev.choices.forEach((ch, i) => {
    const ok = checkReq(run, ch.req);
    list.appendChild(h('button', { class: 'btn choice', disabled: ok !== true, onTap: () => {
      if (ok !== true) return;
      resolveEvent(run, app.meta, i, ev); app.save(); app.render();
    } }, h('span', null, ch.t, ch.req ? h('span', { class: 'req' }, (ok === true ? '✓ ' : '🔒 ') + reqLabel(ch.req)) : null, ch.hint ? h('span', { class: 'req' }, ch.hint) : null)));
  });
  body.push(list);
  body.push(h('div', { class: 'small muted', style: { marginTop: '10px' } }, `❤ ${run.hero.hp}/${maxHp(run)} · ⚪ ${run.pearls} · Vig ${run.hero.attrs.vig} Ímp ${run.hero.attrs.imp} Fôl ${run.hero.attrs.fol} Can ${run.hero.attrs.can}`));
  return screen(app, { title: '❓ ' + ev.title, body });
}

function renderShop(app) {
  const run = app.run;
  const s = run.shop;
  const body = [
    h('div', { class: 'row' }, h('span', { style: { fontSize: '40px' } }, '⚖'), h('div', null, h('b', null, 'Tobias, o mercador afogado'), h('div', { class: 'small muted' }, '"Pérolas, pérolas! O mar leva tudo, menos o comércio."'))),
    s.debtMsg ? h('div', { class: 'npc-line' }, s.debtMsg) : null,
    h('div', { class: 'hudline' }, h('span', { class: 'pill gold' }, `⚪ ${run.pearls} pérolas`), h('span', { class: 'pill' }, `❤ ${run.hero.hp}/${maxHp(run)}`), h('span', { class: 'pill' }, `🎒 ${run.hero.items.length}/${run.hero.slots}`)),
    h('h3', null, 'Mercadorias'),
  ];
  s.items.forEach((it, i) => {
    const d = it.type === 'item' ? REG.items[it.id] : it.type === 'relic' ? REG.relics[it.id] : REG.suits[it.id];
    body.push(h('div', { class: 'card' + (it.sold ? ' locked' : '') },
      h('div', { class: 'title' }, h('span', { class: 'ico' }, d.icon), h('div', { style: { flex: 1 } }, h('div', null, d.name), h('div', { class: 'tiny muted' }, { item: 'Consumível', relic: 'Relíquia', suit: 'Traje' }[it.type])),
        it.sold ? h('span', { class: 'muted' }, 'Vendido') : h('button', { class: 'btn small ' + (run.pearls >= it.price ? 'primary' : ''), onTap: () => { const r = buy(run, app.meta, i); if (r === true) { sfx('coin'); app.save(); app.render(); } else { sfx('error'); toast(r); } } }, `⚪ ${it.price}`)),
      h('div', { class: 'desc' }, d.desc)));
  });
  body.push(h('h3', null, 'Serviços'));
  s.services.forEach((sv, i) => {
    body.push(h('div', { class: 'card' + (sv.sold ? ' locked' : '') },
      h('div', { class: 'title' }, sv.name, h('span', { class: 'spacer' }), sv.sold ? h('span', { class: 'muted' }, 'Feito') : h('button', { class: 'btn small', onTap: () => {
        if (sv.type === 'upgrade') { pickSkillToUpgrade(app, (sid) => { const r = buyService(run, app.meta, i, sid); if (r === true) { sfx('level'); app.save(); app.render(); } else toast(r); }); return; }
        const r = buyService(run, app.meta, i); if (r === true) { sfx('heal'); app.save(); app.render(); } else { sfx('error'); toast(r); }
      } }, `⚪ ${sv.price}`)),
      h('div', { class: 'desc' }, sv.desc)));
  });
  if (run.hero.items.length) {
    body.push(h('h3', null, 'Vender consumíveis'));
    run.hero.items.forEach((id, i) => body.push(h('div', { class: 'kv' }, h('span', null, `${REG.items[id].icon} ${REG.items[id].name}`), h('button', { class: 'btn small ghost', onTap: () => { const v = sellItem(run, i); sfx('coin'); toast(`+${v} pérolas`); app.save(); app.render(); } }, `Vender ⚪${Math.max(3, Math.floor(REG.items[id].price / 3))}`))));
  }
  return screen(app, { title: '⚖ Mercador', body, bottom: [h('button', { class: 'btn primary', onTap: () => { leaveShop(run, app.meta); app.save(); app.render(); } }, 'Seguir viagem')] });
}

function pickSkillToUpgrade(app, cb) {
  const run = app.run;
  const ups = upgradableSkills(run);
  if (!ups.length) { toast('Nenhuma técnica pode ser melhorada agora.'); return; }
  openSheet({
    title: 'Melhorar técnica',
    body: (close) => h('div', null, ...ups.map((s) => {
      const d = REG.skills[s.id];
      return h('div', { class: 'card tap', onclick: () => { close(); cb(s.id); } },
        h('div', { class: 'title' }, h('span', { class: 'ico' }, d.icon), d.name + ' → ' + d.name + '+'),
        h('div', { class: 'desc' }, d.up));
    })),
  });
}

function renderRest(app) {
  const run = app.run;
  const heal = restHealAmount(run, app.meta);
  const ups = upgradableSkills(run);
  const opt = (icon, title, desc, fn, disabled) => h('div', { class: 'card tap' + (disabled ? ' locked' : ''), onclick: () => { if (disabled) { toast(disabled); return; } sfx('tap'); fn(); } },
    h('div', { class: 'title' }, h('span', { class: 'ico' }, icon), title), h('div', { class: 'desc' }, desc));
  return screen(app, {
    title: '🫧 Bolsão de Ar',
    body: [
      h('p', { style: { fontFamily: 'var(--serif)', fontSize: '17px' } }, 'Uma câmara seca sob uma cúpula de vidro. O ar é velho, mas é ar. Você tem tempo para uma coisa só.'),
      h('div', { class: 'hudline' }, h('span', { class: 'pill' }, `❤ ${run.hero.hp}/${maxHp(run)}`), h('span', { class: 'pill gold' }, `⚪ ${run.pearls}`)),
      opt('❤', 'Respirar', `Recupera ${heal} de vida.`, () => { rest(run, app.meta, 'heal'); sfx('heal'); app.save(); app.render(); }, run.hero.hp >= maxHp(run) ? 'Sua vida já está cheia.' : null),
      opt('📘', 'Treinar', 'Melhora uma técnica à sua escolha (+).', () => pickSkillToUpgrade(app, (sid) => { rest(run, app.meta, 'train', sid); sfx('level'); app.save(); app.render(); }), ups.length ? null : 'Nenhuma técnica para melhorar.'),
      opt('🔎', 'Vasculhar', 'Encontra 10 pérolas e um consumível.', () => { rest(run, app.meta, 'search'); sfx('coin'); app.save(); app.render(); }),
    ],
  });
}

function renderBossIntro(app) {
  const run = app.run;
  const bid = run.bossId;
  const b = BOSS_INTRO[bid];
  const d = REG.enemies[bid];
  const body = [
    h('div', { class: 'center' }, img(d.sprite, 96), h('h2', null, b.title), h('p', { style: { fontFamily: 'var(--serif)', fontSize: '17px' } }, b.text)),
    h('div', { class: 'card' }, h('div', { class: 'title' }, '👁 Regras do guardião'), h('div', { class: 'desc' }, d.desc), h('div', { class: 'small gold', style: { marginTop: '6px' } }, '💡 ' + d.tip)),
  ];
  if (bid === 'maren') {
    const versos = app.meta.bosses.filter((x) => ['carranca', 'gardener', 'sineiro'].includes(x)).length >= 3;
    if (app.meta.hasConcha || versos) body.push(h('div', { class: 'npc-line new' }, 'Quando Maren estiver enfraquecida (fase 2), novas ações aparecerão para você: ' + [app.meta.hasConcha ? '🐚 Devolver a Concha-Mãe' : null, versos ? '👑 Cantar os Três Versos' : null].filter(Boolean).join(' ou ') + '. Ou lute até o fim.'));
    else body.push(h('div', { class: 'npc-line' }, 'Você sente que falta algo. Talvez as memórias da cidade — e a Avó Zélia — escondam outro caminho. Mas só há uma forma de saber agora.'));
  }
  return screen(app, { title: 'Guardião', body, bottom: [h('button', { class: 'btn danger', onTap: () => { startBossFight(run, app.meta); app.save(); app.render(); } }, '⚔ Enfrentar')] });
}

function renderExtract(app) {
  const run = app.run;
  const next = DISTRICTS[run.district + 1];
  return screen(app, {
    title: 'A maré está virando',
    body: [
      h('div', { class: 'center' }, h('div', { style: { fontSize: '52px' } }, '🌅')),
      h('p', { style: { fontFamily: 'var(--serif)', fontSize: '17px' } }, `O guardião de ${DISTRICTS[run.district].name} caiu. Ao longe, a água começa a voltar. Você pode subir agora com tudo o que juntou — ou continuar descendo enquanto o caminho está aberto.`),
      h('div', { class: 'card' }, h('div', { class: 'title' }, '⬆ Subir à superfície'), h('div', { class: 'desc' }, `Encerra a expedição em segurança: suas ${run.pearls} pérolas viram ${Math.round(run.pearls * (1 + run.heat * 0.1))} Conchas.`)),
      h('div', { class: 'card' }, h('div', { class: 'title' }, `⬇ Descer: ${next.name}`), h('div', { class: 'desc' }, `${next.desc} Você recupera 30% da vida. Se cair, só metade das pérolas volta.`)),
    ],
    bottom: [
      h('button', { class: 'btn', onTap: async () => { const s = endRun(run, app.meta, 'extract'); app.run = null; app.save(); app.go('summary', s); } }, '⬆ Subir'),
      h('button', { class: 'btn primary', onTap: () => { descend(run, app.meta); app.save(); app.render(); } }, '⬇ Descer'),
    ],
  });
}

function renderDead(app) {
  const run = app.run;
  return screen(app, {
    title: 'A maré te leva',
    body: [
      h('div', { class: 'center' }, h('div', { style: { fontSize: '56px' } }, '🌊'),
        h('p', { style: { fontFamily: 'var(--serif)', fontSize: '18px' } }, 'A água fria te envolve. Tudo escurece... e então, areia. Você acorda na praia de Salgema, tossindo água salgada.'),
        h('p', { class: 'muted' }, 'A maré não devolve ninguém. Mas devolveu você.')),
      h('div', { class: 'card' },
        h('div', { class: 'kv' }, h('span', null, 'Pérolas carregadas'), h('span', null, run.pearls)),
        h('div', { class: 'kv' }, h('span', null, 'Viram Conchas (50%)'), h('span', { class: 'conchas' }, Math.floor(run.pearls / 2))),
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Você mantém: bestiário, memórias, versos, moradores resgatados e melhorias da vila.')),
    ],
    bottom: [h('button', { class: 'btn primary', onTap: () => { const s = endRun(run, app.meta, 'death'); app.run = null; app.save(); app.go('summary', s); } }, 'Acordar na praia')],
  });
}

function renderSummary(app, s) {
  if (!s) return renderHub(app);
  const rows = [
    ['Resultado', outcomeLabel(s.outcome)], ['Ofício', `${REG.classes[s.cls].name} (nível ${s.lvl})`], ['Mais fundo', DISTRICTS[s.district].name],
    ['Combates', s.combats], ['Inimigos derrotados', s.kills], ['Guardiões', s.bosses], ['Resgates', s.rescues], ['Memórias', s.memories],
  ];
  return screen(app, {
    title: 'Fim da expedição',
    body: [
      h('div', { class: 'center' }, h('div', { style: { fontSize: '48px' } }, s.outcome === 'death' ? '🌊' : s.outcome === 'ending' ? '🏁' : '⬆'), h('h2', null, `+${s.conchas} Conchas`)),
      s.contractReward ? h('div', { class: 'npc-line' }, `📃 Contrato cumprido: +${s.contractReward} Conchas`) : null,
      h('div', { class: 'card' }, ...rows.map(([k, v]) => h('div', { class: 'kv' }, h('span', null, k), h('span', null, v)))),
      h('p', { class: 'muted small' }, 'Gaste Conchas na vila para ficar mais forte. Converse com todos: há coisas novas para ouvir.'),
    ],
    bottom: [h('button', { class: 'btn primary', onTap: () => app.go('hub') }, 'Voltar a Salgema')],
  });
}

function renderEnding(app) {
  const run = app.run;
  const E = ENDINGS[run.ending || 'silencio'];
  app.endStep = app.endStep || 0;
  const step = app.endStep;
  if (step < E.text.length) {
    return h('div', { class: 'screen', onclick: () => { sfx('page'); app.endStep++; app.render(); } },
      h('div', { class: 'story-panel ending' },
        h('div', { class: 'art' }, E.icon),
        h('h2', null, `Final: ${E.title}`),
        h('p', null, E.text[step]),
        h('div', { class: 'dots' }, E.text.map((_, i) => h('i', { class: i === step ? 'on' : '' }))),
        h('p', { class: 'muted small' }, 'Toque para continuar')));
  }
  const found = new Set([...(app.meta.endings || []), run.ending]);
  return screen(app, {
    title: 'Fim',
    body: [
      h('div', { class: 'center' }, h('div', { style: { fontSize: '48px' } }, E.icon), h('h2', null, E.title), h('p', null, `Você encontrou ${found.size} de 3 finais.`)),
      h('div', { class: 'card' }, h('p', null, 'Obrigado por jogar VAZANTE.'), h('p', { class: 'muted small' }, 'Agora as Marés Vivas estão abertas no Cais: novas dificuldades, mais Conchas e os mesmos mares — mais bravos. Há outros finais esperando: as memórias, os versos e a Concha-Mãe mudam o que acontece no altar.')),
      h('p', { class: 'muted small center' }, 'Design, código, arte em pixel e áudio sintetizado: criado como um desafio de RPG para iPhone.'),
    ],
    bottom: [h('button', { class: 'btn primary', onTap: () => { app.endStep = 0; const s = endRun(run, app.meta, 'ending'); app.run = null; app.save(); app.go('summary', s); } }, 'Voltar a Salgema')],
  });
}

// ======================= FOLHAS =======================
export function pauseMenu(app) {
  const run = app.run;
  openSheet({
    title: 'Pausa',
    body: (close) => h('div', { class: 'btnlist' },
      h('p', { class: 'muted small' }, 'O jogo salva automaticamente a cada ação.'),
      h('button', { class: 'btn primary', onTap: close }, '▶ Continuar'),
      run ? h('button', { class: 'btn', onTap: () => { close(); openCharacter(app); } }, '🧾 Ficha da personagem') : null,
      h('button', { class: 'btn', onTap: () => { close(); openManual(app); } }, '📖 Manual'),
      h('button', { class: 'btn', onTap: () => { close(); openCodex(app); } }, '📜 Códice'),
      h('button', { class: 'btn', onTap: () => { close(); openSettings(app); } }, '⚙ Opções'),
      h('button', { class: 'btn ghost', onTap: () => { close(); app.save(); app.go('title'); } }, '⌂ Salvar e ir ao título'),
      run && !run.tutorial ? h('button', { class: 'btn danger', onTap: async () => {
        close();
        if (await confirmBox('Abandonar a expedição? Você volta à vila e só metade das pérolas vira Conchas.', 'Abandonar', true)) {
          const s = endRun(run, app.meta, 'abandon'); app.run = null; app.save(); app.go('summary', s);
        }
      } }, '🏳 Abandonar expedição') : null),
  });
}

export function openCharacter(app) {
  const run = app.run;
  if (!run) return;
  const hero = run.hero;
  const st = heroStats(hero, run.metaBonus);
  const C = REG.classes[hero.cls];
  const body = h('div', null,
    h('div', { class: 'row' }, img(C.sprite, 56), h('div', null, h('b', null, `${hero.name}`), h('div', { class: 'small muted' }, `${C.name} · nível ${hero.lvl} · ${REG.weapons[hero.weapon].name}`))),
    h('div', { class: 'statgrid', style: { marginTop: '10px' } },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Vida'), h('div', { class: 'v' }, `${hero.hp}/${st.maxHp}`)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Fôlego máx.'), h('div', { class: 'v' }, st.folMax)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Movimento'), h('div', { class: 'v' }, st.move)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Armadura'), h('div', { class: 'v' }, st.armor)),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Previsão da maré'), h('div', { class: 'v' }, st.forecast + ' rodadas')),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Experiência'), h('div', { class: 'v' }, `${hero.xp}/${xpForLevel(hero.lvl + 1)}`))),
    h('h3', null, 'Atributos'),
    ...Object.entries(ATTRS).map(([k, a]) => h('div', { class: 'kv' }, h('span', null, `${a.icon} ${a.name}: `, h('span', { class: 'muted small' }, a.desc)), h('b', null, st.attrs[k]))),
    h('h3', null, 'Ações da arma'),
    ...REG.weapons[hero.weapon].basics.map((id) => skillRow(REG.skills[id], 1, hero)),
    h('h3', null, `Habilidades (${hero.skills.filter((s) => REG.skills[s.id].kind === 'active').length}/4 ativas)`),
    ...hero.skills.map((s) => skillRow(REG.skills[s.id], s.lv, { ...hero, attrs: st.attrs })),
    h('h3', null, 'Traje'),
    h('div', { class: 'kv' }, h('span', null, `${REG.suits[hero.suit].icon} ${REG.suits[hero.suit].name}`), h('span', { class: 'small muted' }, REG.suits[hero.suit].desc)),
    h('h3', null, `Relíquias (${hero.relics.length})`),
    hero.relics.length ? null : h('p', { class: 'muted small' }, 'Nenhuma ainda.'),
    ...hero.relics.map((id) => h('div', { class: 'kv' }, h('span', null, `${REG.relics[id].icon} ${REG.relics[id].name}`), h('span', { class: 'small muted', style: { maxWidth: '60%', textAlign: 'right' } }, REG.relics[id].desc))),
    h('h3', null, `Consumíveis (${hero.items.length}/${hero.slots})`),
    ...hero.items.map((id) => h('div', { class: 'kv' }, h('span', null, `${REG.items[id].icon} ${REG.items[id].name}`), h('span', { class: 'small muted', style: { maxWidth: '60%', textAlign: 'right' } }, REG.items[id].desc))),
  );
  openSheet({ title: '🧾 Ficha', body });
}

function skillRow(d, lv, hero) {
  const cost = typeof d.cost === 'function' ? d.cost(lv) : d.cost || 0;
  return h('div', { class: 'card' },
    h('div', { class: 'skill' }, h('span', { class: 'ico' }, d.icon),
      h('div', { style: { flex: 1 } },
        h('div', null, h('b', null, d.name + (lv > 1 ? '+' : '')), d.kind === 'passive' ? h('span', { class: 'tag' }, 'passiva') : h('span', { class: 'tag' }, `${cost} 🫁`), (typeof d.quick === 'function' ? d.quick(lv) : d.quick) ? h('span', { class: 'tag' }, '⚡ rápida') : null, d.tag ? h('span', { class: 'tag' }, d.tag) : null),
        h('div', { class: 'small muted' }, d.desc(lv, hero)),
        lv < 2 && d.up ? h('div', { class: 'tiny', style: { color: '#7fa6c6', marginTop: '2px' } }, '+ ' + d.up) : null)));
}

export function openManual(app, topic) {
  let cur = topic && MANUAL.find((s) => s.id === topic) ? topic : MANUAL[0].id;
  const content = h('div', { class: 'manual' });
  const tabs = h('div', { class: 'row wrap', style: { gap: '6px' } });
  const draw = () => {
    clear(tabs);
    for (const s of MANUAL) tabs.appendChild(h('button', { class: 'btn small' + (s.id === cur ? ' primary' : ''), onTap: () => { cur = s.id; draw(); } }, s.title));
    const s = MANUAL.find((q) => q.id === cur);
    content.innerHTML = `<h3>${s.title}</h3>${s.html}`;
  };
  draw();
  openSheet({ title: '📖 Manual', body: h('div', null, tabs, content) });
}

export function openInstall() {
  const d = h('div', { class: 'manual' });
  d.innerHTML = INSTALL_HTML;
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  openSheet({ title: '📲 Instalar no iPhone', body: h('div', null, standalone ? h('p', { class: 'good' }, '✓ Você já está jogando pelo app instalado.') : null, d) });
}

export function openSettings(app) {
  const s = app.settings;
  const sw = (label, key, desc) => h('div', { class: 'switch' }, h('div', null, h('div', null, label), desc ? h('div', { class: 'tiny muted' }, desc) : null),
    h('button', { class: 'btn small ' + (s[key] ? 'primary' : ''), onTap: () => { app.updateSettings({ [key]: !app.settings[key] }); close(); openSettings(app); } }, app.settings[key] ? 'Ligado' : 'Desligado'));
  const close = openSheet({
    title: '⚙ Opções',
    body: () => h('div', null,
      sw('Efeitos sonoros', 'sound'),
      sw('Música ambiente', 'music', 'Mar e acordes gerados ao vivo.'),
      sw('Confirmar fim de turno', 'confirmEnd', 'Pede confirmação se ainda puder mover ou agir.'),
      sw('Dicas', 'hints', 'Explicações curtas quando algo aparece pela primeira vez.'),
      h('div', { class: 'switch' }, h('div', null, 'Velocidade das animações'),
        h('div', { class: 'row' }, ...[1, 1.6, 2.5].map((v) => h('button', { class: 'btn small ' + (app.settings.speed === v ? 'primary' : ''), onTap: () => { app.updateSettings({ speed: v }); close(); openSettings(app); } }, v === 1 ? '1×' : v === 1.6 ? '1.5×' : '2.5×')))),
      h('div', { class: 'switch' }, h('div', null, 'Volume'),
        h('div', { class: 'row' }, ...[0.3, 0.6, 1].map((v) => h('button', { class: 'btn small ' + (Math.abs(app.settings.vol - v) < 0.05 ? 'primary' : ''), onTap: () => { app.updateSettings({ vol: v }); close(); openSettings(app); } }, v === 0.3 ? 'Baixo' : v === 0.6 ? 'Médio' : 'Alto')))),
      app.meta ? h('button', { class: 'btn block', style: { marginTop: '10px' }, onTap: () => { app.meta.hints = {}; app.save(); toast('As dicas vão aparecer de novo.'); } }, 'Rever todas as dicas') : null,
      h('h3', null, 'Backup do progresso'),
      h('p', { class: 'small muted' }, 'O progresso fica salvo neste aparelho. Para garantir, copie o código abaixo e guarde (por exemplo, nas Notas).'),
      app.meta ? h('button', { class: 'btn block', onTap: () => {
        const code = exportSave(app.meta, app.run);
        const ta = h('textarea', { class: 'save', readonly: true }, code);
        openSheet({ title: 'Exportar save', body: h('div', null, ta, h('button', { class: 'btn primary block', style: { marginTop: '8px' }, onTap: async () => {
          try { await navigator.clipboard.writeText(code); toast('Copiado!'); } catch (e) { ta.select(); toast('Selecione e copie o texto.'); }
        } }, 'Copiar')) });
      } }, '⬆ Exportar save') : null,
      h('button', { class: 'btn block', style: { marginTop: '8px' }, onTap: () => {
        const ta = h('textarea', { class: 'save', placeholder: 'Cole aqui o código VZ1:...' });
        const cl = openSheet({ title: 'Importar save', body: h('div', null, ta, h('button', { class: 'btn primary block', style: { marginTop: '8px' }, onTap: async () => {
          try {
            const d = importSave(ta.value);
            if (!(await confirmBox('Substituir o progresso atual por este save?', 'Substituir', true))) return;
            app.meta = d.meta; app.run = d.run || null; app.save(); cl(); closeAllSheets(); app.go('title'); toast('Save importado!');
          } catch (e) { toast(e.message || 'Código inválido.'); }
        } }, 'Importar')) });
      } }, '⬇ Importar save'),
      h('h3', null, 'Zona de perigo'),
      h('button', { class: 'btn danger block', onTap: async () => {
        if (await confirmBox('Apagar TODO o progresso deste aparelho? Não dá para desfazer.', 'Apagar tudo', true)) { wipeSave(); app.meta = null; app.run = null; closeAllSheets(); app.go('title'); }
      } }, 'Apagar progresso'),
      h('p', { class: 'tiny muted center', style: { marginTop: '14px' } }, `Vazante v${VERSION}`)),
  });
}

export function openCodex(app, tab = 'bestiario') {
  const m = app.meta;
  if (!m) return;
  let cur = tab;
  const content = h('div');
  const tabs = h('div', { class: 'row wrap', style: { gap: '6px', marginBottom: '6px' } });
  const draw = () => {
    clear(tabs); clear(content);
    for (const [k, l] of [['bestiario', '🐚 Bestiário'], ['memorias', '✦ Memórias'], ['versos', '📜 Versos e finais']]) tabs.appendChild(h('button', { class: 'btn small' + (cur === k ? ' primary' : ''), onTap: () => { cur = k; draw(); } }, l));
    if (cur === 'bestiario') {
      const th = studyThreshold(m);
      content.appendChild(h('p', { class: 'small muted' }, `Derrote ${th} de uma espécie para Estudá-la: +1 de dano contra ela para sempre.`));
      for (const d of [1, 2, 3, 4]) {
        content.appendChild(h('h3', null, DISTRICTS[d].name));
        for (const [id, e] of Object.entries(REG.enemies)) {
          if (e.d !== d) continue;
          const n = m.bestiary[id] || 0;
          const known = n > 0 || (e.boss && m.bosses.includes(id));
          content.appendChild(h('div', { class: 'card' + (known ? '' : ' locked') },
            h('div', { class: 'title' }, known ? img(e.sprite, 36) : h('span', { class: 'ico' }, '❔'), h('div', { style: { flex: 1 } }, h('div', null, known ? e.name : '???', e.elite ? h('span', { class: 'tag' }, 'elite') : null, e.boss ? h('span', { class: 'tag' }, 'guardião') : null), h('div', { class: 'tiny muted' }, known ? `❤ ${e.hp}${e.armor ? ' · Arm ' + e.armor : ''} · derrotados: ${n}${n >= th ? ' · 📖 Estudado' : ''}` : 'Ainda não encontrado'))),
            known ? h('div', { class: 'desc' }, e.desc) : null,
            known ? h('div', { class: 'small gold', style: { marginTop: '4px' } }, '💡 ' + e.tip) : null));
        }
      }
    } else if (cur === 'memorias') {
      for (const mm of MEMORIES) {
        const found = m.memoryIds.includes(mm.id);
        const given = found && MEMORIES.filter((q) => m.memoryIds.includes(q.id)).indexOf(mm) < m.memoriesGiven;
        content.appendChild(h('div', { class: 'card' + (found ? '' : ' locked') },
          h('div', { class: 'title' }, found ? '✦' : '❔', found ? mm.title : '???'),
          h('div', { class: 'desc' }, given ? mm.text : found ? 'Leve à Avó Zélia para entender esta memória.' : 'Memórias aparecem em mistérios, estátuas, poços e baús da cidade.')));
      }
    } else {
      VERSOS.forEach((v) => {
        const ok = m.bosses.includes(v.from);
        content.appendChild(h('div', { class: 'card' + (ok ? '' : ' locked') }, h('div', { class: 'title' }, ok ? '📜' : '❔', v.title), h('div', { class: 'desc' }, ok ? v.text : `Derrote ${REG.enemies[v.from].name}.`)));
      });
      content.appendChild(h('h3', null, 'Finais'));
      for (const [k, E] of Object.entries(ENDINGS)) {
        const ok = m.endings.includes(k);
        content.appendChild(h('div', { class: 'card' + (ok ? '' : ' locked') }, h('div', { class: 'title' }, ok ? E.icon : '❔', ok ? E.title : '???'), h('div', { class: 'desc' }, ok ? E.text[E.text.length - 1] : 'Ainda não alcançado.')));
      }
    }
  };
  draw();
  openSheet({ title: '📜 Códice', body: h('div', null, tabs, content) });
}

export const VIEWS = {
  title: renderTitle,
  intro: renderIntro,
  tutorialEnd: renderTutorialEnd,
  hub: renderHub,
  location: renderLocation,
  dock: renderDock,
  summary: renderSummary,
  run: (app) => (app.run ? renderRun(app) : renderHub(app)),
};
