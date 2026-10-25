import type { CharacterArt, CharacterDef, SkinDef } from '../../content/types';
import { darken, lighten, mix, outline, rgba } from './color';

/**
 * ARTE PROCEDURAL DAS CAVEIRAS
 * Cada personagem é montado a partir de `art` + paleta (+ skin) do JSON:
 * crânio × chapéu × olhos × mandíbula × roupa × arma × aura.
 * As partes são "assadas" uma vez em canvases (cache) e animadas por transformações
 * no render (bob, squash, recuo, flash), mantendo o custo por frame baixo.
 * Slots de arte final: se `def.sprite` apontar para uma imagem, o render pode trocar
 * estas partes por sprites desenhados à mão sem mexer no motor.
 */

export interface Look {
  art: CharacterArt;
  primary: string;
  dark: string;
  accent: string;
  bone: string;
  eye: string;
  aura: CharacterArt['aura'];
  scale: number;
}

export function resolveLook(def: CharacterDef, skin?: SkinDef | null): Look {
  const pal = skin?.palette ?? def.palette;
  const art: CharacterArt = { ...def.art, headwear: skin?.headwear ?? def.art.headwear };
  return {
    art,
    primary: pal[0],
    dark: pal[1],
    accent: pal[2],
    bone: skin?.boneColor ?? def.art.boneColor ?? '#f3ead8',
    eye: skin?.eyeColor ?? def.art.eyeColor,
    aura: skin?.aura ?? def.art.aura ?? 'none',
    scale: def.art.scale ?? 1,
  };
}

export interface PartCanvas {
  canvas: HTMLCanvasElement;
  /** Âncora em unidades (onde fica a origem da peça dentro do canvas). */
  ax: number;
  ay: number;
  /** Tamanho em unidades. */
  w: number;
  h: number;
}

export interface CharacterSprites {
  head: PartCanvas;
  headBack: PartCanvas;
  body: PartCanvas;
  weapon: PartCanvas;
  headWhite: PartCanvas;
  bodyWhite: PartCanvas;
  look: Look;
}

const LW = 2.6; // espessura do contorno em unidades

function part(w: number, h: number, ax: number, ay: number, res: number, draw: (ctx: CanvasRenderingContext2D) => void): PartCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  ctx.translate(ax, ay);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return { canvas, ax, ay, w, h };
}

/** Versão branca sólida da peça (flash de dano). */
function whiteOf(p: PartCanvas): PartCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = p.canvas.width;
  canvas.height = p.canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(p.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { ...p, canvas };
}

export function bakeCharacter(look: Look, res: number): CharacterSprites {
  const head = part(96, 104, 48, 100, res, (c) => drawHead(c, look, false));
  const headBack = part(96, 104, 48, 100, res, (c) => drawHead(c, look, true));
  const body = part(70, 50, 35, 46, res, (c) => drawBody(c, look));
  const weapon = part(96, 64, 26, 32, res, (c) => drawWeapon(c, look));
  return { head, headBack, body, weapon, headWhite: whiteOf(head), bodyWhite: whiteOf(body), look };
}

// ───────────────────────────── helpers de desenho ─────────────────────────────

function fillStroke(c: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke: string, lw = LW): void {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = stroke;
  c.stroke();
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function boneGrad(c: CanvasRenderingContext2D, bone: string, x: number, y: number, r: number): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, lighten(bone, 0.5));
  g.addColorStop(0.55, bone);
  g.addColorStop(1, darken(bone, 0.28));
  return g;
}

// ───────────────────────────── CABEÇA ─────────────────────────────

interface SkullGeom { cx: number; cy: number; rx: number; ry: number }

function skullGeom(art: CharacterArt): SkullGeom {
  switch (art.skull) {
    case 'long': return { cx: 0, cy: -50, rx: 19, ry: 24 };
    case 'wide': return { cx: 0, cy: -47, rx: 26, ry: 19.5 };
    case 'square': return { cx: 0, cy: -48, rx: 23, ry: 21 };
    case 'tiny': return { cx: 0, cy: -46, rx: 19, ry: 18 };
    default: return { cx: 0, cy: -48, rx: 23, ry: 21.5 };
  }
}

function drawHead(c: CanvasRenderingContext2D, L: Look, back: boolean): void {
  const g = skullGeom(L.art);
  const ol = outline(L.dark);
  const hw = L.art.headwear;

  // Peças de chapéu que ficam ATRÁS do crânio
  if (hw === 'hood') drawHoodBack(c, g, L);
  if (hw === 'pharaoh') drawPharaohBack(c, g, L);
  if (L.art.skull === 'horned') drawHorns(c, g, L, ol);

  // Mandíbula (atrás do crânio no topo, aparece embaixo)
  if (!back) {
    const jw = g.rx * 0.72;
    rrect(c, -jw, g.cy + g.ry * 0.45, jw * 2, g.ry * 0.62, 7);
    fillStroke(c, darken(L.bone, 0.08), ol);
  }

  // Crânio
  if (L.art.skull === 'square') rrect(c, g.cx - g.rx, g.cy - g.ry, g.rx * 2, g.ry * 2, 12);
  else ellipse(c, g.cx, g.cy, g.rx, g.ry);
  fillStroke(c, boneGrad(c, L.bone, g.cx, g.cy, Math.max(g.rx, g.ry)), ol);

  // Sombra inferior (volume)
  c.save();
  if (L.art.skull === 'square') rrect(c, g.cx - g.rx, g.cy - g.ry, g.rx * 2, g.ry * 2, 12);
  else ellipse(c, g.cx, g.cy, g.rx, g.ry);
  c.clip();
  ellipse(c, g.cx + 4, g.cy + g.ry * 0.95, g.rx * 1.2, g.ry * 0.55);
  c.fillStyle = rgba(darken(L.bone, 0.5), 0.28);
  c.fill();
  c.restore();

  if (back) {
    // Nuca: costura craniana + brilho
    c.beginPath();
    c.moveTo(g.cx, g.cy - g.ry * 0.9);
    c.bezierCurveTo(g.cx - 4, g.cy - g.ry * 0.4, g.cx + 4, g.cy, g.cx, g.cy + g.ry * 0.6);
    c.lineWidth = 1.4;
    c.strokeStyle = rgba(darken(L.bone, 0.45), 0.7);
    c.stroke();
  } else {
    drawFace(c, g, L, ol);
  }

  // Rachadura
  if (L.art.skull === 'cracked') {
    c.beginPath();
    c.moveTo(g.cx + 6, g.cy - g.ry);
    c.lineTo(g.cx + 2, g.cy - g.ry * 0.55);
    c.lineTo(g.cx + 9, g.cy - g.ry * 0.35);
    c.lineTo(g.cx + 4, g.cy - g.ry * 0.05);
    c.lineWidth = 2;
    c.strokeStyle = ol;
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = rgba(L.eye, 0.9);
    c.stroke();
  }

  // Brilho especular
  ellipse(c, g.cx - g.rx * 0.38, g.cy - g.ry * 0.5, g.rx * 0.3, g.ry * 0.16, -0.5);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fill();

  drawHeadwear(c, g, L, ol, back);
}

