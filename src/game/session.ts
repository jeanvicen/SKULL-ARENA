import { audio } from '../audio/audio';
import { BOSS } from '../content/characters';
import type { CharacterDef, MapDef, ModeDef, PetDef } from '../content/types';
import { FixedLoop } from '../engine/loop';
import { Rng } from '../engine/rng';
import { Controls, type ControlSettings } from '../input/controls';
import type { MatchSummary } from '../meta/economy';
import { WorldRenderer } from '../render/worldRenderer';
import { BotDirector } from '../sim/bots';
import type { Fighter, FighterInput, GameEvent } from '../sim/types';
import { STEP, World } from '../sim/world';
import { buildRoster } from './roster';
import { esc, Hud } from './hud';

/**
 * SESSÃO DE PARTIDA
 * -----------------
 * Junta tudo: simulação (World) + bots + renderer pixel + controles + HUD + som.
 * Quem chama (a tela do menu) só cria a sessão e espera `onEnd`.
 */

export interface SessionOpts {
  host: HTMLElement;
  mode: ModeDef;
  map: MapDef;
  char: CharacterDef;
  level: number;
  pet: PetDef | null;
  playerName: string;
  /** amigos da sala (jogam no seu time como BOT controlado pela IA no modo local) */
  partyNames?: string[];
  controls: ControlSettings;
  quality: 'alta' | 'media' | 'baixa' | 'auto';
  shake: boolean;
  showFps: boolean;
  /** 0..1 */
  botDifficulty: number;
  seed?: number;
  /** mostra as dicas de controle */
  tutorial?: boolean;
  onEnd: (summary: MatchSummary, world: World, me: Fighter) => void;
  onQuit: () => void;
}

export class MatchSession {
  readonly root: HTMLDivElement;
  readonly world: World;
  readonly renderer: WorldRenderer;
  readonly controls: Controls;
  readonly hud: Hud;
  private bots: BotDirector;
  private loop: FixedLoop;
  private inputs: Array<FighterInput | undefined> = [];
  private hitStopT = 0;
  private endT = -1;
  private ended = false;
  private paused = false;
  private pauseEl: HTMLDivElement | null = null;
  private fpsEl: HTMLDivElement | null = null;
  private fpsAcc = { t: 0, n: 0, low: 0 };
  private disposed = false;
  private onResize = () => {
    this.renderer.resize();
    this.controls.layout();
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') this.togglePause();
  };
  private onBlur = () => {
    if (!this.ended && this.world.started) this.togglePause(true);
  };

