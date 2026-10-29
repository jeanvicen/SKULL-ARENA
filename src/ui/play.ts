import { audio } from '../audio/audio';
import { getCharacter } from '../content/characters';
import { activeEvents } from '../content/events';
import { getMap, mapsForMode } from '../content/maps';
import { MODE, MODES } from '../content/modes';
import { getPet } from '../content/pets';
import type { ModeDef, ModeId } from '../content/types';
import { MatchSession } from '../game/session';
import { store } from '../meta/store';
import type { App } from './app';
import { h, toast } from './dom';
import { resultsScreen } from './screens/results';

/**
 * JOGAR — escolha de modo/mapa e início da partida.
 */

export interface PlayChoice {
  mode: ModeId;
  map: string; // 'random' ou id do mapa
}

const K = 'skull.play';

export function getChoice(): PlayChoice {
  let c: PlayChoice = { mode: 'guerra', map: 'random' };
  try {
    c = { ...c, ...(JSON.parse(localStorage.getItem(K) ?? '{}') as Partial<PlayChoice>) };
  } catch {
    /* ok */
  }
  if (!availableModes().some((m) => m.id === c.mode)) c.mode = 'guerra';
  return c;
}

export function setChoice(c: PlayChoice): void {
  try {
    localStorage.setItem(K, JSON.stringify(c));
  } catch {
    /* ok */
  }
}

/** Modos do seletor: os fixos + os liberados por eventos ativos. */
export function availableModes(): ModeDef[] {
  const ev = activeEvents()
    .map((e) => e.modeId)
    .filter((x): x is ModeId => !!x);
  return MODES.filter((m) => m.listed || ev.includes(m.id));
}

export function startMatch(app: App, choice: PlayChoice, opts: { partyNames?: string[]; charId?: string; onBack?: () => void } = {}): void {
  const p = store.profile;
  if (!p) return;
  const mode = MODE[choice.mode];
  const maps = mapsForMode(mode.id);
  if (!maps.length) {
    toast('Nenhum mapa pra esse modo.', 'err');
    return;
  }
  const map = choice.map !== 'random' && maps.some((m) => m.id === choice.map) ? getMap(choice.map) : maps[Math.floor(Math.random() * maps.length)]!;
  // `charId`: testar um personagem (mesmo bloqueado) no Treino
  const char = getCharacter(opts.charId ?? p.selected);
  const testing = !!opts.charId && opts.charId !== p.selected;
  const s = store.settings;
  audio.play('ui_play');
  // tela de carregamento rapidinha (mostra mapa e modo)
  const loading = h(
    'div.screen.loading',
    null,
    h('div.load-mode', null, `${mode.icon} ${mode.name}`),
    h('div.load-map', null, map.name),
    h('div.load-tip', null, TIPS[Math.floor(Math.random() * TIPS.length)]!),
    h('div.load-bar', null, h('i')),
  );
  app.show({ el: loading });
  setTimeout(() => {
    const host = h('div.screen.match-host');
    let session: MatchSession | null = null;
    app.show({ el: host, dispose: () => session?.dispose() });
    session = new MatchSession({
      host,
      mode,
      map,
      char,
      level: p.chars[char.id]?.level ?? 1,
      pet: getPet(p.selectedPet),
      playerName: p.name,
      partyNames: opts.partyNames,
      controls: s.controls,
      quality: s.quality,
      shake: s.shake,
      showFps: s.showFps,
      botDifficulty: botDifficultyFor(s.botLevel, p.chars[char.id]?.trophies ?? 0),
      tutorial: !p.tutorial,
      onQuit: () => {
        audio.playMusic('music_menu');
        (opts.onBack ?? app.home)();
      },
      onEnd: (summary, world, me) => {
        if (testing) {
          audio.playMusic('music_menu');
          (opts.onBack ?? app.home)();
          return;
        }
        if (!p.tutorial) void store.run('tutorialDone').catch(() => {});
        app.show(resultsScreen(app, summary, world, me, () => startMatch(app, choice, opts)));
      },
    });
  }, 900);
}

/** Bots ficam um pouco mais espertos conforme seus troféus no personagem. */
function botDifficultyFor(base: number, trophies: number): number {
  return Math.max(0.15, Math.min(0.95, base + Math.min(0.3, trophies / 2000)));
}

const TIPS = [
  'Toque rápido no botão de ataque = mira automática no inimigo mais perto.',
  'Arbustos te escondem. Atirar ou levar dano te revela por um instante.',
  'Paredes de tijolo e vidro quebram. Abra caminho!',
  'Barris explodem — empurre um com tiros pra perto dos inimigos.',
  'Na Guerra de Gangues, pegar as caveiras do SEU time nega pontos pro inimigo.',
  'No Todos contra Todos, 3 eliminações seguidas te deixam PROCURADO (vale 2 pontos).',
  'O SUPER enche causando dano. Quando brilhar amarelo, solta!',
  'Pets dão bônus pequenos, mas fazem diferença no fim.',
  'A vida volta sozinha se você ficar uns segundos sem atirar nem levar dano.',
  'Vicen₹ tem 1% de chance no Drop do Vazio. A garantia vem em 100 aberturas.',
];
