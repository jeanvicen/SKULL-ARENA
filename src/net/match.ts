import { audio } from '../audio/audio';
import { BOSS, getCharacter } from '../content/characters';
import { getMap } from '../content/maps';
import { MODE } from '../content/modes';
import { getPet } from '../content/pets';
import type { ModeId } from '../content/types';
import { esc, Hud } from '../game/hud';
import { Controls } from '../input/controls';
import type { MatchRewards, MatchSummary } from '../meta/economy';
import { store } from '../meta/store';
import { WorldRenderer } from '../render/worldRenderer';
import type { FighterInput } from '../sim/types';
import { World } from '../sim/world';
import type { App } from '../ui/app';
import { h, toast } from '../ui/dom';
import { resultsScreen } from '../ui/screens/results';
import { socialScreen } from '../ui/screens/social';
import { net } from './online';
import { SNAP_HZ, SnapDecoder, type Defs, type Snapshot } from './snapshot';

/**
 * PARTIDA ONLINE (cliente)
 * O servidor simula; aqui a gente só:
 *   1) manda os comandos do controle (~30 por segundo, tiros na hora)
 *   2) aplica as fotos do mundo que chegam e desenha com interpolação
 */

interface StartMsg {
  id: string;
  mode: ModeId;
  map: string;
  seed: number;
  boss: boolean;
  roster: Array<{ name: string; charId: string; team: number; isBot: boolean; petId: string | null; level: number }>;
  you: number;
  resume?: { defs: Defs; tiles: string };
}

let current: OnlineSession | null = null;

export function startOnlineMatch(app: App, raw: Record<string, unknown>): void {
  const msg = raw as unknown as StartMsg;
  if (current && current.matchId === msg.id) {
    // reconexão no meio da mesma partida
    if (msg.resume) current.resume(msg.resume);
    return;
  }
  current?.dispose();
  const host = h('div.screen.match-host');
  app.show({ el: host, dispose: () => current?.dispose() });
  current = new OnlineSession(app, host, msg);
}

class OnlineSession {
  readonly matchId: string;
  private world: World;
  private renderer: WorldRenderer;
  private hud: Hud;
  private controls: Controls;
  private dec: SnapDecoder;
  private raf = 0;
  private last = 0;
  private lastSnapAt = 0;
  private sendT = 0;
  private lastSent = '';
  private offs: Array<() => void> = [];
  private disposed = false;
  private root: HTMLDivElement;
  private me: number;

