import type { Rect } from './collision';

/**
 * Grade de navegação para os bots (A* em células de `cell` unidades).
 * Construída uma vez por mapa a partir dos obstáculos que bloqueiam movimento.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly from: Int32Array;
  private readonly closed: Uint8Array;
  private readonly open: number[] = [];

  constructor(readonly w: number, readonly h: number, readonly cell: number, obstacles: Rect[], agentRadius: number) {
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.closed = new Uint8Array(n);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell;
        for (const o of obstacles) {
          if (cx > o.x - agentRadius && cx < o.x + o.w + agentRadius && cy > o.y - agentRadius && cy < o.y + o.h + agentRadius) {
            this.blocked[r * this.cols + c] = 1;
            break;
          }
        }
        if (cx < agentRadius || cy < agentRadius || cx > w - agentRadius || cy > h - agentRadius) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  idx(x: number, y: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    return r * this.cols + c;
  }

  center(i: number): { x: number; y: number } {
    return { x: ((i % this.cols) + 0.5) * this.cell, y: (Math.floor(i / this.cols) + 0.5) * this.cell };
  }

  isBlockedAt(x: number, y: number): boolean {
    return this.blocked[this.idx(x, y)] === 1;
  }

  /** Célula livre mais próxima (busca em anel). */
  nearestFree(i: number): number {
    if (!this.blocked[i]) return i;
    const c0 = i % this.cols, r0 = Math.floor(i / this.cols);
    for (let rad = 1; rad < Math.max(this.cols, this.rows); rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
          const j = r * this.cols + c;
          if (!this.blocked[j]) return j;
        }
      }
    }
    return i;
  }

  /** A* com 8 direções (sem cortar quinas). Retorna lista de pontos (centros de células) ou null. */
  findPath(sx: number, sy: number, tx: number, ty: number, maxIter = 2500): Array<{ x: number; y: number }> | null {
    const start = this.nearestFree(this.idx(sx, sy));
    const goal = this.nearestFree(this.idx(tx, ty));
    if (start === goal) return [{ x: tx, y: ty }];
    const { cols, g, f, from, closed, open, blocked } = this;
    g.fill(Infinity);
    closed.fill(0);
    open.length = 0;
    const gc = goal % cols, gr = Math.floor(goal / cols);
    const heur = (i: number) => {
      const dc = Math.abs((i % cols) - gc), dr = Math.abs(Math.floor(i / cols) - gr);
      return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr);
    };
    g[start] = 0;
    f[start] = heur(start);
    from[start] = -1;
    open.push(start);
    let iter = 0;
    while (open.length && iter++ < maxIter) {
      // menor f (lista pequena — linear é suficiente para grades ~600-1500 células)
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % cols, cr = Math.floor(cur / cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
          const ni = nr * cols + nc;
          if (blocked[ni] || closed[ni]) continue;
          if (dr && dc && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
          const ng = g[cur] + (dr && dc ? Math.SQRT2 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            f[ni] = ng + heur(ni);
            from[ni] = cur;
            open.push(ni);
          }
        }
      }
    }
    if (g[goal] === Infinity) return null;
    const path: Array<{ x: number; y: number }> = [];
    let cur = goal;
    while (cur !== -1 && cur !== start) {
      path.push(this.center(cur));
      cur = from[cur];
    }
    path.reverse();
    if (path.length) path[path.length - 1] = { x: tx, y: ty };
    return path;
  }
}