function drawFace(c: CanvasRenderingContext2D, g: SkullGeom, L: Look, ol: string): void {
  const ex = g.rx * 0.42, ey = g.cy + g.ry * 0.05;
  const sock = '#1a0f24';
  const eyes = L.art.eyes;

  const socket = (x: number, rx: number, ry: number, rot: number) => {
    ellipse(c, x, ey, rx, ry, rot);
    c.fillStyle = sock;
    c.fill();
  };
  const glow = (x: number, y: number, r: number) => {
    c.save();
    c.shadowColor = L.eye;
    c.shadowBlur = 8;
    ellipse(c, x, y, r, r);
    c.fillStyle = L.eye;
    c.fill();
    c.restore();
    ellipse(c, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.35);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
  };

  switch (eyes) {
    case 'cyclops':
      socket(0, 9.5, 9, 0);
      glow(0, ey + 0.5, 4.2);
      // monóculo
      c.beginPath();
      c.arc(0, ey, 11, 0, Math.PI * 2);
      c.lineWidth = 1.8;
      c.strokeStyle = '#ffd84a';
      c.stroke();
      break;
    case 'angry':
      socket(-ex, 7, 6.5, 0.35);
      socket(ex, 7, 6.5, -0.35);
      glow(-ex, ey + 1.2, 2.8);
      glow(ex, ey + 1.2, 2.8);
      // sobrancelha óssea
      c.beginPath();
      c.moveTo(-ex - 8, ey - 8);
      c.lineTo(-2, ey - 4);
      c.moveTo(ex + 8, ey - 8);
      c.lineTo(2, ey - 4);
      c.lineWidth = 2.6;
      c.strokeStyle = ol;
      c.stroke();
      break;
    case 'x':
      socket(-ex, 7, 7.5, 0);
      socket(ex, 7, 7.5, 0);
      for (const sx of [-ex, ex]) {
        c.beginPath();
        c.moveTo(sx - 3.5, ey - 3.5);
        c.lineTo(sx + 3.5, ey + 3.5);
        c.moveTo(sx + 3.5, ey - 3.5);
        c.lineTo(sx - 3.5, ey + 3.5);
        c.lineWidth = 2.4;
        c.strokeStyle = L.eye;
        c.save();
        c.shadowColor = L.eye;
        c.shadowBlur = 6;
        c.stroke();
        c.restore();
      }
      break;
    case 'star':
      socket(-ex, 7.5, 8, 0);
      socket(ex, 7.5, 8, 0);
      for (const sx of [-ex, ex]) drawStar(c, sx, ey + 0.5, 4.6, 2, L.eye);
      break;
    case 'spiral':
      socket(-ex, 7.5, 8, 0);
      socket(ex, 7.5, 8, 0);
      for (const sx of [-ex, ex]) {
        c.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const r = 0.4 + a * 0.38;
          const px = sx + Math.cos(a) * r, py = ey + Math.sin(a) * r;
          if (a === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.lineWidth = 1.3;
        c.strokeStyle = L.eye;
        c.stroke();
      }
      break;
    case 'heart':
      socket(-ex, 7.5, 8, 0);
      socket(ex, 7.5, 8, 0);
      for (const sx of [-ex, ex]) drawHeart(c, sx, ey + 0.5, 4.2, L.eye);
      break;
    case 'visor': {
      rrect(c, -g.rx * 0.8, ey - 5, g.rx * 1.6, 10, 4);
      c.fillStyle = sock;
      c.fill();
      c.save();
      c.shadowColor = L.eye;
      c.shadowBlur = 10;
      rrect(c, -g.rx * 0.68, ey - 1.8, g.rx * 1.36, 3.6, 2);
      c.fillStyle = L.eye;
      c.fill();
      c.restore();
      break;
    }
    case 'hollow':
      socket(-ex, 7.5, 8.5, 0);
      socket(ex, 7.5, 8.5, 0);
      glow(-ex, ey + 2.5, 1.6);
      glow(ex, ey + 2.5, 1.6);
      break;
    default: // glow
      socket(-ex, 7.2, 8, 0.12);
      socket(ex, 7.2, 8, -0.12);
      glow(-ex + 0.5, ey + 0.8, 3.3);
      glow(ex - 0.5, ey + 0.8, 3.3);
  }

  // Nariz (coração invertido)
  const ny = g.cy + g.ry * 0.48;
  c.beginPath();
  c.moveTo(0, ny + 3.2);
  c.quadraticCurveTo(-3.6, ny - 0.5, -1.4, ny - 2.2);
  c.lineTo(0, ny - 0.8);
  c.lineTo(1.4, ny - 2.2);
  c.quadraticCurveTo(3.6, ny - 0.5, 0, ny + 3.2);
  c.fillStyle = sock;
  c.fill();

  // Boca / dentes
  const my = g.cy + g.ry * 0.82;
  const mw = g.rx * 0.62;
  switch (L.art.jaw) {
    case 'fangs':
      c.beginPath();
      c.moveTo(-mw, my);
      c.quadraticCurveTo(0, my + 5, mw, my);
      c.lineWidth = 2;
      c.strokeStyle = sock;
      c.stroke();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * mw * 0.45 - 2, my + 1.5);
        c.lineTo(s * mw * 0.45, my + 7);
        c.lineTo(s * mw * 0.45 + 2, my + 1.8);
        c.fillStyle = '#fffaf0';
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = ol;
        c.stroke();
      }
      break;
    case 'open':
      ellipse(c, 0, my + 2, mw * 0.65, 4.6);
      c.fillStyle = sock;
      c.fill();
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        c.rect(i * 3.2 - 1.2, my - 2.6, 2.4, 2.6);
      }
      c.fillStyle = '#fffaf0';
      c.fill();
      break;
    case 'stitched':
      c.beginPath();
      c.moveTo(-mw, my);
      c.lineTo(mw, my);
      for (let i = -2; i <= 2; i++) {
        c.moveTo(i * mw * 0.4, my - 3);
        c.lineTo(i * mw * 0.4, my + 3);
      }
      c.lineWidth = 1.5;
      c.strokeStyle = sock;
      c.stroke();
      break;
    case 'beard': {
      c.beginPath();
      c.moveTo(-mw - 3, my - 3);
      c.quadraticCurveTo(-mw, my + 12, 0, my + 14);
      c.quadraticCurveTo(mw, my + 12, mw + 3, my - 3);
      c.quadraticCurveTo(0, my + 2, -mw - 3, my - 3);
      fillStroke(c, mix(L.dark, '#ffffff', 0.15), ol, 1.6);
      break;
    }
    case 'gold_tooth':
    case 'grin':
    default: {
      c.beginPath();
      c.moveTo(-mw, my - 2);
      c.quadraticCurveTo(0, my + 6, mw, my - 2);
      c.quadraticCurveTo(0, my + 1, -mw, my - 2);
      c.fillStyle = sock;
      c.fill();
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        const x = i * mw * 0.36;
        c.moveTo(x, my - 1.5);
        c.lineTo(x, my + 3.5 - Math.abs(i) * 0.9);
      }
      c.lineWidth = 1.4;
      c.strokeStyle = '#fffaf0';
      c.stroke();
      if (L.art.jaw === 'gold_tooth') {
        rrect(c, mw * 0.18, my - 1, 3.4, 4, 1);
        c.fillStyle = '#ffd84a';
        c.fill();
      }
    }
  }

  // Bochechas coradas (charme cartoon)
  for (const s of [-1, 1]) {
    ellipse(c, s * g.rx * 0.68, g.cy + g.ry * 0.5, 3.4, 2);
    c.fillStyle = rgba(L.primary, 0.35);
    c.fill();
  }
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number, ri: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 8;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? ri : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.restore();
}