  constructor(
    private readonly app: App,
    host: HTMLElement,
    msg: StartMsg,
  ) {
    this.matchId = msg.id;
    this.me = msg.you;
    const mode = MODE[msg.mode];
    const roster = msg.roster.map((r, i) => ({ name: r.name, def: getCharacter(r.charId), team: r.team, isBot: r.isBot, isLocal: i === msg.you, pet: getPet(r.petId), level: r.level }));
    // mundo "espelho": mesmo mapa e elenco do servidor; o estado vem pelas fotos
    this.world = new World({ map: getMap(msg.map), mode, seed: msg.seed, roster, boss: msg.boss ? BOSS : undefined });
    this.dec = new SnapDecoder(this.world);
    if (msg.resume) this.resume(msg.resume);
    this.root = h('div.match');
    const canvas = h<'canvas'>('canvas.match-canvas');
    this.root.appendChild(canvas);
    host.appendChild(this.root);
    const s = store.settings;
    this.renderer = new WorldRenderer(canvas, this.world, this.me, {
      sound: (id, x, y, v) => audio.play(id, x, y, v),
      announce: (t, k) => this.hud.announce(t, k),
      vibrate: (ms) => {
        if (s.controls.vibrate && navigator.vibrate) navigator.vibrate(ms);
      },
      killFeed: (k, v, kt, vt) => this.hud.killFeed(k, v, kt, vt),
    });
    this.renderer.lowQuality = s.quality === 'baixa';
    this.hud = new Hud(this.root, this.world, this.me);
    this.hud.onPause = () => this.menu();
    this.controls = new Controls(this.root, this.world.fighters[this.me]!.def, s.controls);
    this.controls.playerScreen = () => {
      const f = this.world.fighters[this.me]!;
      return this.renderer.worldToScreen(f.x, f.y - 40);
    };
    this.root.appendChild(h('div.online-badge', null, '🌐 ONLINE'));
    this.offs.push(net.on('match.snap', (m) => this.onSnap(m as unknown as Snapshot)));
    this.offs.push(net.on('match.end', (m) => this.onEnd(m)));
    this.offs.push(
      net.on('status', (m) => {
        if (!m.connected) toast('Conexão caiu! Reconectando… (seu personagem joga como BOT enquanto isso)', 'err', 4000);
      }),
    );
    window.addEventListener('resize', this.onResize);
    audio.playMusic(msg.boss ? 'music_boss' : 'music_battle');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  resume(r: { defs: Defs; tiles: string }): void {
    this.dec.addDefs(r.defs);
  }

  private onResize = () => {
    this.renderer.resize();
    this.controls.layout();
  };

  private onSnap(s: Snapshot): void {
    const events = this.dec.apply(s);
    this.renderer.fx.handle(events);
    for (const e of events) if (e.type === 'hit' && e.kind === 'fighter' && e.target >= 0) this.renderer.onHit(e.target);
    this.lastSnapAt = performance.now();
  }

  private sendInput(inp: FighterInput, force: boolean): void {
    const key = `${inp.mx.toFixed(2)}${inp.my.toFixed(2)}${inp.ax.toFixed(2)}${inp.ay.toFixed(2)}${inp.ad.toFixed(1)}${inp.aiming}`;
    if (!force && key === this.lastSent && this.sendT < 0.25) return;
    this.lastSent = key;
    this.sendT = 0;
    net.send('match.input', { i: inp });
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.sendT += dt;
    const inp = this.controls.read(dt);
    const trigger = inp.fire || inp.skill >= 0;
    if (trigger || this.sendT >= 1 / 30) this.sendInput(inp, trigger);
    const r = this.renderer;
    r.aim = this.controls.preview;
    if (!store.settings.shake) r.cam.shake = 0;
    r.update(dt);
    const alpha = Math.min(1, (now - this.lastSnapAt) / (1000 / SNAP_HZ));
    r.render(alpha);
    audio.listenerX = r.cam.x;
    audio.listenerY = r.cam.y;
    const me = this.world.fighters[this.me]!;
    this.controls.updateButtons(me.skillCd, me.superCharge, me.ammo, me.maxAmmo, this.world.hasStatus(me, 'silence') || this.world.hasStatus(me, 'stun'));
    this.hud.update(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private menu(): void {
    const el = h('div.pause-menu');
    el.innerHTML = `
      <div class="panel pixel-panel">
        <h2>PARTIDA ONLINE</h2>
        <p class="muted">${esc(this.world.mode.name)} · ${esc(this.world.map.name)}</p>
        <p class="muted small">Online não dá pra pausar: a partida continua rolando.</p>
        <button class="btn btn-yellow" data-a="back">VOLTAR PRO JOGO</button>
        <button class="btn btn-red" data-a="quit">SAIR (seu lutador vira BOT)</button>
        <p class="muted small">Sair antes do fim não dá prêmios.</p>
      </div>`;
    el.addEventListener('click', (ev) => {
      const a = (ev.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'back') el.remove();
      if (a === 'quit') {
        net.send('match.leave');
        this.dispose();
        audio.playMusic('music_menu');
        this.app.home();
      }
    });
    this.root.appendChild(el);
  }

  private onEnd(m: Record<string, unknown>): void {
    if (m.profile) store.setProfile(m.profile);
    const summary = m.summary as MatchSummary;
    const rewards = (m.rewards as MatchRewards | null) ?? null;
    const w = this.world;
    const me = w.fighters[this.me]!;
    this.dispose();
    this.app.show(
      resultsScreen(this.app, summary, w, me, () => this.app.show(socialScreen(this.app, 'sala')), {
        rewards: rewards ?? { gains: [], moedas: 0, trophies: 0, xp: 0, passXp: 0, drop: false, missions: [], oldTrophies: store.profile?.trophies ?? 0, newTrophies: store.profile?.trophies ?? 0 },
        againLabel: 'VOLTAR PRA SALA',
      }),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const f of this.offs) f();
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.root.remove();
    if (current === this) current = null;
  }
}
