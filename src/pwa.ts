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
  // Quando o SW novo assume, descarte o documento antigo: JS e app shell precisam
  // pertencer à mesma versão. A primeira instalação não força reload.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  const register = () =>
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      void reg.update().catch(() => undefined);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            app.toast('Atualizando o jogo para a versão mais recente…', 'gold', 3500);
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
