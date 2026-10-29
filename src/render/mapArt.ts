import { alpha, darken, lighten, mix } from '../art/color';
import { makeCanvas } from '../art/sprite';
import { hashString } from '../engine/rng';
import { GameMap, T, TILE } from '../sim/map';
import type { Theme } from './theme';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Altura visual das paredes (px de mundo). */
export const WALL_H = 42;
const CHUNK = 8; // blocos por pedaço de chão pré-renderizado

function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * ARTE DO MAPA
 * - Chão (com variação, enfeites e sombras das paredes) é pré-renderizado em pedaços.
 * - Paredes, arbustos e objetos são desenhados por frame, ordenados por profundidade (Y).
 */
export class MapArt {
  private chunks = new Map<string, { canvas: Canvas; version: number }>();
  private snapshot: Uint8Array;
  private chunkVersion: Int32Array;
  private sprites = new Map<string, Canvas>();
  private scale = 0;
  private readonly cw: number;
  private readonly ch: number;

  constructor(
    readonly map: GameMap,
    readonly theme: Theme,
  ) {
    this.snapshot = new Uint8Array(map.tiles);
    this.cw = Math.ceil(map.w / CHUNK);
    this.ch = Math.ceil(map.h / CHUNK);
    this.chunkVersion = new Int32Array(this.cw * this.ch);
  }

