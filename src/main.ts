import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/press-start-2p/400.css';
import './styles/main.css';
import { audio } from './audio/audio';
import { store } from './meta/store';
import { App } from './ui/app';
import { toast } from './ui/dom';
import { authScreen } from './ui/screens/auth';
import { menuScreen } from './ui/screens/menu';
import { splashScreen } from './ui/screens/splash';

/**
 * ENTRADA DO JOGO
 * abertura (caveira rindo) → login/criar conta (se não tiver) → menu
 */

const app = new App(document.getElementById('app')!);
app.home = () => app.show(menuScreen(app));
audio.setVolumes(store.settings);

// toque no celular: tela cheia + trava em paisagem (quando o navegador deixa)
let triedFullscreen = false;
window.addEventListener(
  'pointerdown',
  () => {
    audio.unlock();
    if (triedFullscreen || !matchMedia('(pointer: coarse)').matches) return;
    triedFullscreen = true;
    const el = document.documentElement;
    const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
    else void lock();
  },
  { capture: true },
);

// evita menu de contexto/arrastar imagens/zoom de pinça no jogo
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

async function boot(): Promise<void> {
  const resumed = store.resume();
  const splash = splashScreen(async () => {
    if (await resumed) app.home();
    else app.show(authScreen(() => app.home()));
  });
  app.show(splash);
}

// PWA: service worker (só no build; no `npm run dev` não usa cache)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Atualização baixada! Ela entra na próxima vez que abrir o jogo.', 'info', 4000);
          });
        });
      })
      .catch(() => {});
  });
}

void boot();