  constructor(private readonly o: SessionOpts) {
    const seed = o.seed ?? (Math.random() * 2 ** 31) | 0;
    const rng = new Rng(seed);
    this.root = document.createElement('div');
    this.root.className = 'match';
    const canvas = document.createElement('canvas');
    canvas.className = 'match-canvas';
    this.root.appendChild(canvas);
    o.host.appendChild(this.root);

    // ----------------------------------------------------------- elenco
    const { roster, boss } = buildRoster(o.mode, rng, [{ name: o.playerName, def: o.char, pet: o.pet, level: o.level, isLocal: true }], { partyNames: o.partyNames });
    this.world = new World({ map: o.map, mode: o.mode, seed, roster, boss: boss ? BOSS : undefined });
    this.bots = new BotDirector(this.world, o.botDifficulty, seed ^ 0x5bd1);

    // ----------------------------------------------------------- render/hud/controles
    this.renderer = new WorldRenderer(canvas, this.world, 0, {
      sound: (id, x, y, v) => audio.play(id, x, y, v),
      announce: (t, k) => this.hud.announce(t, k),
      hitStop: (ms) => (this.hitStopT = Math.max(this.hitStopT, ms / 1000)),
      vibrate: (ms) => {
        if (o.controls.vibrate && navigator.vibrate) navigator.vibrate(ms);
      },
      killFeed: (k, v, kt, vt) => this.hud.killFeed(k, v, kt, vt),
    });
    this.applyQuality(o.quality === 'baixa');
    this.hud = new Hud(this.root, this.world, 0);
    this.hud.onPause = () => this.togglePause();
    this.controls = new Controls(this.root, o.char, o.controls);
    this.controls.playerScreen = () => {
      const me = this.world.fighters[0]!;
      return this.renderer.worldToScreen(me.x, me.y - 40);
    };
    if (o.showFps) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.className = 'fps';
      this.root.appendChild(this.fpsEl);
    }
    if (o.tutorial) this.showTutorial();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('blur', this.onBlur);
    audio.playMusic(boss ? 'music_boss' : 'music_battle');
    this.loop = new FixedLoop(
      STEP,
      (dt) => this.update(dt),
      (a, fdt) => this.draw(a, fdt),
    );
    this.loop.start();
    // só no `npm run dev`: deixa a sessão acessível pros testes automáticos
    if (import.meta.env.DEV) (window as unknown as { __session?: MatchSession }).__session = this;
  }

  private applyQuality(low: boolean): void {
    this.renderer.lowQuality = low;
    this.renderer.particles.quality = low ? 0.55 : 1;
    this.renderer.resize();
  }

  private update(dt: number): void {
    if (this.paused) return;
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      return;
    }
    const w = this.world;
    this.inputs[0] = this.controls.read(dt);
    this.bots.fill(this.inputs, dt);
    const events = w.step(this.inputs);
    this.onEvents(events);
    if (w.over && this.endT < 0) {
      this.endT = 0;
      this.loop.timeScale = 0.3;
      this.controls.enabled = false;
      const me = w.fighters[0]!;
      const win = w.winner === me.team;
      const draw = w.winner === -1;
      audio.play(win ? 'vo_victory' : draw ? 'ui_reward' : 'vo_defeat');
      audio.play(win ? 'victory' : 'defeat');
      this.hud.announce(win ? 'VITÓRIA!' : draw ? 'EMPATE' : w.mode.teams === 0 ? `${w.placement(me)}º LUGAR` : 'DERROTA', 'big');
    }
    if (this.endT >= 0) {
      this.endT += dt / Math.max(0.05, this.loop.timeScale);
      if (this.endT > 0.9) this.loop.timeScale = Math.min(1, this.loop.timeScale + dt * 2);
      if (this.endT > 3.2 && !this.ended) this.finish(false);
    }
  }

  private onEvents(events: GameEvent[]): void {
    this.renderer.fx.handle(events);
    for (const e of events) if (e.type === 'hit' && e.kind === 'fighter' && e.target >= 0) this.renderer.onHit(e.target);
  }

  private draw(alpha: number, frameDt: number): void {
    if (this.disposed) return;
    const r = this.renderer;
    const dt = this.paused ? 0 : frameDt * this.loop.timeScale;
    r.aim = this.controls.preview;
    if (!this.o.shake) r.cam.shake = 0;
    r.update(dt);
    r.render(this.paused ? 1 : alpha);
    audio.listenerX = r.cam.x;
    audio.listenerY = r.cam.y;
    const me = this.world.fighters[0]!;
    this.controls.updateButtons(me.skillCd, me.superCharge, me.ammo, me.maxAmmo, this.world.hasStatus(me, 'silence') || this.world.hasStatus(me, 'stun'));
    this.hud.update(frameDt);
    // FPS e qualidade automática
    const F = this.fpsAcc;
    F.t += frameDt;
    F.n++;
    if (F.t >= 1) {
      const fps = F.n / F.t;
      if (this.fpsEl) this.fpsEl.textContent = `${Math.round(fps)} FPS · ${r.particles.count} part.`;
      if (this.o.quality === 'auto') {
        F.low = fps < 42 ? F.low + 1 : Math.max(0, F.low - 1);
        if (F.low >= 3 && !r.lowQuality) this.applyQuality(true);
      }
      F.t = 0;
      F.n = 0;
    }
  }

  private showTutorial(): void {
    const t = document.createElement('div');
    t.className = 'tutorial';
    t.innerHTML = `
      <div class="tut l"><b>ANDAR</b><span>arraste o dedão aqui</span></div>
      <div class="tut r"><b>MIRAR E ATIRAR</b><span>arraste pra mirar · solte pra atirar · toque rápido = mira automática</span></div>
      <div class="tut c">Pegue as <b>caveiras</b> dos inimigos derrotados pra pontuar! <small>(PC: WASD + mouse · Q/E/R habilidades · Espaço super)</small></div>`;
    this.root.appendChild(t);
    setTimeout(() => t.classList.add('fade'), 7000);
    setTimeout(() => t.remove(), 8000);
  }

  togglePause(force?: boolean): void {
    if (this.ended) return;
    const want = force ?? !this.paused;
    if (want === this.paused) return;
    this.paused = want;
    if (want) {
      audio.play('ui_open');
      const el = document.createElement('div');
      el.className = 'pause-menu';
      el.innerHTML = `
        <div class="panel pixel-panel">
          <h2>PAUSADO</h2>
          <p class="muted">${esc(this.world.mode.name)} · ${esc(this.o.map.name)}</p>
          <p class="muted small">Partida contra BOTs (modo local): o jogo pausa de verdade.</p>
          <button class="btn btn-yellow" data-a="resume">CONTINUAR</button>
          <button class="btn btn-red" data-a="quit">SAIR DA PARTIDA</button>
          <p class="muted small">Sair agora não dá prêmios nem troféus.</p>
        </div>`;
      el.addEventListener('click', (ev) => {
        const a = (ev.target as HTMLElement).closest('button')?.dataset.a;
        if (a === 'resume') this.togglePause(false);
        if (a === 'quit') this.finish(true);
      });
      this.root.appendChild(el);
      this.pauseEl = el;
    } else {
      audio.play('ui_back');
      this.pauseEl?.remove();
      this.pauseEl = null;
    }
  }

  private finish(quit: boolean): void {
    if (this.ended) return;
    this.ended = true;
    const w = this.world;
    const me = w.fighters[0]!;
    const summary: MatchSummary = {
      mode: w.mode.id,
      map: this.o.map.id,
      charId: this.o.char.id,
      win: w.winner === -1 ? null : w.winner === me.team,
      placement: w.placement(me),
      players: w.fighters.length,
      stats: { ...me.stats },
      quit,
    };
    this.dispose();
    if (quit) this.o.onQuit();
    else this.o.onEnd(summary, w, me);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.controls.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}