function drawHeart(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 8;
  c.beginPath();
  c.moveTo(x, y + s);
  c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s);
  c.fillStyle = color;
  c.fill();
  c.restore();
}

function drawHorns(c: CanvasRenderingContext2D, g: SkullGeom, L: Look, ol: string): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * g.rx * 0.55, g.cy - g.ry * 0.6);
    c.quadraticCurveTo(s * (g.rx + 12), g.cy - g.ry - 4, s * (g.rx + 6), g.cy - g.ry - 18);
    c.quadraticCurveTo(s * (g.rx - 2), g.cy - g.ry - 4, s * g.rx * 0.2, g.cy - g.ry * 0.75);
    c.closePath();
    const gr = c.createLinearGradient(0, g.cy - g.ry - 18, 0, g.cy - g.ry * 0.5);
    gr.addColorStop(0, lighten(L.accent, 0.3));
    gr.addColorStop(1, L.dark);
    fillStroke(c, gr, ol, 2);
  }
}

function drawHoodBack(c: CanvasRenderingContext2D, g: SkullGeom, L: Look): void {
  const ol = outline(L.dark);
  c.beginPath();
  c.moveTo(-g.rx - 9, g.cy + g.ry + 4);
  c.quadraticCurveTo(-g.rx - 14, g.cy - g.ry - 4, 0, g.cy - g.ry - 14);
  c.quadraticCurveTo(g.rx + 14, g.cy - g.ry - 4, g.rx + 9, g.cy + g.ry + 4);
  c.closePath();
  const gr = c.createLinearGradient(0, g.cy - g.ry - 14, 0, g.cy + g.ry);
  gr.addColorStop(0, lighten(L.primary, 0.15));
  gr.addColorStop(1, darken(L.primary, 0.35));
  fillStroke(c, gr, ol);
  // interior escuro
  ellipse(c, g.cx, g.cy + 2, g.rx + 3, g.ry + 4);
  c.fillStyle = darken(L.dark, 0.4);
  c.fill();
}

function drawPharaohBack(c: CanvasRenderingContext2D, g: SkullGeom, L: Look): void {
  const ol = outline(L.dark);
  c.beginPath();
  c.moveTo(-g.rx - 4, g.cy - g.ry * 0.5);
  c.lineTo(-g.rx - 12, g.cy + g.ry + 14);
  c.lineTo(g.rx + 12, g.cy + g.ry + 14);
  c.lineTo(g.rx + 4, g.cy - g.ry * 0.5);
  c.closePath();
  fillStroke(c, L.dark, ol);
  c.save();
  c.clip();
  for (let y = g.cy - g.ry; y < g.cy + g.ry + 16; y += 6) {
    c.fillStyle = L.primary;
    c.fillRect(-g.rx - 14, y, (g.rx + 14) * 2, 3);
  }
  c.restore();
}

