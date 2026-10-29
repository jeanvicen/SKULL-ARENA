import { alpha, lighten } from '../art/color';
import { makeCanvas } from '../art/sprite';

/**
 * PARTÍCULAS (pool fixo, sem lixo de memória)
 * Tipos: faísca, fumaça, destroço (com gravidade e quique), anel, brilho, texto
 * flutuante (dano), estilhaço, moeda, confete, osso.
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
  count = 0;
  /** qualidade (0.5 em aparelho fraco) */
  quality = 1;

  constructor() {
    for (let i = 0; i < MAX; i++)
      this.list.push({ kind: 'spark', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', rot: 0, vr: 0, grav: 0, drag: 0, text: '', big: false, alive: false });
  }

  spawn(p: Partial<Particle> & { kind: PKind; x: number; y: number }): Particle | null {
    if (this.quality < 1 && p.kind !== 'text' && Math.random() > this.quality) return null;
    for (let i = 0; i < MAX; i++) {
      const q = this.list[(this.cursor + i) % MAX]!;
      if (!q.alive) {
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
    }
    return null;
  }

  private cursor = 0;

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

  glow(color: string): Canvas {
    let g = this.glowCache.get(color);
    if (!g) {
      g = makeCanvas(64, 64);
      const x = g.getContext('2d') as CanvasRenderingContext2D;
      const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, alpha(lighten(color, 0.4), 0.95));
      grd.addColorStop(0.35, alpha(color, 0.55));
      grd.addColorStop(1, alpha(color, 0));
      x.fillStyle = grd;
      x.fillRect(0, 0, 64, 64);
      this.glowCache.set(color, g);
    }
    return g;
  }

  /** Desenha as partículas no espaço do mundo (ctx já com transformação de câmera). */
  draw(ctx: CanvasRenderingContext2D, layer: 'ground' | 'air'): void {
    for (const p of this.list) {
      if (!p.alive) continue;
      const ground = p.kind === 'dust' || p.kind === 'ring' || (p.kind === 'smoke' && p.z <= 0 && !p.big);
      if ((layer === 'ground') !== ground) continue;
      const t = p.life / p.max;
      const y = p.y - p.z;
      switch (p.kind) {
        case 'spark':
        case 'star': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.lineWidth = p.size * 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, y);
          ctx.lineTo(p.x - p.vx * 0.03, y - p.vy * 0.03);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'glow': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, t * 1.5);
          const s = p.size;
          ctx.drawImage(this.glow(p.color) as CanvasImageSource, p.x - s, y - s, s * 2, s * 2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smoke':
        case 'dust': {
          ctx.globalAlpha = t * (p.kind === 'dust' ? 0.35 : 0.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 + 6 * t;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.72, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'debris':
        case 'shard':
        case 'bone':
        case 'confetti':
        case 'coin': {
          ctx.globalAlpha = Math.min(1, t * 3);
          if (p.z > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.save();
          ctx.translate(p.x, y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.kind === 'shard') {
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size * 0.5, p.size);
            ctx.lineTo(-p.size * 0.5, p.size * 0.6);
            ctx.fill();
          } else if (p.kind === 'bone') {
            ctx.fillRect(-p.size, -p.size * 0.22, p.size * 2, p.size * 0.44);
            for (const sx of [-p.size, p.size]) {
              ctx.beginPath();
              ctx.arc(sx, -p.size * 0.25, p.size * 0.3, 0, Math.PI * 2);
              ctx.arc(sx, p.size * 0.25, p.size * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (p.kind === 'coin') {
            ctx.scale(Math.abs(Math.cos(p.rot * 2)) + 0.15, 1);
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.kind === 'confetti' ? 0.5 : 1));
            if (p.kind === 'debris') {
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              ctx.fillRect(-p.size / 2, 0, p.size, p.size / 2);
            }
          }
          ctx.restore();
          break;
        }
        case 'text': {
          const rise = (1 - t) * 34;
          ctx.globalAlpha = Math.min(1, t * 2.5);
          const sc = p.big ? 1.25 : 1;
          const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
          ctx.font = `900 ${Math.round(p.size * sc * pop)}px "Lilita One", Impact, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(10,4,20,0.9)';
          ctx.strokeText(p.text, p.x, y - rise);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, y - rise);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
