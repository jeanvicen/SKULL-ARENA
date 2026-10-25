import { Pool } from '../engine/pool';

/**
 * Partículas com object pooling. Puramente visuais (usam Math.random à vontade —
 * não fazem parte da simulação determinística).
 */
export type ParticleKind = 'dot' | 'spark' | 'smoke' | 'ring' | 'shard' | 'bone' | 'star' | 'glow' | 'streak' | 'slash' | 'soul';

export class Particle {
  kind: ParticleKind = 'dot';
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  life = 0;
  max = 1;
  size = 4;
  size2 = 0;
  color = '#fff';
  color2 = '#fff';
  rot = 0;
  vr = 0;
  drag = 0;
  gravity = 0;
  additive = false;
  /** Para 'slash'/'streak': ângulo e abertura. */
  angle = 0;
  arc = 0;
}

export interface EmitOpts {
  kind?: ParticleKind;
  x: number;
  y: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life?: number;
  size?: number;
  size2?: number;
  color?: string;
  color2?: string;
  rot?: number;
  vr?: number;
  drag?: number;
  gravity?: number;
  additive?: boolean;
  angle?: number;
  arc?: number;
}

/** Cache de sprites de brilho por cor: evita criar um gradiente por partícula por frame (Android fraco agradece). */
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let cv = glowCache.get(color);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    glowCache.set(color, cv);
  }
  return cv;
}

export class ParticleSystem {
  readonly pool = new Pool<Particle>(() => new Particle(), 512);
  max = 900;

  emit(o: EmitOpts): void {
    if (this.pool.count >= this.max) return;
    const p = this.pool.acquire();
    p.kind = o.kind ?? 'dot';
    p.x = o.x;
    p.y = o.y;
    p.z = o.z ?? 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.life = p.max = o.life ?? 0.5;
    p.size = o.size ?? 4;
    p.size2 = o.size2 ?? 0;
    p.color = o.color ?? '#fff';
    p.color2 = o.color2 ?? p.color;
    p.rot = o.rot ?? Math.random() * 6.28;
    p.vr = o.vr ?? 0;
    p.drag = o.drag ?? 2;
    p.gravity = o.gravity ?? 0;
    p.additive = o.additive ?? false;
    p.angle = o.angle ?? 0;
    p.arc = o.arc ?? 0;
  }