function drawHeadwear(c: CanvasRenderingContext2D, g: SkullGeom, L: Look, ol: string, back: boolean): void {
  const top = g.cy - g.ry;
  const P = L.primary, D = L.dark, A = L.accent;
  switch (L.art.headwear) {
    case 'hood': {
      // aba frontal do capuz por cima da testa
      c.beginPath();
      c.moveTo(-g.rx - 6, g.cy - 2);
      c.quadraticCurveTo(-g.rx, top - 8, 0, top - 10);
      c.quadraticCurveTo(g.rx, top - 8, g.rx + 6, g.cy - 2);
      c.quadraticCurveTo(g.rx * 0.6, top + 6, 0, top + 7);
      c.quadraticCurveTo(-g.rx * 0.6, top + 6, -g.rx - 6, g.cy - 2);
      const gr = c.createLinearGradient(0, top - 10, 0, g.cy);
      gr.addColorStop(0, lighten(P, 0.2));
      gr.addColorStop(1, P);
      fillStroke(c, gr, ol);
      if (back) {
        ellipse(c, 0, g.cy, g.rx + 5, g.ry + 4);
        c.fillStyle = darken(P, 0.1);
        c.fill();
        c.lineWidth = LW;
        c.strokeStyle = ol;
        c.stroke();
      }
      break;
    }
    case 'crown': {
      c.beginPath();
      const w = g.rx * 0.95, y0 = top + 5, h = 15;
      c.moveTo(-w, y0);
      c.lineTo(-w, y0 - h * 0.5);
      c.lineTo(-w * 0.6, y0 - h);
      c.lineTo(-w * 0.3, y0 - h * 0.45);
      c.lineTo(0, y0 - h * 1.15);
      c.lineTo(w * 0.3, y0 - h * 0.45);
      c.lineTo(w * 0.6, y0 - h);
      c.lineTo(w, y0 - h * 0.5);
      c.lineTo(w, y0);
      c.closePath();
      const gr = c.createLinearGradient(0, y0 - h, 0, y0);
      gr.addColorStop(0, '#fff3a6');
      gr.addColorStop(1, '#e09b1a');
      fillStroke(c, gr, '#5a3200');
      for (const [x, col] of [[-w * 0.55, A], [0, P], [w * 0.55, A]] as Array<[number, string]>) {
        ellipse(c, x, y0 - 4, 2.6, 2.6);
        c.fillStyle = col;
        c.fill();
      }
      break;
    }
    case 'tophat': {
      const w = g.rx * 0.78;
      ellipse(c, 0, top + 4, g.rx + 7, 5);
      fillStroke(c, D, ol);
      rrect(c, -w, top - 30, w * 2, 34, 4);
      const gr = c.createLinearGradient(-w, 0, w, 0);
      gr.addColorStop(0, lighten(D, 0.25));
      gr.addColorStop(0.6, D);
      gr.addColorStop(1, darken(D, 0.3));
      fillStroke(c, gr, ol);
      c.fillStyle = P;
      c.fillRect(-w + 1.3, top - 6, w * 2 - 2.6, 6);
      ellipse(c, 0, top - 30, w, 3.5);
      fillStroke(c, lighten(D, 0.15), ol, 1.8);
      break;
    }
    case 'horns':
      drawHorns(c, g, L, ol);
      break;
    case 'helmet': {
      c.beginPath();
      c.moveTo(-g.rx - 3, g.cy - 2);
      c.quadraticCurveTo(-g.rx - 4, top - 10, 0, top - 11);
      c.quadraticCurveTo(g.rx + 4, top - 10, g.rx + 3, g.cy - 2);
      c.lineTo(g.rx + 3, g.cy - 6);
      c.lineTo(-g.rx - 3, g.cy - 6);
      c.closePath();
      const gr = c.createLinearGradient(-g.rx, top, g.rx, g.cy);
      gr.addColorStop(0, lighten(P, 0.45));
      gr.addColorStop(0.5, P);
      gr.addColorStop(1, darken(P, 0.4));
      fillStroke(c, gr, ol);
      // rebites
      for (const x of [-g.rx * 0.7, 0, g.rx * 0.7]) {
        ellipse(c, x, g.cy - 9, 1.6, 1.6);
        c.fillStyle = lighten(P, 0.6);
        c.fill();
      }
      break;
    }
    case 'bandana': {
      c.beginPath();
      c.moveTo(-g.rx - 1, g.cy - g.ry * 0.38);
      c.quadraticCurveTo(0, top - 6, g.rx + 1, g.cy - g.ry * 0.38);
      c.lineTo(g.rx, g.cy - g.ry * 0.15);
      c.quadraticCurveTo(0, top + 6, -g.rx, g.cy - g.ry * 0.15);
      c.closePath();
      fillStroke(c, P, ol);
      // pontinhos
      for (let i = -2; i <= 2; i++) {
        ellipse(c, i * 7, g.cy - g.ry * 0.55 - Math.abs(i) * 0.8, 1.2, 1.2);
        c.fillStyle = lighten(P, 0.7);
        c.fill();
      }
      // nó
      c.beginPath();
      c.moveTo(g.rx - 2, g.cy - g.ry * 0.3);
      c.lineTo(g.rx + 12, g.cy - g.ry * 0.05);
      c.lineTo(g.rx + 8, g.cy - g.ry * 0.5);
      c.closePath();
      fillStroke(c, darken(P, 0.15), ol, 1.8);
      break;
    }
    case 'witch_hat': {
      ellipse(c, 0, top + 5, g.rx + 13, 6);
      fillStroke(c, D, ol);
      c.beginPath();
      c.moveTo(-g.rx * 0.8, top + 4);
      c.quadraticCurveTo(-4, top - 22, 10, top - 42);
      c.quadraticCurveTo(14, top - 30, 4, top - 26);
      c.quadraticCurveTo(10, top - 10, g.rx * 0.8, top + 4);
      c.closePath();
      const gr = c.createLinearGradient(-g.rx, 0, g.rx, 0);
      gr.addColorStop(0, lighten(D, 0.3));
      gr.addColorStop(1, darken(D, 0.2));
      fillStroke(c, gr, ol);
      c.beginPath();
      c.moveTo(-g.rx * 0.72, top - 1);
      c.quadraticCurveTo(0, top - 6, g.rx * 0.72, top - 1);
      c.lineWidth = 4;
      c.strokeStyle = P;
      c.stroke();
      break;
    }
    case 'halo': {
      c.save();
      c.shadowColor = A;
      c.shadowBlur = 10;
      ellipse(c, 0, top - 9, g.rx * 0.75, 5);
      c.lineWidth = 3.2;
      c.strokeStyle = A;
      c.stroke();
      c.restore();
      ellipse(c, 0, top - 9, g.rx * 0.75, 5);
      c.lineWidth = 1;
      c.strokeStyle = '#fffbe0';
      c.stroke();
      break;
    }
    case 'mohawk': {
      for (let i = -3; i <= 3; i++) {
        const x = i * 4.2;
        const h = 18 - Math.abs(i) * 2.6;
        c.beginPath();
        c.moveTo(x - 3.4, top + 5);
        c.lineTo(x + i * 0.8, top - h);
        c.lineTo(x + 3.4, top + 5);
        c.closePath();
        fillStroke(c, i % 2 ? P : A, ol, 1.8);
      }
      break;
    }
    case 'flame': {
      c.save();
      c.shadowColor = A;
      c.shadowBlur = 12;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        const x = i * 7, h = 22 - Math.abs(i) * 5;
        c.moveTo(x - 6, top + 6);
        c.quadraticCurveTo(x - 6, top - h * 0.5, x + 1, top - h);
        c.quadraticCurveTo(x + 7, top - h * 0.4, x + 6, top + 6);
        c.closePath();
        c.fillStyle = i % 2 ? A : P;
        c.fill();
      }
      c.restore();
      break;
    }
    case 'cap': {
      c.beginPath();
      c.moveTo(-g.rx - 1, g.cy - g.ry * 0.3);
      c.quadraticCurveTo(-g.rx, top - 8, 0, top - 8);
      c.quadraticCurveTo(g.rx, top - 8, g.rx + 1, g.cy - g.ry * 0.3);
      c.closePath();
      fillStroke(c, P, ol);
      // aba de lado
      c.beginPath();
      c.moveTo(g.rx * 0.2, g.cy - g.ry * 0.38);
      c.quadraticCurveTo(g.rx + 18, g.cy - g.ry * 0.5, g.rx + 20, g.cy - g.ry * 0.2);
      c.quadraticCurveTo(g.rx + 6, g.cy - g.ry * 0.05, g.rx * 0.2, g.cy - g.ry * 0.38);
      fillStroke(c, darken(P, 0.2), ol);
      ellipse(c, 0, top - 7, 3, 2);
      c.fillStyle = A;
      c.fill();
      // logo caveirinha
      ellipse(c, -4, g.cy - g.ry * 0.7, 4, 3.4);
      c.fillStyle = A;
      c.fill();
      break;
    }
    case 'samurai': {
      c.beginPath();
      c.moveTo(-g.rx - 8, g.cy - 2);
      c.quadraticCurveTo(-g.rx - 2, top - 12, 0, top - 12);
      c.quadraticCurveTo(g.rx + 2, top - 12, g.rx + 8, g.cy - 2);
      c.lineTo(g.rx + 2, g.cy - 8);
      c.lineTo(-g.rx - 2, g.cy - 8);
      c.closePath();
      fillStroke(c, D, ol);
      // crista
      c.beginPath();
      c.moveTo(-14, top - 6);
      c.quadraticCurveTo(-6, top - 30, -20, top - 34);
      c.moveTo(14, top - 6);
      c.quadraticCurveTo(6, top - 30, 20, top - 34);
      c.lineWidth = 4;
      c.strokeStyle = '#ffcf3a';
      c.stroke();
      ellipse(c, 0, top - 8, 4.5, 4.5);
      fillStroke(c, P, ol, 1.6);
      break;
    }
    case 'antlers': {
      c.lineWidth = 3.4;
      c.strokeStyle = darken(L.bone, 0.15);
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 8, top + 4);
        c.lineTo(s * 18, top - 18);
        c.lineTo(s * 28, top - 26);
        c.moveTo(s * 15, top - 12);
        c.lineTo(s * 26, top - 10);
        c.moveTo(s * 19, top - 20);
        c.lineTo(s * 16, top - 32);
        c.stroke();
      }
      break;
    }
    case 'beanie': {
      c.beginPath();
      c.moveTo(-g.rx - 1, g.cy - g.ry * 0.35);
      c.quadraticCurveTo(-g.rx, top - 10, 0, top - 11);
      c.quadraticCurveTo(g.rx, top - 10, g.rx + 1, g.cy - g.ry * 0.35);
      c.closePath();
      fillStroke(c, P, ol);
      rrect(c, -g.rx - 2, g.cy - g.ry * 0.5, g.rx * 2 + 4, 7, 3);
      fillStroke(c, A, ol, 1.8);
      ellipse(c, 0, top - 12, 5.5, 5.5);
      fillStroke(c, A, ol, 1.8);
      break;
    }
    case 'pharaoh': {
      c.beginPath();
      c.moveTo(-g.rx - 4, g.cy - 2);
      c.quadraticCurveTo(-g.rx, top - 9, 0, top - 10);
      c.quadraticCurveTo(g.rx, top - 9, g.rx + 4, g.cy - 2);
      c.lineTo(g.rx - 2, g.cy - g.ry * 0.38);
      c.quadraticCurveTo(0, top + 6, -g.rx + 2, g.cy - g.ry * 0.38);
      c.closePath();
      fillStroke(c, L.primary, ol);
      c.save();
      c.clip();
      for (let x = -g.rx - 4; x < g.rx + 4; x += 6) {
        c.fillStyle = L.dark;
        c.fillRect(x, top - 12, 3, g.ry + 12);
      }
      c.restore();
      // ureu
      c.beginPath();
      c.moveTo(0, top - 2);
      c.quadraticCurveTo(-4, top - 12, 0, top - 16);
      c.quadraticCurveTo(4, top - 12, 0, top - 2);
      fillStroke(c, '#ffcf3a', '#5a3200', 1.4);
      break;
    }
    default:
      break;
  }
}

