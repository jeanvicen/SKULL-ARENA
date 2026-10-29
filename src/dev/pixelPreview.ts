import { allCharacters, getCharacter } from '../content/characters';
import { CharSprite, ORIGIN_X, ORIGIN_Y } from '../pixel/sprite';
import type { BaseState } from '../pixel/animator';

// Página de testes (só em dev): /dev/pixel.html?ids=kaze,marreta&s=4&state=run&aim=1
const params = new URLSearchParams(location.search);
const scale = Number(params.get('s') ?? 4);
const state = (params.get('state') ?? 'idle') as BaseState;
const ids = params.get('ids')?.split(',') ?? ['kaze', 'marreta', 'djkiko', 'vicen_creator', 'pixa', 'ossinho', 'nyx', 'barao_ossudo'];
const gen = Number(params.get('gen') ?? 0);
const defs = gen
  ? allCharacters()
      .filter((c) => !c.handmade)
      .slice(gen - 1, gen - 1 + 10)
  : ids.map((i) => getCharacter(i));
const sprites = defs.map((d) => {
  const s = new CharSprite(d);
  s.setState(state);
  return s;
});
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
cv.width = innerWidth;
cv.height = innerHeight;
ctx.imageSmoothingEnabled = false;
let last = performance.now();
const aim = params.get('aim');
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.fillStyle = '#3b3a46';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const cols = Math.min(sprites.length, Math.floor(cv.width / (40 * scale)) || 1);
  sprites.forEach((s, i) => {
    if (aim) s.anim.lookAt(aim === 'up' ? 0.3 : 1, aim === 'up' ? -1 : 0.2, true);
    s.update(dt);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = Math.round((col + 0.5) * (cv.width / cols));
    const y = Math.round(80 * scale + row * 90 * scale);
    const f = s.frame();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s.facing * scale, scale);
    ctx.drawImage(f as CanvasImageSource, -ORIGIN_X, -ORIGIN_Y);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.def.name, x, y + 14);
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?pets=1 → mostra uma grade de pets embaixo
if (params.get('pets')) {
  import('../content/pets').then(({ allPets, HANDMADE_PETS }) => {
    import('../pixel/pets').then(({ petFrame }) => {
      const list = [
        ...HANDMADE_PETS,
        ...allPets()
          .filter((p) => !p.handmade)
          .slice(0, 20),
      ];
      let t = 0;
      const draw = () => {
        t += 1 / 60;
        const ps = 3;
        list.forEach((p, i) => {
          const x = 20 + (i % 16) * 34 * ps * 0.8;
          const y = cv.height - 220 + Math.floor(i / 16) * 36 * ps;
          ctx.fillStyle = '#2b2a36';
          ctx.fillRect(x, y, 32 * ps, 32 * ps);
          ctx.drawImage(petFrame(p, t + i * 0.1) as CanvasImageSource, x, y, 32 * ps, 32 * ps);
        });
        requestAnimationFrame(draw);
      };
      draw();
    });
  });
}
