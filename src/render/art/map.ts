import type { MapDef, MapTheme } from '../../content/types';
import type { Rect } from '../../engine/collision';
import { Rng } from '../../engine/rng';
import { darken, lighten, mix, rgba } from './color';

/**
 * ARTE PROCEDURAL DAS ARENAS — cada tema tem paleta, piso, decoração e
 * estilo de obstáculo próprios. O piso inteiro é "assado" uma vez por partida.
 */
export interface ThemeStyle {
  floorA: string;
  floorB: string;
  grout: string;
  wallTop: string;
  wallFront: string;
  accent: string;
  liquid: string;
  liquid2: string;
  brush: [string, string, string];
  outside: string;
  light: string;
  tile: number;
  kind: 'tiles' | 'grass' | 'mud' | 'stars';
  decor: Array<'bones' | 'skull' | 'candle' | 'flower' | 'mushroom' | 'crack' | 'ember' | 'snow' | 'rune' | 'pebble' | 'lily' | 'neon'>;
}

export const THEMES: Record<MapTheme, ThemeStyle> = {
  crypt: { floorA: '#2e2346', floorB: '#372a54', grout: '#1b1330', wallTop: '#7a68a6', wallFront: '#43356b', accent: '#9d7bff', liquid: '#5b3fa8', liquid2: '#b48cff', brush: ['#2f6b4f', '#4f9a6c', '#1c4434'], outside: '#120b1f', light: '#ffb35c', tile: 48, kind: 'tiles', decor: ['bones', 'skull', 'candle', 'crack', 'pebble'] },
  graveyard: { floorA: '#1f3d3a', floorB: '#264a44', grout: '#163029', wallTop: '#8aa3a0', wallFront: '#4c625f', accent: '#7fffd4', liquid: '#1d4d5c', liquid2: '#5fd3e0', brush: ['#2d6b3f', '#4c9a55', '#1b4228'], outside: '#0c1a1a', light: '#9fffe0', tile: 40, kind: 'grass', decor: ['flower', 'skull', 'candle', 'mushroom', 'pebble'] },
  lava: { floorA: '#2c1a17', floorB: '#36201b', grout: '#170c0a', wallTop: '#6e4a3f', wallFront: '#3d2620', accent: '#ff7b2e', liquid: '#ff5a1f', liquid2: '#ffd84a', brush: ['#5a2d1a', '#8a4524', '#3a1a0e'], outside: '#120605', light: '#ff7b2e', tile: 48, kind: 'tiles', decor: ['ember', 'crack', 'skull', 'bones'] },
  ice: { floorA: '#2a5577', floorB: '#316289', grout: '#1d3f5c', wallTop: '#dff6ff', wallFront: '#7fc3e8', accent: '#bff4ff', liquid: '#0d2a44', liquid2: '#3a7fb8', brush: ['#d8f0ff', '#a9d6f2', '#7fb4d6'], outside: '#0b1a2a', light: '#bff4ff', tile: 64, kind: 'tiles', decor: ['snow', 'crack', 'pebble', 'skull'] },
  swamp: { floorA: '#26351b', floorB: '#2d3f20', grout: '#18240f', wallTop: '#6b6a3f', wallFront: '#3d3d22', accent: '#a6ff4d', liquid: '#2f4a1c', liquid2: '#7dff4f', brush: ['#3f7a27', '#64a83a', '#24501a'], outside: '#0d1408', light: '#c6ff9e', tile: 40, kind: 'mud', decor: ['lily', 'mushroom', 'bones', 'pebble'] },
  temple: { floorA: '#6b5230', floorB: '#7a5f38', grout: '#3d2d17', wallTop: '#e8c98a', wallFront: '#a8824a', accent: '#ffd84a', liquid: '#1d4d6b', liquid2: '#4fb3ff', brush: ['#4f7a2f', '#78a845', '#2f5020'], outside: '#1d140a', light: '#ffd84a', tile: 56, kind: 'tiles', decor: ['rune', 'crack', 'pebble', 'candle'] },
  neon: { floorA: '#170f33', floorB: '#1d1340', grout: '#0b0620', wallTop: '#3a2a7a', wallFront: '#22164f', accent: '#ff2d95', liquid: '#2a0a4a', liquid2: '#ff2d95', brush: ['#2d1a66', '#ff2d95', '#3df2ff'], outside: '#06030f', light: '#3df2ff', tile: 48, kind: 'tiles', decor: ['neon', 'skull', 'crack'] },
  void: { floorA: '#1a0f30', floorB: '#21143d', grout: '#0d0720', wallTop: '#5a3f99', wallFront: '#2f1f5c', accent: '#c06bff', liquid: '#0a0418', liquid2: '#c06bff', brush: ['#3a1f6b', '#6b3fb3', '#22104a'], outside: '#05020c', light: '#c06bff', tile: 60, kind: 'stars', decor: ['rune', 'skull', 'bones', 'crack'] },
};

