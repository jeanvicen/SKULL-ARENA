import type { ProjLook } from '../content/types';
import { alpha, darken, lighten } from '../art/color';

/**
 * Desenho dos projéteis (no espaço do mundo, ctx já com a câmera).
 * `r` = raio de colisão; `ang` = direção; `t` = tempo (pra girar/pulsar).
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, look: ProjLook, x: number, y: number, r: number, ang: number, t: number, glowImg: CanvasImageSource | null): void {
  const s = (look.size ?? 1) * Math.max(7, r);
  const c = look.color;
  const c2 = look.color2 ?? lighten(c, 0.5);
  if (glowImg) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(glowImg, x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(look.spin ? t * 14 : ang);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ink = 'rgba(14,6,22,0.9)';
  switch (look.shape) {
    case 'bullet': {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.35, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.15, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s * 0.3, -s * 0.1, s * 0.5, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bolt':
    case 'arrow': {
      ctx.strokeStyle = ink;
      ctx.lineWidth = s * 0.9;
      ctx.beginPath();
      ctx.moveTo(-s * 2, 0);
      ctx.lineTo(s * 1.4, 0);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.5;
      ctx.stroke();
      ctx.fillStyle = look.shape === 'arrow' ? c2 : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(s * 1.9, 0);
      ctx.lineTo(s * 0.9, -s * 0.6);
      ctx.lineTo(s * 0.9, s * 0.6);
      ctx.fill();
      break;
    }
    case 'orb':
    case 'bubble': {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.08, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
      g.addColorStop(0, lighten(c, 0.7));
      g.addColorStop(1, look.shape === 'bubble' ? alpha(c, 0.6) : c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'skull': {
      const k = s * 0.95;
      ctx.rotate(-ang + (look.spin ? 0 : 0));
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, -k * 0.15, k * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, -k * 0.2, k * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-k * 0.55, k * 0.4, k * 1.1, k * 0.5);
      ctx.fillStyle = darken(c, 0.8);
      ctx.beginPath();
      ctx.arc(-k * 0.38, -k * 0.2, k * 0.26, 0, Math.PI * 2);
      ctx.arc(k * 0.38, -k * 0.2, k * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-k * 0.06, k * 0.15, k * 0.12, k * 0.25);
      break;
    }
    case 'note': {
      ctx.rotate(-ang);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, s * 0.5, s * 0.75, s * 0.55, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(s * 0.15, -s * 1.3, s * 0.4, s * 1.9);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, s * 0.5, s * 0.55, s * 0.38, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(s * 0.22, -s * 1.2, s * 0.22, s * 1.7);
      ctx.fillRect(s * 0.22, -s * 1.2, s * 0.7, s * 0.3);
      break;
    }
    case 'wave': {
      ctx.strokeStyle = alpha(c, 0.9);
      ctx.lineWidth = s * 0.45;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 1 - i * 0.28;
        ctx.beginPath();
        ctx.arc(-i * s * 0.7, 0, s * 1.3, -0.9, 0.9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'blade':
    case 'shard': {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(s * 1.8, 0);
      ctx.lineTo(-s * 0.4, -s * 0.9);
      ctx.lineTo(-s * 1.2, 0);
      ctx.lineTo(-s * 0.4, s * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(s * 1.45, 0);
      ctx.lineTo(-s * 0.3, -s * 0.6);
      ctx.lineTo(-s * 0.9, 0);
      ctx.lineTo(-s * 0.3, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(s * 1.2, 0);
      ctx.lineTo(-s * 0.2, -s * 0.4);
      ctx.lineTo(-s * 0.2, 0);
      ctx.fill();
      break;
    }
    case 'fire':
    case 'spray': {
      for (let i = 0; i < 3; i++) {
        const k = s * (1.1 - i * 0.3);
        ctx.fillStyle = i === 0 ? alpha(darken(c, 0.2), 0.8) : i === 1 ? c : lighten(c, 0.6);
        ctx.beginPath();
        ctx.ellipse(-i * s * 0.3, 0, k * 1.3, k * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'coin': {
      ctx.rotate(-ang);
      ctx.scale(Math.abs(Math.cos(t * 12)) * 0.8 + 0.2, 1);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.font = `900 ${Math.round(s * 1.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₹', 0, s * 0.05);
      break;
    }
    case 'glyph': {
      ctx.strokeStyle = ink;
      ctx.lineWidth = s * 0.6;
      ctx.beginPath();
      ctx.rect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.32;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(s * 0.5, 0);
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(0, s * 0.5);
      ctx.strokeStyle = c2;
      ctx.stroke();
      break;
    }
    case 'rock': {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, -s * 0.2);
      ctx.lineTo(-s * 0.3, -s * 0.9);
      ctx.lineTo(s * 0.7, -s * 0.6);
      ctx.lineTo(s * 0.9, s * 0.4);
      ctx.lineTo(0, s * 0.9);
      ctx.lineTo(-s * 0.8, s * 0.5);
      ctx.fill();
      break;
    }
    case 'card': {
      ctx.fillStyle = ink;
      ctx.fillRect(-s * 0.85, -s * 1.15, s * 1.7, s * 2.3);
      ctx.fillStyle = '#f7f4ec';
      ctx.fillRect(-s * 0.7, -s, s * 1.4, s * 2);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.4, 0);
      ctx.lineTo(0, s * 0.5);
      ctx.lineTo(-s * 0.4, 0);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}
