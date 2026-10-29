import type { AnimStyle, Look } from '../content/types';
import { Animator } from '../art/animator';
import { CharacterSprite } from '../art/sprite';
import type { Mat } from '../art/rig';

const looks: Array<{ look: Look; anim: AnimStyle; state?: 'idle' | 'run' | 'victory' }> = [
  {
    look: { species: 'human', skin: '#f1d2bf', body: 'slim', hair: { style: 'messy', color: '#15121c' }, eyes: { style: 'sleepy', color: '#5a4a6e' }, brows: 'flat', mouth: 'neutral', top: { style: 'hoodie', color: '#1a1820', color2: '#d9d9e3', print: 'skull' }, pants: { style: 'wide_jeans', color: '#3e6a8a' }, shoes: { style: 'hightop', color: '#16141c', sole: '#f6f4ee', accent: '#16141c' }, weapon: { kind: 'dual_pistols', color: '#2b2d38', color2: '#7a7f8f' } },
    anim: { idle: 'chill', run: 'normal', attack: 'dual', victory: 'point' },
  },
  {
    look: { species: 'human', skin: '#e9c3a6', body: 'normal', hair: { style: 'messy', color: '#121016' }, eyes: { style: 'sharp', color: '#2b2b30' }, top: { style: 'turtleneck_jacket', color: '#9a9aa2', print: 'text', text: 'SKULL' }, pants: { style: 'cargo', color: '#2a2a30' }, shoes: { style: 'chunky', color: '#16141c', sole: '#f6f4ee', accent: '#f6f4ee' }, acc: { backpack: '#3a3a42', chain: '#c9ccd6' }, weapon: { kind: 'bat', color: '#c9a274', color2: '#1a1a1f' } },
    anim: { idle: 'stoic', run: 'normal', attack: 'swing', victory: 'flex' },
  },
  {
    look: { species: 'human', skin: '#f3d9c9', body: 'slim', hair: { style: 'messy', color: '#0e0c12' }, eyes: { style: 'sleepy', color: '#3d3550' }, top: { style: 'hoodie', color: '#121016', hood: 'up' }, pants: { style: 'baggy', color: '#141218' }, shoes: { style: 'chunky', color: '#f2f2f2', sole: '#f6f4ee', accent: '#141218' }, weapon: { kind: 'katana', color: '#dfe6f2', color2: '#1d1b26' } },
    anim: { idle: 'stoic', run: 'sprint', attack: 'swing', victory: 'bow' },
  },
  {
    look: { species: 'human', skin: '#8a5a3c', body: 'normal', hair: { style: 'curly', color: '#16100c' }, eyes: { style: 'sleepy', color: '#2a1a12' }, mouth: 'smirk', top: { style: 'ribbed_tee', color: '#17161c' }, pants: { style: 'baggy', color: '#6e6e74' }, shoes: { style: 'chunky', color: '#f7f7f7', sole: '#f7f7f7', accent: '#e2e2e2' }, acc: { glasses: 'rect', earbuds: true, watch: true }, weapon: { kind: 'boombox', color: '#2b2a33', color2: '#58ffd0' } },
    anim: { idle: 'cocky', run: 'skip', attack: 'boombox', victory: 'peace' },
  },
  {
    look: { species: 'skeleton', skin: '#efe6d2', body: 'broad', hair: { style: 'none', color: '#000' }, eyes: { style: 'glow', color: '#ff3df2' }, top: { style: 'hoodie', color: '#14101c', color2: '#ffd23f', print: 'text', text: '₹' }, pants: { style: 'baggy', color: '#1c1428' }, shoes: { style: 'chunky', color: '#1a1622', sole: '#ffd23f', accent: '#ff3df2' }, acc: { hat: 'crown', chain: '#ffd23f' }, weapon: { kind: 'orb', color: '#ff3df2', color2: '#3df2ff' }, aura: { kind: 'void', color: '#ff3df2', color2: '#3df2ff' } },
    anim: { idle: 'float', run: 'glide', attack: 'cast', victory: 'laugh' },
  },
  {
    look: { species: 'robot', skin: '#a3aec0', body: 'heavy', hair: { style: 'none', color: '#000' }, eyes: { style: 'visor', color: '#58ffd0' }, top: { style: 'puffer', color: '#ff7a2e' }, pants: { style: 'cargo', color: '#3a3f4d' }, shoes: { style: 'boots', color: '#2a2d36' }, acc: { hat: 'antenna', hatColor: '#58ffd0' }, weapon: { kind: 'hammer', color: '#5d6678', color2: '#8a5a3c' } },
    anim: { idle: 'heavy', run: 'stomp', attack: 'heavy_swing', victory: 'flex' },
  },
];

const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const dpr = Math.min(2, window.devicePixelRatio || 1);
const W = innerWidth;
const H = innerHeight;
cv.width = W * dpr;
cv.height = H * dpr;
cv.style.width = W + 'px';
cv.style.height = H + 'px';
const params = new URLSearchParams(location.search);
const scale = Number(params.get('s') ?? 2.2);
const state = (params.get('state') ?? 'idle') as 'idle' | 'run' | 'victory';
const items = looks.map((l) => {
  const anim = new Animator(l.anim);
  anim.setState(state);
  return { sprite: new CharacterSprite(l.look, scale * dpr), anim };
});
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#2a1d4a');
  g.addColorStop(1, '#120c22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  items.forEach((it, i) => {
    const x = (W / items.length) * (i + 0.5);
    const y = H * 0.8;
    it.anim.lookAt(params.get('aim') === 'up' ? 0.3 : 1, params.get('aim') === 'up' ? -1 : 0.1, params.has('aim'));
    it.anim.update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x * dpr, y * dpr, 22 * scale * dpr * 0.5, 7 * scale * dpr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const base: Mat = [scale * dpr * it.anim.facing, 0, 0, scale * dpr, x * dpr, y * dpr];
    it.sprite.draw(ctx, it.anim.pose, it.anim.solved, { base, view: it.anim.view });
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
