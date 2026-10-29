import type { AbilityDef, CharacterDef } from '../content/types';
import { alpha, darken, lighten } from '../art/color';
import { clamp, len, TAU } from '../engine/math';
import { newCanvas } from '../pixel/buffer';
import { INK_HEX } from '../pixel/palette';
import { petFrame } from '../pixel/pets';
import { CharSprite, ORIGIN_X, ORIGIN_Y } from '../pixel/sprite';
import { T, TILE } from '../sim/map';
import type { Fighter, Pickup, Projectile, Prop, Summon } from '../sim/types';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { Fx, type FxHooks, zoneColor } from './fx';
import { MapArt, TA, WALL_HA } from './mapArt';
import { Particles } from './particles';
import { pixDither, pixEllipse, pixLine, pixPoly, pixRect, pixRing } from './pix';
import { projSprite, PROJ_SPR } from './projectileArt';
import { THEMES, type Theme } from './theme';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

export interface AimPreview {
  ability: AbilityDef;
  kind: 'attack' | 'skill' | 'super';
  ax: number;
  ay: number;
  ad: number;
}

interface Visual {
  sprite: CharSprite;
  petX: number;
  petY: number;
  petFlip: boolean;
  flash: number;
  lastCastT: number;
  wasAlive: boolean;
  hpShown: number;
}

/** fonte pixel pra textos no canvas */
export const PIXEL_FONT = '"Press Start 2P", "Pixelify Sans", monospace';

const whiteCache = new WeakMap<object, Canvas>();
function whiteOf(src: Canvas): Canvas {
  let w = whiteCache.get(src);
  if (!w) {
    w = newCanvas(src.width, src.height);
    const g = w.getContext('2d') as CanvasRenderingContext2D;
    g.drawImage(src as CanvasImageSource, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w.width, w.height);
    whiteCache.set(src, w);
  }
  return w;
}

/**
 * RENDERIZADOR DA PARTIDA (pixel art)
 * 1) desenha o mundo num buffer pequeno (1 pixel de arte = 2 px de mundo)
 * 2) amplia esse buffer com ESCALA INTEIRA (cada pixel fica nítido)
 * 3) por cima, em resolução cheia: nomes, números de dano, vinheta
 */