  /** Detecta blocos que mudaram (parede quebrou) e invalida os pedaços certos. */
  sync(): void {
    const m = this.map;
    for (let i = 0; i < m.tiles.length; i++) {
      if (m.tiles[i] !== this.snapshot[i]) {
        this.snapshot[i] = m.tiles[i]!;
        const tx = i % m.w;
        const ty = Math.floor(i / m.w);
        // sombra cai até 1 bloco pra direita/baixo: invalida vizinhos
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 0],
          [0, -1],
        ]) {
          const cx = Math.floor((tx + dx!) / CHUNK);
          const cy = Math.floor((ty + dy!) / CHUNK);
          if (cx >= 0 && cy >= 0 && cx < this.cw && cy < this.ch) this.chunkVersion[cy * this.cw + cx]!++;
        }
      }
    }
  }

  setScale(s: number): void {
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.chunks.clear();
    this.sprites.clear();
  }

  // -------------------------------------------------------------------------
  // CHÃO
  // -------------------------------------------------------------------------

  /** Desenha o chão visível. (ox, oy) = pixel de tela do ponto de mundo (0,0); k = escala. */
  drawFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number, k: number, vx0: number, vy0: number, vx1: number, vy1: number): void {
    this.setScale(k);
    const cs = CHUNK * TILE;
    const cx0 = Math.max(0, Math.floor(vx0 / cs));
    const cy0 = Math.max(0, Math.floor(vy0 / cs));
    const cx1 = Math.min(this.cw - 1, Math.floor(vx1 / cs));
    const cy1 = Math.min(this.ch - 1, Math.floor(vy1 / cs));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`;
        const ver = this.chunkVersion[cy * this.cw + cx]!;
        let c = this.chunks.get(key);
        if (!c || c.version !== ver) {
          c = { canvas: this.renderChunk(cx, cy), version: ver };
          this.chunks.set(key, c);
          if (this.chunks.size > 24) {
            const first = this.chunks.keys().next().value;
            if (first !== undefined && first !== key) this.chunks.delete(first);
          }
        }
        ctx.drawImage(c.canvas as CanvasImageSource, Math.round(ox + cx * cs * k), Math.round(oy + cy * cs * k));
      }
    }
  }

  private renderChunk(cx: number, cy: number): Canvas {
    const k = this.scale;
    const cs = CHUNK * TILE;
    const c = makeCanvas(cs * k + 1, cs * k + 1);
    const g = c.getContext('2d') as Ctx;
    g.setTransform(k, 0, 0, k, -cx * cs * k, -cy * cs * k);
    const m = this.map;
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) {
      for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        this.paintFloorTile(g, tx, ty, m.at(tx, ty));
      }
    }
    // sombras das paredes (num caminho só = sem sombra dobrada)
    const sh = new Path2D();
    for (let ty = ty0 - 2; ty < ty0 + CHUNK + 1; ty++) {
      for (let tx = tx0 - 2; tx < tx0 + CHUNK + 1; tx++) {
        const t = m.at(tx, ty);
        if (!m.solid(t) || t === T.Water) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        sh.moveTo(x + TILE, y - WALL_H + 10);
        sh.lineTo(x + TILE + 22, y - WALL_H + 22);
        sh.lineTo(x + TILE + 22, y + TILE + 14);
        sh.lineTo(x + 18, y + TILE + 14);
        sh.lineTo(x, y + TILE);
        sh.lineTo(x + TILE, y + TILE);
        sh.closePath();
      }
    }
    g.fillStyle = 'rgba(8,4,18,0.34)';
    g.fill(sh, 'nonzero');
    return c;
  }

  private paintFloorTile(g: Ctx, tx: number, ty: number, t: T): void {
    const th = this.theme;
    const x = tx * TILE;
    const y = ty * TILE;
    const r = hash2(tx, ty);
    const base = th.floor[Math.floor(r * th.floor.length)]!;
    g.fillStyle = t === T.Rubble ? th.rubble : base;
    g.fillRect(x, y, TILE + 0.5, TILE + 0.5);
    // ladrilhos / juntas
    g.strokeStyle = th.floorLine;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    // variação suave (luz/sombra)
    const v = hash2(tx, ty, 3);
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.06})` : `rgba(0,0,0,${(0.5 - v) * 0.1})`;
    g.fillRect(x, y, TILE, TILE);
    if (t === T.Rubble) {
      for (let i = 0; i < 6; i++) {
        const px = x + hash2(tx, ty, 10 + i) * TILE;
        const py = y + hash2(tx, ty, 20 + i) * TILE;
        const s = 3 + hash2(tx, ty, 30 + i) * 6;
        g.fillStyle = mix(th.brickSide, th.rubble, 0.4);
        g.beginPath();
        g.moveTo(px, py - s);
        g.lineTo(px + s, py);
        g.lineTo(px, py + s * 0.6);
        g.lineTo(px - s * 0.8, py);
        g.fill();
      }
    }
    if (t === T.Water) {
      const grd = g.createLinearGradient(x, y, x, y + TILE);
      grd.addColorStop(0, th.water[0]);
      grd.addColorStop(1, darken(th.water[0], 0.25));
      g.fillStyle = grd;
      g.fillRect(x, y, TILE + 0.5, TILE + 0.5);
      // borda (margem) onde encosta em terra
      const m = this.map;
      g.fillStyle = alpha(lighten(th.water[1], 0.4), 0.5);
      if (m.at(tx, ty - 1) !== T.Water) g.fillRect(x, y, TILE, 5);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      if (m.at(tx, ty + 1) !== T.Water) g.fillRect(x, y + TILE - 4, TILE, 4);
    }
    if (t === T.Hazard) {
      g.fillStyle = th.hazard[1];
      g.fillRect(x, y, TILE + 0.5, TILE + 0.5);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = alpha(th.hazard[0], 0.25 + hash2(tx, ty, 40 + i) * 0.3);
        g.beginPath();
        g.arc(x + hash2(tx, ty, 50 + i) * TILE, y + hash2(tx, ty, 60 + i) * TILE, 5 + hash2(tx, ty, 70 + i) * 10, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (t === T.Pad) {
      g.save();
      g.translate(x + TILE / 2, y + TILE / 2);
      g.fillStyle = darken(th.pad, 0.5);
      g.beginPath();
      g.arc(0, 0, 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = th.pad;
      g.beginPath();
      g.arc(0, 0, 20, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = darken(th.pad, 0.55);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-9, 8 - i * 7);
        g.lineTo(0, -1 - i * 7);
        g.lineTo(9, 8 - i * 7);
        g.lineTo(9, 4 - i * 7);
        g.lineTo(0, -5 - i * 7);
        g.lineTo(-9, 4 - i * 7);
        g.fill();
      }
      g.restore();
    }
    // enfeites determinísticos
    if ((t === T.Floor || t === T.Bush) && hash2(tx, ty, 7) < 0.16) this.paintDecal(g, tx, ty);
  }

  private paintDecal(g: Ctx, tx: number, ty: number): void {
    const th = this.theme;
    const kind = th.decals[Math.floor(hash2(tx, ty, 8) * th.decals.length)]!;
    const x = tx * TILE + 10 + hash2(tx, ty, 9) * 30;
    const y = ty * TILE + 10 + hash2(tx, ty, 11) * 30;
    g.save();
    g.translate(x, y);
    g.rotate(hash2(tx, ty, 12) * Math.PI * 2);
    switch (kind) {
      case 'crack':
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(-14, -4);
        g.lineTo(-4, 0);
        g.lineTo(2, -6);
        g.lineTo(12, 2);
        g.moveTo(-4, 0);
        g.lineTo(-2, 10);
        g.stroke();
        break;
      case 'puddle':
        g.fillStyle = alpha(th.accent2, 0.12);
        g.beginPath();
        g.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(-6, -3, 8, 2);
        break;
      case 'graffiti': {
        g.strokeStyle = alpha(hash2(tx, ty, 13) > 0.5 ? th.accent : th.accent2, 0.35);
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-12, 4);
        g.quadraticCurveTo(-6, -10, 0, 2);
        g.quadraticCurveTo(6, 12, 12, -4);
        g.stroke();
        break;
      }
      case 'leaves':
        for (let i = 0; i < 3; i++) {
          g.fillStyle = alpha(th.bush[2], 0.35);
          g.beginPath();
          g.ellipse(i * 6 - 6, (i % 2) * 5, 4, 2, i, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'bones':
        g.strokeStyle = 'rgba(239,230,210,0.5)';
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(8, 0);
        g.stroke();
        g.fillStyle = 'rgba(239,230,210,0.5)';
        for (const sx of [-9, 9]) {
          g.beginPath();
          g.arc(sx, -2, 2.4, 0, Math.PI * 2);
          g.arc(sx, 2, 2.4, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'oil':
        g.fillStyle = 'rgba(10,6,20,0.35)';
        g.beginPath();
        g.ellipse(0, 0, 14, 8, 0.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = alpha(th.accent, 0.1);
        g.beginPath();
        g.ellipse(-3, -2, 6, 3, 0.4, 0, Math.PI * 2);
        g.fill();
        break;
      case 'stars':
        g.fillStyle = alpha('#ffffff', 0.5);
        for (let i = 0; i < 4; i++) g.fillRect(hash2(tx, ty, 80 + i) * 30 - 15, hash2(tx, ty, 90 + i) * 30 - 15, 2, 2);
        break;
      case 'manhole':
        g.fillStyle = 'rgba(20,16,28,0.5)';
        g.beginPath();
        g.arc(0, 0, 13, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 1;
        for (let i = -8; i <= 8; i += 4) {
          g.beginPath();
          g.moveTo(-10, i);
          g.lineTo(10, i);
          g.stroke();
        }
        break;
      case 'tile':
        g.strokeStyle = 'rgba(0,0,0,0.15)';
        g.lineWidth = 1;
        g.strokeRect(-12, -12, 24, 24);
        break;
      case 'grass':
        g.strokeStyle = alpha(th.bush[2], 0.4);
        g.lineWidth = 1.5;
        for (let i = -6; i <= 6; i += 3) {
          g.beginPath();
          g.moveTo(i, 4);
          g.lineTo(i + 1, -4);
          g.stroke();
        }
        break;
      case 'arrow':
        g.fillStyle = alpha(th.accent2, 0.18);
        g.beginPath();
        g.moveTo(-10, -4);
        g.lineTo(4, -4);
        g.lineTo(4, -10);
        g.lineTo(14, 0);
        g.lineTo(4, 10);
        g.lineTo(4, 4);
        g.lineTo(-10, 4);
        g.fill();
        break;
    }
    g.restore();
  }

  // -------------------------------------------------------------------------
  // ÁGUA / PERIGO animados (por cima do chão)
  // -------------------------------------------------------------------------

  drawAnimated(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number, tx0: number, ty0: number, tx1: number, ty1: number, time: number): void {
    const m = this.map;
    const th = this.theme;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    for (let ty = Math.max(0, ty0); ty <= Math.min(m.h - 1, ty1); ty++) {
      for (let tx = Math.max(0, tx0); tx <= Math.min(m.w - 1, tx1); tx++) {
        const t = m.at(tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        if (t === T.Water) {
          ctx.strokeStyle = alpha(th.water[1], 0.55);
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const yy = y + 12 + i * 18 + Math.sin(time * 1.6 + tx * 0.7 + i) * 3;
            ctx.beginPath();
            ctx.moveTo(x + 6, yy);
            ctx.quadraticCurveTo(x + 22, yy - 5, x + 34, yy);
            ctx.quadraticCurveTo(x + 46, yy + 5, x + 58, yy);
            ctx.stroke();
          }
          if (hash2(tx, ty, 99) < 0.2) {
            ctx.fillStyle = alpha('#ffffff', 0.25 + Math.sin(time * 3 + tx) * 0.2);
            ctx.fillRect(x + 20 + Math.sin(time + ty) * 10, y + 30, 3, 3);
          }
        } else if (t === T.Hazard) {
          const p = 0.25 + Math.sin(time * 3 + tx * 0.9 + ty * 1.3) * 0.15;
          ctx.fillStyle = alpha(th.hazard[0], p);
          ctx.fillRect(x, y, TILE, TILE);
          const bx = x + 32 + Math.sin(time * 2 + ty) * 18;
          const by = y + 32 + Math.cos(time * 1.7 + tx) * 18;
          const br = 3 + ((time * 4 + tx) % 5);
          ctx.strokeStyle = alpha(lighten(th.hazard[0], 0.4), 0.7);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.stroke();
        } else if (t === T.Pad) {
          const p = (time * 1.5) % 1;
          ctx.strokeStyle = alpha(th.pad, 1 - p);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x + 32, y + 32, 20 + p * 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // PAREDES (blocos com altura) — desenhadas por linha, junto com os personagens
  // -------------------------------------------------------------------------

  private sprite(key: string, w: number, h: number, paint: (g: Ctx) => void): Canvas {
    let s = this.sprites.get(key);
    if (!s) {
      const k = this.scale;
      s = makeCanvas(w * k + 2, h * k + 2);
      const g = s.getContext('2d') as Ctx;
      g.setTransform(k, 0, 0, k, 1, 1);
      paint(g);
      this.sprites.set(key, s);
    }
    return s;
  }

  /** Desenha os blocos sólidos de uma linha `ty` (chamado na ordem de profundidade). */
  drawWallRow(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number, ty: number, tx0: number, tx1: number, time: number): void {
    const m = this.map;
    for (let tx = Math.max(0, tx0); tx <= Math.min(m.w - 1, tx1); tx++) {
      const t = m.at(tx, ty);
      if (t === T.Wall || t === T.Brick || t === T.Glass || t === T.TempWall) this.drawBlock(ctx, k, ox, oy, tx, ty, t, time);
    }
  }

  private drawBlock(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number, tx: number, ty: number, t: T, time: number): void {
    const m = this.map;
    const th = this.theme;
    const below = m.at(tx, ty + 1);
    const showFront = !(below === T.Wall || below === T.Brick || below === T.Glass || below === T.TempWall);
    const variant = Math.floor(hash2(tx, ty, 5) * 3);
    const H = WALL_H;
    const key = `b${t}:${variant}:${showFront ? 1 : 0}`;
    const spr = this.sprite(key, TILE, TILE + H, (g) => this.paintBlock(g, t, variant, showFront));
    const x = Math.round(ox + tx * TILE * k) - 1;
    const y = Math.round(oy + (ty * TILE - H) * k) - 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(spr as CanvasImageSource, x, y);
    // rachaduras conforme a vida
    if (t === T.Brick || t === T.Glass || t === T.TempWall) {
      const max = t === T.Brick ? 2600 : t === T.Glass ? 700 : 1800;
      const hp = m.hp[m.idx(tx, ty)]!;
      const frac = hp / max;
      if (frac < 0.95) {
        ctx.setTransform(k, 0, 0, k, ox, oy);
        ctx.strokeStyle = t === T.Glass ? 'rgba(255,255,255,0.8)' : 'rgba(20,8,10,0.75)';
        ctx.lineWidth = 2;
        const cx = tx * TILE + 32;
        const cy = ty * TILE - H + 32;
        const n = Math.ceil((1 - frac) * 5);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = hash2(tx, ty, 200 + i) * Math.PI * 2;
          const l = 10 + hash2(tx, ty, 300 + i) * 20;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.5 + 3);
          ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
        }
        ctx.stroke();
      }
    }
    // enfeite neon/cristal pulsando no topo de algumas paredes
    if (t === T.Wall && (th.wallDeco === 'neon' || th.wallDeco === 'crystal') && hash2(tx, ty, 77) < 0.07 && showFront) {
      ctx.setTransform(k, 0, 0, k, ox, oy);
      const p = 0.6 + Math.sin(time * 4 + tx) * 0.4;
      ctx.fillStyle = alpha(hash2(tx, ty, 78) > 0.5 ? th.accent : th.accent2, 0.25 * p);
      ctx.beginPath();
      ctx.arc(tx * TILE + 32, ty * TILE + TILE - H / 2, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintBlock(g: Ctx, t: T, variant: number, front: boolean): void {
    const th = this.theme;
    const H = WALL_H;
    let top = th.wallTop;
    let side = th.wallSide;
    let edge = th.wallEdge;
    if (t === T.Brick) {
      top = th.brickTop;
      side = th.brickSide;
      edge = lighten(th.brickTop, 0.25);
    } else if (t === T.Glass) {
      top = alpha(th.glass, 0.55);
      side = alpha(darken(th.glass, 0.35), 0.6);
      edge = '#ffffff';
    } else if (t === T.TempWall) {
      top = '#8a7aa8';
      side = '#4a3a6a';
      edge = '#d6c8ff';
    }
    // frente
    if (front) {
      const grd = g.createLinearGradient(0, TILE - H, 0, TILE + H - H);
      grd.addColorStop(0, side);
      grd.addColorStop(1, darken(side, 0.35));
      g.fillStyle = grd;
      g.fillRect(0, TILE, TILE, H);
      if (t === T.Brick) {
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.lineWidth = 1.5;
        for (let r = 0; r < 3; r++) {
          const yy = TILE + r * (H / 3);
          g.beginPath();
          g.moveTo(0, yy);
          g.lineTo(TILE, yy);
          g.stroke();
          for (let c = 0; c < 3; c++) {
            const xx = ((c + (r % 2) * 0.5) * TILE) / 3;
            g.beginPath();
            g.moveTo(xx, yy);
            g.lineTo(xx, yy + H / 3);
            g.stroke();
          }
        }
      } else if (t === T.Wall) {
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(0, TILE + 4, TILE, 3);
        if (this.theme.wallDeco === 'pipe' && variant === 1) {
          g.fillStyle = darken(side, 0.2);
          g.fillRect(6, TILE + 8, TILE - 12, 8);
          g.fillStyle = 'rgba(255,255,255,0.15)';
          g.fillRect(6, TILE + 8, TILE - 12, 2);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, TILE + H - 4, TILE, 4);
    }
    // topo
    g.fillStyle = top;
    g.fillRect(0, 0, TILE, TILE);
    const grd = g.createLinearGradient(0, 0, TILE, TILE);
    grd.addColorStop(0, 'rgba(255,255,255,0.10)');
    grd.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grd;
    g.fillRect(0, 0, TILE, TILE);
    g.strokeStyle = alpha(edge, 0.6);
    g.lineWidth = 2;
    g.strokeRect(1, 1, TILE - 2, TILE - 2);
    // detalhes do topo por tema
    if (t === T.Wall) {
      const d = this.theme.wallDeco;
      if (d === 'tomb' && variant === 0) {
        g.fillStyle = darken(top, 0.15);
        g.beginPath();
        g.roundRect(18, 10, 28, 40, [12, 12, 2, 2]);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(32, 18);
        g.lineTo(32, 38);
        g.moveTo(24, 26);
        g.lineTo(40, 26);
        g.stroke();
      } else if (d === 'crystal' && variant === 2) {
        g.fillStyle = alpha(this.theme.accent, 0.7);
        g.beginPath();
        g.moveTo(32, 8);
        g.lineTo(42, 30);
        g.lineTo(32, 52);
        g.lineTo(22, 30);
        g.fill();
      } else if (d === 'pillar' && variant === 0) {
        g.fillStyle = lighten(top, 0.15);
        g.beginPath();
        g.arc(32, 32, 20, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.2)';
        g.stroke();
      } else if (d === 'neon' && variant === 1) {
        g.strokeStyle = alpha(this.theme.accent, 0.9);
        g.lineWidth = 3;
        g.strokeRect(12, 12, 40, 40);
      } else if (variant === 2) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(8, 8, 20, 20);
        g.fillRect(36, 36, 20, 20);
      }
    } else if (t === T.Brick) {
      g.strokeStyle = 'rgba(0,0,0,0.2)';
      g.lineWidth = 1.5;
      for (let r = 1; r < 4; r++) {
        g.beginPath();
        g.moveTo(0, r * 16);
        g.lineTo(TILE, r * 16);
        g.stroke();
      }
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) {
          const xx = ((c + (r % 2) * 0.5) * TILE) / 3;
          g.beginPath();
          g.moveTo(xx, r * 16);
          g.lineTo(xx, r * 16 + 16);
          g.stroke();
        }
    } else if (t === T.Glass) {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(12, 40);
      g.lineTo(30, 14);
      g.moveTo(26, 50);
      g.lineTo(44, 24);
      g.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // ARBUSTOS (tufos altos, ficam transparentes perto de você)
  // -------------------------------------------------------------------------

  drawBush(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number, tx: number, ty: number, fade: number, time: number): void {
    const v = Math.floor(hash2(tx, ty, 6) * 3);
    const spr = this.sprite(`bush${v}`, TILE + 16, TILE + 24, (g) => this.paintBush(g, v));
    const sway = Math.sin(time * 1.8 + tx * 0.6 + ty) * 1.2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * fade;
    ctx.drawImage(spr as CanvasImageSource, Math.round(ox + (tx * TILE - 8 + sway) * k), Math.round(oy + (ty * TILE - 22) * k));
    ctx.globalAlpha = prev;
  }

  private paintBush(g: Ctx, v: number): void {
    const [dark, mid, lite] = this.theme.bush;
    const blobs: Array<[number, number, number]> = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + v;
      blobs.push([40 + Math.cos(a) * 20, 48 + Math.sin(a) * 14 - 4, 15 + ((i * 7 + v * 3) % 5)]);
    }
    blobs.push([40, 40, 20]);
    // contorno
    g.fillStyle = darken(dark, 0.5);
    for (const [x, y, r] of blobs) {
      g.beginPath();
      g.arc(x, y, r + 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = dark;
    for (const [x, y, r] of blobs) {
      g.beginPath();
      g.arc(x, y + 2, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = mid;
    for (const [x, y, r] of blobs) {
      g.beginPath();
      g.arc(x - 2, y - 2, r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = lite;
    for (const [x, y, r] of blobs.slice(0, 6)) {
      g.beginPath();
      g.ellipse(x - 5, y - 7, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  hash(tx: number, ty: number, s: number): number {
    return hash2(tx, ty, s);
  }
}

export { hashString };
