import type { CharacterDef, SkinDef } from '../content/types';
import { rgba } from '../render/art/color';
import { bakeCharacter, resolveLook, type CharacterSprites } from '../render/art/skull';

/**
 * Vitrine animada de um personagem (menu, seleção, resultados): mesmo sprite
 * procedural do jogo, em tamanho grande, com idle, pose de ataque e aura.
 */
export class Showcase {
  private sprites: CharacterSprites | null = null;
  private raf = 0;
  private t = 0;
  private last = 0;
  private poseT = 0;
  private running = false;
  facing = 0.35;
  /** 'pedestal' (menu) | 'card' (sem pedestal) | 'victory' (pulos). */
  mode: 'pedestal' | 'card' | 'victory' | 'defeat' = 'pedestal';
  rarityColor = '#9d5cff';
  private ro: ResizeObserver;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(canvas);
  }

  set(def: CharacterDef, skin: SkinDef | null, rarityColor: string): void {
    this.sprites = bakeCharacter(resolveLook(def, skin), 6);
    this.rarityColor = rarityColor;
    this.poseT = 1;
  }

  poke(): void {
    this.poseT = 1;
  }

  private fit(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.fit();
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.poseT = Math.max(0, this.poseT - dt * 1.6);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  private draw(): void {
    const c = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const s = this.sprites;
    if (!s) return;
    const L = s.look;
    const scale = Math.min(W / 120, H / (this.mode === 'card' ? 118 : 150)) * (L.scale > 1.05 ? 0.95 : 1);
    const baseY = this.mode === 'card' ? H * 0.93 : H * 0.84;
    const t = this.t;
    c.save();
    c.translate(W / 2, baseY);

    // brilho de fundo
    const g = c.createRadialGradient(0, -60 * scale, 4, 0, -60 * scale, Math.min(95 * scale, Math.min(W, H) * 0.55));
    g.addColorStop(0, rgba(this.rarityColor, 0.55));
    g.addColorStop(1, rgba(this.rarityColor, 0));
    c.fillStyle = g;
    c.fillRect(-W, -H, W * 2, H * 2);

    if (this.mode === 'pedestal' || this.mode === 'victory' || this.mode === 'defeat') {
      // raios girando (desbotam até a borda — nada de retângulo visível)
      c.save();
      c.globalCompositeOperation = 'lighter';
      const R = Math.min(W, H) * 0.62;
      for (let i = 0; i < 10; i++) {
        const a = t * 0.25 + (i / 10) * Math.PI * 2;
        const rg = c.createRadialGradient(0, -55 * scale, 0, 0, -55 * scale, R);
        rg.addColorStop(0, rgba(this.rarityColor, 0.1));
        rg.addColorStop(1, rgba(this.rarityColor, 0));
        c.fillStyle = rg;
        c.beginPath();
        c.moveTo(0, -55 * scale);
        c.arc(0, -55 * scale, R, a, a + 0.18);
        c.fill();
      }
      c.restore();
      // pedestal
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(0, 4 * scale, 44 * scale, 13 * scale, 0, 0, Math.PI * 2);
      c.fill();
      const pg = c.createLinearGradient(0, -6 * scale, 0, 14 * scale);
      pg.addColorStop(0, '#5a3aa0');
      pg.addColorStop(1, '#22104a');
      c.fillStyle = pg;
      c.beginPath();
      c.ellipse(0, 6 * scale, 40 * scale, 11 * scale, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7a52cc';
      c.beginPath();
      c.ellipse(0, 0, 40 * scale, 11 * scale, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = rgba(this.rarityColor, 0.9);
      c.lineWidth = 2 * scale;
      c.stroke();
    } else {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(0, 0, 30 * scale, 8 * scale, 0, 0, Math.PI * 2);
      c.fill();
    }

    c.scale(scale * 1.2, scale * 1.2);
    let jump = 0;
    if (this.mode === 'victory') jump = Math.abs(Math.sin(t * 4)) * 10;
    const bob = Math.sin(t * 2.4) * 1.6 + jump;
    const pose = this.poseT;
    const facing = this.mode === 'defeat' ? Math.PI * 0.5 : this.facing + Math.sin(t * 0.7) * 0.2;
    const sq = Math.sin(t * 2.4) * 0.02;
    c.translate(0, -bob);
    if (this.mode === 'defeat') c.rotate(Math.sin(t * 1.5) * 0.05);

    // aura
    if (L.aura && L.aura !== 'none') {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const ag = c.createRadialGradient(0, -30, 4, 0, -30, 60);
      ag.addColorStop(0, rgba(L.accent, 0.35));
      ag.addColorStop(1, rgba(L.accent, 0));
      c.fillStyle = ag;
      c.beginPath();
      c.arc(0, -30, 60, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // pés
    c.fillStyle = '#1a0f24';
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(sx * 7, -1, 5.2, 3.4, 0, 0, Math.PI * 2);
      c.fill();
    }
    const hx = Math.cos(facing) * 12, hy = -18 + Math.sin(facing) * 6;
    const back = false;
    const drawWeapon = () => {
      c.save();
      c.translate(hx, hy);
      const a = facing - pose * 0.9 + (pose > 0.5 ? 0 : pose * 1.2);
      c.rotate(a);
      const w = s.weapon;
      c.drawImage(w.canvas, -w.ax + pose * 6, -w.ay, w.w, w.h);
      c.restore();
    };
    if (back) drawWeapon();
    c.save();
    c.scale(1 + sq, 1 - sq);
    c.drawImage(s.body.canvas, -s.body.ax, -s.body.ay, s.body.w, s.body.h);
    c.restore();
    drawWeapon();
    c.save();
    c.translate(0, Math.sin(t * 2.4 + 0.6) * 1.2 - 30);
    const hp = 1 + pose * 0.08;
    c.scale(hp, hp);
    c.translate(0, 30);
    c.drawImage(s.head.canvas, -s.head.ax, -s.head.ay, s.head.w, s.head.h);
    c.restore();
    c.restore();
  }
}
