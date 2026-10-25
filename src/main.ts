import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './ui/styles.css';
import { audio } from './audio/audio';
import { loadContent } from './content/load';
import { inputProfile } from './input/profile';
import { App } from './ui/app';
import { loadingScreen, loginScreen } from './ui/screens/boot';
import { gameScreen } from './ui/screens/game';
import { roomsScreen, matchmakingScreen } from './ui/screens/match';
import { menuScreen } from './ui/screens/menu';
import { resultsScreen } from './ui/screens/results';
import { collectionScreen, selectScreen } from './ui/screens/select';
import { registerExtraScreens } from './ui/screens/extra';
import { registerServiceWorker } from './pwa';

/**
 * Bootstrap. Camadas: content (dados) → combat (simulação) → render/audio/input
 * (apresentação) → ui (menus). Nenhuma camada de baixo conhece as de cima.
 */
const content = loadContent();
const root = document.getElementById('app')!;

let pref: 'auto' | 'touch' | 'desktop' = 'auto';
try {
  const raw = localStorage.getItem('skull-arena-save');
  if (raw) pref = JSON.parse(raw)?.settings?.input ?? 'auto';
} catch {
  /* sem storage */
}
inputProfile.init(pref);

const app = new App(root, content);
app.register('loading', (a) => loadingScreen(a));
app.register('login', (a) => loginScreen(a));
app.register('menu', (a) => menuScreen(a));
app.register('select', (a, p) => selectScreen(a, p));
app.register('collection', (a) => collectionScreen(a));
app.register('matchmaking', (a, p) => matchmakingScreen(a, p));
app.register('rooms', (a) => roomsScreen(a));
app.register('game', (a, p) => gameScreen(a, p));
app.register('results', (a, p) => resultsScreen(a, p));
registerExtraScreens(app);

// Primeiro gesto libera o áudio (política dos navegadores)
const unlock = () => {
  audio.unlock();
  audio.applyVolumes();
  if (app.screenName && app.screenName !== 'game') audio.playMusic('menu');
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

void app.go('loading', {}, 'none');
registerServiceWorker(app);

// Exposto para testes automatizados (e2e) e depuração
(window as unknown as { __skull: unknown }).__skull = { app, content };