  burst(n: number, base: EmitOpts, speed: number, spreadAngle = Math.PI * 2, dir = 0): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spreadAngle;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit({ ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (base.life ?? 0.5) * (0.6 + Math.random() * 0.7) });
    }
  }

  update(dt: number): void {
    const pool = this.pool;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        pool.releaseAt(i);
        i--;
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) {
        p.vz -= p.gravity * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
      p.rot += p.vr * dt;
    }
  }

  draw(c: CanvasRenderingContext2D, additivePass: boolean): void {
    const pool = this.pool;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i];
      if (p.additive !== additivePass) continue;
      const t = p.life / p.max; // 1 → 0
      const y = p.y - p.z;
      switch (p.kind) {
        case 'dot': {
          c.globalAlpha = Math.min(1, t * 1.6);
          c.fillStyle = p.color;
          const r = p.size * (0.4 + t * 0.6);
          c.beginPath();
          c.arc(p.x, y, r, 0, Math.PI * 2);
          c.fill();
          break;
        }
        case 'glow': {
          c.globalAlpha = t * 0.9;
          const r = p.size * (1.2 - t * 0.2);
          c.drawImage(glowSprite(p.color), p.x - r, y - r, r * 2, r * 2);
          break;
        }
        case 'spark': {
          c.globalAlpha = Math.min(1, t * 2);
          c.strokeStyle = p.color;
          c.lineWidth = p.size * 0.5 * t + 0.6;
          const sp = Math.hypot(p.vx, p.vy) * 0.04 + 2;
          const a = Math.atan2(p.vy, p.vx);
          c.beginPath();
          c.moveTo(p.x, y);
          c.lineTo(p.x - Math.cos(a) * sp, y - Math.sin(a) * sp);
          c.stroke();
          break;
        }
        case 'smoke': {
          c.globalAlpha = t * 0.45;
          c.fillStyle = p.color;
          const r = p.size * (1.6 - t * 0.6);
          c.beginPath();
          c.arc(p.x, y, r, 0, Math.PI * 2);
          c.fill();
          break;
        }
        case 'ring': {
          // size → size2 (raio inicial/final), arc = espessura
          const k = 1 - t;
          const e = 1 - (1 - k) * (1 - k);
          c.globalAlpha = t;
          c.strokeStyle = p.color;
          c.lineWidth = Math.max(0.8, (p.arc || 4) * t);
          c.beginPath();
          c.arc(p.x, y, Math.max(0.1, p.size + (p.size2 - p.size) * e), 0, Math.PI * 2);
          c.stroke();
          break;
        }
        case 'shard':
        case 'bone': {
          c.globalAlpha = Math.min(1, t * 2.5);
          c.save();
          c.translate(p.x, y);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          if (p.kind === 'bone') {
            c.fillRect(-p.size, -p.size * 0.22, p.size * 2, p.size * 0.44);
            c.beginPath();
            c.arc(-p.size, 0, p.size * 0.32, 0, Math.PI * 2);
            c.arc(p.size, 0, p.size * 0.32, 0, Math.PI * 2);
            c.fill();
          } else {
            c.beginPath();
            c.moveTo(p.size, 0);
            c.lineTo(-p.size * 0.6, -p.size * 0.5);
            c.lineTo(-p.size * 0.4, p.size * 0.5);
            c.closePath();
            c.fill();
          }
          c.restore();
          break;
        }
        case 'star': {
          c.globalAlpha = Math.min(1, t * 2);
          c.fillStyle = p.color;
          c.save();
          c.translate(p.x, y);
          c.rotate(p.rot);
          const r = p.size * (0.5 + t * 0.5);
          c.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            const rr = k % 2 ? r * 0.35 : r;
            c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          c.closePath();
          c.fill();
          c.restore();
          break;
        }
        case 'streak': {
          c.globalAlpha = t * 0.8;
          c.strokeStyle = p.color;
          c.lineWidth = p.size * t;
          c.beginPath();
          c.moveTo(p.x, y);
          c.lineTo(p.x + Math.cos(p.angle) * p.size2, y + Math.sin(p.angle) * p.size2);
          c.stroke();
          break;
        }
        case 'slash': {
          // arco de golpe melee
          const k = 1 - t;
          c.globalAlpha = Math.min(1, t * 2.2);
          c.strokeStyle = p.color;
          c.lineWidth = p.size2 * (0.4 + t * 0.6);
          c.beginPath();
          const r = p.size * (0.75 + k * 0.3);
          const a0 = p.angle - p.arc / 2, a1 = p.angle - p.arc / 2 + p.arc * Math.min(1, k * 3.2);
          c.arc(p.x, y, r, a0, a1);
          c.stroke();
          c.strokeStyle = p.color2;
          c.lineWidth = p.size2 * 0.3 * t;
          c.stroke();
          break;
        }
        case 'soul': {
          c.globalAlpha = Math.min(1, t * 2);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, y, p.size * t, 0, Math.PI * 2);
          c.fill();
          break;
        }
      }
    }
    c.globalAlpha = 1;
  }
}

/** Números de dano / textos flutuantes. */
export class Floater {
  x = 0;
  y = 0;
  vy = 0;
  life = 0;
  max = 1;
  text = '';
  color = '#fff';
  size = 18;
  stroke = '#000';
}

export class FloaterSystem {
  readonly pool = new Pool<Floater>(() => new Floater(), 64);

  add(x: number, y: number, text: string, color: string, size: number, stroke = '#1a0f24'): void {
    if (this.pool.count > 80) return;
    const f = this.pool.acquire();
    f.x = x + (Math.random() - 0.5) * 18;
    f.y = y;
    f.vy = -70;
    f.life = f.max = 0.9;
    f.text = text;
    f.color = color;
    f.size = size;
    f.stroke = stroke;
  }

  update(dt: number): void {
    const pool = this.pool;
    for (let i = 0; i < pool.count; i++) {
      const f = pool.items[i];
      f.life -= dt;
      if (f.life <= 0) {
        pool.releaseAt(i);
        i--;
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= Math.exp(-3 * dt);
    }
  }

  draw(c: CanvasRenderingContext2D, font: string): void {
    const pool = this.pool;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (let i = 0; i < pool.count; i++) {
      const f = pool.items[i];
      const age = f.max - f.life;
      // "pop" com overshoot e depois some
      const pop = age < 0.12 ? 0.6 + (age / 0.12) * 0.7 : age < 0.22 ? 1.3 - ((age - 0.12) / 0.1) * 0.3 : 1;
      c.globalAlpha = Math.min(1, f.life / 0.3);
      c.font = `${Math.round(f.size * pop)}px ${font}`;
      c.lineWidth = 4;
      c.strokeStyle = f.stroke;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }
}
