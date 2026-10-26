import type { ContentDB } from '../content/registry';
import type { AbilityDef } from '../content/types';
import type { Fighter } from '../combat/state';
import { findAttackTarget } from '../combat/targeting';
import type { World } from '../combat/world';
import { clamp, DEG, TAU } from '../engine/math';
import { Camera } from './camera';
import { darken, lighten, rgba } from './art/color';
import { drawPet, projectileSprite } from './art/fxart';
import { bakeBrush, bakeFloor, bakeObstacle, drawCrate, drawMiniSkull, THEMES, type ObstacleSprite } from './art/map';
import { bakeCharacter, resolveLook, type CharacterSprites } from './art/skull';
import { FloaterSystem, ParticleSystem } from './particles';

export interface RenderOptions {
  /** Pré-visualização do especial (botão pressionado). */
  specialPreview: boolean;
  /** Mostrar cone de ataque do jogador. */
  showAimCone: boolean;
  quality: 'alta' | 'media' | 'baixa';
  showFps: boolean;
}

interface Drawable {
  y: number;
  draw: () => void;
}

export const UI_FONT = "'Lilita One', 'Nunito', system-ui, sans-serif";

/**
 * Renderizador Canvas 2D da arena. Lê o World (somente leitura) e desenha.
 * Separado da simulação: trocar por PixiJS/WebGL no futuro não toca no combate.
 */
