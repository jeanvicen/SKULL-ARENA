import { alpha, lighten } from '../art/color';
import { newCanvas } from '../pixel/buffer';
import { pixEllipse, pixRing } from './pix';

/**
 * PARTÍCULAS EM PIXEL ART (pool fixo, sem lixo de memória)
 * Guardam posição em px de MUNDO; desenham em pixels de arte (quadradinhos nítidos).
 * Tipos: faísca, fumaça, destroço (com gravidade e quique), anel, brilho, texto
 * flutuante (dano), estilhaço, moeda, confete, osso, poeira, estrela.
 */

export type PKind = 'spark' | 'smoke' | 'debris' | 'ring' | 'glow' | 'text' | 'shard' | 'coin' | 'confetti' | 'bone' | 'dust' | 'star';

export interface Particle {
  kind: PKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  rot: number;
  vr: number;
  grav: number;
  drag: number;
  text: string;
  big: boolean;
  alive: boolean;
}

const MAX = 1400;
type Canvas = HTMLCanvasElement | OffscreenCanvas;

export class Particles {
  readonly list: Particle[] = [];
  private glowCache = new Map<string, Canvas>();
  private cursor = 0;
  count = 0;
  quality = 1;

  constructor() {
    for (let i = 0; i < MAX; i++)
      this.list.push({ kind: 'spark', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', rot: 0, vr: 0, grav: 0, drag: 0, text: '', big: false, alive: false });
  }

  spawn(p: Partial<Particle> & { kind: PKind; x: number; y: number }): Particle | null {
    if (this.quality < 1 && p.kind !== 'text' && Math.random() > this.quality) return null;
    for (let i = 0; i < MAX; i++) {
      const q = this.list[(this.cursor + i) % MAX]!;
      if (q.alive) continue;
      this.cursor = (this.cursor + i + 1) % MAX;
      q.kind = p.kind;
      q.x = p.x;
      q.y = p.y;
      q.z = p.z ?? 0;
      q.vx = p.vx ?? 0;
      q.vy = p.vy ?? 0;
      q.vz = p.vz ?? 0;
      q.life = q.max = p.max ?? p.life ?? 0.6;
      q.size = p.size ?? 4;
      q.grow = p.grow ?? 0;
      q.color = p.color ?? '#ffffff';
      q.rot = p.rot ?? Math.random() * Math.PI * 2;
      q.vr = p.vr ?? 0;
      q.grav = p.grav ?? 0;
      q.drag = p.drag ?? 0;
      q.text = p.text ?? '';
      q.big = p.big ?? false;
      q.alive = true;
      return q;
    }
    return null;
  }

  burst(x: number, y: number, n: number, color: string, speed = 260, kind: PKind = 'spark', o: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, max: 0.25 + Math.random() * 0.35, size: 2 + Math.random() * 3, color, drag: 3, ...o });
    }
  }

  update(dt: number): void {
    let c = 0;
    for (const p of this.list) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      c++;
      if (p.drag) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      if (p.grav) {
        p.vz -= p.grav * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          if (p.vz < -80) {
            p.vz = -p.vz * 0.42;
            p.vx *= 0.6;
            p.vy *= 0.6;
            p.vr *= 0.6;
          } else {
            p.vz = 0;
            p.vx *= 0.85;
            p.vy *= 0.85;
          }
        }
      }
    }
    this.count = c;
  }

  /** brilho "pixelado" (gradiente desenhado em baixa resolução) */
  glow(color: string, r = 12): Canvas {
    const key = `${color}|${r}`;
    let g = this.glowCache.get(key);
    if (!g) {
      g = newCanvas(r * 2, r * 2);
      const x = g.getContext('2d') as CanvasRenderingContext2D;
      for (let i = r; i > 0; i -= 1) {
        const t = i / r;
        x.globalAlpha = 0.16 * (1 - t) + 0.02;
        pixEllipse(x, r, r, i, i, i < r * 0.35 ? lighten(color, 0.5) : color);
      }
      this.glowCache.set(key, g);
    }
    return g;
  }

  /**
   * Desenha no buffer de pixels. `ox, oy` = deslocamento (px de arte) e o mundo é
   * dividido por 2 (1 pixel de arte = 2 px de mundo).
   */
  draw(g: CanvasRenderingContext2D, ox: number, oy: number, layer: 'ground' | 'air'): void {
    for (const p of this.list) {
      if (!p.alive || p.kind === 'text') continue;
      const ground = p.kind === 'dust' || p.kind === 'ring' || (p.kind === 'smoke' && p.z <= 0 && !p.big);
      if ((layer === 'ground') !== ground) continue;
      const t = p.life / p.max;
      const x = Math.round(p.x / 2 + ox);
      const y = Math.round((p.y - p.z) / 2 + oy);
      const s = Math.max(1, Math.round(p.size / 2));
      switch (p.kind) {
        case 'spark':
        case 'star': {
          g.fillStyle = t > 0.5 ? lighten(p.color, 0.35) : p.color;
          g.fillRect(x, y, s, s);
          if (p.kind === 'star' && t > 0.4) {
            g.fillRect(x - 1, y + (s >> 1), s + 2, 1);
            g.fillRect(x + (s >> 1), y - 1, 1, s + 2);
          } else {
            const tx = Math.round(x - (p.vx / 2) * 0.03);
            const ty = Math.round(y - (p.vy / 2) * 0.03);
            g.globalAlpha = 0.6;
            g.fillRect(Math.min(x, tx), Math.min(y, ty), Math.abs(x - tx) + 1, Math.abs(y - ty) + 1);
            g.globalAlpha = 1;
          }
          break;
        }
        case 'glow': {
          const r = Math.max(2, Math.round(p.size / 2));
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.min(1, t * 1.6);
          const img = this.glow(p.color, Math.min(48, r));
          g.drawImage(img as CanvasImageSource, x - r, y - r, r * 2, r * 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smoke':
        case 'dust': {
          g.globalAlpha = t * (p.kind === 'dust' ? 0.45 : 0.55);
          pixEllipse(g, x, y, s, s * (p.kind === 'dust' ? 0.6 : 1), p.color);
          g.globalAlpha = 1;
          break;
        }
        case 'ring': {
          g.globalAlpha = Math.min(1, t * 1.4);
          pixRing(g, x, y, s, Math.max(1, s * 0.7), t > 0.5 ? 2 : 1, p.color);
          g.globalAlpha = 1;
          break;
        }
        case 'debris':
        case 'shard':
        case 'bone':
        case 'confetti':
        case 'coin': {
          g.globalAlpha = Math.min(1, t * 3);
          if (p.z > 0) {
            g.fillStyle = 'rgba(8,4,18,0.35)';
            g.fillRect(x - 1, Math.round(p.y / 2 + oy), s + 1, 1);
          }
          const flip = Math.abs(Math.cos(p.rot)) > 0.5;
          g.fillStyle = '#160d22';
          if (p.kind === 'bone') {
            const w = flip ? 5 : 2;
            const h = flip ? 2 : 5;
            g.fillRect(x - 1, y - 1, w + 2, h + 2);
            g.fillStyle = p.color;
            g.fillRect(x, y, w, h);
          } else if (p.kind === 'confetti') {
            g.fillStyle = p.color;
            g.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2);
          } else if (p.kind === 'coin') {
            g.fillRect(x - 1, y - 1, (flip ? 3 : 1) + 2, 5);
            g.fillStyle = p.color;
            g.fillRect(x, y, flip ? 3 : 1, 3);
          } else {
            g.fillRect(x - 1, y - 1, s + 2, s + 2);
            g.fillStyle = p.color;
            g.fillRect(x, y, s, s);
            if (s > 1) {
              g.fillStyle = alpha('#000000', 0.3);
              g.fillRect(x, y + s - 1, s, 1);
            }
          }
          g.globalAlpha = 1;
          break;
        }
      }
    }
  }
}
