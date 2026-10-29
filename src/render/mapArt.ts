import { alpha, darken, lighten, mix } from '../art/color';
import { newCanvas } from '../pixel/buffer';
import { INK_HEX } from '../pixel/palette';
import { GameMap, T } from '../sim/map';
import { pixDither, pixEllipse, pixLine, pixPoly, pixRect, pixRing } from './pix';
import type { Theme } from './theme';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** 1 bloco = 32×32 pixels de arte (64 px de mundo). */
export const TA = 32;
/** altura das paredes em pixels de arte */
export const WALL_HA = 21;
const CHUNK = 8;

function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * ARTE DO MAPA EM PIXEL ART
 * Chão pré-desenhado em pedaços (8×8 blocos); paredes, arbustos e objetos por frame,
 * ordenados por profundidade. Tudo em coordenadas de PIXEL DE ARTE (inteiros).
 */
export class MapArt {
  private chunks = new Map<string, { canvas: Canvas; version: number }>();
  private snapshot: Uint8Array;
  private chunkVersion: Int32Array;
  private sprites = new Map<string, Canvas>();
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

  sync(): void {
    const m = this.map;
    for (let i = 0; i < m.tiles.length; i++) {
      if (m.tiles[i] !== this.snapshot[i]) {
        this.snapshot[i] = m.tiles[i]!;
        const tx = i % m.w;
        const ty = Math.floor(i / m.w);
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

  // ------------------------------------------------------------------- CHÃO

  /** (ox,oy) = pixel do buffer onde fica o pixel de arte (0,0) do mapa */
  drawFloor(g: CanvasRenderingContext2D, ox: number, oy: number, ax0: number, ay0: number, ax1: number, ay1: number): void {
    const cs = CHUNK * TA;
    const cx0 = Math.max(0, Math.floor(ax0 / cs));
    const cy0 = Math.max(0, Math.floor(ay0 / cs));
    const cx1 = Math.min(this.cw - 1, Math.floor(ax1 / cs));
    const cy1 = Math.min(this.ch - 1, Math.floor(ay1 / cs));
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`;
        const ver = this.chunkVersion[cy * this.cw + cx]!;
        let c = this.chunks.get(key);
        if (!c || c.version !== ver) {
          c = { canvas: this.renderChunk(cx, cy), version: ver };
          this.chunks.set(key, c);
        }
        g.drawImage(c.canvas as CanvasImageSource, ox + cx * cs, oy + cy * cs);
      }
  }

  private renderChunk(cx: number, cy: number): Canvas {
    const cs = CHUNK * TA;
    const c = newCanvas(cs, cs);
    const g = c.getContext('2d') as Ctx;
    g.translate(-cx * cs, -cy * cs);
    const m = this.map;
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++)
      for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        this.paintFloorTile(g, tx, ty, m.at(tx, ty));
      }
    // sombras das paredes caindo pra baixo-direita (num único polígono = sem sobreposição)
    g.save();
    g.globalAlpha = 0.32;
    const sh = '#080412';
    for (let ty = ty0 - 2; ty < ty0 + CHUNK + 1; ty++)
      for (let tx = tx0 - 2; tx < tx0 + CHUNK + 1; tx++) {
        const t = m.at(tx, ty);
        if (!m.solid(t) || t === T.Water) continue;
        const x = tx * TA;
        const y = ty * TA;
        const right = m.solid(m.at(tx + 1, ty)) && m.at(tx + 1, ty) !== T.Water;
        const below = m.solid(m.at(tx, ty + 1)) && m.at(tx, ty + 1) !== T.Water;
        if (!below) pixPoly(g, [x, y + TA, x + TA, y + TA, x + TA + 10, y + TA + 7, x + 9, y + TA + 7], sh);
        if (!right) pixPoly(g, [x + TA, y - WALL_HA + 4, x + TA + 10, y - WALL_HA + 10, x + TA + 10, y + TA + 7, x + TA, y + TA], sh);
      }
    g.restore();
    return c;
  }

  private paintFloorTile(g: Ctx, tx: number, ty: number, t: T): void {
    const th = this.theme;
    const x = tx * TA;
    const y = ty * TA;
    const r = hash2(tx, ty);
    const base = t === T.Rubble ? th.rubble : th.floor[Math.floor(r * th.floor.length)]!;
    pixRect(g, x, y, TA, TA, base);
    // textura: pixels mais claros e mais escuros espalhados
    const dark = mix(base, '#120a26', 0.22);
    const lite = mix(base, '#fff3d6', 0.1);
    for (let i = 0; i < 14; i++) {
      const px = Math.floor(hash2(tx, ty, 100 + i) * TA);
      const py = Math.floor(hash2(tx, ty, 200 + i) * TA);
      pixRect(g, x + px, y + py, 1, 1, i % 3 ? dark : lite);
    }
    // juntas do piso
    pixRect(g, x, y + TA - 1, TA, 1, mix(base, '#120a26', 0.18));
    pixRect(g, x + TA - 1, y, 1, TA, mix(base, '#120a26', 0.12));
    pixRect(g, x, y, TA, 1, mix(base, '#fff3d6', 0.06));
    if (t === T.Rubble) {
      for (let i = 0; i < 7; i++) {
        const px = x + 3 + Math.floor(hash2(tx, ty, 10 + i) * (TA - 6));
        const py = y + 3 + Math.floor(hash2(tx, ty, 20 + i) * (TA - 6));
        const s = 2 + Math.floor(hash2(tx, ty, 30 + i) * 3);
        pixRect(g, px, py, s, s, th.brickSide);
        pixRect(g, px, py, s, 1, th.brickTop);
        pixRect(g, px, py + s, s, 1, INK_HEX);
      }
    }
    if (t === T.Water) {
      pixRect(g, x, y, TA, TA, th.water[0]);
      pixDither(g, x, y + TA - 6, TA, 6, darken(th.water[0], 0.25));
      const m = this.map;
      if (m.at(tx, ty - 1) !== T.Water) {
        pixRect(g, x, y, TA, 2, lighten(th.water[1], 0.35));
        pixRect(g, x, y + 2, TA, 1, th.water[1]);
      }
      if (m.at(tx, ty + 1) !== T.Water) pixRect(g, x, y + TA - 2, TA, 2, darken(th.water[0], 0.4));
    }
    if (t === T.Hazard) {
      pixRect(g, x, y, TA, TA, th.hazard[1]);
      for (let i = 0; i < 4; i++)
        pixEllipse(g, x + 4 + hash2(tx, ty, 50 + i) * 24, y + 4 + hash2(tx, ty, 60 + i) * 24, 2 + hash2(tx, ty, 70 + i) * 4, 2 + hash2(tx, ty, 70 + i) * 3, mix(th.hazard[1], th.hazard[0], 0.45));
    }
    if (t === T.Pad) {
      pixEllipse(g, x + 16, y + 16, 13, 13, INK_HEX);
      pixEllipse(g, x + 16, y + 16, 12, 12, darken(th.pad, 0.45));
      pixEllipse(g, x + 16, y + 15, 9, 9, th.pad);
      for (let i = 0; i < 3; i++) {
        const yy = y + 19 - i * 4;
        pixLine(g, x + 12, yy, x + 16, yy - 4, darken(th.pad, 0.55));
        pixLine(g, x + 16, yy - 4, x + 20, yy, darken(th.pad, 0.55));
      }
    }
    if ((t === T.Floor || t === T.Bush) && hash2(tx, ty, 7) < 0.14) this.paintDecal(g, tx, ty);
  }

  private paintDecal(g: Ctx, tx: number, ty: number): void {
    const th = this.theme;
    const kind = th.decals[Math.floor(hash2(tx, ty, 8) * th.decals.length)]!;
    const x = tx * TA + 6 + Math.floor(hash2(tx, ty, 9) * 16);
    const y = ty * TA + 6 + Math.floor(hash2(tx, ty, 11) * 16);
    switch (kind) {
      case 'crack':
        pixLine(g, x, y, x + 5, y + 2, alpha('#000000', 0.4));
        pixLine(g, x + 5, y + 2, x + 8, y - 1, alpha('#000000', 0.4));
        pixLine(g, x + 5, y + 2, x + 6, y + 6, alpha('#000000', 0.4));
        break;
      case 'puddle':
        pixEllipse(g, x + 4, y + 3, 7, 3.5, alpha(th.accent2, 0.18));
        pixRect(g, x + 1, y + 2, 3, 1, alpha('#ffffff', 0.25));
        break;
      case 'graffiti': {
        const c = hash2(tx, ty, 13) > 0.5 ? th.accent : th.accent2;
        pixLine(g, x, y + 3, x + 3, y, alpha(c, 0.45), 2);
        pixLine(g, x + 3, y, x + 6, y + 4, alpha(c, 0.45), 2);
        pixLine(g, x + 6, y + 4, x + 10, y, alpha(c, 0.45), 2);
        break;
      }
      case 'leaves':
        for (let i = 0; i < 3; i++) pixRect(g, x + i * 3, y + (i % 2) * 2, 2, 1, alpha(th.bush[2], 0.5));
        break;
      case 'bones':
        pixRect(g, x, y + 1, 7, 1, '#d8cdb4');
        pixRect(g, x - 1, y, 2, 3, '#e9e2d0');
        pixRect(g, x + 6, y, 2, 3, '#e9e2d0');
        break;
      case 'oil':
        pixEllipse(g, x + 4, y + 2, 6, 3, alpha('#0a0614', 0.4));
        pixRect(g, x + 2, y + 1, 2, 1, alpha(th.accent, 0.3));
        break;
      case 'stars':
        for (let i = 0; i < 4; i++) pixRect(g, x + Math.floor(hash2(tx, ty, 80 + i) * 14), y + Math.floor(hash2(tx, ty, 90 + i) * 14), 1, 1, '#ffffff');
        break;
      case 'manhole':
        pixEllipse(g, x + 5, y + 5, 6, 6, '#24202c');
        for (let i = -3; i <= 3; i += 2) pixRect(g, x + 2, y + 5 + i, 7, 1, '#3a3442');
        break;
      case 'tile':
        pixRing(g, x + 5, y + 5, 6, 6, 1, alpha('#000000', 0.15));
        break;
      case 'grass':
        for (let i = 0; i < 4; i++) pixLine(g, x + i * 2, y + 4, x + i * 2 + 1, y, alpha(th.bush[2], 0.55));
        break;
      case 'arrow':
        pixPoly(g, [x, y + 2, x + 6, y + 2, x + 6, y, x + 10, y + 3, x + 6, y + 6, x + 6, y + 4, x, y + 4], alpha(th.accent2, 0.25));
        break;
    }
  }

  // ---------------------------------------------------- ÁGUA/PERIGO animados

  drawAnimated(g: CanvasRenderingContext2D, ox: number, oy: number, tx0: number, ty0: number, tx1: number, ty1: number, time: number): void {
    const m = this.map;
    const th = this.theme;
    for (let ty = Math.max(0, ty0); ty <= Math.min(m.h - 1, ty1); ty++)
      for (let tx = Math.max(0, tx0); tx <= Math.min(m.w - 1, tx1); tx++) {
        const t = m.at(tx, ty);
        const x = ox + tx * TA;
        const y = oy + ty * TA;
        if (t === T.Water) {
          const f = Math.floor(time * 4 + tx * 0.7 + ty) % 4;
          for (let i = 0; i < 3; i++) {
            const wy = y + 7 + i * 9 + ((f + i) % 2);
            const wx = x + ((f * 3 + i * 7 + tx * 5) % 12);
            pixRect(g, wx, wy, 6, 1, th.water[1]);
            pixRect(g, wx + 6, wy - 1, 4, 1, th.water[1]);
          }
          if (hash2(tx, ty, 99) < 0.25 && f < 2) pixRect(g, x + 10 + f * 4, y + 14, 1, 1, '#ffffff');
        } else if (t === T.Hazard) {
          const f = Math.floor(time * 5 + tx * 1.3 + ty * 0.7);
          for (let i = 0; i < 2; i++) {
            const bx = x + 4 + ((tx * 7 + i * 13 + f) % 24);
            const by = y + 26 - ((f * 3 + i * 9) % 22);
            pixRing(g, bx, by, 2 + (i % 2), 2 + (i % 2), 1, lighten(th.hazard[0], 0.2));
          }
          if ((f + tx) % 3 === 0) pixDither(g, x, y, TA, TA, alpha(th.hazard[0], 0.25), f & 1);
        } else if (t === T.Pad) {
          const p = (time * 1.5) % 1;
          pixRing(g, x + 16, y + 16, 10 + p * 8, 10 + p * 8, 1, alpha(th.pad, 1 - p));
        }
      }
  }

  // ------------------------------------------------------------- PAREDES

  private sprite(key: string, w: number, h: number, paint: (g: Ctx) => void): Canvas {
    let s = this.sprites.get(key);
    if (!s) {
      s = newCanvas(w, h);
      paint(s.getContext('2d') as Ctx);
      this.sprites.set(key, s);
    }
    return s;
  }

  drawWallRow(g: CanvasRenderingContext2D, ox: number, oy: number, ty: number, tx0: number, tx1: number, time: number): void {
    const m = this.map;
    for (let tx = Math.max(0, tx0); tx <= Math.min(m.w - 1, tx1); tx++) {
      const t = m.at(tx, ty);
      if (t === T.Wall || t === T.Brick || t === T.Glass || t === T.TempWall) this.drawBlock(g, ox, oy, tx, ty, t, time);
    }
  }

  private isBlock(t: T): boolean {
    return t === T.Wall || t === T.Brick || t === T.Glass || t === T.TempWall;
  }

  private drawBlock(g: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number, t: T, time: number): void {
    const m = this.map;
    const th = this.theme;
    const front = !this.isBlock(m.at(tx, ty + 1));
    const L = !this.isBlock(m.at(tx - 1, ty));
    const R = !this.isBlock(m.at(tx + 1, ty));
    const U = !this.isBlock(m.at(tx, ty - 1));
    const variant = Math.floor(hash2(tx, ty, 5) * 3);
    const key = `b${t}:${variant}:${front ? 1 : 0}${L ? 1 : 0}${R ? 1 : 0}${U ? 1 : 0}`;
    const spr = this.sprite(key, TA, TA + WALL_HA, (c) => this.paintBlock(c, t, variant, front, L, R, U));
    const x = ox + tx * TA;
    const y = oy + ty * TA - WALL_HA;
    g.drawImage(spr as CanvasImageSource, x, y);
    // rachaduras conforme a vida
    if (t === T.Brick || t === T.Glass || t === T.TempWall) {
      const max = t === T.Brick ? 2600 : t === T.Glass ? 700 : 1800;
      const frac = m.hp[m.idx(tx, ty)]! / max;
      if (frac < 0.95) {
        const n = Math.ceil((1 - frac) * 5);
        const cc = t === T.Glass ? '#ffffff' : '#1a0a10';
        const cx = x + 16;
        const cy = y + 14;
        for (let i = 0; i < n; i++) {
          const a = hash2(tx, ty, 200 + i) * Math.PI * 2;
          const l = 5 + hash2(tx, ty, 300 + i) * 9;
          pixLine(g, cx, cy, cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.5 + 2, cc);
          pixLine(g, cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.5 + 2, cx + Math.cos(a) * l, cy + Math.sin(a) * l, cc);
        }
      }
    }
    // luz neon pulsando em algumas paredes
    if (t === T.Wall && (th.wallDeco === 'neon' || th.wallDeco === 'crystal') && hash2(tx, ty, 77) < 0.08 && front) {
      const on = Math.floor(time * 2 + tx) % 5 !== 0;
      if (on) {
        g.globalAlpha = 0.22;
        pixEllipse(g, x + 16, y + TA + WALL_HA / 2, 22, 14, hash2(tx, ty, 78) > 0.5 ? th.accent : th.accent2);
        g.globalAlpha = 1;
      }
    }
  }

  private paintBlock(g: Ctx, t: T, variant: number, front: boolean, L: boolean, R: boolean, U: boolean): void {
    const th = this.theme;
    let top = th.wallTop;
    let side = th.wallSide;
    let edge = th.wallEdge;
    if (t === T.Brick) {
      top = th.brickTop;
      side = th.brickSide;
      edge = lighten(th.brickTop, 0.25);
    } else if (t === T.Glass) {
      top = mix(th.glass, th.floor[0]!, 0.35);
      side = mix(darken(th.glass, 0.35), th.floor[0]!, 0.3);
      edge = '#ffffff';
    } else if (t === T.TempWall) {
      top = '#8a7aa8';
      side = '#4a3a6a';
      edge = '#d6c8ff';
    }
    // FRENTE
    if (front) {
      pixRect(g, 0, TA, TA, WALL_HA, side);
      pixRect(g, 0, TA + WALL_HA - 4, TA, 4, darken(side, 0.3));
      if (t === T.Brick) {
        for (let r = 0; r < 3; r++) {
          const yy = TA + r * 7;
          pixRect(g, 0, yy, TA, 1, darken(side, 0.35));
          for (let c = 0; c < 4; c++) pixRect(g, (c * 8 + (r % 2) * 4) % TA, yy, 1, 7, darken(side, 0.35));
          pixRect(g, 0, yy + 1, TA, 1, lighten(side, 0.12));
        }
      } else if (t === T.Glass) {
        pixLine(g, 6, TA + 16, 12, TA + 4, '#ffffff');
        pixLine(g, 14, TA + 17, 18, TA + 9, alpha('#ffffff', 0.7));
      } else {
        pixRect(g, 0, TA + 2, TA, 1, lighten(side, 0.15));
        if (th.wallDeco === 'pipe' && variant === 1) {
          pixRect(g, 3, TA + 5, TA - 6, 5, darken(side, 0.2));
          pixRect(g, 3, TA + 5, TA - 6, 1, lighten(side, 0.25));
        }
        if (th.wallDeco === 'neon' && variant === 2) {
          pixRect(g, 6, TA + 6, 20, 6, '#140c1e');
          pixRect(g, 8, TA + 8, 16, 2, th.accent);
        }
        if (th.wallDeco === 'tomb' && variant === 1) pixDither(g, 0, TA + 4, TA, WALL_HA - 8, alpha('#58ffd0', 0.15));
      }
    }
    // TOPO
    pixRect(g, 0, 0, TA, TA, top);
    pixDither(g, 1, 1, TA - 2, TA - 2, alpha(darken(top, 0.25), 0.25), variant);
    // bordas iluminadas/sombreadas
    if (U) pixRect(g, 0, 0, TA, 2, edge);
    if (L) pixRect(g, 0, 0, 2, TA, mix(edge, top, 0.4));
    if (R) pixRect(g, TA - 2, 0, 2, TA, darken(top, 0.25));
    if (front) pixRect(g, 0, TA - 2, TA, 2, darken(top, 0.3));
    // detalhes do topo por tema
    if (t === T.Wall) {
      const d = th.wallDeco;
      if (d === 'tomb' && variant === 0) {
        pixRect(g, 10, 5, 12, 20, darken(top, 0.18));
        pixRect(g, 11, 4, 10, 1, darken(top, 0.18));
        pixRect(g, 15, 8, 2, 12, darken(top, 0.4));
        pixRect(g, 12, 11, 8, 2, darken(top, 0.4));
      } else if (d === 'crystal' && variant === 2) {
        pixPoly(g, [16, 4, 22, 15, 16, 27, 10, 15], th.accent);
        pixPoly(g, [16, 4, 22, 15, 16, 15], lighten(th.accent, 0.4));
      } else if (d === 'pillar' && variant === 0) {
        pixEllipse(g, 16, 16, 10, 10, lighten(top, 0.12));
        pixRing(g, 16, 16, 10, 10, 1, darken(top, 0.25));
      } else if (d === 'neon' && variant === 1) {
        pixRing(g, 16, 16, 10, 10, 2, th.accent);
      } else if (d === 'fence' && variant === 1) {
        for (let i = 4; i < TA; i += 6) pixRect(g, i, 4, 2, TA - 8, darken(top, 0.25));
      } else if (variant === 2) {
        pixRect(g, 5, 5, 8, 8, darken(top, 0.12));
        pixRect(g, 19, 19, 8, 8, darken(top, 0.12));
      }
    } else if (t === T.Brick) {
      for (let r = 0; r < 4; r++) {
        pixRect(g, 0, r * 8, TA, 1, darken(top, 0.25));
        for (let c = 0; c < 4; c++) pixRect(g, (c * 8 + (r % 2) * 4) % TA, r * 8, 1, 8, darken(top, 0.25));
      }
    } else if (t === T.Glass) {
      pixLine(g, 6, 22, 15, 7, '#ffffff');
      pixLine(g, 12, 25, 21, 11, alpha('#ffffff', 0.6));
    }
    // contorno escuro em volta do bloco
    if (U) pixRect(g, 0, 0, TA, 1, INK_HEX);
    if (L) pixRect(g, 0, 0, 1, TA + (front ? WALL_HA : 0), INK_HEX);
    if (R) pixRect(g, TA - 1, 0, 1, TA + (front ? WALL_HA : 0), INK_HEX);
    if (front) pixRect(g, 0, TA + WALL_HA - 1, TA, 1, INK_HEX);
  }

  // ------------------------------------------------------------- ARBUSTOS

  drawBush(g: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number, fade: number, time: number): void {
    const v = Math.floor(hash2(tx, ty, 6) * 3);
    const spr = this.sprite(`bush${v}`, TA + 12, TA + 14, (c) => this.paintBush(c, v));
    const sway = Math.floor(time * 1.6 + tx * 0.6 + ty) % 4 === 0 ? 1 : 0;
    const prev = g.globalAlpha;
    g.globalAlpha = prev * fade;
    g.drawImage(spr as CanvasImageSource, ox + tx * TA - 6 + sway, oy + ty * TA - 12);
    g.globalAlpha = prev;
  }

  private paintBush(g: Ctx, v: number): void {
    const [dark, mid, lite] = this.theme.bush;
    const blobs: Array<[number, number, number]> = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + v;
      blobs.push([22 + Math.cos(a) * 10, 26 + Math.sin(a) * 7, 7 + ((i * 5 + v * 3) % 3)]);
    }
    blobs.push([22, 22, 10]);
    for (const [x, y, r] of blobs) pixEllipse(g, x, y, r + 1, r + 1, INK_HEX);
    for (const [x, y, r] of blobs) pixEllipse(g, x, y + 1, r, r, dark);
    for (const [x, y, r] of blobs) pixEllipse(g, x - 1, y - 1, r * 0.75, r * 0.75, mid);
    for (const [x, y, r] of blobs.slice(0, 6)) pixRect(g, Math.round(x - 3), Math.round(y - r * 0.55), 3, 1, lite);
    // folhinhas soltas
    for (let i = 0; i < 6; i++) pixRect(g, 8 + ((i * 7 + v * 5) % 28), 12 + ((i * 11 + v) % 22), 1, 1, lite);
  }
}