// ───────────────────────────── CORPO ─────────────────────────────

function drawBody(c: CanvasRenderingContext2D, L: Look): void {
  const ol = outline(L.dark);
  const P = L.primary, D = L.dark, A = L.accent;
  const top = -30, bot = -4;
  const grad = (col: string) => {
    const g = c.createLinearGradient(-16, top, 16, bot);
    g.addColorStop(0, lighten(col, 0.22));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darken(col, 0.32));
    return g;
  };

  // pescoço (vértebra)
  rrect(c, -4, top - 6, 8, 8, 3);
  fillStroke(c, darken(L.bone, 0.1), ol, 1.6);

  switch (L.art.body) {
    case 'robe':
    case 'cloak': {
      c.beginPath();
      c.moveTo(-12, top);
      c.quadraticCurveTo(-20, -14, -21, bot);
      c.quadraticCurveTo(0, bot + 5, 21, bot);
      c.quadraticCurveTo(20, -14, 12, top);
      c.quadraticCurveTo(0, top - 4, -12, top);
      fillStroke(c, grad(P), ol);
      if (L.art.body === 'robe') {
        c.beginPath();
        c.moveTo(-20, bot - 3);
        c.quadraticCurveTo(0, bot + 2, 20, bot - 3);
        c.lineWidth = 3;
        c.strokeStyle = A;
        c.stroke();
        rrect(c, -14, -18, 28, 4, 2);
        c.fillStyle = D;
        c.fill();
      } else {
        // fecho do manto
        ellipse(c, 0, top + 3, 3.4, 3.4);
        fillStroke(c, A, ol, 1.4);
        c.beginPath();
        c.moveTo(0, top + 6);
        c.lineTo(0, bot);
        c.lineWidth = 1.4;
        c.strokeStyle = rgba(darken(P, 0.5), 0.8);
        c.stroke();
      }
      break;
    }
    case 'armor': {
      rrect(c, -15, top, 30, 25, 8);
      fillStroke(c, grad(P), ol);
      // ombreiras
      for (const s of [-1, 1]) {
        ellipse(c, s * 15, top + 4, 8, 6.5);
        fillStroke(c, grad(lighten(P, 0.1)), ol);
      }
      c.beginPath();
      c.moveTo(0, top + 3);
      c.lineTo(0, bot - 2);
      c.moveTo(-10, -16);
      c.lineTo(10, -16);
      c.lineWidth = 1.6;
      c.strokeStyle = rgba(darken(P, 0.5), 0.8);
      c.stroke();
      ellipse(c, 0, -21, 3.4, 3.4);
      fillStroke(c, A, ol, 1.4);
      break;
    }
    case 'jacket':
    case 'hoodie': {
      // camiseta/costelas
      rrect(c, -13, top, 26, 26, 7);
      fillStroke(c, L.art.body === 'jacket' ? '#2a2233' : grad(P), ol);
      if (L.art.body === 'jacket') {
        drawRibs(c, L, 0, top + 4, 0.75);
        // jaqueta aberta
        for (const s of [-1, 1]) {
          c.beginPath();
          c.moveTo(s * 4, top);
          c.lineTo(s * 15, top + 1);
          c.lineTo(s * 16, bot);
          c.lineTo(s * 6, bot);
          c.closePath();
          fillStroke(c, grad(P), ol);
          for (let i = 0; i < 3; i++) {
            ellipse(c, s * 11, top + 6 + i * 6, 1.1, 1.1);
            c.fillStyle = '#e8e8f0';
            c.fill();
          }
        }
      } else {
        // bolso canguru + cordinhas
        rrect(c, -9, -16, 18, 8, 3);
        c.lineWidth = 1.6;
        c.strokeStyle = rgba(darken(P, 0.5), 0.8);
        c.stroke();
        c.beginPath();
        c.moveTo(-3, top + 1);
        c.lineTo(-4, top + 9);
        c.moveTo(3, top + 1);
        c.lineTo(4, top + 9);
        c.lineWidth = 1.3;
        c.strokeStyle = A;
        c.stroke();
      }
      break;
    }
    case 'suit': {
      rrect(c, -14, top, 28, 26, 7);
      fillStroke(c, grad(D), ol);
      c.beginPath();
      c.moveTo(-5, top);
      c.lineTo(0, -16);
      c.lineTo(5, top);
      c.closePath();
      c.fillStyle = '#f4f0ea';
      c.fill();
      // gravata borboleta
      c.beginPath();
      c.moveTo(0, top + 3);
      c.lineTo(-6, top);
      c.lineTo(-6, top + 6);
      c.closePath();
      c.moveTo(0, top + 3);
      c.lineTo(6, top);
      c.lineTo(6, top + 6);
      c.closePath();
      fillStroke(c, P, ol, 1.2);
      break;
    }
    case 'tunic':
    case 'kimono': {
      c.beginPath();
      c.moveTo(-13, top);
      c.lineTo(-17, bot);
      c.lineTo(17, bot);
      c.lineTo(13, top);
      c.closePath();
      fillStroke(c, grad(P), ol);
      if (L.art.body === 'kimono') {
        c.beginPath();
        c.moveTo(-8, top);
        c.lineTo(5, -14);
        c.moveTo(8, top);
        c.lineTo(-2, -18);
        c.lineWidth = 2.4;
        c.strokeStyle = A;
        c.stroke();
        rrect(c, -16, -15, 32, 6, 2);
        fillStroke(c, D, ol, 1.4);
      } else {
        rrect(c, -16, -16, 32, 4.5, 2);
        c.fillStyle = A;
        c.fill();
        for (let x = -12; x <= 12; x += 6) {
          c.beginPath();
          c.moveTo(x - 2, bot - 2);
          c.lineTo(x, bot - 6);
          c.lineTo(x + 2, bot - 2);
          c.lineWidth = 1.2;
          c.strokeStyle = rgba(A, 0.9);
          c.stroke();
        }
      }
      break;
    }
    case 'bandages': {
      rrect(c, -13, top, 26, 26, 7);
      fillStroke(c, '#efe4c8', ol);
      for (let y = top + 4; y < bot; y += 5) {
        c.beginPath();
        c.moveTo(-13, y);
        c.lineTo(13, y + 2.5);
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(120,96,60,0.55)';
        c.stroke();
      }
      break;
    }
    case 'ribs':
    default: {
      // caixa torácica exposta com coluna
      rrect(c, -2.5, top, 5, 26, 2);
      fillStroke(c, L.bone, ol, 1.4);
      drawRibs(c, L, 0, top + 3, 1);
      rrect(c, -10, bot - 7, 20, 6, 3);
      fillStroke(c, darken(L.bone, 0.1), ol, 1.4);
      break;
    }
  }
}

