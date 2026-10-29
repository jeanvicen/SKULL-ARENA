import { audio } from '../../audio/audio';
import { h } from '../dom';

/**
 * ABERTURA — caveira em pixel art que ri com uma risada "quebrada" (glitch).
 * 1) caveira parada, olhos piscando + "TOQUE PARA COMEÇAR" (o toque libera o som)
 * 2) toque → gargalhada: mandíbula batendo, cabeça tremendo, cortes de glitch RGB
 * 3) chama `onDone`
 */

const W = 64;
const H = 64;
const INK = '#160d22';
const BONE = ['#fff8ea', '#efe6d2', '#d6c6a4', '#a8936c', '#6e5a40'];

function paintSkull(g: CanvasRenderingContext2D, jaw: number, eye: number, t: number): void {
  g.clearRect(0, 0, W, H);
  const px = (x: number, y: number, w: number, hh: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, hh);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const xa = Math.ceil(cx - half - 0.5);
      const xb = Math.floor(cx + half - 0.5);
      if (xb >= xa) g.fillRect(xa, y, xb - xa + 1, 1);
    }
  };
  const cx = 32;
  // ---------------- mandíbula (atrás do crânio, desce quando ri)
  const jy = 40 + jaw;
  px(cx - 13, jy - 1, 26, 12, INK);
  px(cx - 12, jy, 24, 10, BONE[2]!);
  px(cx - 12, jy, 24, 2, BONE[1]!);
  px(cx - 12, jy + 8, 24, 2, BONE[3]!);
  px(cx - 13, jy + 9, 26, 2, INK);
  // dentes de baixo
  for (let i = 0; i < 6; i++) {
    px(cx - 11 + i * 4, jy - 1, 3, 4, BONE[0]!);
    px(cx - 11 + i * 4, jy + 2, 3, 1, BONE[2]!);
  }
  // boca aberta (escuro entre crânio e mandíbula)
  if (jaw > 0) {
    px(cx - 11, 40, 22, jaw, '#0b0612');
    // língua neon
    if (jaw > 3) px(cx - 4, 40 + jaw - 3, 8, 2, '#ff3df2');
  }
  // ---------------- crânio
  ellipse(cx, 24, 21, 20, INK);
  px(cx - 15, 32, 30, 11, INK);
  ellipse(cx, 24, 20, 19, BONE[1]!);
  px(cx - 14, 32, 28, 10, BONE[1]!);
  // luz em cima / sombra embaixo (pixel shading)
  ellipse(cx - 4, 15, 11, 7, BONE[0]!);
  px(cx - 14, 38, 28, 4, BONE[2]!);
  px(cx + 12, 22, 6, 14, BONE[2]!);
  px(cx + 15, 26, 3, 10, BONE[3]!);
  // dentes de cima
  for (let i = 0; i < 6; i++) {
    px(cx - 11 + i * 4, 39, 3, 4, BONE[0]!);
    px(cx - 11 + i * 4 + 2, 39, 1, 4, BONE[2]!);
  }
  px(cx - 12, 43, 24, 1, INK);
  // rachadura na testa
  const crack: Array<[number, number]> = [
    [38, 6],
    [37, 7],
    [37, 8],
    [36, 9],
    [37, 10],
    [38, 11],
    [38, 12],
    [37, 13],
  ];
  for (const [x, y] of crack) px(x, y, 1, 1, BONE[4]!);
  // nariz
  px(cx - 2, 31, 4, 5, '#2a1830');
  px(cx - 1, 30, 2, 1, '#2a1830');
  px(cx - 2, 35, 1, 1, BONE[1]!);
  // órbitas
  for (const side of [-1, 1]) {
    const ex = cx + side * 9;
    ellipse(ex, 25, 6.5, 6, INK);
    ellipse(ex, 25.5, 5.5, 5, '#1a0d24');
    // brilho dos olhos (neon pulsando)
    const col = side < 0 ? '#ff3df2' : '#3df2ff';
    const r = 1.5 + eye * 1.2;
    ellipse(ex, 26, r + 1.2, r + 1, col + '55');
    ellipse(ex, 26, r, r, col);
    px(Math.round(ex - 1), 25, 1, 1, '#ffffff');
  }
  // sobrancelha "de risada" (órbita apertada quando ri)
  if (jaw > 2) {
    px(cx - 16, 18, 10, 2, BONE[2]!);
    px(cx + 6, 18, 10, 2, BONE[2]!);
  }
  void t;
}