const BORDER = 70;

/** Assa o piso inteiro + sombras de obstáculos + decoração, em `res` px/unidade. */
export function bakeFloor(map: MapDef, res: number): { canvas: HTMLCanvasElement; border: number } {
  const T = THEMES[map.theme] ?? THEMES.crypt;
  const W = map.size.w + BORDER * 2, H = map.size.h + BORDER * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(W * res);
  canvas.height = Math.ceil(H * res);
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  const rng = new Rng(map.decorSeed ?? 7);

  // Fora da arena
  c.fillStyle = T.outside;
  c.fillRect(0, 0, W, H);
  c.translate(BORDER, BORDER);

  const { w, h } = map.size;
  c.save();
  c.beginPath();
  c.rect(0, 0, w, h);
  c.clip();

  // Piso base
  if (T.kind === 'tiles') {
    const s = T.tile;
    c.fillStyle = T.grout;
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const v = rng.next();
        const col = mix(T.floorA, T.floorB, v);
        c.fillStyle = col;
        c.beginPath();
        c.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, 4);
        c.fill();
        // bisel
        c.fillStyle = rgba(lighten(col, 0.4), 0.12);
        c.fillRect(x + 2, y + 2, s - 4, 3);
        c.fillStyle = rgba(darken(col, 0.5), 0.25);
        c.fillRect(x + 2, y + s - 5, s - 4, 3);
        if (rng.chance(0.18)) {
          // ladrilho desgastado
          c.fillStyle = rgba(darken(col, 0.4), 0.25);
          c.beginPath();
          c.arc(x + s * rng.next(), y + s * rng.next(), s * 0.25 * rng.next() + 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    if (map.theme === 'neon') {
      c.save();
      c.shadowColor = T.accent;
      c.shadowBlur = 8;
      c.strokeStyle = rgba(T.accent, 0.35);
      c.lineWidth = 1.2;
      for (let x = 0; x <= w; x += T.tile * 2) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      c.strokeStyle = rgba('#3df2ff', 0.3);
      for (let y = 0; y <= h; y += T.tile * 2) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.restore();
    }
    if (map.theme === 'temple') {
      // faixa de mosaico dourado no centro
      c.strokeStyle = rgba(T.accent, 0.45);
      c.lineWidth = 3;
      c.strokeRect(w * 0.18, h * 0.38, w * 0.64, h * 0.24);
      c.beginPath();
      c.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
      c.stroke();
      drawSun(c, w / 2, h / 2, 46, rgba(T.accent, 0.4));
    }
    if (map.theme === 'ice') {
      // reflexos diagonais
      c.strokeStyle = 'rgba(255,255,255,0.07)';
      c.lineWidth = 18;
      for (let k = -h; k < w + h; k += 160) {
        c.beginPath();
        c.moveTo(k, 0);
        c.lineTo(k + h * 0.6, h);
        c.stroke();
      }
    }
  } else if (T.kind === 'grass' || T.kind === 'mud') {
    c.fillStyle = T.floorA;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = rng.next() * w, y = rng.next() * h, r = 10 + rng.next() * 34;
      c.fillStyle = rgba(rng.chance(0.5) ? T.floorB : darken(T.floorA, 0.25), 0.35);
      c.beginPath();
      c.ellipse(x, y, r, r * 0.7, rng.next() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // tufos de grama / lama
    for (let i = 0; i < (w * h) / 500; i++) {
      const x = rng.next() * w, y = rng.next() * h;
      c.strokeStyle = rgba(lighten(T.floorB, 0.25), 0.35);
      c.lineWidth = 1.4;
      c.beginPath();
      for (let k = -1; k <= 1; k++) {
        c.moveTo(x + k * 2, y);
        c.lineTo(x + k * 3.5, y - 5 - rng.next() * 3);
      }
      c.stroke();
    }
    if (T.kind === 'grass') {
      // trilha de terra
      c.strokeStyle = rgba('#3a2f22', 0.45);
      c.lineWidth = 46;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.5, -20);
      c.bezierCurveTo(w * 0.15, h * 0.3, w * 0.85, h * 0.7, w * 0.5, h + 20);
      c.stroke();
      c.lineWidth = 30;
      c.strokeStyle = rgba('#4a3d2c', 0.35);
      c.stroke();
    }
  } else {
    // estrelas / vazio cósmico
    const g = c.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, T.floorB);
    g.addColorStop(1, T.floorA);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / 1400; i++) {
      c.fillStyle = `rgba(255,255,255,${0.15 + rng.next() * 0.5})`;
      const r = rng.next() * 1.6 + 0.3;
      c.beginPath();
      c.arc(rng.next() * w, rng.next() * h, r, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = rgba(T.accent, 0.12);
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(w / 2, h / 2, 120 + i * 140, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // Líquidos (água/lava/gelo) — base assada, brilho animado no render
  for (const o of map.obstacles) {
    if (o.type !== 'water') continue;
    drawLiquidBase(c, o, T);
  }

  // Sombras dos obstáculos e caixas (luz vindo de cima-esquerda)
  c.fillStyle = 'rgba(0,0,0,0.32)';
  for (const o of map.obstacles) {
    if (o.type === 'water') continue;
    c.beginPath();
    c.roundRect(o.x + 8, o.y + 6, o.w + 4, o.h + 6, 8);
    c.fill();
  }

  // Decoração (evita obstáculos)
  const blocked = (x: number, y: number) =>
    map.obstacles.some((o) => x > o.x - 16 && x < o.x + o.w + 16 && y > o.y - 16 && y < o.y + o.h + 16);
  const n = Math.round((w * h) / 9000);
  for (let i = 0; i < n; i++) {
    const x = 20 + rng.next() * (w - 40), y = 20 + rng.next() * (h - 40);
    if (blocked(x, y)) continue;
    drawDecor(c, rng.pick(T.decor), x, y, rng, T);
  }

  c.restore();

  // Borda da arena (muro baixo decorado)
  c.lineWidth = 14;
  c.strokeStyle = T.wallFront;
  c.strokeRect(-7, -7, w + 14, h + 14);
  c.lineWidth = 6;
  c.strokeStyle = T.wallTop;
  c.strokeRect(-11, -11, w + 22, h + 22);
  c.lineWidth = 2;
  c.strokeStyle = rgba(T.accent, 0.5);
  c.strokeRect(-1, -1, w + 2, h + 2);
  // caveirinhas nos cantos
  for (const [x, y] of [[-11, -11], [w + 11, -11], [-11, h + 11], [w + 11, h + 11]]) {
    drawMiniSkull(c, x, y, 13, lighten(T.wallTop, 0.3));
  }

  return { canvas, border: BORDER };
}

function drawSun(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  c.strokeStyle = col;
  c.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.stroke();
  }
  c.beginPath();
  c.arc(x, y, r * 0.4, 0, Math.PI * 2);
  c.stroke();
}

function drawLiquidBase(c: CanvasRenderingContext2D, o: Rect, T: ThemeStyle): void {
  c.save();
  c.beginPath();
  c.roundRect(o.x, o.y, o.w, o.h, 18);
  const g = c.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
  g.addColorStop(0, darken(T.liquid, 0.25));
  g.addColorStop(1, T.liquid);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = darken(T.floorA, 0.4);
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = rgba(T.liquid2, 0.6);
  c.stroke();
  c.restore();
}

export function drawMiniSkull(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y - r * 0.15, r, 0, Math.PI * 2);
  c.fill();
  c.fillRect(x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.5);
  c.fillStyle = 'rgba(10,5,20,0.85)';
  c.beginPath();
  c.arc(x - r * 0.38, y - r * 0.1, r * 0.27, 0, Math.PI * 2);
  c.arc(x + r * 0.38, y - r * 0.1, r * 0.27, 0, Math.PI * 2);
  c.fill();
}

function drawDecor(c: CanvasRenderingContext2D, kind: ThemeStyle['decor'][number], x: number, y: number, rng: Rng, T: ThemeStyle): void {
  switch (kind) {
    case 'bones': {
      c.save();
      c.translate(x, y);
      c.rotate(rng.next() * Math.PI);
      c.strokeStyle = 'rgba(232,222,200,0.55)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(8, 0);
      c.stroke();
      c.fillStyle = 'rgba(232,222,200,0.55)';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(s * 9, -1.5, 2.4, 0, Math.PI * 2);
        c.arc(s * 9, 1.5, 2.4, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      break;
    }
    case 'skull':
      drawMiniSkull(c, x, y, 5 + rng.next() * 2, 'rgba(232,222,200,0.5)');
      break;
    case 'candle': {
      const g = c.createRadialGradient(x, y - 8, 1, x, y - 8, 26);
      g.addColorStop(0, rgba(T.light, 0.35));
      g.addColorStop(1, rgba(T.light, 0));
      c.fillStyle = g;
      c.fillRect(x - 26, y - 34, 52, 52);
      c.fillStyle = '#efe6cf';
      c.fillRect(x - 2.5, y - 8, 5, 10);
      c.fillStyle = T.light;
      c.beginPath();
      c.ellipse(x, y - 11, 2, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'flower': {
      // cempasúchil (flor do Dia dos Mortos)
      for (let k = 0; k < 3; k++) {
        const fx = x + (rng.next() - 0.5) * 16, fy = y + (rng.next() - 0.5) * 10;
        c.fillStyle = rng.chance(0.5) ? '#ff9a2e' : '#ffcf3a';
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          c.beginPath();
          c.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = '#b8460b';
        c.beginPath();
        c.arc(fx, fy, 1.6, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'mushroom': {
      c.fillStyle = '#efe6cf';
      c.fillRect(x - 1.5, y - 4, 3, 6);
      c.fillStyle = rng.chance(0.5) ? '#c06bff' : '#ff4d6d';
      c.beginPath();
      c.ellipse(x, y - 5, 6, 4, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.beginPath();
      c.arc(x - 2, y - 6.5, 1, 0, Math.PI * 2);
      c.arc(x + 2.5, y - 6, 0.8, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'crack': {
      c.strokeStyle = rgba(darken(T.floorA, 0.6), 0.6);
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x, y);
      let px = x, py = y;
      for (let k = 0; k < 4; k++) {
        px += (rng.next() - 0.5) * 22;
        py += (rng.next() - 0.3) * 14;
        c.lineTo(px, py);
      }
      c.stroke();
      break;
    }
    case 'ember': {
      c.strokeStyle = rgba(T.accent, 0.7);
      c.lineWidth = 2;
      c.save();
      c.shadowColor = T.accent;
      c.shadowBlur = 8;
      c.beginPath();
      c.moveTo(x - 10, y);
      c.lineTo(x - 2, y + 3);
      c.lineTo(x + 6, y - 2);
      c.lineTo(x + 12, y + 2);
      c.stroke();
      c.restore();
      break;
    }
    case 'snow': {
      c.fillStyle = 'rgba(240,250,255,0.35)';
      c.beginPath();
      c.ellipse(x, y, 14 + rng.next() * 10, 7, rng.next(), 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'rune': {
      c.strokeStyle = rgba(T.accent, 0.35);
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, 12, 0, Math.PI * 2);
      c.moveTo(x - 6, y - 6);
      c.lineTo(x + 6, y + 6);
      c.moveTo(x + 6, y - 6);
      c.lineTo(x, y + 2);
      c.stroke();
      break;
    }
    case 'lily': {
      c.fillStyle = 'rgba(80,140,50,0.65)';
      c.beginPath();
      c.arc(x, y, 7, 0.3, Math.PI * 2 - 0.3);
      c.lineTo(x, y);
      c.fill();
      break;
    }
    case 'neon': {
      c.save();
      c.shadowColor = rng.chance(0.5) ? '#ff2d95' : '#3df2ff';
      c.shadowBlur = 10;
      c.strokeStyle = c.shadowColor;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      break;
    }
    case 'pebble':
    default: {
      c.fillStyle = rgba(lighten(T.floorB, 0.2), 0.4);
      c.beginPath();
      c.ellipse(x, y, 3 + rng.next() * 3, 2 + rng.next() * 2, rng.next(), 0, Math.PI * 2);
      c.fill();
    }
  }
}

// ───────────────────────────── OBSTÁCULOS (3/4) ─────────────────────────────

export interface ObstacleSprite {
  canvas: HTMLCanvasElement;
  /** Deslocamento do canto superior-esquerdo do sprite em relação ao retângulo do obstáculo. */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export function bakeObstacle(type: string, rect: Rect, height: number, theme: MapTheme, res: number, seed: number): ObstacleSprite | null {
  if (type === 'water') return null;
  const T = THEMES[theme] ?? THEMES.crypt;
  const pad = 14;
  const extra = type === 'statue' ? 30 : type === 'crystal' ? 24 : 0;
  const w = rect.w, h = rect.h;
  const W = w + pad * 2, H = h + height + extra + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(W * res);
  canvas.height = Math.ceil(H * res);
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  // Origem local = canto superior-esquerdo da "pegada" (footprint) do obstáculo.
  c.translate(pad, pad + extra + height);
  c.lineJoin = 'round';
  const rng = new Rng(seed);
  const ol = darken(T.wallFront, 0.6);
  // Perspectiva 3/4: topo deslocado para cima por `height`; face frontal liga topo à base.
  const topY = -height, frontY = h - height, baseY = h;

  switch (type) {
    case 'pillar': {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, darken(T.wallFront, 0.15));
      g.addColorStop(0.35, lighten(T.wallFront, 0.25));
      g.addColorStop(1, darken(T.wallFront, 0.45));
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(3, topY + h / 2, w - 6, height + h / 2 - 2, 6);
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      for (let k = 1; k < 4; k++) {
        c.strokeStyle = rgba(darken(T.wallFront, 0.5), 0.5);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(w * (k / 4), topY + h);
        c.lineTo(w * (k / 4), baseY - 4);
        c.stroke();
      }
      c.fillStyle = lighten(T.wallTop, 0.1);
      c.beginPath();
      c.ellipse(w / 2, topY + h / 2, w / 2, h / 2.2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = rgba(T.accent, 0.3);
      c.beginPath();
      c.ellipse(w / 2, topY + h / 2, w / 3.2, h / 3.6, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'fence': {
      c.strokeStyle = '#1e1a26';
      c.lineWidth = 3;
      for (let x = 4; x < w; x += 10) {
        c.beginPath();
        c.moveTo(x, baseY - 2);
        c.lineTo(x, topY + h / 2);
        c.stroke();
        c.fillStyle = '#1e1a26';
        c.beginPath();
        c.moveTo(x - 3, topY + h / 2);
        c.lineTo(x, topY + h / 2 - 7);
        c.lineTo(x + 3, topY + h / 2);
        c.fill();
      }
      c.beginPath();
      c.moveTo(0, topY + h / 2 + 5);
      c.lineTo(w, topY + h / 2 + 5);
      c.moveTo(0, baseY - 6);
      c.lineTo(w, baseY - 6);
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = rgba(T.accent, 0.45);
      c.lineWidth = 1;
      c.stroke();
      break;
    }
    case 'bones': {
      for (let i = 0; i < Math.max(5, (w * h) / 110); i++) {
        const x = 4 + rng.next() * (w - 8), y = -height * 0.6 + rng.next() * (h + height * 0.6);
        c.save();
        c.translate(x, y);
        c.rotate(rng.next() * Math.PI);
        c.fillStyle = '#e8dec8';
        c.strokeStyle = '#5a4a3a';
        c.lineWidth = 1;
        c.beginPath();
        c.roundRect(-9, -2, 18, 4, 2);
        c.fill();
        c.stroke();
        c.restore();
      }
      drawMiniSkull(c, w / 2, h * 0.35, 7, '#efe6cf');
      break;
    }
    case 'tomb': {
      const th = height + h;
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, lighten(T.wallTop, 0.1));
      g.addColorStop(1, darken(T.wallTop, 0.35));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, baseY);
      c.lineTo(0, baseY - th + w / 2);
      c.arc(w / 2, baseY - th + w / 2, w / 2, Math.PI, 0);
      c.lineTo(w, baseY);
      c.closePath();
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      c.strokeStyle = rgba(darken(T.wallTop, 0.6), 0.8);
      c.lineWidth = 3;
      const cx = w / 2, cy = baseY - th * 0.58;
      c.beginPath();
      c.moveTo(cx, cy - 9);
      c.lineTo(cx, cy + 9);
      c.moveTo(cx - 6, cy - 3);
      c.lineTo(cx + 6, cy - 3);
      c.stroke();
      c.fillStyle = 'rgba(90,160,90,0.4)';
      c.beginPath();
      c.ellipse(w / 2, baseY, w / 2 + 4, 5, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'crystal': {
      const cols = [T.accent, lighten(T.accent, 0.4), darken(T.accent, 0.3)];
      const shards: Array<[number, number, number]> = [
        [w * 0.5, topY - extra + 4, w * 0.24],
        [w * 0.24, topY + height * 0.3, w * 0.17],
        [w * 0.76, topY + height * 0.25, w * 0.18],
      ];
      for (let i = 0; i < shards.length; i++) {
        const [sx, sy, sw] = shards[i];
        c.save();
        c.shadowColor = T.accent;
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + sw, sy + sw * 1.4);
        c.lineTo(sx + sw * 0.6, baseY - 4);
        c.lineTo(sx - sw * 0.6, baseY - 4);
        c.lineTo(sx - sw, sy + sw * 1.4);
        c.closePath();
        c.fillStyle = rgba(cols[i], 0.88);
        c.fill();
        c.restore();
        c.strokeStyle = darken(T.accent, 0.5);
        c.lineWidth = 1.8;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(sx, sy + 3);
        c.lineTo(sx - sw * 0.3, baseY - 8);
        c.stroke();
      }
      break;
    }
    case 'statue': {
      const pedTop = baseY - height * 0.5;
      c.fillStyle = T.wallFront;
      c.beginPath();
      c.roundRect(0, pedTop, w, baseY - pedTop, 4);
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = T.wallTop;
      c.beginPath();
      c.roundRect(-2, pedTop - h * 0.5, w + 4, h * 0.5 + 4, 5);
      c.fill();
      c.stroke();
      const sx = w / 2, sy = pedTop - h * 0.25 - w * 0.3;
      const g = c.createRadialGradient(sx - 8, sy - 10, 2, sx, sy, w * 0.45);
      g.addColorStop(0, lighten(T.wallTop, 0.4));
      g.addColorStop(1, darken(T.wallTop, 0.25));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(sx, sy, w * 0.36, w * 0.34, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(15,8,25,0.85)';
      c.beginPath();
      c.ellipse(sx - w * 0.13, sy + 2, w * 0.09, w * 0.1, 0, 0, Math.PI * 2);
      c.ellipse(sx + w * 0.13, sy + 2, w * 0.09, w * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.shadowColor = T.accent;
      c.shadowBlur = 10;
      c.fillStyle = T.accent;
      c.beginPath();
      c.arc(sx - w * 0.13, sy + 3, 2.4, 0, Math.PI * 2);
      c.arc(sx + w * 0.13, sy + 3, 2.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
      break;
    }
    case 'wall':
    default: {
      const fg = c.createLinearGradient(0, frontY, 0, baseY);
      fg.addColorStop(0, T.wallFront);
      fg.addColorStop(1, darken(T.wallFront, 0.35));
      c.fillStyle = fg;
      c.beginPath();
      c.roundRect(0, frontY - 6, w, height + 6, [0, 0, 6, 6]);
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      c.strokeStyle = rgba(darken(T.wallFront, 0.6), 0.55);
      c.lineWidth = 1.2;
      const rows = Math.max(2, Math.round(height / 13));
      for (let r = 1; r <= rows; r++) {
        const y = frontY + (height / rows) * r;
        if (r < rows) {
          c.beginPath();
          c.moveTo(2, y);
          c.lineTo(w - 2, y);
          c.stroke();
        }
        for (let x = (r % 2) * 14 + 12; x < w - 4; x += 28) {
          c.beginPath();
          c.moveTo(x, y - height / rows);
          c.lineTo(x, y);
          c.stroke();
        }
      }
      const tg = c.createLinearGradient(0, topY, 0, frontY);
      tg.addColorStop(0, lighten(T.wallTop, 0.18));
      tg.addColorStop(1, T.wallTop);
      c.fillStyle = tg;
      c.beginPath();
      c.roundRect(0, topY, w, h, 6);
      c.fill();
      c.strokeStyle = ol;
      c.lineWidth = 2.5;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(6, topY + 3);
      c.lineTo(w - 6, topY + 3);
      c.stroke();
      if (theme === 'neon') {
        c.save();
        c.shadowColor = T.accent;
        c.shadowBlur = 12;
        c.strokeStyle = T.accent;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(2, topY + 2, w - 4, h - 4, 5);
        c.stroke();
        c.restore();
      }
      if (theme === 'crypt' || theme === 'swamp' || theme === 'graveyard') {
        for (let i = 0; i < 3; i++) {
          c.fillStyle = 'rgba(90,160,90,0.35)';
          c.beginPath();
          c.ellipse(rng.next() * w, frontY + rng.next() * 5, 6 + rng.next() * 6, 3, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
  }
  return { canvas, ox: -pad, oy: -(pad + extra + height), w: W, h: H };
}

// ───────────────────────────── MATO ─────────────────────────────

export function bakeBrush(rect: Rect, theme: MapTheme, res: number, seed: number): ObstacleSprite {
  const T = THEMES[theme] ?? THEMES.crypt;
  const pad = 16, up = 26;
  const W = rect.w + pad * 2, H = rect.h + pad * 2 + up;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(W * res);
  canvas.height = Math.ceil(H * res);
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  c.translate(pad, pad + up);
  const rng = new Rng(seed);
  const count = Math.round((rect.w * rect.h) / 140);
  const tufts: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) tufts.push([rng.next() * rect.w, rng.next() * rect.h]);
  tufts.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of tufts) {
    const hgt = 18 + rng.next() * 14;
    const col = rng.pick(T.brush);
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(x + k * 3, y + 4);
      c.quadraticCurveTo(x + k * 5, y - hgt * 0.5, x + k * 7 + (rng.next() - 0.5) * 4, y - hgt + Math.abs(k) * 3);
      c.quadraticCurveTo(x + k * 4 + 2, y - hgt * 0.4, x + k * 3 + 4, y + 4);
      c.closePath();
      c.fillStyle = k % 2 ? col : lighten(col, 0.15);
      c.fill();
      c.strokeStyle = rgba(darken(col, 0.55), 0.7);
      c.lineWidth = 1;
      c.stroke();
    }
  }
  // borda superior mais clara (leitura do contorno do mato)
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, -up, 0, rect.h);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  c.fillStyle = g;
  c.fillRect(-pad, -up - pad, W, H);
  return { canvas, ox: -pad, oy: -pad - up, w: W, h: H };
}

// ───────────────────────────── CAIXAS / URNAS / CAIXÕES ─────────────────────────────

export function drawCrate(c: CanvasRenderingContext2D, type: string, x: number, y: number, w: number, h: number, damaged: number, flash: number, accent: string): void {
  const lift = 14;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(x + w / 2 + 4, y + h - 2, w / 2 + 2, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.lineJoin = 'round';
  if (type === 'urn') {
    const cx = x + w / 2, cy = y + h / 2 - lift / 2;
    const g = c.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, w * 0.7);
    g.addColorStop(0, '#e7a46b');
    g.addColorStop(1, '#8a4524');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx - w * 0.22, cy - h * 0.62);
    c.lineTo(cx + w * 0.22, cy - h * 0.62);
    c.quadraticCurveTo(cx + w * 0.62, cy - h * 0.2, cx + w * 0.36, cy + h * 0.5);
    c.lineTo(cx - w * 0.36, cy + h * 0.5);
    c.quadraticCurveTo(cx - w * 0.62, cy - h * 0.2, cx - w * 0.22, cy - h * 0.62);
    c.fill();
    c.strokeStyle = '#3a1a0a';
    c.lineWidth = 2.2;
    c.stroke();
    c.strokeStyle = accent;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - w * 0.45, cy);
    c.lineTo(cx + w * 0.45, cy);
    c.stroke();
    drawMiniSkull(c, cx, cy + h * 0.2, 4.5, '#f3ead8');
  } else if (type === 'coffin') {
    c.fillStyle = '#5a3a22';
    c.beginPath();
    c.moveTo(x + w * 0.3, y - lift);
    c.lineTo(x + w * 0.7, y - lift);
    c.lineTo(x + w, y + h * 0.25 - lift);
    c.lineTo(x + w * 0.8, y + h - lift);
    c.lineTo(x + w * 0.2, y + h - lift);
    c.lineTo(x, y + h * 0.25 - lift);
    c.closePath();
    c.fill();
    c.strokeStyle = '#1e120a';
    c.lineWidth = 2.4;
    c.stroke();
    c.fillStyle = '#3d2614';
    c.fillRect(x + w * 0.2, y + h - lift, w * 0.6, lift);
    c.strokeRect(x + w * 0.2, y + h - lift, w * 0.6, lift);
    c.strokeStyle = accent;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x + w / 2, y + h * 0.15 - lift);
    c.lineTo(x + w / 2, y + h * 0.6 - lift);
    c.moveTo(x + w * 0.35, y + h * 0.3 - lift);
    c.lineTo(x + w * 0.65, y + h * 0.3 - lift);
    c.stroke();
  } else {
    // caixa de madeira
    c.fillStyle = '#7a4f2a';
    c.fillRect(x, y + h - lift - 6, w, lift + 6);
    c.fillStyle = '#9b6a3a';
    c.fillRect(x, y - lift, w, h - 6);
    c.strokeStyle = '#2e1a0c';
    c.lineWidth = 2.4;
    c.strokeRect(x, y - lift, w, h - 6);
    c.strokeRect(x, y + h - lift - 6, w, lift + 6);
    c.strokeStyle = '#5a3818';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x + 4, y - lift + 4);
    c.lineTo(x + w - 4, y + h - lift - 10);
    c.stroke();
    drawMiniSkull(c, x + w / 2, y + h / 2 - lift - 2, 6, accent);
  }
  if (damaged > 0.5) {
    c.strokeStyle = 'rgba(20,10,5,0.8)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x + w * 0.2, y - lift + 4);
    c.lineTo(x + w * 0.45, y + h * 0.3 - lift);
    c.lineTo(x + w * 0.35, y + h * 0.6 - lift);
    c.stroke();
  }
  if (flash > 0) {
    c.globalAlpha = flash * 0.6;
    c.fillStyle = '#fff';
    c.fillRect(x, y - lift, w, h + lift - 2);
  }
  c.restore();
}
