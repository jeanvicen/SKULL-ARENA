import { GameMap, T, TILE } from './map';

/**
 * NAVEGAÇÃO (A* em 8 direções) — usada pelos bots pra contornar paredes.
 * Reconstrói o custo quando o mapa muda (parede destruída / parede temporária).
 */
export class NavGrid {
  private cost: Float32Array;
  private version = -1;
  private readonly w: number;
  private readonly h: number;
  // buffers reaproveitados
  private g: Float32Array;
  private came: Int32Array;
  private closed: Uint8Array;
  private stamp: Uint32Array;
  private run = 1;

  constructor(private readonly map: GameMap) {
    this.w = map.w;
    this.h = map.h;
    const n = this.w * this.h;
    this.cost = new Float32Array(n);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.stamp = new Uint32Array(n);
    this.refresh();
  }

  refresh(): void {
    if (this.version === this.map.version) return;
    this.version = this.map.version;
    for (let i = 0; i < this.cost.length; i++) {
      const t = this.map.tiles[i] as T;
      this.cost[i] = this.map.solid(t) ? Infinity : t === T.Hazard ? 8 : t === T.Bush ? 1.15 : 1;
    }
  }

  walkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    return this.cost[ty * this.w + tx]! < Infinity;
  }

  /** Caminho em pixels (centros das células) de (sx,sy) até (gx,gy). */
  path(sx: number, sy: number, gx: number, gy: number, maxNodes = 2500): Array<{ x: number; y: number }> | null {
    this.refresh();
    const w = this.w;
    let s = this.clampCell(Math.floor(sx / TILE), Math.floor(sy / TILE));
    let goal = this.clampCell(Math.floor(gx / TILE), Math.floor(gy / TILE));
    if (!this.walkable(s % w, (s / w) | 0)) s = this.nearestWalkable(s);
    if (!this.walkable(goal % w, (goal / w) | 0)) goal = this.nearestWalkable(goal);
    if (s < 0 || goal < 0) return null;
    if (s === goal) return [{ x: gx, y: gy }];
    this.run++;
    const run = this.run;
    const heap = new MinHeap();
    const gxC = goal % w;
    const gyC = (goal / w) | 0;
    const hfn = (i: number) => {
      const dx = Math.abs((i % w) - gxC);
      const dy = Math.abs(((i / w) | 0) - gyC);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    this.stamp[s] = run;
    this.g[s] = 0;
    this.came[s] = -1;
    this.closed[s] = 0;
    heap.push(s, hfn(s));
    let expanded = 0;
    let best = s;
    let bestH = hfn(s);
    while (heap.size > 0) {
      const cur = heap.pop();
      if (this.stamp[cur] === run && this.closed[cur]) continue;
      this.closed[cur] = 1;
      if (cur === goal) {
        best = cur;
        break;
      }
      const hc = hfn(cur);
      if (hc < bestH) {
        bestH = hc;
        best = cur;
      }
      if (++expanded > maxNodes) break;
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!this.walkable(nx, ny)) continue;
          // não corta quina
          if (dx !== 0 && dy !== 0 && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
          const ni = ny * w + nx;
          const step = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * this.cost[ni]!;
          const ng = this.g[cur]! + step;
          if (this.stamp[ni] !== run) {
            this.stamp[ni] = run;
            this.closed[ni] = 0;
            this.g[ni] = Infinity;
          }
          if (this.closed[ni]) continue;
          if (ng < this.g[ni]!) {
            this.g[ni] = ng;
            this.came[ni] = cur;
            heap.push(ni, ng + hfn(ni));
          }
        }
      }
    }
    // reconstrói
    const cells: number[] = [];
    let c = best;
    let guard = 0;
    while (c >= 0 && guard++ < 4000) {
      cells.push(c);
      c = this.came[c]!;
    }
    cells.reverse();
    const pts = cells.map((i) => ({ x: ((i % w) + 0.5) * TILE, y: (((i / w) | 0) + 0.5) * TILE }));
    if (best === goal && pts.length) pts[pts.length - 1] = { x: gx, y: gy };
    return this.smooth(pts);
  }

  /** Remove pontos intermediários quando dá pra andar reto (caminho mais natural). */
  private smooth(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (pts.length <= 2) return pts;
    const out = [pts[0]!];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.clearLine(pts[i]!, pts[j]!)) j--;
      out.push(pts[j]!);
      i = j;
    }
    return out;
  }

  clearLine(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.ceil(d / (TILE / 3));
    for (let k = 1; k < n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const y = a.y + ((b.y - a.y) * k) / n;
      // margem do raio do lutador
      for (const [ox, oy] of [
        [0, 0],
        [20, 20],
        [-20, 20],
        [20, -20],
        [-20, -20],
      ])
        if (!this.walkable(Math.floor((x + ox!) / TILE), Math.floor((y + oy!) / TILE))) return false;
    }
    return true;
  }

  private clampCell(tx: number, ty: number): number {
    tx = Math.max(0, Math.min(this.w - 1, tx));
    ty = Math.max(0, Math.min(this.h - 1, ty));
    return ty * this.w + tx;
  }

  private nearestWalkable(i: number): number {
    const w = this.w;
    const cx = i % w;
    const cy = (i / w) | 0;
    for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.walkable(cx + dx, cy + dy)) return (cy + dy) * w + cx + dx;
    return -1;
  }
}

class MinHeap {
  private items: number[] = [];
  private pri: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    const it = this.items;
    const pr = this.pri;
    it.push(item);
    pr.push(p);
    let i = it.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (pr[par]! <= pr[i]!) break;
      [it[par], it[i]] = [it[i]!, it[par]!];
      [pr[par], pr[i]] = [pr[i]!, pr[par]!];
      i = par;
    }
  }
  pop(): number {
    const it = this.items;
    const pr = this.pri;
    const top = it[0]!;
    const li = it.pop()!;
    const lp = pr.pop()!;
    if (it.length) {
      it[0] = li;
      pr[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < it.length && pr[l]! < pr[m]!) m = l;
        if (r < it.length && pr[r]! < pr[m]!) m = r;
        if (m === i) break;
        [it[m], it[i]] = [it[i]!, it[m]!];
        [pr[m], pr[i]] = [pr[i]!, pr[m]!];
        i = m;
      }
    }
    return top;
  }
}