export class GameRenderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly camera = new Camera();
  readonly particles = new ParticleSystem();
  readonly floaters = new FloaterSystem();
  dpr = 1;
  cssW = 1;
  cssH = 1;
  private res = 2;
  private floor: { canvas: HTMLCanvasElement; border: number; res: number } | null = null;
  private obstacleSprites: Array<{ sprite: ObstacleSprite | null; x: number; y: number; w: number; h: number; type: string }> = [];
  private brushSprites: Array<{ sprite: ObstacleSprite; x: number; y: number; w: number; h: number }> = [];
  private chars = new Map<string, CharacterSprites>();
  private time = 0;
  /** Flash de dano na tela (0..1). */
  hurtFlash = 0;
  /** Flash branco (especial do jogador). */
  whiteFlash = 0;
  private drawables: Drawable[] = [];

  constructor(readonly canvas: HTMLCanvasElement, private readonly content: ContentDB) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  /** Assa piso, obstáculos, mato e sprites dos lutadores da partida. */
  prepare(world: World, quality: RenderOptions['quality']): void {
    const want = clamp(this.camera.zoom * this.dpr, 1, quality === 'baixa' ? 1.4 : quality === 'media' ? 2 : 2.6);
    this.res = want;
    this.particles.max = quality === 'baixa' ? 300 : quality === 'media' ? 600 : 900;
    const map = world.map;
    const W = map.size.w + 140, H = map.size.h + 140;
    const floorRes = Math.min(want, Math.sqrt((quality === 'baixa' ? 3e6 : 8e6) / (W * H)));
    const f = bakeFloor(map, floorRes);
    this.floor = { ...f, res: floorRes };
    this.obstacleSprites = world.obstacles.map((o, i) => ({
      sprite: bakeObstacle(o.type, o, o.def.height, map.theme, want, (map.decorSeed ?? 1) * 31 + i),
      x: o.x, y: o.y, w: o.w, h: o.h, type: o.type,
    }));
    this.brushSprites = world.brush.map((b, i) => ({ sprite: bakeBrush(b, map.theme, want, i * 97 + 13), x: b.x, y: b.y, w: b.w, h: b.h }));
    for (const fi of world.fighters) this.spritesFor(fi);
  }

  spritesFor(f: Fighter): CharacterSprites {
    const key = `${f.def.id}|${f.skinId}|${f.isMinion ? 'm' : ''}`;
    let s = this.chars.get(key);
    if (!s) {
      const skin = f.skinId !== 'default' ? this.content.skins.get(f.skinId) : null;
      s = bakeCharacter(resolveLook(f.def, skin), this.res);
      this.chars.set(key, s);
    }
    return s;
  }

  // ─────────────────────────── frame ───────────────────────────

  render(world: World, alpha: number, dt: number, viewer: Fighter | undefined, opts: RenderOptions): void {
    this.time += dt;
    const c = this.ctx;
    const cam = this.camera;
    const T = THEMES[world.map.theme] ?? THEMES.crypt;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = T.outside;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    cam.apply(c, this.dpr);
    c.imageSmoothingEnabled = true;

    // Piso
    if (this.floor) {
      const b = this.floor.border;
      c.drawImage(this.floor.canvas, -b, -b, world.map.size.w + b * 2, world.map.size.h + b * 2);
    }
    this.drawLiquids(world);
    this.drawZones(world);
    this.drawTraps(world, viewer);
    if (viewer && viewer.alive && opts.showAimCone) this.drawAimCone(world, viewer, alpha);
    if (viewer && viewer.alive && opts.specialPreview) this.drawSpecialPreview(world, viewer, alpha);

    // Lista ordenada por Y (perspectiva 3/4)
    const list = this.drawables;
    list.length = 0;
    for (const o of this.obstacleSprites) {
      if (!o.sprite) continue;
      const sp = o.sprite;
      list.push({ y: o.y + o.h, draw: () => c.drawImage(sp.canvas, o.x + sp.ox, o.y + sp.oy, sp.w, sp.h) });
    }
    for (const cr of world.crates) {
      if (!cr.alive) continue;
      list.push({ y: cr.y + cr.h, draw: () => drawCrate(c, cr.type, cr.x, cr.y, cr.w, cr.h, 1 - cr.hp / cr.maxHp, cr.hurtT, T.accent) });
    }
    for (const p of world.pickups) list.push({ y: p.y, draw: () => this.drawPickup(p.kind, p.x, p.y, p.t + p.bob) });
    for (const f of world.fighters) {
      if (!f.alive) continue;
      if (viewer && !world.canSee(viewer, f)) continue;
      const fx = f.px + (f.x - f.px) * alpha, fy = f.py + (f.y - f.py) * alpha;
      list.push({ y: fy, draw: () => this.drawFighter(f, fx, fy, viewer) });
      if (f.pet) {
        const pet = f.pet;
        const px = pet.px + (pet.x - pet.px) * alpha, py = pet.py + (pet.y - pet.py) * alpha;
        list.push({ y: py + 24, draw: () => drawPet(c, pet.def, px, py, pet.t, pet.pulse, Math.cos(f.facing) < 0) });
      }
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    // Mato por cima (com transparência quando o jogador está dentro)
    for (const b of this.brushSprites) {
      const inside = viewer && viewer.alive && viewer.x > b.x - 30 && viewer.x < b.x + b.w + 30 && viewer.y > b.y - 30 && viewer.y < b.y + b.h + 40;
      c.globalAlpha = inside ? 0.45 : 1;
      c.drawImage(b.sprite.canvas, b.x + b.sprite.ox, b.y + b.sprite.oy, b.sprite.w, b.sprite.h);
    }
    c.globalAlpha = 1;

    this.drawBeams(world, alpha);
    this.drawProjectiles(world, alpha);

    // Partículas
    this.particles.draw(c, false);
    c.globalCompositeOperation = 'lighter';
    this.particles.draw(c, true);
    c.globalCompositeOperation = 'source-over';

    this.drawRing(world);
    this.drawOverheads(world, alpha, viewer);
    this.floaters.draw(c, UI_FONT);

    // Espaço de tela: vinheta, flashes
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawVignette(T.outside);
    if (this.hurtFlash > 0) {
      const g = c.createRadialGradient(cam.vx + cam.vw / 2, cam.vy + cam.vh / 2, Math.min(cam.vw, cam.vh) * 0.3, cam.vx + cam.vw / 2, cam.vy + cam.vh / 2, Math.max(cam.vw, cam.vh) * 0.75);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,20,60,${0.45 * this.hurtFlash})`);
      c.fillStyle = g;
      c.fillRect(cam.vx, cam.vy, cam.vw, cam.vh);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    }
    if (this.whiteFlash > 0) {
      c.fillStyle = `rgba(255,255,255,${0.35 * this.whiteFlash})`;
      c.fillRect(cam.vx, cam.vy, cam.vw, cam.vh);
      this.whiteFlash = Math.max(0, this.whiteFlash - dt * 4);
    }
  }

  // ─────────────────────────── peças ───────────────────────────

  private drawVignette(col: string): void {
    const c = this.ctx, cam = this.camera;
    const cx = cam.vx + cam.vw / 2, cy = cam.vy + cam.vh / 2;
    const g = c.createRadialGradient(cx, cy, Math.min(cam.vw, cam.vh) * 0.42, cx, cy, Math.hypot(cam.vw, cam.vh) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, rgba(col, 0.7));
    c.fillStyle = g;
    c.fillRect(cam.vx, cam.vy, cam.vw, cam.vh);
  }

  private drawLiquids(world: World): void {
    const c = this.ctx;
    const T = THEMES[world.map.theme] ?? THEMES.crypt;
    const t = this.time;
    for (const o of world.obstacles) {
      if (o.type !== 'water') continue;
      c.save();
      c.beginPath();
      c.roundRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6, 16);
      c.clip();
      const isLava = world.map.theme === 'lava';
      // ondas brilhantes
      c.strokeStyle = rgba(T.liquid2, isLava ? 0.55 : 0.35);
      c.lineWidth = isLava ? 3 : 2;
      for (let k = 0; k < Math.ceil(o.h / 14) + 1; k++) {
        const yy = o.y + k * 14 + ((t * 10) % 14);
        c.beginPath();
        for (let x = o.x; x <= o.x + o.w; x += 8) {
          const y2 = yy + Math.sin(x * 0.08 + t * 2.4 + k) * 2.4;
          if (x === o.x) c.moveTo(x, y2);
          else c.lineTo(x, y2);
        }
        c.stroke();
      }
      if (isLava) {
        c.globalCompositeOperation = 'lighter';
        const pulse = 0.25 + Math.sin(t * 2) * 0.08;
        c.fillStyle = rgba('#ff7b2e', pulse);
        c.fillRect(o.x, o.y, o.w, o.h);
      }
      c.restore();
    }
  }

  private drawZones(world: World): void {
    const c = this.ctx;
    for (const z of world.zones) {
      const life = 1 - z.t / z.dur;
      const appear = Math.min(1, z.t * 6);
      const r = z.radius * (0.6 + 0.4 * appear);
      const col = z.spec.color;
      c.save();
      const g = c.createRadialGradient(z.x, z.y, r * 0.1, z.x, z.y, r);
      g.addColorStop(0, rgba(col, 0.1 * life + 0.05));
      g.addColorStop(0.75, rgba(col, 0.28 * Math.min(1, life * 2)));
      g.addColorStop(1, rgba(col, 0.05));
      c.fillStyle = g;
      c.beginPath();
      c.arc(z.x, z.y, r, 0, TAU);
      c.fill();
      c.setLineDash([10, 8]);
      c.lineDashOffset = -this.time * 30;
      c.lineWidth = 3;
      c.strokeStyle = rgba(lighten(col, 0.3), 0.75 * Math.min(1, life * 3));
      c.stroke();
      c.setLineDash([]);
      if (z.spec.look === 'holy') {
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + this.time * 0.6;
          c.strokeStyle = rgba(col, 0.18);
          c.lineWidth = 6;
          c.beginPath();
          c.moveTo(z.x, z.y);
          c.lineTo(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r);
          c.stroke();
        }
      }
      c.restore();
    }
  }

  private drawTraps(world: World, viewer: Fighter | undefined): void {
    const c = this.ctx;
    for (const tr of world.traps) {
      const mine = viewer && viewer.team === tr.team;
      const near = viewer && Math.hypot(viewer.x - tr.x, viewer.y - tr.y) < 95;
      if (!mine && !near && tr.t > tr.armT) continue;
      const armed = tr.t >= tr.armT;
      c.save();
      c.globalAlpha = mine ? 0.85 : 0.6;
      c.fillStyle = '#2a1a0c';
      c.beginPath();
      c.ellipse(tr.x, tr.y, tr.radius, tr.radius * 0.6, 0, 0, TAU);
      c.fill();
      c.strokeStyle = armed ? tr.color : rgba(tr.color, 0.4);
      c.lineWidth = 2.5;
      c.stroke();
      // mãos de osso saindo
      if (armed) {
        c.strokeStyle = '#efe6cf';
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + this.time * 0.5;
          const bx = tr.x + Math.cos(a) * tr.radius * 0.45, by = tr.y + Math.sin(a) * tr.radius * 0.25;
          c.beginPath();
          c.moveTo(bx, by);
          c.lineTo(bx + Math.cos(a) * 3, by - 7 - Math.sin(this.time * 4 + i) * 2);
          c.stroke();
        }
      }
      c.restore();
    }
  }

  private drawAimCone(world: World, f: Fighter, alpha: number): void {
    const inp = f.input;
    const aiming = inp.attackHeld;
    if (!aiming) return;
    const c = this.ctx;
    const def = f.transform?.basicProjectile ?? f.basic;
    const range = def.type === 'melee' ? def.range + f.radius : def.range;
    const half = world.content.control.attackConeHalfDeg * DEG;
    const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
    const needsLos = def.type !== 'lob' && world.content.control.requireLineOfSight;
    const target = f.attackCd <= 0.25 ? findAttackTarget(world, f, def.type === 'melee' ? def.range + 4 : def.range, needsLos) : null;
    const ready = f.attackCd <= 0;
    c.save();
    const g = c.createRadialGradient(x, y, f.radius, x, y, range);
    const col = target ? '#ffe14d' : '#ffffff';
    g.addColorStop(0, rgba(col, target ? 0.3 : 0.16));
    g.addColorStop(1, rgba(col, target ? 0.14 : 0.05));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y);
    c.arc(x, y, range, f.facing - half, f.facing + half);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(col, target ? 0.85 : ready ? 0.5 : 0.25);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, range, f.facing - half, f.facing + half);
    c.stroke();
    if (target) {
      // retícula no alvo
      const tx = target.fighter ? target.fighter.px + (target.fighter.x - target.fighter.px) * alpha : target.x;
      const ty = target.fighter ? target.fighter.py + (target.fighter.y - target.fighter.py) * alpha : target.y;
      const r = target.r + 8 + Math.sin(this.time * 12) * 2;
      c.strokeStyle = '#ffe14d';
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + this.time * 2;
        c.beginPath();
        c.arc(tx, ty, r, a, a + 0.8);
        c.stroke();
      }
    }
    c.restore();
  }

  private drawSpecialPreview(_world: World, f: Fighter, alpha: number): void {
    const c = this.ctx;
    const ab: AbilityDef = f.ability;
    const p = ab.params;
    const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
    const a = f.facing;
    const ca = Math.cos(a), sa = Math.sin(a);
    const col = ab.vfx.color;
    c.save();
    c.strokeStyle = rgba(col, 0.9);
    c.fillStyle = rgba(col, 0.18);
    c.lineWidth = 3;
    c.setLineDash([12, 8]);
    c.lineDashOffset = -this.time * 40;
    const circle = (cx: number, cy: number, r: number) => {
      c.beginPath();
      c.arc(cx, cy, r, 0, TAU);
      c.fill();
      c.stroke();
    };
    const line = (len: number, width: number) => {
      c.beginPath();
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.roundRect(0, -width / 2, len, width, width / 2);
      c.restore();
      c.fill();
      c.stroke();
    };
    switch (ab.type) {
      case 'dash':
        line(p.distance ?? 200, f.radius * 2);
        break;
      case 'teleport':
        line(p.distance ?? 250, 10);
        circle(x + ca * (p.distance ?? 250), y + sa * (p.distance ?? 250), p.radius ?? f.radius);
        break;
      case 'beam':
        line(p.length ?? 400, p.width ?? 24);
        break;
      case 'multi_shot': {
        const def = this.content.projectiles.get(p.projectile ?? '');
        if (def?.orbit) circle(x, y, def.orbit.radius + def.radius);
        else line(def?.range ?? 300, 14);
        break;
      }
      case 'trap':
        for (let i = 0; i < (p.count ?? 1); i++) {
          const aa = a + (i - ((p.count ?? 1) - 1) / 2) * 0.5;
          circle(x + Math.cos(aa) * (p.castRange ?? 110), y + Math.sin(aa) * (p.castRange ?? 110), p.radius ?? 34);
        }
        break;
      case 'zone':
        circle(x + ca * (p.castRange ?? 0), y + sa * (p.castRange ?? 0), p.zone?.radius ?? 100);
        break;
      case 'aoe_burst':
      case 'debuff':
        circle(x + ca * (p.castRange ?? 0), y + sa * (p.castRange ?? 0), p.radius ?? 120);
        break;
      default:
        circle(x, y, p.radius ?? f.radius + 26);
    }
    c.restore();
  }

  private drawFighter(f: Fighter, x: number, y: number, viewer: Fighter | undefined): void {
    const c = this.ctx;
    const sp = this.spritesFor(f);
    const L = sp.look;
    const t = this.time;
    const sc = L.scale * (f.radius / (f.def.stats.radius ?? 22));
    const isViewer = f === viewer;
    const ally = viewer && f.team === viewer.team && !isViewer;
    const ringCol = isViewer ? '#3df2c8' : ally ? '#4fb3ff' : '#ff4d6d';

    c.save();
    c.translate(x, y);
    // Pop de nascimento
    if (f.spawnT > 0) {
      const k = 1 - f.spawnT;
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      c.scale(s, s);
    }
    // Invulnerável pisca
    if (f.invuln > 0 && !f.dash) c.globalAlpha = 0.55 + Math.sin(t * 30) * 0.25;
    if (f.inBrush && (isViewer || ally)) c.globalAlpha *= 0.6;
    if (f.dash) c.globalAlpha = 0.75;

    // Sombra + anel do time
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(0, 2, f.radius * 1.05, f.radius * 0.45, 0, 0, TAU);
    c.fill();
    c.strokeStyle = ringCol;
    c.lineWidth = isViewer ? 3.2 : 2.4;
    c.globalAlpha *= 0.9;
    c.beginPath();
    c.ellipse(0, 2, f.radius * 1.1, f.radius * 0.5, 0, 0, TAU);
    c.stroke();
    c.globalAlpha /= 0.9;

    // Aura de raridade alta
    if (L.aura && L.aura !== 'none') this.drawAura(L.aura, f.radius * sc, L.accent, L.primary);

    c.scale(sc, sc);
    const moving = f.moving;
    const motion = L.art.motion ?? 'measured';
    const idlePulse = Math.sin(t * (motion === 'bounce' || motion === 'rhythm' ? 5 : motion === 'float' ? 1.8 : 2.7) + f.id);
    const bob = moving ? Math.abs(Math.sin(f.walkPhase * (motion === 'quick' ? 1.35 : 1.0))) * (motion === 'heavy' ? 2.8 : 4) : idlePulse * (motion === 'float' ? 2.6 : motion === 'heavy' ? .7 : motion === 'bounce' ? 2.1 : 1.3);
    const squash = moving ? Math.sin(f.walkPhase * 2) * (motion === 'heavy' ? .055 : .04) : idlePulse * (motion === 'bounce' ? .035 : .02);
    const attitude = motion === 'swagger' || L.art.streetwear === 'punk' ? .09 : motion === 'heavy' ? .025 : motion === 'precise' ? .012 : .04;
    const lean = moving ? Math.cos(f.facing) * attitude : Math.sin(t * (motion === 'rhythm' ? 2.5 : 1.4) + f.id) * attitude;
    const flip = Math.cos(f.facing) < -0.05;
    const back = Math.sin(f.facing) < -0.5;
    const atk = f.attackT;
    const recoil = atk * (motion === 'heavy' ? 7 : motion === 'quick' ? 3 : 5);

    // pés
    const step = moving ? Math.sin(f.walkPhase * (motion === 'quick' ? 2.7 : motion === 'rhythm' ? 1.6 : 2)) : Math.sin(t * (motion === 'bounce' ? 4.5 : 2) + f.id) * (motion === 'float' ? .08 : .025);
    c.fillStyle = darken(L.dark, 0.25);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * 7, -1 - Math.max(0, step * s) * 3, 5.2, 3.4, 0, 0, TAU);
      c.fill();
    }

    c.save();
    c.rotate(lean);
    c.translate(-Math.cos(f.facing) * recoil, -Math.sin(f.facing) * recoil * 0.5 - bob);

    const hx = Math.cos(f.facing) * 12, hy = -18 + Math.sin(f.facing) * 6;
    const drawWeapon = () => {
      c.save();
      c.translate(hx, hy);
      c.rotate(f.facing);
      if (Math.cos(f.facing) < 0) c.scale(1, -1);
      const thrust = atk * (motion === 'heavy' ? 4 : motion === 'quick' ? 9 : 6);
      const w = sp.weapon;
      c.drawImage(w.canvas, -w.ax + thrust, -w.ay, w.w, w.h);
      c.restore();
    };

    if (back) drawWeapon();
    c.save();
    if (flip) c.scale(-1, 1);
    c.scale(1 + squash, 1 - squash);
    const b = sp.body;
    c.drawImage(b.canvas, -b.ax, -b.ay, b.w, b.h);
    if (f.hurtT > 0) {
      c.globalAlpha = f.hurtT * 0.85;
      c.drawImage(sp.bodyWhite.canvas, -b.ax, -b.ay, b.w, b.h);
      c.globalAlpha = 1;
    }
    c.restore();
    if (!back) drawWeapon();

    // cabeça (balança um pouco mais que o corpo)
    c.save();
    if (flip) c.scale(-1, 1);
    const headBob = moving ? Math.sin(f.walkPhase * (motion === 'quick' ? 2.6 : 2) + 0.6) * (motion === 'heavy' ? 1 : 1.5) : Math.sin(t * (motion === 'rhythm' ? 4 : 2.8) + f.id + 0.8) * (motion === 'float' ? 1.8 : 1);
    const headPunch = 1 + atk * 0.06 + f.specialT * 0.08;
    c.translate(0, headBob - 30);
    c.scale(headPunch, headPunch);
    c.translate(0, 30);
    const h = back ? sp.headBack : sp.head;
    c.drawImage(h.canvas, -h.ax, -h.ay, h.w, h.h);
    if (f.hurtT > 0) {
      c.globalAlpha = f.hurtT * 0.85;
      c.drawImage(sp.headWhite.canvas, -h.ax, -h.ay, h.w, h.h);
      c.globalAlpha = 1;
    }
    c.restore();
    c.restore();

    // Overlays de status
    this.drawStatusOverlays(f);
    c.restore();
  }

  private drawAura(kind: string, r: number, accent: string, primary: string): void {
    const c = this.ctx;
    const t = this.time;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const col = kind === 'gold' ? '#ffd84a' : kind === 'creator' ? '#ff2d95' : kind === 'frost' ? '#9fe8ff' : kind === 'flame' ? '#ff7b2e' : kind === 'toxic' ? '#7dff4f' : kind === 'electric' ? '#7ff7ff' : accent;
    const g = c.createRadialGradient(0, -24, 4, 0, -24, r * 2.6);
    g.addColorStop(0, rgba(col, 0.35));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -24, r * 2.6, 0, TAU);
    c.fill();
    if (kind === 'creator' || kind === 'gold') {
      for (let i = 0; i < 6; i++) {
        const a = t * (kind === 'creator' ? 1.6 : 0.9) + (i / 6) * TAU;
        c.strokeStyle = rgba(i % 2 && kind === 'creator' ? '#3df2ff' : col, 0.35);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.6, -24 + Math.sin(a) * r * 0.6);
        c.lineTo(Math.cos(a) * r * 2.1, -24 + Math.sin(a) * r * 2.1);
        c.stroke();
      }
    }
    if (kind === 'void' || kind === 'electric') {
      c.strokeStyle = rgba(kind === 'void' ? primary : col, 0.45);
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 2, r * 1.5 + Math.sin(t * 4) * 2, r * 0.7, 0, 0, TAU);
      c.stroke();
    }
    c.restore();
  }

  private drawStatusOverlays(f: Fighter): void {
    const c = this.ctx;
    const t = this.time;
    const top = -f.radius * 3.4;
    if (f.shield > 0) {
      const k = f.shieldMax > 0 ? f.shield / f.shieldMax : 1;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const col = f.shieldReflect ? '#9ff3ff' : '#bfe0ff';
      const g = c.createRadialGradient(0, -26, f.radius * 0.6, 0, -26, f.radius * 2.2);
      g.addColorStop(0, rgba(col, 0.02));
      g.addColorStop(0.85, rgba(col, 0.22 + 0.15 * k));
      g.addColorStop(1, rgba(col, 0.5));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, -26, f.radius * 2.2, 0, TAU);
      c.fill();
      c.strokeStyle = rgba(col, 0.6 + Math.sin(t * 8) * 0.2);
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }
    if (f.hasStatus('freeze')) {
      c.save();
      c.fillStyle = 'rgba(190,240,255,0.45)';
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(-f.radius * 1.2, -f.radius * 3.3, f.radius * 2.4, f.radius * 3.4, 6);
      c.fill();
      c.stroke();
      c.restore();
    }
    if (f.hasStatus('stun') || f.hasStatus('freeze') || f.hasStatus('root')) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i / 3) * TAU;
        c.fillStyle = '#ffe14d';
        c.beginPath();
        const sx = Math.cos(a) * 16, sy = top + Math.sin(a) * 5;
        for (let k = 0; k < 10; k++) {
          const aa = -Math.PI / 2 + (k * Math.PI) / 5;
          const rr = k % 2 ? 1.8 : 4.4;
          c.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        c.fill();
      }
    }
    if (f.hasStatus('mark') || f.hasStatus('reveal')) {
      c.save();
      c.strokeStyle = f.hasStatus('mark') ? '#7ff7e4' : 'rgba(255,255,255,0.6)';
      c.lineWidth = 2;
      c.setLineDash([5, 5]);
      c.lineDashOffset = t * 20;
      c.beginPath();
      c.arc(0, -24, f.radius * 1.7, 0, TAU);
      c.stroke();
      c.restore();
    }
    if (f.hasStatus('slow')) {
      c.fillStyle = 'rgba(120,200,255,0.7)';
      for (let i = 0; i < 2; i++) {
        const yy = ((t * 30 + i * 12) % 24) - 4;
        c.beginPath();
        c.arc((i ? 1 : -1) * f.radius * 0.7, yy - 10, 2.2, 0, TAU);
        c.fill();
      }
    }
    if (f.healT > 0) {
      c.fillStyle = rgba('#5cff9d', f.healT * 0.9);
      for (let i = 0; i < 3; i++) {
        const yy = top + 20 - ((t * 40 + i * 13) % 34);
        const xx = (i - 1) * 14;
        c.fillRect(xx - 1.6, yy - 5, 3.2, 10);
        c.fillRect(xx - 5, yy - 1.6, 10, 3.2);
      }
    }
  }

  private drawPickup(kind: 'soul' | 'potion', x: number, y: number, t: number): void {
    const c = this.ctx;
    const bob = Math.sin(t * 3) * 4;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(x, y + 4, 9, 3.5, 0, 0, TAU);
    c.fill();
    if (kind === 'soul') {
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(x, y - 16 + bob, 2, x, y - 16 + bob, 22);
      g.addColorStop(0, 'rgba(200,160,255,0.9)');
      g.addColorStop(1, 'rgba(120,60,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y - 16 + bob, 22, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      drawMiniSkull(c, x, y - 16 + bob, 7, '#e9dcff');
      c.fillStyle = '#7a3fff';
      c.beginPath();
      c.arc(x - 2.6, y - 16.5 + bob, 1.5, 0, TAU);
      c.arc(x + 2.6, y - 16.5 + bob, 1.5, 0, TAU);
      c.fill();
    } else {
      c.translate(x, y - 14 + bob);
      c.fillStyle = '#ff4d6d';
      c.strokeStyle = '#3a0010';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 2, 8, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = '#efe6cf';
      c.fillRect(-3, -9, 6, 6);
      c.strokeRect(-3, -9, 6, 6);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(-3, 0, 2, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  private drawBeams(world: World, alpha: number): void {
    const c = this.ctx;
    for (const f of world.fighters) {
      if (!f.alive || !f.beam) continue;
      const b = f.beam;
      const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha - 18;
      const flick = 0.85 + Math.sin(this.time * 50) * 0.15;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      c.strokeStyle = rgba(b.color, 0.35 * flick);
      c.lineWidth = b.width * 1.8;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(b.ex, b.ey - 18);
      c.stroke();
      c.strokeStyle = rgba(b.color, 0.8);
      c.lineWidth = b.width * 0.9 * flick;
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = b.width * 0.3;
      c.stroke();
      c.restore();
    }
  }

  private drawProjectiles(world: World, alpha: number): void {
    const c = this.ctx;
    const pool = world.projectiles;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i];
      const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
      const sp = projectileSprite(p.def, this.res);
      let ang = Math.atan2(p.vy, p.vx);
      if (p.def.vfx.shape === 'bone' || p.def.vfx.shape === 'skull' || p.def.vfx.shape === 'scythe') ang = p.age * 18;
      if (p.lob) {
        // sombra no chão + projétil no ar
        const k = Math.min(1, p.age / p.flightDur);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.beginPath();
        c.ellipse(x, y, p.radius * (0.6 + 0.4 * k), p.radius * 0.4 * (0.6 + 0.4 * k), 0, 0, TAU);
        c.fill();
        // marcador de impacto
        c.strokeStyle = rgba(p.def.vfx.color, 0.5);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(p.tx, p.ty, (p.def.aoeRadius ?? p.radius) * (0.4 + 0.6 * k), 0, TAU);
        c.stroke();
        c.save();
        c.translate(x, y - p.z - 12);
        c.rotate(p.age * 10);
        c.drawImage(sp.canvas, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2);
        c.restore();
        continue;
      }
      c.save();
      c.translate(x, y - 16);
      c.rotate(ang);
      c.drawImage(sp.canvas, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2);
      c.restore();
    }
  }

  private drawRing(world: World): void {
    const r = world.ring;
    if (!r || !r.active) return;
    const c = this.ctx;
    const { w, h } = world.map.size;
    c.save();
    c.beginPath();
    c.rect(-400, -400, w + 800, h + 800);
    c.arc(r.cx, r.cy, r.r, 0, TAU, true);
    c.fillStyle = 'rgba(80,20,120,0.42)';
    c.fill('evenodd');
    c.strokeStyle = rgba('#c06bff', 0.85);
    c.lineWidth = 5;
    c.setLineDash([18, 10]);
    c.lineDashOffset = this.time * 40;
    c.beginPath();
    c.arc(r.cx, r.cy, r.r, 0, TAU);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = rgba('#ffffff', 0.25);
    c.lineWidth = 12;
    c.stroke();
    c.restore();
  }

  private drawOverheads(world: World, alpha: number, viewer: Fighter | undefined): void {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const f of world.fighters) {
      if (!f.alive) continue;
      if (viewer && !world.canSee(viewer, f)) continue;
      const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
      const sc = (f.def.art.scale ?? 1) * (f.radius / (f.def.stats.radius ?? 22));
      const top = y - (f.isMinion ? 62 : 98) * sc;
      const isViewer = f === viewer;
      const ally = viewer && f.team === viewer.team && !isViewer;
      const bw = f.isMinion ? 34 : 60, bh = f.isMinion ? 6 : 9;
      const col = isViewer ? '#3df2a0' : ally ? '#4fb3ff' : '#ff4d6d';
      const k = clamp(f.hp / f.maxHp, 0, 1);
      // barra
      c.fillStyle = 'rgba(10,5,20,0.85)';
      c.beginPath();
      c.roundRect(x - bw / 2 - 2, top - bh / 2 - 2, bw + 4, bh + 4, 5);
      c.fill();
      c.fillStyle = darken(col, 0.55);
      c.beginPath();
      c.roundRect(x - bw / 2, top - bh / 2, bw, bh, 3);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(x - bw / 2, top - bh / 2, Math.max(2, bw * k), bh, 3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x - bw / 2 + 2, top - bh / 2 + 1, Math.max(0, bw * k - 4), 2);
      if (f.shield > 0) {
        const sk = clamp(f.shield / f.maxHp, 0, 1);
        c.fillStyle = 'rgba(220,240,255,0.95)';
        c.fillRect(x - bw / 2, top + bh / 2 - 3, bw * sk, 3);
      }
      if (f.isMinion) continue;
      // número de vida
      c.font = `11px ${UI_FONT}`;
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(10,5,20,0.9)';
      const hpTxt = `${Math.ceil(f.hp)}`;
      c.strokeText(hpTxt, x, top + 0.5);
      c.fillStyle = '#ffffff';
      c.fillText(hpTxt, x, top + 0.5);
      // nome (+ selo BOT)
      c.font = `12px ${UI_FONT}`;
      const name = isViewer ? f.name : f.name;
      c.strokeText(name, x, top - 14);
      c.fillStyle = isViewer ? '#ffffff' : ally ? '#cfe8ff' : '#ffd6dc';
      c.fillText(name, x, top - 14);
      if (f.isBot) {
        const tw = c.measureText(name).width;
        c.font = `9px ${UI_FONT}`;
        const bx = x + tw / 2 + 14;
        c.fillStyle = 'rgba(10,5,20,0.85)';
        c.beginPath();
        c.roundRect(bx - 11, top - 20, 22, 12, 4);
        c.fill();
        c.fillStyle = '#ffb347';
        c.fillText('BOT', bx, top - 13.5);
      }
      // nível
      c.fillStyle = '#2a1650';
      c.beginPath();
      c.arc(x - bw / 2 - 8, top, 8, 0, TAU);
      c.fill();
      c.strokeStyle = '#c06bff';
      c.lineWidth = 1.5;
      c.stroke();
      c.font = `9px ${UI_FONT}`;
      c.fillStyle = '#fff';
      c.fillText(String(f.level), x - bw / 2 - 8, top + 0.5);
      // almas
      if (f.souls > 0) {
        c.fillStyle = 'rgba(10,5,20,0.85)';
        c.beginPath();
        c.roundRect(x + bw / 2 + 2, top - 7, 22, 14, 5);
        c.fill();
        c.fillStyle = '#c9a0ff';
        c.fillText(`◆${f.souls}`, x + bw / 2 + 13, top + 0.5);
      }
    }
  }
}
