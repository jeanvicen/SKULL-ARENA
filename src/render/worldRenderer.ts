import type { AbilityDef, CharacterDef, PetDef } from '../content/types';
import { RARITY } from '../content/rarities';
import { Animator } from '../art/animator';
import { CLIPS } from '../art/anims';
import { alpha, darken, lighten } from '../art/color';
import { PetSprite } from '../art/pets';
import type { Mat } from '../art/rig';
import { CharacterSprite, makeCanvas } from '../art/sprite';
import { TAU, clamp, len } from '../engine/math';
import { T, TILE } from '../sim/map';
import type { Fighter, Pickup, Prop, Summon } from '../sim/types';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { Fx, type FxHooks, zoneColor } from './fx';
import { MapArt, WALL_H } from './mapArt';
import { Particles } from './particles';
import { drawProjectile } from './projectileArt';
import { THEMES, type Theme } from './theme';

/** px de mundo por unidade do rig (altura do personagem ≈ 86 px) */
export const CHAR_SCALE = 0.86;

export interface AimPreview {
  ability: AbilityDef;
  kind: 'attack' | 'skill' | 'super';
  ax: number;
  ay: number;
  ad: number;
}

interface Visual {
  anim: Animator;
  sprite: CharacterSprite;
  pet: PetSprite | null;
  petX: number;
  petY: number;
  petFlip: boolean;
  flash: number;
  lastCastT: number;
  wasAlive: boolean;
  hpShown: number;
}

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * RENDERIZADOR DA PARTIDA (Canvas 2D)
 * Ordem: chão → efeitos de chão → [paredes, arbustos, objetos, personagens, tiros]
 * ordenados por profundidade (Y) → partículas → barras de vida → overlays de tela.
 */
