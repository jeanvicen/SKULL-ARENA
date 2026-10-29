import type { PrintKind } from '../../content/types';
import { alpha, darken } from '../color';
import type { Ctx } from '../paint';

/** Estampas de camiseta/moletom (todas originais). `s` = tamanho aproximado. */
export function paintPrint(ctx: Ctx, kind: PrintKind, cx: number, cy: number, s: number, color: string, text?: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const k = s / 8;
  ctx.scale(k, k);
  switch (kind) {
    case 'skull': {
      ctx.beginPath();
      ctx.ellipse(0, -1, 4.2, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2.4, 1.5, 4.8, 2.6);
      ctx.fillStyle = darken(color, 0.85);
      ctx.beginPath();
      ctx.ellipse(-1.6, -1, 1.2, 1.4, 0, 0, Math.PI * 2);
      ctx.ellipse(1.6, -1, 1.2, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0.6);
      ctx.lineTo(-0.6, 1.7);
      ctx.lineTo(0.6, 1.7);
      ctx.fill();
      ctx.fillRect(-1.6, 2.6, 0.5, 1.5);
      ctx.fillRect(-0.25, 2.6, 0.5, 1.5);
      ctx.fillRect(1.1, 2.6, 0.5, 1.5);
      break;
    }
    case 'text': {
      ctx.font = `900 ${text && text.length > 4 ? 3.2 : 4.4}px "Lilita One", Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text ?? 'SKULL', 0, 0);
      break;
    }
    case 'stripe': {
      ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, i * 2.4);
        ctx.lineTo(6, i * 2.4);
        ctx.stroke();
      }
      break;
    }
    case 'flame': {
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(-5, 4, -4, -1, -2, -2);
      ctx.bezierCurveTo(-2, 0, -1, 1, 0, 1);
      ctx.bezierCurveTo(-1, -2, 1, -4, 1, -6);
      ctx.bezierCurveTo(3, -3, 5, 0, 4, 2);
      ctx.bezierCurveTo(3.5, 4, 2, 5, 0, 5);
      ctx.fill();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 2 : 4.8;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'cross': {
      ctx.fillRect(-1, -5, 2, 10);
      ctx.fillRect(-3.5, -2.5, 7, 2);
      break;
    }
    case 'bolt': {
      ctx.beginPath();
      ctx.moveTo(1.5, -5.5);
      ctx.lineTo(-3, 0.6);
      ctx.lineTo(0, 0.6);
      ctx.lineTo(-1.5, 5.5);
      ctx.lineTo(3, -0.8);
      ctx.lineTo(0, -0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-6, 0, -3.5, -5, 0, -2);
      ctx.bezierCurveTo(3.5, -5, 6, 0, 0, 4);
      ctx.fill();
      break;
    }
    case 'eye': {
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(0, -4.5, 5, 0);
      ctx.quadraticCurveTo(0, 4.5, -5, 0);
      ctx.fill();
      ctx.fillStyle = darken(color, 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rune': {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
      ctx.moveTo(0, -4.4);
      ctx.lineTo(-2.5, 2.5);
      ctx.lineTo(3, -1);
      ctx.lineTo(-3, -1);
      ctx.lineTo(2.5, 2.5);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
  void alpha;
}