export function splashScreen(onDone: () => void): { el: HTMLElement; dispose: () => void } {
  const low = document.createElement('canvas');
  low.width = W;
  low.height = H;
  const lg = low.getContext('2d')!;
  const tint = document.createElement('canvas');
  tint.width = W;
  tint.height = H;
  const tg = tint.getContext('2d')!;
  const canvas = h<'canvas'>('canvas.splash-skull');
  const title = h('h1.glitch-title', { 'data-text': 'SKULL ARENA' }, 'SKULL ARENA');
  const tap = h('div.tap-start.blink', null, 'TOQUE PARA COMEÇAR');
  const el = h('div.screen.splash', null, h('div.splash-noise'), canvas, title, tap, h('div.splash-ver', null, `v${__APP_VERSION__}`));
  let raf = 0;
  let t0 = performance.now();
  let laughing = false;
  let laughT = 0;
  let done = false;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.add('out');
    setTimeout(onDone, 380);
  };

  const start = () => {
    audio.unlock();
    if (laughing) {
      if (laughT > 0.6) finish();
      return;
    }
    laughing = true;
    laughT = 0;
    tap.textContent = '';
    title.classList.add('glitching');
    audio.play('skull_laugh');
    setTimeout(() => {
      done = true;
    }, 2700);
  };
  el.addEventListener('pointerdown', start);
  const onKey = () => start();
  window.addEventListener('keydown', onKey);

  const draw = (now: number) => {
    const t = (now - t0) / 1000;
    let jaw = 0;
    let shakeX = 0;
    let shakeY = 0;
    let glitch = Math.random() < 0.02 ? 0.4 : 0;
    if (laughing) {
      laughT += 1 / 60;
      // "HA-HA-HA" em rajadas, com travadas (risada quebrada)
      const burst = Math.floor(laughT * 2.2);
      const stutter = burst % 3 === 2 && laughT % 0.45 < 0.15;
      const phase = stutter ? 0 : Math.abs(Math.sin(laughT * 26));
      jaw = Math.round(phase * 7);
      shakeX = Math.round((Math.random() - 0.5) * 2);
      shakeY = Math.round(-phase * 2);
      glitch = stutter || Math.random() < 0.25 ? 1 : 0.3;
      if (done) finish();
    } else jaw = Math.sin(t * 2) > 0.97 ? 1 : 0;
    const eye = laughing ? 0.6 + Math.random() * 0.6 : 0.5 + Math.sin(t * 3) * 0.3;
    paintSkull(lg, jaw, eye, t);

    // escala inteira pra tela
    const css = Math.min(el.clientWidth * 0.32, el.clientHeight * 0.52);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const S = Math.max(2, Math.floor((css * dpr) / W));
    if (canvas.width !== W * S) {
      canvas.width = W * S;
      canvas.height = H * S;
    }
    canvas.style.width = `${(W * S) / dpr}px`;
    canvas.style.height = `${(H * S) / dpr}px`;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const bob = laughing ? 0 : Math.round(Math.sin(t * 1.6) * 1);
    const ox = shakeX * S;
    const oy = (shakeY + bob) * S;
    if (glitch > 0.5) {
      // separação RGB: cópia ciano pra esquerda, magenta pra direita
      for (const [col, dx] of [
        ['#3df2ff', -2],
        ['#ff3df2', 2],
      ] as const) {
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, W, H);
        tg.drawImage(low, 0, 0);
        tg.globalCompositeOperation = 'source-in';
        tg.fillStyle = col;
        tg.fillRect(0, 0, W, H);
        g.globalAlpha = 0.75;
        g.drawImage(tint, ox + dx * S, oy, W * S, H * S);
      }
      g.globalAlpha = 1;
    }
    g.drawImage(low, ox, oy, W * S, H * S);
    if (glitch > 0) {
      // fatias deslocadas
      const n = glitch > 0.5 ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const sy = Math.floor(Math.random() * H);
        const sh = 1 + Math.floor(Math.random() * 5);
        const dx = Math.round((Math.random() - 0.5) * 10);
        g.drawImage(low, 0, sy, W, sh, ox + dx * S, oy + sy * S, W * S, sh * S);
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,61,242,0.35)' : 'rgba(61,242,255,0.35)';
        g.fillRect(ox + dx * S, oy + sy * S, W * S, sh * S);
      }
    }
    // linhas de TV
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < canvas.height; y += S * 2) g.fillRect(0, y, canvas.width, Math.max(1, S >> 1));
    el.style.setProperty('--glitch', String(glitch));
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return {
    el,
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      t0 = 0;
    },
  };
}