export class WorldRenderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly fx: Fx;
  readonly mapArt: MapArt;
  readonly theme: Theme;
  private visuals = new Map<number, Visual>();
  private summonSprites = new Map<string, CharacterSprite>();
  private summonAnims = new Map<number, Animator>();
  private propSprites = new Map<string, Canvas>();
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private k = 1;
  private ox = 0;
  private oy = 0;
  time = 0;
  /** preview de mira do jogador local */
  aim: AimPreview | null = null;
  lowQuality = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly world: World,
    readonly localId: number,
    hooks: FxHooks,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
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
    this.dpr = Math.min(this.lowQuality ? 1.25 : 2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.cam.fit(this.cssW, this.cssH);
    // sprites dos personagens dependem da escala: refaz
    for (const v of this.visuals.values()) v.sprite.dispose();
    this.visuals.clear();
    this.summonSprites.clear();
    this.propSprites.clear();
  }

  private visual(f: Fighter): Visual {
    let v = this.visuals.get(f.id);
    if (!v) {
      const ppu = CHAR_SCALE * (f.def.look.scale ?? 1) * this.cam.zoom * this.dpr;
      const sprite = this.spriteFor(f.def, ppu);
      const anim = new Animator(f.def.anim);
      v = { anim, sprite, pet: f.pet ? new PetSprite(f.pet, 0.8 * this.cam.zoom * this.dpr) : null, petX: f.x - 40, petY: f.y, petFlip: false, flash: 0, lastCastT: -1, wasAlive: true, hpShown: f.hp };
      this.visuals.set(f.id, v);
    }
    return v;
  }

  private spriteCache = new Map<string, CharacterSprite>();
  private spriteFor(def: CharacterDef, ppu: number): CharacterSprite {
    const key = `${def.id}@${ppu.toFixed(3)}`;
    let s = this.spriteCache.get(key);
    if (!s) {
      s = new CharacterSprite(def.look, ppu);
      this.spriteCache.set(key, s);
    }
    return s;
  }

  /** Atualiza animações/efeitos com o tempo real do frame. */
  update(dt: number): void {
    this.time += dt;
    this.cam.update(dt);
    this.particles.update(dt);
    this.fx.update(dt);
    const w = this.world;
    for (const f of w.fighters) {
      const v = this.visual(f);
      const a = v.anim;
      if (f.lastCast && f.lastCast.t !== v.lastCastT) {
        v.lastCastT = f.lastCast.t;
        const pose = f.lastCast.kind === 'attack' ? f.def.attack.pose : f.lastCast.kind === 'super' ? f.def.super.pose : f.def.skills[f.lastCast.idx]?.pose;
        if (pose === 'cast' || pose === 'play') a.play(f.def.anim.attack === 'boombox' ? CLIPS.atk_boombox : CLIPS.atk_cast);
        else if (pose === 'throw') a.play(CLIPS.atk_throw);
        else if (pose === 'slam') a.play(CLIPS.atk_heavy_swing);
        else a.playAttack();
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
      a.setState(st);
      const recently = w.time - (f.lastCast?.t ?? -9) < 0.6;
      a.lookAt(Math.cos(f.aim), Math.sin(f.aim), f.aiming || recently);
      a.update(dt);
      v.flash = Math.max(0, v.flash - dt * 6);
      v.hpShown += (f.hp - v.hpShown) * Math.min(1, dt * 6);
      // pet segue com atraso
      if (v.pet) {
        const side = a.facing > 0 ? -1 : 1;
        const tx = f.x + side * 44;
        const ty = f.y - 6;
        v.petX += (tx - v.petX) * Math.min(1, dt * 5);
        v.petY += (ty - v.petY) * Math.min(1, dt * 5);
        v.petFlip = a.facing < 0;
      }
    }
  }

  onHit(targetId: number): void {
    const v = this.visuals.get(targetId);
    if (v) {
      v.flash = 1;
      v.anim.playHit();
    }
  }

  // -------------------------------------------------------------------------

  render(interp: number): void {
    const ctx = this.ctx;
    const w = this.world;
    const me = w.fighters[this.localId];
    // câmera
    if (me) {
      const ix = me.px + (me.x - me.px) * interp;
      const iy = me.py + (me.y - me.py) * interp;
      let lx = 0;
      let ly = 0;
      if (this.aim && this.aim.ability.aim !== 'self') {
        lx = this.aim.ax * Math.min(160, this.aim.ability.range * 0.35);
        ly = this.aim.ay * Math.min(120, this.aim.ability.range * 0.25);
      }
      this.cam.follow(ix + lx, iy + ly - 20, 1 / 60);
    }
    this.cam.clampTo(w.map.widthPx, w.map.heightPx, this.cssW, this.cssH);
    const k = this.cam.zoom * this.dpr;
    this.k = k;
    this.ox = (this.cssW * this.dpr) / 2 - this.cam.cx * k;
    this.oy = (this.cssH * this.dpr) / 2 - this.cam.cy * k;
    const vx0 = this.cam.cx - this.cssW / this.cam.zoom / 2 - TILE;
    const vy0 = this.cam.cy - this.cssH / this.cam.zoom / 2 - TILE * 2;
    const vx1 = this.cam.cx + this.cssW / this.cam.zoom / 2 + TILE;
    const vy1 = this.cam.cy + this.cssH / this.cam.zoom / 2 + TILE * 2;
    const tx0 = Math.floor(vx0 / TILE);
    const ty0 = Math.floor(vy0 / TILE);
    const tx1 = Math.floor(vx1 / TILE);
    const ty1 = Math.floor(vy1 / TILE);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 1) chão
    this.mapArt.sync();
    this.mapArt.drawFloor(ctx, this.ox, this.oy, k, vx0, vy0, vx1, vy1);
    this.mapArt.drawAnimated(ctx, k, this.ox, this.oy, tx0, ty0, tx1, ty1, this.time);

    // 2) efeitos de chão
    this.world2();
    this.drawZones();
    this.drawTraps();
    this.drawMeteorMarks();
    this.particles.draw(ctx, 'ground');
    this.drawAimPreview(interp);
    for (const f of w.fighters) if (f.alive && this.isVisible(f)) this.drawGroundMark(f, interp);
    for (const p of w.pickups) this.drawPickupShadow(p);

    // 3) objetos ordenados por profundidade
    type D = { y: number; fn: () => void };
    const list: D[] = [];
    for (let ty = Math.max(0, ty0); ty <= Math.min(w.map.h - 1, ty1 + 1); ty++) {
      list.push({ y: (ty + 1) * TILE - 0.5, fn: () => this.mapArt.drawWallRow(ctx, k, this.ox, this.oy, ty, tx0, tx1, this.time) });
      for (let tx = Math.max(0, tx0); tx <= Math.min(w.map.w - 1, tx1); tx++) {
        if (w.map.at(tx, ty) !== T.Bush) continue;
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        let fade = 1;
        if (me && me.alive && len(me.x - cx, me.y - cy) < 120) fade = 0.42;
        list.push({ y: ty * TILE + TILE * 0.8, fn: () => this.mapArt.drawBush(ctx, k, this.ox, this.oy, tx, ty, fade, this.time) });
      }
    }
    for (const f of w.fighters) {
      if (!f.alive || !this.isVisible(f)) continue;
      const iy = f.py + (f.y - f.py) * interp;
      list.push({ y: iy, fn: () => this.drawFighter(f, interp) });
      const v = this.visuals.get(f.id);
      if (v?.pet) list.push({ y: v.petY, fn: () => this.drawPet(v, f) });
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

    // 4) ar: feixes + partículas
    this.world2();
    this.drawBeams();
    this.particles.draw(ctx, 'air');

    // 5) barras de vida / nomes por cima de tudo
    for (const f of w.fighters) if (f.alive && this.isVisible(f)) this.drawOverhead(f, interp);
    for (const s of w.summons) if (s.alive && s.def.look.kind !== 'clone') this.drawSummonBar(s);

    // 6) overlays de tela
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.theme.fog !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = this.theme.fog;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.drawVignette(me);
  }

  /** transformação de mundo */
  private world2(): void {
    this.ctx.setTransform(this.k, 0, 0, this.k, this.ox, this.oy);
  }

  private isVisible(f: Fighter): boolean {
    const me = this.world.fighters[this.localId];
    const team = me ? me.team : -1;
    return this.world.visibleTo(f, team);
  }

  private teamColor(f: { team: number; id?: number }): string {
    const me = this.world.fighters[this.localId];
    if (f.id === this.localId) return '#ffe14d';
    if (!me) return '#ff3d4d';
    return f.team === me.team ? '#3db8ff' : '#ff3d4d';
  }

  // -------------------------------------------------------------------------

  private drawGroundMark(f: Fighter, interp: number): void {
    const ctx = this.ctx;
    const x = f.px + (f.x - f.px) * interp;
    const y = f.py + (f.y - f.py) * interp;
    const sc = f.def.look.scale ?? 1;
    // sombra
    const zf = 1 - Math.min(0.6, f.z / 200);
    ctx.fillStyle = 'rgba(6,2,14,0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 26 * sc * zf, 10 * sc * zf, 0, 0, TAU);
    ctx.fill();
    // anel do time
    const col = this.teamColor(f);
    ctx.strokeStyle = alpha(col, 0.85);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 30 * sc, 12 * sc, 0, 0, TAU);
    ctx.stroke();
    if (f.id === this.localId) {
      // seta de mira no chão
      const a = f.aim;
      ctx.fillStyle = alpha(col, 0.9);
      ctx.beginPath();
      const ax = x + Math.cos(a) * 40 * sc;
      const ay = y + 2 + Math.sin(a) * 16 * sc;
      ctx.moveTo(ax + Math.cos(a) * 8, ay + Math.sin(a) * 4);
      ctx.lineTo(ax + Math.cos(a + 2.4) * 7, ay + Math.sin(a + 2.4) * 3);
      ctx.lineTo(ax + Math.cos(a - 2.4) * 7, ay + Math.sin(a - 2.4) * 3);
      ctx.fill();
    }
    if (f.superCharge >= 1) {
      const p = 0.5 + Math.sin(this.time * 6) * 0.5;
      ctx.strokeStyle = alpha('#ffd23f', 0.4 + p * 0.5);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, (34 + p * 4) * sc, (14 + p * 2) * sc, 0, 0, TAU);
      ctx.stroke();
    }
  }

  private drawFighter(f: Fighter, interp: number): void {
    const v = this.visual(f);
    const ctx = this.ctx;
    const x = f.px + (f.x - f.px) * interp;
    const y = f.py + (f.y - f.py) * interp - f.z;
    const sc = CHAR_SCALE * (f.def.look.scale ?? 1);
    // aura das raridades altas (atrás do corpo)
    const aura = f.def.look.aura;
    if (aura) this.drawAura(x, y, aura, sc);
    const sx = (x * this.k + this.ox) | 0;
    const sy = (y * this.k + this.oy) | 0;
    const s = sc * this.k;
    const base: Mat = [s * v.anim.facing, 0, 0, s, sx, sy];
    let a = 1;
    const me = this.world.fighters[this.localId];
    if (f.stealthT > 0) a = me && f.team === me.team ? 0.45 : 0.6;
    if (f.inBush && me && f.team === me.team) a = Math.min(a, 0.7);
    if (f.invulnT > 0) a *= 0.55 + Math.sin(this.time * 30) * 0.35;
    v.sprite.draw(ctx, v.anim.pose, v.anim.solved, { base, view: v.anim.view, flash: v.flash, alpha: a });
    // efeitos de status por cima
    this.world2();
    if (this.world.hasStatus(f, 'stun') || this.world.hasStatus(f, 'freeze')) {
      for (let i = 0; i < 3; i++) {
        const ang = this.time * 5 + (i * TAU) / 3;
        ctx.fillStyle = this.world.hasStatus(f, 'freeze') ? '#bdf3ff' : '#ffe14d';
        star(ctx, x + Math.cos(ang) * 22, y - 104 * (f.def.look.scale ?? 1) + Math.sin(ang) * 6, 5);
      }
    }
    if (this.world.hasStatus(f, 'freeze')) {
      ctx.fillStyle = 'rgba(160,230,255,0.35)';
      ctx.beginPath();
      ctx.roundRect(x - 28, y - 96, 56, 98, 10);
      ctx.fill();
    }
    if (f.shield > 0) {
      ctx.strokeStyle = alpha('#bfe6ff', 0.5 + Math.sin(this.time * 8) * 0.2);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y - 44, 40, 56, 0, 0, TAU);
      ctx.stroke();
    }
    if (Math.random() < 0.25) {
      if (this.world.hasStatus(f, 'burn')) this.particles.spawn({ kind: 'spark', x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 70, vy: -120, max: 0.4, size: 3, color: '#ff8a3d' });
      if (this.world.hasStatus(f, 'poison')) this.particles.spawn({ kind: 'glow', x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 70, vy: -50, max: 0.5, size: 6, color: '#9ef08a' });
      if (this.world.hasStatus(f, 'slow')) this.particles.spawn({ kind: 'dust', x: x + (Math.random() - 0.5) * 30, y: f.y, max: 0.4, size: 5, color: 'rgba(120,200,255,1)' });
    }
  }

  private drawAura(x: number, y: number, aura: NonNullable<CharacterDef['look']['aura']>, sc: number): void {
    const ctx = this.ctx;
    const t = this.time;
    const pulse = 0.75 + Math.sin(t * 3) * 0.25;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * pulse;
    const g = this.particles.glow(aura.color) as CanvasImageSource;
    ctx.drawImage(g, x - 60 * sc, y - 120 * sc, 120 * sc, 130 * sc);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < (this.lowQuality ? 0.15 : 0.4)) {
      const c = aura.kind === 'prism' ? (Math.random() < 0.5 ? aura.color : (aura.color2 ?? aura.color)) : aura.color;
      const kind = aura.kind === 'smoke' ? 'smoke' : aura.kind === 'flame' ? 'spark' : 'star';
      this.particles.spawn({ kind, x: x + (Math.random() - 0.5) * 50 * sc, y: y - Math.random() * 90 * sc, vy: -60 - Math.random() * 60, vx: (Math.random() - 0.5) * 30, max: 0.6 + Math.random() * 0.4, size: aura.kind === 'smoke' ? 8 : 2.5, color: c });
    }
  }

  private drawPet(v: Visual, f: Fighter): void {
    if (!v.pet) return;
    const bob = v.pet.pet.motion === 'hop' ? -Math.abs(Math.sin(this.time * 6)) * 10 : v.pet.pet.motion === 'bounce' ? -Math.abs(Math.sin(this.time * 4)) * 8 : Math.sin(this.time * 3) * 5;
    const fly = v.pet.pet.motion === 'flap' || v.pet.pet.motion === 'float' || v.pet.pet.motion === 'orbit' ? 46 : 14;
    const ctx = this.ctx;
    this.world2();
    ctx.fillStyle = 'rgba(6,2,14,0.3)';
    ctx.beginPath();
    ctx.ellipse(v.petX, v.petY, 12, 5, 0, 0, TAU);
    ctx.fill();
    const sx = v.petX * this.k + this.ox;
    const sy = (v.petY - fly + bob) * this.k + this.oy;
    v.pet.draw(ctx, sx, sy, this.time, v.petFlip);
    void f;
  }

  private drawOverhead(f: Fighter, interp: number): void {
    const ctx = this.ctx;
    this.world2();
    const v = this.visual(f);
    const x = f.px + (f.x - f.px) * interp;
    const y = f.py + (f.y - f.py) * interp - f.z - 112 * (f.def.look.scale ?? 1) * (CHAR_SCALE / 0.86);
    const isMe = f.id === this.localId;
    const col = this.teamColor(f);
    const bw = isMe ? 78 : 66;
    const bh = isMe ? 11 : 9;
    // nome
    ctx.font = `900 ${isMe ? 14 : 12}px "Lilita One", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const name = f.isBot ? `${f.name}` : f.name;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,4,20,0.85)';
    ctx.strokeText(name, x, y - 4);
    ctx.fillStyle = isMe ? '#ffe14d' : '#ffffff';
    ctx.fillText(name, x, y - 4);
    if (f.isBot) {
      const tw = ctx.measureText(name).width;
      ctx.font = '900 9px "Lilita One", sans-serif';
      ctx.fillStyle = 'rgba(10,4,20,0.75)';
      ctx.beginPath();
      ctx.roundRect(x + tw / 2 + 3, y - 16, 24, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#9aa6c0';
      ctx.textAlign = 'left';
      ctx.fillText('BOT', x + tw / 2 + 6, y - 6);
      ctx.textAlign = 'center';
    }
    if (f.wanted) {
      ctx.font = '900 16px sans-serif';
      ctx.fillText('👑', x, y - 20);
    }
    // barra de vida
    ctx.fillStyle = 'rgba(10,4,20,0.85)';
    ctx.beginPath();
    ctx.roundRect(x - bw / 2 - 2, y, bw + 4, bh + 4, 4);
    ctx.fill();
    const frac = clamp(f.hp / f.maxHp, 0, 1);
    const shown = clamp(v.hpShown / f.maxHp, 0, 1);
    if (shown > frac) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - bw / 2, y + 2, bw * shown, bh);
    }
    ctx.fillStyle = isMe ? (frac < 0.3 ? '#ff5d4d' : '#5dff7a') : col;
    ctx.fillRect(x - bw / 2, y + 2, bw * frac, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - bw / 2, y + 2, bw * frac, bh * 0.35);
    if (f.shield > 0) {
      ctx.fillStyle = 'rgba(191,230,255,0.85)';
      ctx.fillRect(x - bw / 2, y + 2, bw * clamp(f.shield / f.maxHp, 0, 1), bh * 0.5);
    }
    // número da vida
    ctx.font = `900 ${isMe ? 10 : 9}px "Lilita One", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,4,20,0.8)';
    const hpTxt = String(Math.ceil(f.hp));
    ctx.strokeText(hpTxt, x, y + 2 + bh / 2 + 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hpTxt, x, y + 2 + bh / 2 + 0.5);
    // munição (só o jogador local)
    if (isMe) {
      const segW = (bw - (f.maxAmmo - 1) * 3) / f.maxAmmo;
      for (let i = 0; i < f.maxAmmo; i++) {
        const fill = clamp(f.ammo - i, 0, 1);
        const sx = x - bw / 2 + i * (segW + 3);
        ctx.fillStyle = 'rgba(10,4,20,0.85)';
        ctx.fillRect(sx - 1, y + bh + 6, segW + 2, 6);
        ctx.fillStyle = fill >= 1 ? '#ffb02e' : alpha('#ffb02e', 0.45);
        ctx.fillRect(sx, y + bh + 7, segW * fill, 4);
      }
    }
  }

  // -------------------------------------------------------------------------

  private drawAimPreview(interp: number): void {
    const aim = this.aim;
    const me = this.world.fighters[this.localId];
    if (!aim || !me || !me.alive) return;
    const ctx = this.ctx;
    const x = me.px + (me.x - me.px) * interp;
    const y = me.py + (me.y - me.py) * interp;
    const ab = aim.ability;
    const col = aim.kind === 'super' ? '#ffd23f' : aim.kind === 'skill' ? '#3df2ff' : '#ffffff';
    const ang = Math.atan2(aim.ay, aim.ax);
    ctx.fillStyle = alpha(col, 0.22);
    ctx.strokeStyle = alpha(col, 0.75);
    ctx.lineWidth = 2.5;
    if (ab.indicator === 'line') {
      const w = (ab.indicatorSize ?? 20) * 1.2;
      // corta na parede (tiro reto)
      let len2 = ab.range;
      const lob = ab.effects.some((e) => e.kind === 'projectile' && e.proj.lob);
      if (!lob) {
        const hit = this.world.map.rayHit(x, y, x + Math.cos(ang) * ab.range, y + Math.sin(ang) * ab.range);
        if (hit) len2 = Math.max(30, len(hit.x - x, hit.y - y));
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(0, -w / 2, len2, w, w / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (ab.indicator === 'cone') {
      const spread = ((ab.indicatorSize ?? 30) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, ab.range, ang - spread / 2, ang + spread / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (ab.indicator === 'circle') {
      const r = ab.indicatorSize ?? 100;
      if (ab.aim === 'self') {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else {
        const d = Math.max(40, ab.range * clamp(aim.ad, 0.1, 1));
        const tx = x + Math.cos(ang) * d;
        const ty = y + Math.sin(ang) * d;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = alpha(col, 0.35);
        ctx.beginPath();
        ctx.arc(x, y, ab.range, 0, TAU);
        ctx.stroke();
      }
    } else if (ab.aim === 'self') {
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, TAU);
      ctx.stroke();
    }
  }

  private drawZones(): void {
    const ctx = this.ctx;
    for (const z of this.world.zones) {
      const col = z.look.color ?? zoneColor(z.look.kind);
      const life = clamp(z.t / Math.max(0.1, z.duration), 0, 1);
      const r = z.radius * (life > 0.92 ? 1 - (life - 0.92) * 4 : 1);
      ctx.fillStyle = alpha(col, 0.18 + Math.sin(this.time * 4) * 0.04);
      ctx.strokeStyle = alpha(col, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // padrão animado
      ctx.save();
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = alpha(col, 0.35);
      ctx.lineWidth = 2;
      const t = this.time;
      for (let i = 0; i < 6; i++) {
        const a = t * (z.look.kind === 'void' ? 1.4 : 0.6) + (i * TAU) / 6;
        const rr = ((t * 30 + i * 30) % r) || 1;
        ctx.beginPath();
        if (z.look.kind === 'void' || z.look.kind === 'electric') ctx.arc(z.x, z.y, rr, a, a + 1.4);
        else ctx.arc(z.x + Math.cos(a) * r * 0.5, z.y + Math.sin(a) * r * 0.4, 6 + (i % 3) * 3, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      if (Math.random() < 0.3) {
        const a = Math.random() * TAU;
        const d = Math.random() * r;
        this.particles.spawn({ kind: z.look.kind === 'smoke' ? 'smoke' : 'glow', x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d * 0.8, vy: -40, max: 0.7, size: z.look.kind === 'smoke' ? 14 : 7, color: z.look.kind === 'smoke' ? 'rgba(120,110,130,1)' : col });
      }
    }
  }

  private drawTraps(): void {
    const ctx = this.ctx;
    const me = this.world.fighters[this.localId];
    for (const tr of this.world.traps) {
      if (!me || tr.team !== me.team) continue;
      ctx.strokeStyle = alpha('#ffd23f', 0.6);
      ctx.fillStyle = alpha('#ffd23f', 0.12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a3f4d';
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        ctx.beginPath();
        ctx.moveTo(tr.x + Math.cos(a) * 10, tr.y + Math.sin(a) * 10);
        ctx.lineTo(tr.x + Math.cos(a + 0.3) * 20, tr.y + Math.sin(a + 0.3) * 20);
        ctx.lineTo(tr.x + Math.cos(a - 0.3) * 20, tr.y + Math.sin(a - 0.3) * 20);
        ctx.fill();
      }
    }
  }

  private drawMeteorMarks(): void {
    const ctx = this.ctx;
    for (const m of this.fx.meteorMarks) {
      const left = m.at - this.world.time;
      const p = clamp(1 - left / 1.4, 0, 1);
      ctx.strokeStyle = alpha('#ff3d3d', 0.85);
      ctx.fillStyle = alpha('#ff3d3d', 0.12 + p * 0.25);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 140, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 140 * p, 0, TAU);
      ctx.fill();
      // meteoro caindo
      const h = (1 - p) * 700;
      ctx.drawImage(this.particles.glow('#ff8a3d') as CanvasImageSource, m.x - 40 + h * 0.4, m.y - 40 - h, 80, 80);
    }
  }

  private drawBeams(): void {
    const ctx = this.ctx;
    for (const b of this.world.beams) {
      const o = this.world.fighters[b.owner];
      if (!o) continue;
      const sx = o.x + Math.cos(o.aim) * 30;
      const sy = o.y - 44 + Math.sin(o.aim) * 30;
      const ex = b.ex;
      const ey = b.ey - 30;
      const jitter = Math.sin(this.time * 60) * 3;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = alpha(b.color, 0.35);
      ctx.lineWidth = b.width * 1.6 + jitter;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = alpha(b.color, 0.85);
      ctx.lineWidth = b.width * 0.7;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.width * 0.25;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.6) this.particles.burst(ex, ey + 30, 2, b.color, 260, 'spark');
    }
  }

  private drawProj(p: import('../sim/types').Projectile, interp: number): void {
    const ctx = this.ctx;
    this.world2();
    const x = p.px + (p.x - p.px) * interp;
    const y = p.py + (p.y - p.py) * interp;
    const look = p.def.look;
    const z = p.lob ? p.z : 34;
    // sombra
    ctx.fillStyle = 'rgba(6,2,14,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(5, p.def.radius * 0.8), Math.max(2, p.def.radius * 0.35), 0, 0, TAU);
    ctx.fill();
    const ang = Math.atan2(p.vy, p.vx);
    drawProjectile(ctx, look, x, y - z, p.def.radius, ang, this.time + p.id, this.lowQuality ? null : (this.particles.glow(look.color) as CanvasImageSource));
    // rastro
    const tr = look.trail ?? 'none';
    if (tr !== 'none' && Math.random() < (this.lowQuality ? 0.3 : 0.7)) {
      if (tr === 'smoke') this.particles.spawn({ kind: 'smoke', x, y: y - z, size: 5, grow: 18, max: 0.4, color: 'rgba(120,110,130,1)', big: true });
      else if (tr === 'fire') this.particles.spawn({ kind: 'glow', x, y: y - z, size: 10, max: 0.25, color: '#ff8a3d' });
      else if (tr === 'void') this.particles.spawn({ kind: 'star', x, y: y - z, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, size: 2.5, max: 0.35, color: Math.random() < 0.5 ? '#ff3df2' : '#3df2ff' });
      else this.particles.spawn({ kind: 'glow', x, y: y - z, size: 6, max: 0.18, color: look.color });
    }
  }

  private propSprite(kind: string): Canvas {
    let s = this.propSprites.get(kind);
    if (!s) {
      const k = this.k;
      s = makeCanvas(72 * k, 80 * k);
      const g = s.getContext('2d') as CanvasRenderingContext2D;
      g.setTransform(k, 0, 0, k, 36 * k, 60 * k);
      g.lineJoin = 'round';
      const ink = '#140a1c';
      if (kind === 'crate') {
        g.fillStyle = ink;
        g.fillRect(-27, -50, 54, 54);
        g.fillStyle = '#8a5a2e';
        g.fillRect(-24, -20, 48, 21);
        g.fillStyle = '#c08a4a';
        g.fillRect(-24, -47, 48, 27);
        g.strokeStyle = '#6a3e1a';
        g.lineWidth = 3;
        g.strokeRect(-21, -44, 42, 21);
        g.beginPath();
        g.moveTo(-21, -44);
        g.lineTo(21, -23);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.15)';
        g.fillRect(-24, -47, 48, 4);
      } else if (kind === 'barrel') {
        g.fillStyle = ink;
        g.beginPath();
        g.roundRect(-22, -56, 44, 60, 10);
        g.fill();
        const grd = g.createLinearGradient(-20, 0, 20, 0);
        grd.addColorStop(0, '#8a1a10');
        grd.addColorStop(0.4, '#e04a2a');
        grd.addColorStop(1, '#6a1008');
        g.fillStyle = grd;
        g.beginPath();
        g.roundRect(-19, -53, 38, 54, 8);
        g.fill();
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.moveTo(0, -38);
        g.lineTo(9, -22);
        g.lineTo(-9, -22);
        g.closePath();
        g.fill();
        g.fillStyle = ink;
        g.fillRect(-1.5, -34, 3, 7);
        g.fillRect(-1.5, -26, 3, 2.5);
        g.fillStyle = '#c0392b';
        g.beginPath();
        g.ellipse(0, -52, 17, 6, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-19, -12);
        g.lineTo(19, -12);
        g.stroke();
      } else {
        g.fillStyle = ink;
        g.beginPath();
        g.ellipse(0, -14, 24, 17, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#2a2a33';
        g.beginPath();
        g.ellipse(0, -15, 21, 14, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#4a4a55';
        g.beginPath();
        g.ellipse(0, -18, 21, 10, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#16161c';
        g.beginPath();
        g.ellipse(0, -18, 9, 5, 0, 0, TAU);
        g.fill();
      }
      this.propSprites.set(kind, s);
    }
    return s;
  }

  private drawProp(p: Prop, interp: number): void {
    const ctx = this.ctx;
    const x = p.px + (p.x - p.px) * interp;
    const y = p.py + (p.y - p.py) * interp;
    this.world2();
    ctx.fillStyle = 'rgba(6,2,14,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 2, p.radius * 1.05, p.radius * 0.45, 0, 0, TAU);
    ctx.fill();
    const spr = this.propSprite(p.kind);
    const sx = x * this.k + this.ox;
    const sy = (y - p.z) * this.k + this.oy;
    const tilt = clamp(p.vx * 0.0008 + Math.sin(p.rot) * 0.06, -0.5, 0.5);
    ctx.setTransform(Math.cos(tilt), Math.sin(tilt), -Math.sin(tilt), Math.cos(tilt), sx, sy);
    ctx.drawImage(spr as CanvasImageSource, -36 * this.k, -60 * this.k);
  }

  private drawPickupShadow(p: Pickup): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,2,14,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 14, 6, 0, 0, TAU);
    ctx.fill();
    if (p.kind === 'skull') {
      const me = this.world.fighters[this.localId];
      const col = me && p.team === me.team ? '#3db8ff' : '#ff3d4d';
      ctx.strokeStyle = alpha(col, 0.6 + Math.sin(this.time * 6) * 0.3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4, 22, 9, 0, 0, TAU);
      ctx.stroke();
    }
  }

  private drawPickup(p: Pickup): void {
    const ctx = this.ctx;
    this.world2();
    const bob = Math.sin(this.time * 4 + p.id) * 5;
    const y = p.y - 24 - p.z + bob;
    const blink = p.t < 3 ? (Math.sin(this.time * 20) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    if (p.kind === 'skull') {
      ctx.drawImage(this.particles.glow('#efe6d2') as CanvasImageSource, p.x - 30, y - 30, 60, 60);
      skullIcon(ctx, p.x, y, 13, '#efe6d2');
    } else if (p.kind === 'heal') {
      ctx.drawImage(this.particles.glow('#5dffa0') as CanvasImageSource, p.x - 30, y - 30, 60, 60);
      ctx.fillStyle = '#140a1c';
      ctx.beginPath();
      ctx.roundRect(p.x - 15, y - 15, 30, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#f7f7fb';
      ctx.beginPath();
      ctx.roundRect(p.x - 12, y - 12, 24, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#ff3d5c';
      ctx.fillRect(p.x - 3, y - 8, 6, 16);
      ctx.fillRect(p.x - 8, y - 3, 16, 6);
    } else if (p.kind === 'power') {
      ctx.drawImage(this.particles.glow('#b77bff') as CanvasImageSource, p.x - 34, y - 34, 68, 68);
      ctx.fillStyle = '#140a1c';
      star(ctx, p.x, y, 17);
      ctx.fillStyle = '#d6a8ff';
      star(ctx, p.x, y, 13);
    } else {
      ctx.drawImage(this.particles.glow('#ffd23f') as CanvasImageSource, p.x - 22, y - 22, 44, 44);
      const sc = Math.abs(Math.cos(this.time * 5 + p.id)) * 0.8 + 0.2;
      ctx.save();
      ctx.translate(p.x, y);
      ctx.scale(sc, 1);
      ctx.fillStyle = '#140a1c';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, TAU);
      ctx.fill();
      skullIcon(ctx, 0, 0, 5, '#8a5a00');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawSummon(s: Summon, interp: number): void {
    const ctx = this.ctx;
    const x = s.px + (s.x - s.px) * interp;
    const y = s.py + (s.y - s.py) * interp;
    const owner = this.world.fighters[s.owner];
    this.world2();
    ctx.fillStyle = 'rgba(6,2,14,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 22, 9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = alpha(this.teamColor({ team: s.team }), 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 25, 10, 0, 0, TAU);
    ctx.stroke();
    const kind = s.def.look.kind;
    const c = s.def.look.color;
    if (kind === 'clone' && owner) {
      const v = this.visual(owner);
      const sc = CHAR_SCALE * this.k;
      const facing = s.vx >= 0 ? 1 : -1;
      v.sprite.draw(ctx, v.anim.pose, v.anim.solved, { base: [sc * facing, 0, 0, sc, x * this.k + this.ox, y * this.k + this.oy], view: 'front', alpha: 0.85 });
      return;
    }
    if (kind === 'skeleton' || kind === 'minion') {
      const key = `minion:${c}`;
      let spr = this.summonSprites.get(key);
      if (!spr) {
        spr = new CharacterSprite(
          {
            species: 'skeleton',
            skin: '#efe6d2',
            body: 'slim',
            hair: { style: 'none', color: '#000' },
            eyes: { style: 'glow', color: c === '#efe6d2' ? '#ff3df2' : c },
            top: { style: 'tank', color: '#2a2433' },
            pants: { style: 'shorts', color: '#2a2433' },
            shoes: { style: 'skate', color: '#2a2433' },
            weapon: { kind: 'bat', color: '#c9a274' },
          },
          CHAR_SCALE * 0.62 * this.k,
        );
        this.summonSprites.set(key, spr);
      }
      let an = this.summonAnims.get(s.id);
      if (!an) {
        an = new Animator({ idle: 'bounce', run: 'sprint', attack: 'swing', victory: 'laugh' });
        an.setState('run');
        this.summonAnims.set(s.id, an);
      }
      an.lookAt(Math.cos(s.aim), Math.sin(s.aim), false);
      an.update(1 / 60);
      const sc = CHAR_SCALE * 0.62 * this.k;
      spr.draw(ctx, an.pose, an.solved, { base: [sc * an.facing, 0, 0, sc, x * this.k + this.ox, y * this.k + this.oy], view: 'front' });
      return;
    }
    // torreta / totem / caixa de som / drone
    const pulse = 0.6 + Math.sin(this.time * 5 + s.id) * 0.4;
    ctx.drawImage(this.particles.glow(c) as CanvasImageSource, x - 30, y - 70, 60, 60);
    ctx.fillStyle = '#140a1c';
    ctx.beginPath();
    ctx.roundRect(x - 18, y - 38, 36, 40, 7);
    ctx.fill();
    ctx.fillStyle = darken(c, 0.45);
    ctx.beginPath();
    ctx.roundRect(x - 15, y - 35, 30, 34, 5);
    ctx.fill();
    if (kind === 'turret') {
      ctx.save();
      ctx.translate(x, y - 40);
      ctx.rotate(s.aim);
      ctx.fillStyle = '#140a1c';
      ctx.fillRect(-4, -7, 34, 14);
      ctx.fillStyle = lighten(c, 0.2);
      ctx.fillRect(-2, -5, 30, 10);
      ctx.restore();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y - 40, 11, 0, TAU);
      ctx.fill();
    } else if (kind === 'speaker') {
      ctx.fillStyle = '#1b1a22';
      ctx.beginPath();
      ctx.arc(x, y - 18, 10 + pulse * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y - 18, 4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = alpha(c, 0.5 * pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 18, 22 + pulse * 10, 0, TAU);
      ctx.stroke();
    } else {
      // totem / glifo
      ctx.fillStyle = c;
      ctx.save();
      ctx.translate(x, y - 56);
      ctx.rotate(this.time * 2);
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
      ctx.strokeStyle = s.def.look.color2 ?? '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 8, y - 30, 16, 20);
    }
  }

  private drawSummonBar(s: Summon): void {
    const ctx = this.ctx;
    this.world2();
    const y = s.y - (s.def.look.kind === 'skeleton' || s.def.look.kind === 'minion' ? 70 : 84);
    ctx.fillStyle = 'rgba(10,4,20,0.8)';
    ctx.fillRect(s.x - 22, y, 44, 6);
    ctx.fillStyle = this.teamColor({ team: s.team });
    ctx.fillRect(s.x - 21, y + 1, 42 * clamp(s.hp / s.maxHp, 0, 1), 4);
  }

  private drawDeathSkull(s: Fx['deathSkulls'][number]): void {
    const ctx = this.ctx;
    this.world2();
    const a = clamp(s.t / 0.6, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,2,14,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 14, 6, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y - 16 - s.z);
    ctx.rotate(s.rot);
    skullIcon(ctx, 0, 0, 16, '#efe6d2');
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private vignette: Canvas | null = null;
  private drawVignette(me: Fighter | undefined): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.vignette || this.vignette.width !== W) {
      this.vignette = makeCanvas(W, H);
      const g = this.vignette.getContext('2d') as CanvasRenderingContext2D;
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(6,0,16,0.55)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vignette as CanvasImageSource, 0, 0);
    if (me && me.alive && me.hp < me.maxHp * 0.3) {
      ctx.fillStyle = `rgba(255,20,50,${0.12 + Math.sin(this.time * 6) * 0.07})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.fx.flashT > 0) {
      ctx.fillStyle = alpha(this.fx.flashColor, this.fx.flashT * 1.6);
      ctx.fillRect(0, 0, W, H);
    }
    if (me && !me.alive && !this.world.over) {
      ctx.fillStyle = 'rgba(20,10,30,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  get rarityColor(): (r: keyof typeof RARITY) => string {
    return (r) => RARITY[r].color;
  }

  /** tamanho do canvas em px CSS (pro HUD) */
  get size(): { w: number; h: number } {
    return { w: this.cssW, h: this.cssH };
  }

  dispose(): void {
    for (const s of this.spriteCache.values()) s.dispose();
    this.spriteCache.clear();
    this.visuals.clear();
  }

  /** usado pelo renderer do pet no menu */
  static petSprite(p: PetDef, ppu: number): PetSprite {
    return new PetSprite(p, ppu);
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function skullIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = '#140a1c';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 1.12, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - r * 0.62, y + r * 0.3, r * 1.24, r * 0.8);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.15, r * 0.92, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - r * 0.5, y + r * 0.35, r * 1, r * 0.6);
  ctx.fillStyle = '#140a1c';
  ctx.beginPath();
  ctx.arc(x - r * 0.36, y - r * 0.12, r * 0.26, 0, TAU);
  ctx.arc(x + r * 0.36, y - r * 0.12, r * 0.26, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - r * 0.06, y + r * 0.2, r * 0.12, r * 0.2);
  ctx.fillRect(x - r * 0.3, y + r * 0.55, r * 0.1, r * 0.35);
  ctx.fillRect(x + r * 0.2, y + r * 0.55, r * 0.1, r * 0.35);
}

export { WALL_H };
