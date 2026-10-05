// Ponto de entrada: registra conteúdo, inicia a aplicação e o service worker.
import './data/index.js';
import { App } from './ui/app.js';
import { h } from './ui/dom.js';

function setVh() {
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
setVh();
window.addEventListener('resize', setVh);

// Evita zoom por gesto de pinça e duplo toque no iOS (o jogo é todo por toque simples).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

const app = new App();
window.__vazante = app;
try {
  app.boot();
} catch (e) {
  console.error(e);
  document.getElementById('app').innerHTML = '<div class="boot"><div class="boot-title">VAZANTE</div><p>Erro ao iniciar: ' + (e && e.message) + '</p><button class="btn" onclick="location.reload()">Recarregar</button></div>';
}

// Service worker: offline + atualização segura (o save fica no localStorage, fora do cache).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
      const notify = (worker) => {
        const t = h('div', { class: 'toast update', role: 'status' }, 'Nova versão do Vazante disponível. ',
          h('button', { class: 'btn small primary', style: { marginLeft: '8px' }, onclick: () => { app.save(); worker.postMessage({ type: 'SKIP_WAITING' }); } }, 'Atualizar'));
        document.body.appendChild(t);
      };
      // Fora de uma expedição (título/vila), a atualização é aplicada na hora — o save fica no aparelho.
      const safeToReload = () => app.view !== 'run';
      const handle = (w) => { if (safeToReload()) { app.save(); w.postMessage({ type: 'SKIP_WAITING' }); } else notify(w); };
      if (reg.waiting && navigator.serviceWorker.controller) handle(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) handle(w);
        });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('SW falhou', e));
    let reloading = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return; // primeira instalação: não recarrega
      reloading = true;
      app.save();
      location.reload();
    });
  });
}
