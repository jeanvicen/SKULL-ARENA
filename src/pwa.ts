import type { App } from './ui/app';

/** Registra o Service Worker (só em produção) e avisa quando há versão nova. */
export function registerServiceWorker(app: App): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            app.toast('Nova versão disponível — reabra o jogo para atualizar.', 'gold', 5000);
            w.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(() => {
      /* offline ou bloqueado — o jogo segue funcionando */
    });
  });
}
