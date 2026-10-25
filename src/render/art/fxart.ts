import type { PetDef, ProjectileDef } from '../../content/types';
import { darken, lighten, rgba } from './color';
import { drawMiniSkull } from './map';

/**
 * Sprites de projéteis (assados por definição, com brilho embutido) e
 * desenho dos pets (animados a cada frame — são poucos e pequenos).
 */
export interface ProjSprite {
  canvas: HTMLCanvasElement;
  /** Meio-tamanho em unidades (o sprite é centrado no projétil, apontando para +x). */
  hw: number;
  hh: number;
}

const projCache = new Map<string, ProjSprite>();

export function projectileSprite(def: ProjectileDef, res: number): ProjSprite {
  const key = `${def.id}@${res.toFixed(2)}`;
  const hit = projCache.get(key);
  if (hit) return hit;
  const s = (def.vfx.scale ?? 1) * Math.max(def.radius, 7);
  const hw = s * 2.6 + 8, hh = s * 1.8 + 8;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(hw * 2 * res);
  canvas.height = Math.ceil(hh * 2 * res);
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  c.translate(hw, hh);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const col = def.vfx.color, col2 = def.vfx.color2 ?? '#ffffff';
  c.shadowColor = col;
  c.shadowBlur = 10;
  switch (def.vfx.shape) {
    case 'bone': {
      c.fillStyle = lighten(col, 0.2);
      c.strokeStyle = darken(col2, 0.5);
      c.lineWidth = 1.6;
      c.beginPath();
      c.roundRect(-s * 1.4, -s * 0.32, s * 2.8, s * 0.64, s * 0.3);
      c.fill();
      c.stroke();
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.arc(sx * s * 1.45, -s * 0.38, s * 0.42, 0, Math.PI * 2);
        c.arc(sx * s * 1.45, s * 0.38, s * 0.42, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      break;
    }
    case 'dagger': {
      c.beginPath();
      c.moveTo(s * 1.8, 0);
      c.lineTo(-s * 0.4, -s * 0.5);
      c.lineTo(-s * 0.4, s * 0.5);
      c.closePath();
      c.fillStyle = lighten(col, 0.4);
      c.fill();
      c.strokeStyle = col2;
      c.lineWidth = 1.2;
      c.stroke();
      c.fillStyle = col2;
      c.fillRect(-s * 1.2, -s * 0.22, s * 0.8, s * 0.44);
      break;
    }
    case 'arrow': {
      c.strokeStyle = lighten(col, 0.3);
      c.lineWidth = s * 0.35;
      c.beginPath();
      c.moveTo(-s * 2, 0);
      c.lineTo(s * 1.2, 0);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(s * 2, 0);
      c.lineTo(s * 0.9, -s * 0.6);
      c.lineTo(s * 0.9, s * 0.6);
      c.closePath();
      c.fill();
      c.fillStyle = col2;
      c.beginPath();
      c.moveTo(-s * 2, 0);
      c.lineTo(-s * 2.4, -s * 0.6);
      c.lineTo(-s * 1.4, 0);
      c.lineTo(-s * 2.4, s * 0.6);
      c.closePath();
      c.fill();
      break;
    }
    case 'skull': {
      c.rotate(Math.PI / 2);
      drawMiniSkull(c, 0, 0, s * 0.95, lighten(col, 0.1));
      c.shadowBlur = 0;
      c.fillStyle = col2;
      c.beginPath();
      c.arc(-s * 0.36, -s * 0.1, s * 0.16, 0, Math.PI * 2);
      c.arc(s * 0.36, -s * 0.1, s * 0.16, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'flame': {
      const g = c.createRadialGradient(s * 0.5, 0, 1, 0, 0, s * 1.8);
      g.addColorStop(0, '#fff7d6');
      g.addColorStop(0.4, col);
      g.addColorStop(1, rgba(col2, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(s * 1.4, 0);
      c.quadraticCurveTo(0, -s * 1.2, -s * 2, 0);
      c.quadraticCurveTo(0, s * 1.2, s * 1.4, 0);
      c.fill();
      break;
    }
    case 'wave': {
      c.strokeStyle = col;
      c.lineWidth = s * 0.55;
      c.beginPath();
      c.arc(-s * 0.6, 0, s * 1.4, -1.1, 1.1);
      c.stroke();
      c.strokeStyle = lighten(col2, 0.4);
      c.lineWidth = s * 0.22;
      c.stroke();
      break;
    }
    case 'shard': {
      c.beginPath();
      c.moveTo(s * 1.8, 0);
      c.lineTo(0, -s * 0.55);
      c.lineTo(-s * 1.2, 0);
      c.lineTo(0, s * 0.55);
      c.closePath();
      const g = c.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, col);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = col2;
      c.lineWidth = 1.2;
      c.stroke();
      break;
    }
    case 'note': {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(-s * 0.4, s * 0.45, s * 0.65, s * 0.48, -0.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = s * 0.25;
      c.beginPath();
      c.moveTo(s * 0.2, s * 0.35);
      c.lineTo(s * 0.2, -s * 1.2);
      c.quadraticCurveTo(s * 1.1, -s * 0.9, s * 0.9, -s * 0.2);
      c.stroke();
      c.shadowColor = col2;
      c.fillStyle = col2;
      c.beginPath();
      c.arc(-s * 0.55, s * 0.3, s * 0.18, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'bolt': {
      const g = c.createLinearGradient(-s * 2, 0, s * 1.4, 0);
      g.addColorStop(0, rgba(col2, 0));
      g.addColorStop(0.5, col);
      g.addColorStop(1, '#ffffff');
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(-s * 2.2, -s * 0.42, s * 3.6, s * 0.84, s * 0.42);
      c.fill();
      break;
    }
    case 'scythe': {
      c.strokeStyle = col;
      c.lineWidth = s * 0.5;
      c.beginPath();
      c.arc(0, 0, s * 1.2, -2.2, 0.6);
      c.stroke();
      break;
    }
    case 'bubble': {
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, s, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = rgba(col, 0.25);
      c.fill();
      break;
    }
    case 'orb':
    default: {
      const g = c.createRadialGradient(-s * 0.25, -s * 0.25, 1, 0, 0, s * 1.15);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, lighten(col, 0.3));
      g.addColorStop(0.8, col);
      g.addColorStop(1, darken(col2, 0.1));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, s, 0, Math.PI * 2);
      c.fill();
    }
  }
  const sp = { canvas, hw, hh };
  projCache.set(key, sp);
  return sp;
}

/** Pet desenhado ao vivo (asas batendo etc). */
export function drawPet(c: CanvasRenderingContext2D, pet: PetDef, x: number, y: number, t: number, pulse: number, flip: boolean): void {
  const L = pet.look;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  // sombra
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath();
  c.ellipse(0, 26, 9, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  if (pulse > 0) {
    c.globalAlpha = pulse * 0.6;
    c.fillStyle = L.color2;
    c.beginPath();
    c.arc(0, 0, 16 + (1 - pulse) * 16, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
  const ol = darken(L.color2, 0.6);
  c.lineJoin = 'round';
  c.lineWidth = 1.6;
  c.strokeStyle = ol;
  switch (L.kind) {
    case 'bat': {
      const flap = Math.sin(t * 18) * 0.6;
      for (const s of [-1, 1]) {
        c.save();
        c.scale(s, 1);
        c.rotate(flap * 0.6);
        c.beginPath();
        c.moveTo(3, -2);
        c.quadraticCurveTo(12, -12, 20, -6);
        c.quadraticCurveTo(16, -3, 17, 2);
        c.quadraticCurveTo(12, -1, 10, 3);
        c.quadraticCurveTo(7, 0, 3, 3);
        c.closePath();
        c.fillStyle = L.color2;
        c.fill();
        c.stroke();
        c.restore();
      }
      c.beginPath();
      c.ellipse(0, 0, 6.5, 6, 0, 0, Math.PI * 2);
      c.fillStyle = L.color;
      c.fill();
      c.stroke();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 3, -4);
        c.lineTo(s * 5, -10);
        c.lineTo(s * 6, -3);
        c.fillStyle = L.color;
        c.fill();
      }
      eyes(c, L.eyeColor, 2.4, -0.5, 1.3);
      break;
    }
    case 'skull': {
      const bob = Math.sin(t * 4) * 1.5;
      c.translate(0, bob);
      c.save();
      c.shadowColor = L.color2;
      c.shadowBlur = 12;
      c.beginPath();
      c.ellipse(0, 0, 9, 8.5, 0, 0, Math.PI * 2);
      c.fillStyle = L.color;
      c.fill();
      c.restore();
      c.stroke();
      c.fillStyle = L.color;
      c.fillRect(-5, 6, 10, 4);
      c.strokeRect(-5, 6, 10, 4);
      c.fillStyle = '#1a0f24';
      c.beginPath();
      c.ellipse(-3.4, 0, 2.6, 3, 0, 0, Math.PI * 2);
      c.ellipse(3.4, 0, 2.6, 3, 0, 0, Math.PI * 2);
      c.fill();
      eyes(c, L.eyeColor, 3.4, 0.4, 1.2);
      // chamas em volta
      c.globalAlpha = 0.7;
      c.fillStyle = L.color2;
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 2.1;
        c.beginPath();
        c.arc(Math.cos(a) * 12, Math.sin(a) * 6 - 2, 1.6, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'ghost': {
      const wob = Math.sin(t * 5);
      c.globalAlpha = 0.92;
      c.beginPath();
      c.moveTo(-9, 8);
      c.quadraticCurveTo(-11, -12, 0, -12);
      c.quadraticCurveTo(11, -12, 9, 8);
      for (let i = 0; i < 4; i++) {
        const x0 = 9 - i * 6;
        c.quadraticCurveTo(x0 - 1.5, 12 + wob * (i % 2 ? 2 : -2), x0 - 4.5, 8);
      }
      c.closePath();
      const g = c.createLinearGradient(0, -12, 0, 10);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, L.color2);
      c.fillStyle = g;
      c.fill();
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = L.eyeColor;
      c.beginPath();
      c.ellipse(-3.2, -3, 1.8, 2.6, 0, 0, Math.PI * 2);
      c.ellipse(3.2, -3, 1.8, 2.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = rgba('#ff7ab6', 0.6);
      c.beginPath();
      c.arc(-5.5, 1.5, 1.6, 0, Math.PI * 2);
      c.arc(5.5, 1.5, 1.6, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'crow':
    case 'spider':
    default: {
      const flap = Math.sin(t * 10) * 0.5;
      for (const s of [-1, 1]) {
        c.save();
        c.scale(s, 1);
        c.rotate(flap * 0.5 - 0.2);
        c.beginPath();
        c.moveTo(2, 0);
        c.quadraticCurveTo(12, -10, 22, -4);
        c.lineTo(18, -1);
        c.lineTo(20, 2);
        c.lineTo(15, 2);
        c.lineTo(16, 5);
        c.quadraticCurveTo(8, 4, 2, 4);
        c.closePath();
        c.fillStyle = L.color;
        c.fill();
        c.stroke();
        c.restore();
      }
      c.beginPath();
      c.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
      c.fillStyle = L.color;
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-2, -2);
      c.lineTo(0, 4);
      c.lineTo(2, -2);
      c.closePath();
      c.fillStyle = '#ffcf3a';
      c.fill();
      eyes(c, L.eyeColor, 2.6, -4, 1.3);
      c.strokeStyle = L.color2;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 1, 9, 0.3, 2.8);
      c.stroke();
    }
  }
  c.restore();
}

function eyes(c: CanvasRenderingContext2D, col: string, dx: number, y: number, r: number): void {
  c.save();
  c.shadowColor = col;
  c.shadowBlur = 6;
  c.fillStyle = col;
  c.beginPath();
  c.arc(-dx, y, r, 0, Math.PI * 2);
  c.arc(dx, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
