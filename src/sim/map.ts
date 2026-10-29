import type { MapDef, MapTheme } from '../content/types';

/**
 * MAPA EM GRADE
 * Cada célula tem 64×64 px. O desenho do mapa vem de texto (content/maps/*.ts).
 */

export const TILE = 64;

export const T = {
  Floor: 0,
  Wall: 1, // indestrutível
  Brick: 2, // destrutível (bloqueia tiro e passagem)
  Glass: 3, // destrutível fraco
  Water: 4, // bloqueia passagem, NÃO bloqueia tiro
  Bush: 5, // esconde
  Hazard: 6, // lava/veneno: dano por segundo
  Pad: 7, // pad de salto
  Rubble: 8, // chão de escombro (era parede)
  TempWall: 9, // parede de habilidade (some sozinha)
} as const;
export type T = (typeof T)[keyof typeof T];

/** Legenda do desenho em texto. */
export const LEGEND: Record<string, { tile: T; extra?: 'spawnA' | 'spawnB' | 'spawn' | 'crate' | 'barrel' | 'tire' | 'heal' | 'power' }> = {
  '.': { tile: T.Floor },
  ' ': { tile: T.Floor },
  '#': { tile: T.Wall },
  B: { tile: T.Brick },
  '=': { tile: T.Glass },
  W: { tile: T.Water },
  '"': { tile: T.Bush },
  '~': { tile: T.Hazard },
  '^': { tile: T.Pad },
  A: { tile: T.Floor, extra: 'spawnA' },
  Z: { tile: T.Floor, extra: 'spawnB' },
  S: { tile: T.Floor, extra: 'spawn' },
  x: { tile: T.Floor, extra: 'crate' },
  o: { tile: T.Floor, extra: 'barrel' },
  t: { tile: T.Floor, extra: 'tire' },
  '+': { tile: T.Floor, extra: 'heal' },
  '*': { tile: T.Floor, extra: 'power' },
};

export const TILE_HP: Partial<Record<T, number>> = { [T.Brick]: 2600, [T.Glass]: 700, [T.TempWall]: 1800 };

export interface MapSpawns {
  teamA: Array<{ x: number; y: number }>;
  teamB: Array<{ x: number; y: number }>;
  free: Array<{ x: number; y: number }>;
  props: Array<{ kind: 'crate' | 'barrel' | 'tire'; x: number; y: number }>;
  heals: Array<{ x: number; y: number }>;
  powers: Array<{ x: number; y: number }>;
}

/** Expande a simetria e devolve as linhas completas. */
export function expandGrid(def: MapDef): string[] {
  const rows = def.grid.map((r) => r.replace(/\s+$/, ''));
  const w = Math.max(...rows.map((r) => r.length));
  const pad = rows.map((r) => r.padEnd(w, '.'));
  const swapTeam = (ch: string) => (ch === 'A' ? 'Z' : ch === 'Z' ? 'A' : ch);
  switch (def.symmetry) {
    case 'mirror_x':
      return pad.map((r) => r + r.split('').reverse().map(swapTeam).join(''));
    case 'mirror_y':
      return [...pad, ...pad.slice().reverse().map((r) => r.split('').map(swapTeam).join(''))];
    case 'point':
      return [...pad, ...pad.slice().reverse().map((r) => r.split('').reverse().map(swapTeam).join(''))];
    default:
      return pad;
  }
}

export class GameMap {
  readonly w: number;
  readonly h: number;
  readonly tiles: Uint8Array;
  readonly hp: Float32Array;
  /** expiração das paredes temporárias (tempo do mundo) */
  readonly tempUntil: Float32Array;
  readonly spawns: MapSpawns;
  readonly theme: MapTheme;
  readonly id: string;
  readonly name: string;
  /** incrementa quando o mapa muda (pra renderer e navegação refazerem cache) */
  version = 0;
  readonly widthPx: number;
  readonly heightPx: number;

