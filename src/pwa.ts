import type { App } from './ui/app';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

/** Registra o Service Worker (só em produção), captura o convite de instalação e avisa versões novas. */
export function registerServiceWorker(app: App): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    app.toast('SKULL ARENA instalado! Agora dá pra jogar offline.', 'good', 3500);
  });
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const register = () =>
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
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register());
}

export function canInstall(): boolean {
  return !!deferred;
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  deferred = null;
}