function drawRibs(c: CanvasRenderingContext2D, L: Look, x: number, y: number, s: number): void {
  c.lineWidth = 2.4 * s;
  c.strokeStyle = L.bone;
  for (let i = 0; i < 4; i++) {
    const w = (11 - i * 1.4) * s;
    c.beginPath();
    c.moveTo(x - 1, y + i * 5 * s);
    c.quadraticCurveTo(x - w, y + i * 5 * s - 1, x - w + 1, y + i * 5 * s + 4);
    c.moveTo(x + 1, y + i * 5 * s);
    c.quadraticCurveTo(x + w, y + i * 5 * s - 1, x + w - 1, y + i * 5 * s + 4);
    c.stroke();
  }
}

// ───────────────────────────── ARMA ─────────────────────────────
// Desenhada apontando para +x a partir da mão (0,0). O render gira pela mira.

function drawHand(c: CanvasRenderingContext2D, L: Look, x: number, y: number): void {
  ellipse(c, x, y, 4.2, 4.2);
  fillStroke(c, boneGrad(c, L.bone, x, y, 4.2), outline(L.dark), 1.6);
}

function drawWeapon(c: CanvasRenderingContext2D, L: Look): void {
  const ol = outline(L.dark);
  const P = L.primary, D = L.dark, A = L.accent;
  const metal = (x0: number, y0: number, x1: number, y1: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#c9d3e6');
    g.addColorStop(1, '#5b6478');
    return g;
  };
  switch (L.art.weapon) {
    case 'scythe': {
      rrect(c, -10, -2, 52, 4.5, 2);
      fillStroke(c, '#4a2f1d', ol, 1.6);
      c.beginPath();
      c.moveTo(40, -2);
      c.quadraticCurveTo(52, -26, 22, -30);
      c.quadraticCurveTo(44, -20, 36, -2);
      c.closePath();
      fillStroke(c, metal(20, -30, 50, 0), ol, 1.8);
      c.beginPath();
      c.moveTo(38, -4);
      c.quadraticCurveTo(46, -20, 26, -27);
      c.lineWidth = 1.2;
      c.strokeStyle = rgba(A, 0.9);
      c.stroke();
      break;
    }
    case 'pistols': {
      for (const oy of [-5, 5]) {
        rrect(c, 2, oy - 3, 20, 6, 2);
        fillStroke(c, metal(2, oy - 3, 22, oy + 3), ol, 1.4);
        rrect(c, 2, oy, 6, 8, 2);
        fillStroke(c, '#6b3a1d', ol, 1.2);
      }
      break;
    }
    case 'staff': {
      rrect(c, -8, -2, 46, 4, 2);
      fillStroke(c, '#5a3a22', ol, 1.4);
      c.save();
      c.shadowColor = A;
      c.shadowBlur = 12;
      ellipse(c, 42, 0, 7, 7);
      c.fillStyle = A;
      c.fill();
      c.restore();
      ellipse(c, 42, 0, 7, 7);
      c.lineWidth = 1.6;
      c.strokeStyle = ol;
      c.stroke();
      ellipse(c, 40, -2, 2.2, 2.2);
      c.fillStyle = '#fff';
      c.fill();
      break;
    }
    case 'bow': {
      c.beginPath();
      c.moveTo(10, -24);
      c.quadraticCurveTo(28, 0, 10, 24);
      c.lineWidth = 4;
      c.strokeStyle = D;
      c.stroke();
      c.lineWidth = 2;
      c.strokeStyle = P;
      c.stroke();
      c.beginPath();
      c.moveTo(10, -24);
      c.lineTo(4, 0);
      c.lineTo(10, 24);
      c.lineWidth = 0.9;
      c.strokeStyle = '#e8fffb';
      c.stroke();
      rrect(c, 4, -1, 30, 2, 1);
      c.fillStyle = '#d8c7a0';
      c.fill();
      c.beginPath();
      c.moveTo(34, -3.5);
      c.lineTo(40, 0);
      c.lineTo(34, 3.5);
      c.closePath();
      c.fillStyle = A;
      c.fill();
      break;
    }
    case 'hammer':
    case 'shovel': {
      rrect(c, -6, -2.2, 40, 4.4, 2);
      fillStroke(c, '#6b4527', ol, 1.4);
      if (L.art.weapon === 'hammer') {
        rrect(c, 30, -11, 14, 22, 3);
        fillStroke(c, metal(30, -11, 44, 11), ol, 1.8);
      } else {
        c.beginPath();
        c.moveTo(32, -9);
        c.lineTo(46, -8);
        c.quadraticCurveTo(54, 0, 46, 8);
        c.lineTo(32, 9);
        c.closePath();
        fillStroke(c, metal(32, -9, 52, 9), ol, 1.8);
      }
      break;
    }
    case 'daggers': {
      for (const oy of [-7, 7]) {
        c.beginPath();
        c.moveTo(6, oy - 3);
        c.lineTo(28, oy);
        c.lineTo(6, oy + 3);
        c.closePath();
        fillStroke(c, metal(6, oy - 3, 28, oy + 3), ol, 1.2);
        rrect(c, 0, oy - 1.8, 7, 3.6, 1);
        c.fillStyle = P;
        c.fill();
      }
      break;
    }
    case 'cannon': {
      rrect(c, -4, -7, 34, 14, 5);
      fillStroke(c, metal(-4, -7, 30, 7), ol, 1.8);
      rrect(c, 26, -9, 8, 18, 3);
      fillStroke(c, D, ol, 1.6);
      rrect(c, 4, -8, 6, 16, 2);
      c.fillStyle = A;
      c.fill();
      break;
    }
    case 'lute':
    case 'guitar': {
      // guitarra "flying V" de osso
      c.beginPath();
      c.moveTo(-6, -12);
      c.lineTo(14, 0);
      c.lineTo(-6, 12);
      c.lineTo(2, 0);
      c.closePath();
      fillStroke(c, P, ol, 1.8);
      rrect(c, 12, -2, 30, 4, 1.5);
      fillStroke(c, '#3a2433', ol, 1.2);
      rrect(c, 40, -4, 7, 8, 2);
      fillStroke(c, A, ol, 1.2);
      c.beginPath();
      c.moveTo(2, -1);
      c.lineTo(42, -1);
      c.moveTo(2, 1);
      c.lineTo(42, 1);
      c.lineWidth = 0.5;
      c.strokeStyle = '#ffffff';
      c.stroke();
      break;
    }
    case 'book': {
      rrect(c, 4, -11, 20, 22, 2);
      fillStroke(c, D, ol, 1.6);
      rrect(c, 6, -9, 16, 18, 1);
      c.fillStyle = '#efe6cf';
      c.fill();
      c.save();
      c.shadowColor = A;
      c.shadowBlur = 8;
      ellipse(c, 14, 0, 4, 4);
      c.fillStyle = A;
      c.fill();
      c.restore();
      break;
    }
    case 'lantern': {
      c.beginPath();
      c.moveTo(4, -2);
      c.lineTo(18, -2);
      c.lineWidth = 2;
      c.strokeStyle = '#3a2a14';
      c.stroke();
      c.save();
      c.shadowColor = A;
      c.shadowBlur = 16;
      rrect(c, 16, -9, 14, 18, 4);
      c.fillStyle = A;
      c.fill();
      c.restore();
      rrect(c, 16, -9, 14, 18, 4);
      c.lineWidth = 2;
      c.strokeStyle = '#3a2a14';
      c.stroke();
      ellipse(c, 23, 0, 3, 4.5);
      c.fillStyle = '#fffbe0';
      c.fill();
      break;
    }
    case 'flask': {
      c.beginPath();
      c.moveTo(14, -10);
      c.lineTo(20, -10);
      c.lineTo(20, -4);
      c.quadraticCurveTo(30, 2, 26, 10);
      c.lineTo(8, 10);
      c.quadraticCurveTo(4, 2, 14, -4);
      c.closePath();
      fillStroke(c, rgba(A, 0.85), ol, 1.6);
      c.beginPath();
      c.moveTo(8, 4);
      c.lineTo(26, 4);
      c.lineTo(26, 10);
      c.lineTo(8, 10);
      c.closePath();
      c.fillStyle = P;
      c.fill();
      ellipse(c, 13, 0, 1.6, 2.6);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fill();
      break;
    }
    case 'shield': {
      c.beginPath();
      c.moveTo(8, -18);
      c.lineTo(26, -14);
      c.quadraticCurveTo(28, 8, 14, 20);
      c.quadraticCurveTo(2, 8, 8, -18);
      c.closePath();
      fillStroke(c, metal(8, -18, 26, 20), ol, 2);
      c.beginPath();
      c.moveTo(17, -12);
      c.lineTo(17, 13);
      c.moveTo(10, -2);
      c.lineTo(25, -2);
      c.lineWidth = 2.4;
      c.strokeStyle = P;
      c.stroke();
      // cano da escopeta por baixo
      rrect(c, 14, 14, 24, 5, 2);
      fillStroke(c, '#3a3f4a', ol, 1.2);
      break;
    }
    case 'katana': {
      rrect(c, -2, -2, 12, 4, 1);
      fillStroke(c, D, ol, 1.2);
      c.beginPath();
      c.moveTo(10, -2);
      c.quadraticCurveTo(34, -6, 50, -2);
      c.lineTo(10, 2);
      c.closePath();
      fillStroke(c, metal(10, -6, 50, 2), ol, 1.2);
      break;
    }
    case 'trident': {
      rrect(c, -8, -2, 48, 4, 2);
      fillStroke(c, '#b8860b', ol, 1.4);
      c.beginPath();
      c.moveTo(38, -10);
      c.lineTo(52, -10);
      c.moveTo(38, 10);
      c.lineTo(52, 10);
      c.moveTo(38, -10);
      c.lineTo(38, 10);
      c.moveTo(38, 0);
      c.lineTo(56, 0);
      c.lineWidth = 3;
      c.strokeStyle = '#ffd84a';
      c.stroke();
      break;
    }
    case 'chain': {
      for (let i = 0; i < 5; i++) {
        ellipse(c, 6 + i * 7, 0, 4, 2.6);
        c.lineWidth = 2;
        c.strokeStyle = '#9aa3b5';
        c.stroke();
      }
      break;
    }
    case 'claws': {
      for (const oy of [-5, 0, 5]) {
        c.beginPath();
        c.moveTo(6, oy - 1.5);
        c.quadraticCurveTo(18, oy - 4, 24, oy);
        c.lineTo(6, oy + 1.5);
        c.closePath();
        fillStroke(c, metal(6, oy, 24, oy), ol, 1);
      }
      break;
    }
    case 'fist':
    default: {
      // punho de osso grande (soco/arremesso)
      ellipse(c, 12, 0, 8, 7);
      fillStroke(c, boneGrad(c, L.bone, 12, 0, 8), ol, 1.8);
      c.beginPath();
      c.moveTo(14, -5);
      c.lineTo(14, 5);
      c.moveTo(18, -4);
      c.lineTo(18, 4);
      c.lineWidth = 1;
      c.strokeStyle = rgba(darken(L.bone, 0.5), 0.8);
      c.stroke();
      rrect(c, 4, -3.5, 6, 7, 2);
      c.fillStyle = A;
      c.fill();
      break;
    }
  }
  drawHand(c, L, 0, 0);
}

// ───────────────────────────── RETRATO (UI) ─────────────────────────────

const portraitCache = new Map<string, string>();

/** Retrato em data URL (busto + cabeça), com cache. Usado em cards/menus. */
export function portraitURL(key: string, look: Look, size = 160): string {
  const k = `${key}@${size}`;
  const hit = portraitCache.get(k);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  const s = size / 92;
  c.scale(s, s);
  c.translate(46, 104);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.save();
  c.translate(0, 8);
  c.scale(1.25, 1.25);
  drawBody(c, look);
  c.restore();
  c.save();
  c.translate(0, 2);
  c.scale(1.05, 1.05);
  drawHead(c, look, false);
  c.restore();
  const url = canvas.toDataURL('image/png');
  portraitCache.set(k, url);
  return url;
}