  constructor(def: MapDef) {
    const rows = expandGrid(def);
    this.id = def.id;
    this.name = def.name;
    this.theme = def.theme;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.widthPx = this.w * TILE;
    this.heightPx = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.hp = new Float32Array(this.w * this.h);
    this.tempUntil = new Float32Array(this.w * this.h);
    this.spawns = { teamA: [], teamB: [], free: [], props: [], heals: [], powers: [] };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = rows[y]![x] ?? '.';
        const leg = LEGEND[ch] ?? LEGEND['.']!;
        let tile = leg.tile;
        // borda sempre fechada
        if (x === 0 || y === 0 || x === this.w - 1 || y === this.h - 1) tile = T.Wall;
        const i = y * this.w + x;
        this.tiles[i] = tile;
        this.hp[i] = TILE_HP[tile] ?? 0;
        const cx = (x + 0.5) * TILE;
        const cy = (y + 0.5) * TILE;
        switch (leg.extra) {
          case 'spawnA':
            this.spawns.teamA.push({ x: cx, y: cy });
            this.spawns.free.push({ x: cx, y: cy });
            break;
          case 'spawnB':
            this.spawns.teamB.push({ x: cx, y: cy });
            this.spawns.free.push({ x: cx, y: cy });
            break;
          case 'spawn':
            this.spawns.free.push({ x: cx, y: cy });
            break;
          case 'crate':
          case 'barrel':
          case 'tire':
            this.spawns.props.push({ kind: leg.extra, x: cx, y: cy });
            break;
          case 'heal':
            this.spawns.heals.push({ x: cx, y: cy });
            break;
          case 'power':
            this.spawns.powers.push({ x: cx, y: cy });
            break;
        }
      }
    }
    if (this.spawns.free.length === 0) this.spawns.free.push({ x: this.widthPx / 2, y: this.heightPx / 2 });
  }

  idx(tx: number, ty: number): number {
    return ty * this.w + tx;
  }

  at(tx: number, ty: number): T {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.Wall;
    return this.tiles[ty * this.w + tx] as T;
  }

  atPx(x: number, y: number): T {
    return this.at(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** bloqueia andar */
  solid(t: T): boolean {
    return t === T.Wall || t === T.Brick || t === T.Glass || t === T.Water || t === T.TempWall;
  }

  /** bloqueia tiro */
  blocksShot(t: T): boolean {
    return t === T.Wall || t === T.Brick || t === T.Glass || t === T.TempWall;
  }

  destructible(t: T): boolean {
    return t === T.Brick || t === T.Glass || t === T.TempWall;
  }

  solidAt(x: number, y: number): boolean {
    return this.solid(this.atPx(x, y));
  }

  /**
   * Linha de visão (tiro) entre dois pontos — DDA na grade.
   * Devolve true se nada bloqueia.
   */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.rayHit(x0, y0, x1, y1) === null;
  }

  /** Primeira célula que bloqueia tiro no segmento (ou null). */
  rayHit(x0: number, y0: number, x1: number, y1: number): { tx: number; ty: number; x: number; y: number } | null {
    let tx = Math.floor(x0 / TILE);
    let ty = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE);
    const ey = Math.floor(y1 / TILE);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((stepX > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : Infinity;
    let tMaxY = dy !== 0 ? ((stepY > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)) : Infinity;
    let guard = 0;
    let t = 0;
    while (guard++ < 400) {
      if (this.blocksShot(this.at(tx, ty)) && guard > 1) return { tx, ty, x: x0 + dx * t, y: y0 + dy * t };
      if (tx === ex && ty === ey) return null;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        tx += stepX;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        ty += stepY;
      }
      if (t > 1) return null;
    }
    return null;
  }

  isBush(x: number, y: number): boolean {
    return this.atPx(x, y) === T.Bush;
  }

  /** Aplica dano numa célula destrutível. Devolve o tipo destruído (ou null). */
  damageTile(tx: number, ty: number, dmg: number): T | null {
    const t = this.at(tx, ty);
    if (!this.destructible(t)) return null;
    const i = this.idx(tx, ty);
    this.hp[i]! -= dmg;
    if (this.hp[i]! <= 0) {
      this.tiles[i] = T.Rubble;
      this.hp[i] = 0;
      this.version++;
      return t;
    }
    return null;
  }

  placeTemp(tx: number, ty: number, until: number): boolean {
    const t = this.at(tx, ty);
    if (t !== T.Floor && t !== T.Rubble && t !== T.Bush) return false;
    const i = this.idx(tx, ty);
    this.tiles[i] = T.TempWall;
    this.hp[i] = TILE_HP[T.TempWall]!;
    this.tempUntil[i] = until;
    this.version++;
    return true;
  }

  /** Remove paredes temporárias vencidas. */
  expireTemp(now: number): Array<{ tx: number; ty: number }> {
    const gone: Array<{ tx: number; ty: number }> = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === T.TempWall && this.tempUntil[i]! <= now) {
        this.tiles[i] = T.Floor;
        gone.push({ tx: i % this.w, ty: Math.floor(i / this.w) });
      }
    }
    if (gone.length) this.version++;
    return gone;
  }

  /** Acha um ponto andável perto de (x,y) (espiral). */
  nearestFree(x: number, y: number, r = 26): { x: number; y: number } {
    const fits = (px: number, py: number) => {
      for (const [ox, oy] of [
        [-r, -r],
        [r, -r],
        [-r, r],
        [r, r],
        [0, 0],
      ])
        if (this.solidAt(px + ox!, py + oy!)) return false;
      return true;
    };
    if (fits(x, y)) return { x, y };
    for (let ring = 1; ring < 12; ring++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const px = x + Math.cos(ang) * ring * (TILE / 2);
        const py = y + Math.sin(ang) * ring * (TILE / 2);
        if (fits(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
}