export class WorldRenderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly fx: Fx;
  readonly mapArt: MapArt;
  readonly theme: Theme;
  private low: HTMLCanvasElement;
  private lg: CanvasRenderingContext2D;
  /** pixels de tela (dispositivo) por pixel de arte */
  S = 3;
  private lowW = 1;
  private lowH = 1;
  private devW = 1;
  private devH = 1;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  /** pixel do buffer onde fica o pixel de arte (0,0) do mapa */
  private ox = 0;
  private oy = 0;
  private fracX = 0;
  private fracY = 0;
  private visuals = new Map<number, Visual>();
  private sprCache = new Map<string, Canvas>();
  time = 0;
  aim: AimPreview | null = null;
  lowQuality = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly world: World,
    readonly localId: number,
    hooks: FxHooks,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.low = document.createElement('canvas');
    this.lg = this.low.getContext('2d', { alpha: false })!;
    this.theme = THEMES[world.map.theme] ?? THEMES.quarteirao;
    this.mapArt = new MapArt(world.map, this.theme);
    this.fx = new Fx(world, this.particles, this.cam, this.theme, localId, hooks);
    this.resize();
    const me = world.fighters[localId];
    if (me) this.cam.follow(me.x, me.y, 0, true);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width || window.innerWidth);
    this.cssH = Math.max(1, r.height || window.innerHeight);
    this.dpr = Math.min(this.lowQuality ? 1.5 : 3, window.devicePixelRatio || 1);
    this.devW = Math.round(this.cssW * this.dpr);
    this.devH = Math.round(this.cssH * this.dpr);
    this.canvas.width = this.devW;
    this.canvas.height = this.devH;
    // escala inteira: ~600 pixels de arte na largura (≈ 1200 px de mundo)
    const landscape = this.devW >= this.devH;
    this.S = Math.max(1, Math.round((landscape ? this.devW : this.devH) / 600));
    // telas baixas: garante pelo menos ~250 pixels de arte de altura
    while (this.S > 1 && this.devH / this.S < 250) this.S--;
    this.lowW = Math.ceil(this.devW / this.S) + 2;
    this.lowH = Math.ceil(this.devH / this.S) + 2;
    this.low.width = this.lowW;
    this.low.height = this.lowH;
    this.lg.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
    // zoom da câmera (css px por px de mundo) — usado pelo HUD/controles
    this.cam.zoom = this.S / 2 / this.dpr;
  }

  private visual(f: Fighter): Visual {
    let v = this.visuals.get(f.id);
    if (!v) {
      v = { sprite: new CharSprite(f.def), petX: f.x - 40, petY: f.y, petFlip: false, flash: 0, lastCastT: -1, wasAlive: true, hpShown: f.hp };
      this.visuals.set(f.id, v);
    }
    return v;
  }

  update(dt: number): void {
    this.time += dt;
    this.cam.update(dt);
    this.particles.update(dt);
    this.fx.update(dt);
    const w = this.world;
    for (const f of w.fighters) {
      const v = this.visual(f);
      const sp = v.sprite;
      if (f.lastCast && f.lastCast.t !== v.lastCastT) {
        v.lastCastT = f.lastCast.t;
        const pose = f.lastCast.kind === 'attack' ? f.def.attack.pose : f.lastCast.kind === 'super' ? f.def.super.pose : f.def.skills[f.lastCast.idx]?.pose;
        if (pose === 'cast' || pose === 'play') sp.playAction(f.def.anim.attack === 'boombox' ? 'atk_boombox' : 'cast');
        else if (pose === 'throw') sp.playAction('atk_throw');
        else if (pose === 'slam') sp.playAction('atk_heavy_swing');
        else sp.playAction('attack');
      }
      if (!f.alive) {
        v.wasAlive = false;
        continue;
      }
      if (!v.wasAlive) {
        v.wasAlive = true;
        v.hpShown = f.hp;
      }
      const st = w.over ? (w.winner === f.team ? 'victory' : 'defeat') : f.dash ? 'dash' : w.hasStatus(f, 'stun') || w.hasStatus(f, 'freeze') ? 'stunned' : f.moving || f.jump ? 'run' : 'idle';
      sp.setState(st);
      const recently = w.time - (f.lastCast?.t ?? -9) < 0.6;
      sp.anim.lookAt(Math.cos(f.aim), Math.sin(f.aim), f.aiming || recently);
      sp.update(dt);
      v.flash = Math.max(0, v.flash - dt * 7);
      v.hpShown += (f.hp - v.hpShown) * Math.min(1, dt * 6);
      if (f.pet) {
        const side = sp.facing > 0 ? -1 : 1;
        const tx = f.x + side * 46;
        const ty = f.y - 4;
        v.petX += (tx - v.petX) * Math.min(1, dt * 5);
        v.petY += (ty - v.petY) * Math.min(1, dt * 5);
        v.petFlip = sp.facing < 0;
      }
    }
  }

  onHit(targetId: number): void {
    const v = this.visuals.get(targetId);
    if (v) {
      v.flash = 1;
      v.sprite.playAction('hit');
    }
  }

  // ---------------------------------------------------- conversão de coordenadas
  private AX(x: number): number {
    return Math.round(x / 2) + this.ox;
  }
  private AY(y: number): number {
    return Math.round(y / 2) + this.oy;
  }

  /** posição de TELA (css px) de um ponto do mundo — pro controle com mouse */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const ax = x / 2 + this.ox - this.fracX;
    const ay = y / 2 + this.oy - this.fracY;
    return { x: (ax * this.S) / this.dpr, y: (ay * this.S) / this.dpr };
  }

  // ---------------------------------------------------------------- RENDER

  render(interp: number): void {
    const w = this.world;
    const me = w.fighters[this.localId];
    if (me) {
      const ix = me.px + (me.x - me.px) * interp;
      const iy = me.py + (me.y - me.py) * interp;
      let lx = 0;
      let ly = 0;
      if (this.aim && this.aim.ability.aim !== 'self') {
        lx = this.aim.ax * Math.min(170, this.aim.ability.range * 0.35);
        ly = this.aim.ay * Math.min(120, this.aim.ability.range * 0.25);
      }
      this.cam.follow(ix + lx, iy + ly - 30, 1 / 60);
    }
    // limita a câmera ao mapa
    const visW = (this.lowW - 2) * 2;
    const visH = (this.lowH - 2) * 2;
    const mw = w.map.widthPx;
    const mh = w.map.heightPx;
    this.cam.x = visW >= mw ? mw / 2 : clamp(this.cam.x, visW / 2 - 40, mw - visW / 2 + 40);
    this.cam.y = visH >= mh ? mh / 2 : clamp(this.cam.y, visH / 2 - 80, mh - visH / 2 + 40);
    // centro em pixels de arte (com fração pra rolagem suave)
    const cax = this.cam.cx / 2;
    const cay = this.cam.cy / 2;
    const left = cax - (this.lowW - 2) / 2;
    const top = cay - (this.lowH - 2) / 2;
    const bx = Math.floor(left);
    const by = Math.floor(top);
    this.fracX = left - bx;
    this.fracY = top - by;
    this.ox = -bx + 1;
    this.oy = -by + 1;
    const g = this.lg;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = this.theme.bg;
    g.fillRect(0, 0, this.lowW, this.lowH);
    // área visível em pixels de arte do mapa
    const ax0 = bx - 2;
    const ay0 = by - WALL_HA - 4;
    const ax1 = bx + this.lowW + 2;
    const ay1 = by + this.lowH + 4;
    const tx0 = Math.floor(ax0 / TA) - 1;
    const ty0 = Math.floor(ay0 / TA) - 1;
    const tx1 = Math.floor(ax1 / TA) + 1;
    const ty1 = Math.floor(ay1 / TA) + 2;

    // 1) chão
    this.mapArt.sync();
    this.mapArt.drawFloor(g, this.ox, this.oy, ax0, ay0, ax1, ay1);
    this.mapArt.drawAnimated(g, this.ox, this.oy, tx0, ty0, tx1, ty1, this.time);

    // 2) chão: zonas, armadilhas, marcas, partículas de chão, mira, sombras
    this.drawZones();
    this.drawTraps();
    this.drawMeteorMarks();
    this.particles.draw(g, this.ox, this.oy, 'ground');
    this.drawAimPreview(interp);
    for (const f of w.fighters) if (f.alive && this.isVisible(f)) this.drawGroundMark(f, interp);
    for (const p of w.pickups) this.drawPickupShadow(p);

    // 3) tudo que tem altura, ordenado por profundidade
    type D = { y: number; fn: () => void };
    const list: D[] = [];
    for (let ty = Math.max(0, ty0); ty <= Math.min(w.map.h - 1, ty1); ty++) {
      list.push({ y: (ty + 1) * TILE - 0.5, fn: () => this.mapArt.drawWallRow(g, this.ox, this.oy, ty, tx0, tx1, this.time) });
      for (let tx = Math.max(0, tx0); tx <= Math.min(w.map.w - 1, tx1); tx++) {
        if (w.map.at(tx, ty) !== T.Bush) continue;
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        const fade = me && me.alive && len(me.x - cx, me.y - cy) < 130 ? 0.45 : 1;
        list.push({ y: ty * TILE + TILE * 0.8, fn: () => this.mapArt.drawBush(g, this.ox, this.oy, tx, ty, fade, this.time) });
      }
    }
    for (const f of w.fighters) {
      if (!f.alive || !this.isVisible(f)) continue;
      const iy = f.py + (f.y - f.py) * interp;
      list.push({ y: iy, fn: () => this.drawFighter(f, interp) });
      if (f.pet) {
        const v = this.visual(f);
        list.push({ y: v.petY, fn: () => this.drawPet(v, f) });
      }
    }
    for (const s of w.summons) if (s.alive) list.push({ y: s.y, fn: () => this.drawSummon(s, interp) });
    for (const p of w.props) if (p.alive) list.push({ y: p.y, fn: () => this.drawProp(p, interp) });
    for (const p of w.pickups) list.push({ y: p.y, fn: () => this.drawPickup(p) });
    for (const p of w.projectiles) {
      if (!p.alive) continue;
      const py = p.py + (p.y - p.py) * interp;
      list.push({ y: p.lob ? py + 200 : py + 12, fn: () => this.drawProj(p, interp) });
    }
    for (const s of this.fx.deathSkulls) list.push({ y: s.y, fn: () => this.drawDeathSkull(s) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.fn();

    // 4) ar: feixes, partículas
    this.drawBeams();
    this.particles.draw(g, this.ox, this.oy, 'air');

    // 5) barras de vida (pixel) por cima
    for (const f of w.fighters) if (f.alive && this.isVisible(f)) this.drawBars(f, interp);
    for (const s of w.summons) if (s.alive && s.def.look.kind !== 'clone') this.drawSummonBar(s);

    // 6) amplia o buffer pra tela (escala inteira, sem suavizar)
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.low, Math.round(-(1 + this.fracX) * this.S), Math.round(-(1 + this.fracY) * this.S), this.lowW * this.S, this.lowH * this.S);

    // 7) por cima em resolução cheia: textos e efeitos de tela
    this.drawOverlayText(interp);
    if (this.theme.fog !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = this.theme.fog;
      ctx.fillRect(0, 0, this.devW, this.devH);
    }
    this.drawVignette(me);
  }

  private isVisible(f: Fighter): boolean {
    const me = this.world.fighters[this.localId];
    return this.world.visibleTo(f, me ? me.team : -1);
  }

  teamColor(f: { team: number; id?: number }): string {
    const me = this.world.fighters[this.localId];
    if (f.id === this.localId) return '#ffe14d';
    if (!me) return '#ff3d4d';
    return f.team === me.team ? '#3db8ff' : '#ff3d4d';
  }

  // ------------------------------------------------------------- personagens

  private drawGroundMark(f: Fighter, interp: number): void {
    const g = this.lg;
    const x = this.AX(f.px + (f.x - f.px) * interp);
    const y = this.AY(f.py + (f.py === f.y ? f.y : f.py + (f.y - f.py) * interp));
    const big = f === this.world.boss ? 2 : 1;
    const zf = 1 - Math.min(0.6, f.z / 200);
    g.globalAlpha = 0.45;
    pixEllipse(g, x, y + 1, 12 * zf * big, 4 * zf * big, '#08040f');
    g.globalAlpha = 1;
    const col = this.teamColor(f);
    pixRing(g, x, y + 1, 15 * big, 6 * big, 1, col);
    if (f.id === this.localId) {
      // setinha da mira no chão
      const a = f.aim;
      const sx = x + Math.cos(a) * 20;
      const sy = y + 1 + Math.sin(a) * 8;
      pixPoly(g, [sx + Math.cos(a) * 4, sy + Math.sin(a) * 2, sx + Math.cos(a + 2.4) * 3, sy + Math.sin(a + 2.4) * 2, sx + Math.cos(a - 2.4) * 3, sy + Math.sin(a - 2.4) * 2], col);
    }
    if (f.superCharge >= 1) {
      const p = Math.floor(this.time * 6) % 2;
      pixRing(g, x, y + 1, 17 + p, 7 + p, 1, '#ffd23f');
    }
  }

  private drawFighter(f: Fighter, interp: number): void {
    const v = this.visual(f);
    const g = this.lg;
    const x = this.AX(f.px + (f.x - f.px) * interp);
    const y = this.AY(f.py + (f.y - f.py) * interp - f.z);
    const aura = f.def.look.aura;
    if (aura) this.drawAura(x, y, aura);
    const frame = v.sprite.frame();
    let a = 1;
    const me = this.world.fighters[this.localId];
    if (f.stealthT > 0) a = me && f.team === me.team ? 0.45 : 0.55;
    if (f.inBush && me && f.team === me.team) a = Math.min(a, 0.75);
    if (f.invulnT > 0 && Math.floor(this.time * 16) % 2 === 0) a *= 0.4;
    const sc = f === this.world.boss ? 2 : 1;
    g.globalAlpha = a;
    g.setTransform(v.sprite.facing * sc, 0, 0, sc, x, y);
    g.drawImage(frame as CanvasImageSource, -ORIGIN_X, -ORIGIN_Y);
    if (v.flash > 0.05) {
      g.globalAlpha = a * Math.min(1, v.flash);
      g.drawImage(whiteOf(frame) as CanvasImageSource, -ORIGIN_X, -ORIGIN_Y);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    // efeitos de status
    const W = this.world;
    const headY = y - 58 * sc;
    if (W.hasStatus(f, 'stun') || W.hasStatus(f, 'freeze')) {
      const fr = W.hasStatus(f, 'freeze');
      for (let i = 0; i < 3; i++) {
        const ang = this.time * 5 + (i * TAU) / 3;
        const sx = Math.round(x + Math.cos(ang) * 10);
        const sy = Math.round(headY + Math.sin(ang) * 3);
        pixRect(g, sx - 1, sy, 3, 1, fr ? '#bdf3ff' : '#ffe14d');
        pixRect(g, sx, sy - 1, 1, 3, fr ? '#bdf3ff' : '#ffe14d');
      }
      if (fr) {
        g.globalAlpha = 0.35;
        pixRect(g, x - 12, y - 50, 24, 50, '#a0e6ff');
        g.globalAlpha = 1;
      }
    }
    if (f.shield > 0) {
      const p = Math.floor(this.time * 8) % 2;
      g.globalAlpha = 0.7;
      pixRing(g, x, y - 26, 18 + p, 28 + p, 1, '#bfe6ff');
      g.globalAlpha = 1;
    }
    if (Math.random() < 0.25) {
      if (W.hasStatus(f, 'burn')) this.particles.spawn({ kind: 'spark', x: f.x + (Math.random() - 0.5) * 30, y: f.y - Math.random() * 90, vy: -120, max: 0.4, size: 3, color: '#ff8a3d' });
      if (W.hasStatus(f, 'poison')) this.particles.spawn({ kind: 'star', x: f.x + (Math.random() - 0.5) * 30, y: f.y - Math.random() * 90, vy: -50, max: 0.5, size: 3, color: '#9ef08a' });
      if (W.hasStatus(f, 'slow')) this.particles.spawn({ kind: 'dust', x: f.x + (Math.random() - 0.5) * 30, y: f.y, max: 0.4, size: 6, color: '#78c8ff' });
    }
  }

  private drawAura(x: number, y: number, aura: NonNullable<CharacterDef['look']['aura']>): void {
    const g = this.lg;
    const pulse = Math.floor(this.time * 4) % 2;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    const img = this.particles.glow(aura.color, 30);
    g.drawImage(img as CanvasImageSource, x - 28 - pulse, y - 60 - pulse, 56 + pulse * 2, 64 + pulse * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (Math.random() < (this.lowQuality ? 0.15 : 0.4)) {
      const c = aura.kind === 'prism' ? (Math.random() < 0.5 ? aura.color : (aura.color2 ?? aura.color)) : aura.color;
      const kind = aura.kind === 'smoke' ? 'smoke' : aura.kind === 'flame' ? 'spark' : 'star';
      const wx = (x - this.ox) * 2;
      const wy = (y - this.oy) * 2;
      this.particles.spawn({
        kind,
        x: wx + (Math.random() - 0.5) * 50,
        y: wy - Math.random() * 100,
        vy: -60 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 30,
        max: 0.6 + Math.random() * 0.4,
        size: aura.kind === 'smoke' ? 10 : 3,
        color: c,
      });
    }
  }

  private drawPet(v: Visual, f: Fighter): void {
    if (!f.pet) return;
    const g = this.lg;
    const fly = f.pet.motion === 'flap' || f.pet.motion === 'float' || f.pet.motion === 'orbit';
    const bob = Math.round(Math.sin(this.time * 3 + f.id) * 2);
    const x = this.AX(v.petX);
    const y = this.AY(v.petY);
    g.globalAlpha = 0.35;
    pixEllipse(g, x, y, 6, 2, '#08040f');
    g.globalAlpha = 1;
    const fr = petFrame(f.pet, this.time + f.id * 0.37);
    g.setTransform(v.petFlip ? -1 : 1, 0, 0, 1, x, y - (fly ? 22 : 6) + bob);
    g.drawImage(fr as CanvasImageSource, -16, -17);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawBars(f: Fighter, interp: number): void {
    const g = this.lg;
    const v = this.visual(f);
    const sc = f === this.world.boss ? 2 : 1;
    const x = this.AX(f.px + (f.x - f.px) * interp);
    const y = this.AY(f.py + (f.y - f.py) * interp - f.z) - 62 * sc;
    const isMe = f.id === this.localId;
    const bw = isMe ? 30 : 26;
    const bh = 3;
    const col = this.teamColor(f);
    const bx = x - (bw >> 1);
    pixRect(g, bx - 1, y - 1, bw + 2, bh + 2, INK_HEX);
    pixRect(g, bx, y, bw, bh, '#3a2236');
    const frac = clamp(f.hp / f.maxHp, 0, 1);
    const shown = clamp(v.hpShown / f.maxHp, 0, 1);
    if (shown > frac) pixRect(g, bx, y, Math.round(bw * shown), bh, '#ffffff');
    const hc = isMe ? (frac < 0.3 ? '#ff5d4d' : '#5dff7a') : col;
    pixRect(g, bx, y, Math.max(frac > 0 ? 1 : 0, Math.round(bw * frac)), bh, hc);
    pixRect(g, bx, y, Math.round(bw * frac), 1, lighten(hc, 0.35));
    if (f.shield > 0) pixRect(g, bx, y + bh - 1, Math.round(bw * clamp(f.shield / f.maxHp, 0, 1)), 1, '#bfe6ff');
    if (isMe) {
      const n = f.maxAmmo;
      const segW = Math.floor((bw - (n - 1)) / n);
      for (let i = 0; i < n; i++) {
        const fill = clamp(f.ammo - i, 0, 1);
        const sx = bx + i * (segW + 1);
        pixRect(g, sx - 1, y + bh + 1, segW + 2, 4, INK_HEX);
        pixRect(g, sx, y + bh + 2, Math.round(segW * fill), 2, fill >= 1 ? '#ffb02e' : '#8a5a1a');
      }
    }
  }

  /** nomes, BOT, coroa de procurado e números de dano (fonte pixel, resolução cheia) */
  private drawOverlayText(interp: number): void {
    const ctx = this.ctx;
    const S = this.S;
    const n = Math.max(1, Math.round(S / 2));
    const toDev = (ax: number, ay: number): [number, number] => [Math.round((ax - 1 - this.fracX) * S), Math.round((ay - 1 - this.fracY) * S)];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const outlined = (text: string, x: number, y: number, size: number, color: string) => {
      ctx.font = `${size}px ${PIXEL_FONT}`;
      const o = Math.max(1, Math.round(size / 8));
      ctx.fillStyle = INK_HEX;
      for (const [dx, dy] of [
        [-o, 0],
        [o, 0],
        [0, -o],
        [0, o],
        [-o, -o],
        [o, o],
        [-o, o],
        [o, -o],
      ])
        ctx.fillText(text, x + dx!, y + dy!);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    for (const f of this.world.fighters) {
      if (!f.alive || !this.isVisible(f)) continue;
      const sc = f === this.world.boss ? 2 : 1;
      const ax = this.AX(f.px + (f.x - f.px) * interp);
      const ay = this.AY(f.py + (f.y - f.py) * interp - f.z) - 62 * sc - 3;
      const [dx, dy] = toDev(ax, ay);
      const isMe = f.id === this.localId;
      const size = 8 * n;
      const label = f.isBot ? `${f.name} ·BOT` : f.name;
      outlined(label, dx, dy, size, isMe ? '#ffe14d' : f.isBot ? '#c8d0e0' : '#ffffff');
      if (f.wanted) outlined('♛', dx, dy - size - 2 * n, size * 1.5, '#ffd23f');
    }
    for (const p of this.particles.list) {
      if (!p.alive || p.kind !== 'text') continue;
      const t = p.life / p.max;
      const rise = (1 - t) * 34;
      const ax = Math.round(p.x / 2) + this.ox;
      const ay = Math.round((p.y - rise) / 2) + this.oy;
      const [dx, dy] = toDev(ax, ay);
      const pop = t > 0.85 ? 1.3 : 1;
      const size = Math.round((p.size / 2.2) * n * pop) * 1;
      ctx.globalAlpha = Math.min(1, t * 2.5);
      outlined(p.text, dx, dy, Math.max(8, size - (size % n)), p.color);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- mira

  private drawAimPreview(interp: number): void {
    const aim = this.aim;
    const me = this.world.fighters[this.localId];
    if (!aim || !me || !me.alive) return;
    const g = this.lg;
    const wx = me.px + (me.x - me.px) * interp;
    const wy = me.py + (me.y - me.py) * interp;
    const x = this.AX(wx);
    const y = this.AY(wy);
    const ab = aim.ability;
    const col = aim.kind === 'super' ? '#ffd23f' : aim.kind === 'skill' ? '#3df2ff' : '#ffffff';
    const ang = Math.atan2(aim.ay, aim.ax);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const fillA = 0.22;
    if (ab.indicator === 'line') {
      let L = ab.range;
      const lob = ab.effects.some((e) => e.kind === 'projectile' && e.proj.lob);
      if (!lob) {
        const hit = this.world.map.rayHit(wx, wy, wx + ca * ab.range, wy + sa * ab.range);
        if (hit) L = Math.max(30, len(hit.x - wx, hit.y - wy));
      }
      const hw = Math.max(3, ((ab.indicatorSize ?? 20) * 1.2) / 4);
      const L2 = L / 2;
      const pts = [x - sa * hw, y + ca * hw, x + ca * L2 - sa * hw, y + sa * L2 + ca * hw, x + ca * L2 + sa * hw, y + sa * L2 - ca * hw, x + sa * hw, y - ca * hw];
      g.globalAlpha = fillA;
      pixPoly(g, pts, col);
      g.globalAlpha = 0.85;
      pixLine(g, pts[0]!, pts[1]!, pts[2]!, pts[3]!, col);
      pixLine(g, pts[6]!, pts[7]!, pts[4]!, pts[5]!, col);
      pixLine(g, pts[2]!, pts[3]!, pts[4]!, pts[5]!, col);
      g.globalAlpha = 1;
    } else if (ab.indicator === 'cone') {
      const spread = ((ab.indicatorSize ?? 30) * Math.PI) / 180;
      const R = ab.range / 2;
      const pts = [x, y];
      for (let i = 0; i <= 10; i++) {
        const a = ang - spread / 2 + (spread * i) / 10;
        pts.push(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.globalAlpha = fillA;
      pixPoly(g, pts, col);
      g.globalAlpha = 0.85;
      for (let i = 2; i + 3 < pts.length; i += 2) pixLine(g, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, col);
      pixLine(g, x, y, pts[2]!, pts[3]!, col);
      pixLine(g, x, y, pts[pts.length - 2]!, pts[pts.length - 1]!, col);
      g.globalAlpha = 1;
    } else if (ab.indicator === 'circle') {
      const r = (ab.indicatorSize ?? 100) / 2;
      let cx = x;
      let cy = y;
      if (ab.aim !== 'self') {
        const d = Math.max(40, ab.range * clamp(aim.ad, 0.1, 1)) / 2;
        cx = Math.round(x + ca * d);
        cy = Math.round(y + sa * d);
        g.globalAlpha = 0.5;
        for (let k = 0; k < d; k += 6) pixRect(g, Math.round(x + ca * k), Math.round(y + sa * k), 2, 2, col);
        pixRing(g, x, y, ab.range / 2, ab.range / 2, 1, col);
        g.globalAlpha = 1;
      }
      g.globalAlpha = fillA;
      pixEllipse(g, cx, cy, r, r * 0.8, col);
      g.globalAlpha = 0.9;
      pixRing(g, cx, cy, r, r * 0.8, 1, col);
      g.globalAlpha = 1;
    } else if (ab.aim === 'self') {
      g.globalAlpha = 0.8;
      pixRing(g, x, y, 22, 16, 1, col);
      g.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------- zonas/armadilhas

  private drawZones(): void {
    const g = this.lg;
    for (const z of this.world.zones) {
      const col = z.look.color ?? zoneColor(z.look.kind);
      const x = this.AX(z.x);
      const y = this.AY(z.y);
      const r = z.radius / 2;
      g.globalAlpha = 0.22;
      pixEllipse(g, x, y, r, r * 0.8, col);
      g.globalAlpha = 0.35;
      pixDither(g, x - Math.floor(r * 0.5), y - Math.floor(r * 0.4), Math.floor(r), Math.floor(r * 0.8), col, Math.floor(this.time * 4) & 1);
      g.globalAlpha = 0.9;
      pixRing(g, x, y, r, r * 0.8, 1, col);
      g.globalAlpha = 1;
      // pontinhos girando
      for (let i = 0; i < 6; i++) {
        const a = this.time * (z.look.kind === 'void' ? 1.6 : 0.8) + (i * TAU) / 6;
        pixRect(g, Math.round(x + Math.cos(a) * r * 0.7), Math.round(y + Math.sin(a) * r * 0.55), 2, 2, lighten(col, 0.3));
      }
      if (Math.random() < 0.25) {
        const a = Math.random() * TAU;
        const d = Math.random() * z.radius;
        this.particles.spawn({
          kind: z.look.kind === 'smoke' ? 'smoke' : 'star',
          x: z.x + Math.cos(a) * d,
          y: z.y + Math.sin(a) * d * 0.8,
          vy: -40,
          max: 0.7,
          size: z.look.kind === 'smoke' ? 14 : 3,
          color: z.look.kind === 'smoke' ? '#7a6e86' : col,
        });
      }
    }
  }

  private drawTraps(): void {
    const g = this.lg;
    const me = this.world.fighters[this.localId];
    for (const tr of this.world.traps) {
      if (!me || tr.team !== me.team) continue;
      const x = this.AX(tr.x);
      const y = this.AY(tr.y);
      g.globalAlpha = 0.6;
      pixRing(g, x, y, tr.radius / 2, tr.radius / 2.6, 1, '#ffd23f');
      g.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        pixLine(g, x + Math.cos(a) * 3, y + Math.sin(a) * 2, x + Math.cos(a) * 8, y + Math.sin(a) * 6, '#5d6678');
      }
      pixRect(g, x - 1, y - 1, 3, 3, '#ff3d4d');
    }
  }

  private drawMeteorMarks(): void {
    const g = this.lg;
    for (const m of this.fx.meteorMarks) {
      const left = m.at - this.world.time;
      const p = clamp(1 - left / 1.4, 0, 1);
      const x = this.AX(m.x);
      const y = this.AY(m.y);
      g.globalAlpha = 0.9;
      pixRing(g, x, y, 70, 56, 1, '#ff3d3d');
      g.globalAlpha = 0.25 + p * 0.25;
      pixEllipse(g, x, y, 70 * p, 56 * p, '#ff3d3d');
      g.globalAlpha = 1;
      const h = (1 - p) * 300;
      const img = this.particles.glow('#ff8a3d', 16);
      g.drawImage(img as CanvasImageSource, x - 16 + h * 0.4, y - 16 - h);
      pixEllipse(g, x + h * 0.4, y - h, 6, 6, '#5a2a1a');
    }
  }

  private drawBeams(): void {
    const g = this.lg;
    for (const b of this.world.beams) {
      const o = this.world.fighters[b.owner];
      if (!o) continue;
      const sx = this.AX(o.x + Math.cos(o.aim) * 30);
      const sy = this.AY(o.y - 50 + Math.sin(o.aim) * 30);
      const ex = this.AX(b.ex);
      const ey = this.AY(b.ey - 40);
      const w = Math.max(3, Math.round(b.width / 2));
      const j = Math.floor(this.time * 30) % 2;
      g.globalAlpha = 0.45;
      pixLine(g, sx, sy, ex, ey, b.color, w + 2 + j);
      g.globalAlpha = 1;
      pixLine(g, sx, sy, ex, ey, b.color, Math.max(2, w - 2));
      pixLine(g, sx, sy, ex, ey, '#ffffff', Math.max(1, Math.floor(w / 3)));
      if (Math.random() < 0.6) this.particles.burst(b.ex, b.ey, 2, b.color, 260, 'spark');
    }
  }

  // ------------------------------------------------------- tiros / objetos

  private drawProj(p: Projectile, interp: number): void {
    const g = this.lg;
    const wx = p.px + (p.x - p.px) * interp;
    const wy = p.py + (p.y - p.py) * interp;
    const look = p.def.look;
    const z = p.lob ? p.z : 40;
    const x = this.AX(wx);
    const y = this.AY(wy);
    g.globalAlpha = 0.35;
    pixEllipse(g, x, y, Math.max(2, p.def.radius / 2.5), Math.max(1, p.def.radius / 5), '#08040f');
    g.globalAlpha = 1;
    const ang = Math.atan2(p.vy, p.vx);
    const yy = this.AY(wy - z);
    if (!this.lowQuality) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5;
      const r = Math.max(6, Math.round(p.def.radius * 0.7));
      g.drawImage(this.particles.glow(look.color, 12) as CanvasImageSource, x - r, yy - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    const spr = projSprite(look, p.def.radius, ang, Math.floor(this.time * 12 + p.id));
    if (look.spin && look.shape !== 'coin') {
      const a = Math.round(this.time * 10 + p.id) * (Math.PI / 2);
      g.setTransform(Math.round(Math.cos(a)), Math.round(Math.sin(a)), -Math.round(Math.sin(a)), Math.round(Math.cos(a)), x, yy);
      g.drawImage(spr as CanvasImageSource, -PROJ_SPR / 2, -PROJ_SPR / 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
    } else g.drawImage(spr as CanvasImageSource, x - PROJ_SPR / 2, yy - PROJ_SPR / 2);
    const tr = look.trail ?? 'none';
    if (tr !== 'none' && Math.random() < (this.lowQuality ? 0.3 : 0.7)) {
      if (tr === 'smoke') this.particles.spawn({ kind: 'smoke', x: wx, y: wy - z, size: 6, grow: 16, max: 0.4, color: '#7a6e86', big: true });
      else if (tr === 'fire') this.particles.spawn({ kind: 'spark', x: wx, y: wy - z, size: 4, max: 0.25, color: '#ff8a3d', vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 });
      else if (tr === 'void')
        this.particles.spawn({
          kind: 'star',
          x: wx,
          y: wy - z,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          size: 3,
          max: 0.35,
          color: Math.random() < 0.5 ? '#ff3df2' : '#3df2ff',
        });
      else this.particles.spawn({ kind: 'spark', x: wx, y: wy - z, size: 3, max: 0.18, color: look.color });
    }
  }

  private spr(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Canvas {
    let s = this.sprCache.get(key);
    if (!s) {
      s = newCanvas(w, h);
      paint(s.getContext('2d') as CanvasRenderingContext2D);
      this.sprCache.set(key, s);
    }
    return s;
  }

  private drawProp(p: Prop, interp: number): void {
    const g = this.lg;
    const x = this.AX(p.px + (p.x - p.px) * interp);
    const y = this.AY(p.py + (p.y - p.py) * interp);
    g.globalAlpha = 0.4;
    pixEllipse(g, x + 2, y + 1, p.radius / 2 + 1, p.radius / 5 + 1, '#08040f');
    g.globalAlpha = 1;
    const s = this.spr(`prop:${p.kind}`, 32, 36, (c) => paintProp(c, p.kind));
    const tilt = Math.abs(p.vx) > 120 ? (Math.floor(this.time * 10) % 2 ? 1 : -1) : 0;
    g.drawImage(s as CanvasImageSource, x - 16 + tilt, this.AY(p.y - p.z) - 30);
  }

  private drawPickupShadow(p: Pickup): void {
    const g = this.lg;
    const x = this.AX(p.x);
    const y = this.AY(p.y);
    g.globalAlpha = 0.35;
    pixEllipse(g, x, y + 2, 7, 3, '#08040f');
    g.globalAlpha = 1;
    if (p.kind === 'skull') {
      const me = this.world.fighters[this.localId];
      const col = me && p.team === me.team ? '#3db8ff' : '#ff3d4d';
      if (Math.floor(this.time * 6) % 2) pixRing(g, x, y + 2, 11, 5, 1, col);
    }
  }

  private drawPickup(p: Pickup): void {
    const g = this.lg;
    const bob = Math.round(Math.sin(this.time * 4 + p.id) * 2);
    const x = this.AX(p.x);
    const y = this.AY(p.y - 24 - p.z) + bob;
    if (p.t < 3 && Math.floor(this.time * 10) % 2) return;
    const s = this.spr(`pick:${p.kind}:${p.kind === 'coin' ? Math.floor(this.time * 8 + p.id) % 4 : 0}`, 20, 20, (c) => paintPickup(c, p.kind, Math.floor(this.time * 8 + p.id) % 4));
    const glowC = p.kind === 'skull' ? '#efe6d2' : p.kind === 'heal' ? '#5dffa0' : p.kind === 'power' ? '#b77bff' : '#ffd23f';
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35;
    g.drawImage(this.particles.glow(glowC, 14) as CanvasImageSource, x - 14, y - 14);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(s as CanvasImageSource, x - 10, y - 10);
  }

  private drawSummon(s: Summon, interp: number): void {
    const g = this.lg;
    const x = this.AX(s.px + (s.x - s.px) * interp);
    const y = this.AY(s.py + (s.y - s.py) * interp);
    const owner = this.world.fighters[s.owner];
    g.globalAlpha = 0.4;
    pixEllipse(g, x, y + 1, 10, 4, '#08040f');
    g.globalAlpha = 1;
    pixRing(g, x, y + 1, 12, 5, 1, this.teamColor({ team: s.team }));
    const kind = s.def.look.kind;
    const c = s.def.look.color;
    if (kind === 'clone' && owner) {
      const v = this.visual(owner);
      const frame = v.sprite.frame();
      g.globalAlpha = 0.8;
      g.setTransform(s.vx >= 0 ? 1 : -1, 0, 0, 1, x, y);
      g.drawImage(frame as CanvasImageSource, -ORIGIN_X, -ORIGIN_Y);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      return;
    }
    const f = Math.floor(this.time * 6 + s.id) % 2;
    const spr = this.spr(`summon:${kind}:${c}:${f}`, 28, 36, (cx) => paintSummon(cx, kind, c, s.def.look.color2 ?? '#ffffff', f));
    g.drawImage(spr as CanvasImageSource, x - 14, y - 34);
    if (kind === 'turret') {
      const a = s.aim;
      pixLine(g, x, y - 22, x + Math.cos(a) * 10, y - 22 + Math.sin(a) * 6, INK_HEX, 3);
      pixLine(g, x, y - 22, x + Math.cos(a) * 9, y - 22 + Math.sin(a) * 5, lighten(c, 0.2), 1);
    }
  }

  private drawSummonBar(s: Summon): void {
    const g = this.lg;
    const x = this.AX(s.x);
    const y = this.AY(s.y) - 40;
    pixRect(g, x - 11, y - 1, 22, 4, INK_HEX);
    pixRect(g, x - 10, y, Math.round(20 * clamp(s.hp / s.maxHp, 0, 1)), 2, this.teamColor({ team: s.team }));
  }

  private drawDeathSkull(s: Fx['deathSkulls'][number]): void {
    const g = this.lg;
    if (s.t < 0.6 && Math.floor(this.time * 12) % 2) return;
    const spr = this.spr('deathskull', 20, 20, (c) => paintPickup(c, 'skull', 0));
    const x = this.AX(s.x);
    const y = this.AY(s.y - 16 - s.z);
    g.globalAlpha = 0.35;
    pixEllipse(g, this.AX(s.x), this.AY(s.y), 6, 2, '#08040f');
    g.globalAlpha = 1;
    g.drawImage(spr as CanvasImageSource, x - 10, y - 10);
  }

  // ------------------------------------------------------------- tela cheia

  private vignette: Canvas | null = null;
  private drawVignette(me: Fighter | undefined): void {
    const ctx = this.ctx;
    const W = this.devW;
    const H = this.devH;
    if (!this.vignette || this.vignette.width !== W || this.vignette.height !== H) {
      this.vignette = newCanvas(W, H);
      const g = this.vignette.getContext('2d') as CanvasRenderingContext2D;
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.78);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(6,0,16,0.5)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vignette as CanvasImageSource, 0, 0);
    if (me && me.alive && me.hp < me.maxHp * 0.3) {
      ctx.fillStyle = `rgba(255,20,50,${Math.floor(this.time * 3) % 2 ? 0.16 : 0.07})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.fx.flashT > 0) {
      ctx.fillStyle = alpha(this.fx.flashColor, Math.min(0.4, this.fx.flashT * 1.8));
      ctx.fillRect(0, 0, W, H);
    }
    if (me && !me.alive && !this.world.over) {
      ctx.fillStyle = 'rgba(20,10,30,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  get size(): { w: number; h: number } {
    return { w: this.cssW, h: this.cssH };
  }

  dispose(): void {
    this.visuals.clear();
    this.sprCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Pequenos sprites de objetos (pixel)
// ---------------------------------------------------------------------------

function paintProp(g: CanvasRenderingContext2D, kind: string): void {
  const ink = INK_HEX;
  if (kind === 'crate') {
    pixRect(g, 3, 6, 26, 28, ink);
    pixRect(g, 4, 7, 24, 12, '#c08a4a');
    pixRect(g, 4, 19, 24, 14, '#8a5a2e');
    pixRect(g, 4, 7, 24, 1, '#e0b070');
    pixRect(g, 6, 9, 20, 1, '#6a3e1a');
    pixRect(g, 6, 16, 20, 1, '#6a3e1a');
    pixLine(g, 6, 9, 25, 16, '#6a3e1a');
    pixRect(g, 4, 19, 24, 1, '#5a3010');
    for (let x = 8; x < 28; x += 6) pixRect(g, x, 21, 1, 11, '#6a3e1a');
  } else if (kind === 'barrel') {
    pixRect(g, 7, 4, 18, 30, ink);
    pixRect(g, 6, 6, 20, 26, ink);
    pixRect(g, 8, 5, 16, 28, '#c0392b');
    pixRect(g, 7, 7, 18, 24, '#c0392b');
    pixRect(g, 8, 7, 3, 24, '#e05a40');
    pixRect(g, 21, 7, 3, 24, '#8a1a10');
    pixRect(g, 7, 12, 18, 1, '#5a0a08');
    pixRect(g, 7, 26, 18, 1, '#5a0a08');
    pixEllipse(g, 16, 6, 8, 2, '#e05a40');
    pixPoly(g, [16, 14, 20, 21, 12, 21], '#ffd23f');
    pixRect(g, 15, 16, 2, 3, ink);
    pixRect(g, 15, 20, 2, 1, ink);
  } else {
    pixEllipse(g, 16, 26, 13, 8, ink);
    pixEllipse(g, 16, 25, 12, 7, '#2a2a33');
    pixEllipse(g, 16, 23, 12, 5, '#4a4a55');
    pixEllipse(g, 16, 23, 5, 2, '#16161c');
  }
}

function paintPickup(g: CanvasRenderingContext2D, kind: string, f: number): void {
  const ink = INK_HEX;
  if (kind === 'skull') {
    pixEllipse(g, 10, 9, 7, 6.5, ink);
    pixRect(g, 5, 11, 10, 7, ink);
    pixEllipse(g, 10, 9, 6, 5.5, '#efe6d2');
    pixRect(g, 6, 12, 8, 5, '#efe6d2');
    pixRect(g, 6, 8, 3, 3, '#1c1028');
    pixRect(g, 11, 8, 3, 3, '#1c1028');
    pixRect(g, 9, 12, 2, 1, '#1c1028');
    for (let x = 6; x < 14; x += 2) pixRect(g, x, 15, 1, 2, '#9a8a6a');
    pixRect(g, 6, 5, 2, 1, '#ffffff');
  } else if (kind === 'heal') {
    pixRect(g, 3, 3, 14, 14, ink);
    pixRect(g, 4, 4, 12, 12, '#f7f7fb');
    pixRect(g, 4, 14, 12, 2, '#c8c8d8');
    pixRect(g, 8, 6, 4, 8, '#ff3d5c');
    pixRect(g, 6, 8, 8, 4, '#ff3d5c');
  } else if (kind === 'power') {
    pixPoly(g, [10, 1, 13, 7, 19, 8, 14, 12, 16, 19, 10, 15, 4, 19, 6, 12, 1, 8, 7, 7], ink);
    pixPoly(g, [10, 3, 12, 8, 17, 9, 13, 12, 14, 17, 10, 14, 6, 17, 7, 12, 3, 9, 8, 8], '#d6a8ff');
    pixRect(g, 8, 8, 2, 2, '#ffffff');
  } else {
    const w = [7, 5, 2, 5][f]!;
    pixEllipse(g, 10, 10, w + 1, 8, ink);
    pixEllipse(g, 10, 10, w, 7, '#ffd23f');
    if (w > 3) pixRect(g, 9, 6, 2, 8, '#c98a00');
  }
}

function paintSummon(g: CanvasRenderingContext2D, kind: string, c: string, c2: string, f: number): void {
  const ink = INK_HEX;
  if (kind === 'skeleton' || kind === 'minion') {
    // esqueletinho capanga
    const by = f ? 1 : 0;
    pixEllipse(g, 14, 9 + by, 7, 6.5, ink);
    pixEllipse(g, 14, 9 + by, 6, 5.5, '#efe6d2');
    pixRect(g, 10, 8 + by, 3, 3, '#1c1028');
    pixRect(g, 16, 8 + by, 3, 3, '#1c1028');
    pixRect(g, 11, 9 + by, 1, 1, c === '#efe6d2' ? '#ff3df2' : c);
    pixRect(g, 17, 9 + by, 1, 1, c === '#efe6d2' ? '#ff3df2' : c);
    pixRect(g, 10, 15, 9, 10, ink);
    pixRect(g, 11, 16, 7, 8, '#2a2433');
    pixRect(g, 13, 17, 3, 1, '#efe6d2');
    pixRect(g, 13, 19, 3, 1, '#efe6d2');
    pixRect(g, 10, 25, 3, 8 - by, ink);
    pixRect(g, 16, 25, 3, 7 + by, ink);
    pixRect(g, 11, 25, 1, 6 - by, '#efe6d2');
    pixRect(g, 17, 25, 1, 5 + by, '#efe6d2');
    return;
  }
  // torre / totem / caixa de som
  pixRect(g, 6, 14, 16, 21, ink);
  pixRect(g, 7, 15, 14, 19, darken(c, 0.5));
  pixRect(g, 7, 15, 14, 2, darken(c, 0.25));
  if (kind === 'speaker') {
    pixEllipse(g, 14, 24, 5 + f, 5 + f, '#1b1a22');
    pixEllipse(g, 14, 24, 2, 2, c);
  } else if (kind === 'turret') {
    pixEllipse(g, 14, 12, 6, 5, ink);
    pixEllipse(g, 14, 12, 5, 4, c);
  } else {
    pixPoly(g, [14, 2 + f, 19, 8, 14, 14 - f, 9, 8], ink);
    pixPoly(g, [14, 4 + f, 17, 8, 14, 12 - f, 11, 8], c);
    pixRect(g, 10, 20, 8, 2, c2);
    pixRect(g, 10, 26, 8, 2, c2);
  }
}
