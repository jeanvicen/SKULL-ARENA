import { clamp } from '../engine/math';

/**
 * Câmera top-down. Segue o jogador com suavização e um leve "olhar à frente"
 * na direção em que ele está virado. Shake por "trauma" (quadrático, decai rápido)
 * — usado com parcimônia.
 */
export class Camera {
  x = 0;
  y = 0;
  /** Pixels CSS por unidade de mundo. */
  zoom = 1;
  /** Retângulo do viewport em px CSS (a arena pode não ocupar a tela toda). */
  vx = 0;
  vy = 0;
  vw = 1;
  vh = 1;
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  private lookX = 0;
  private lookY = 0;
  private t = 0;

  setViewport(x: number, y: number, w: number, h: number, viewWorldW: number, viewWorldHMin: number): void {
    this.vx = x;
    this.vy = y;
    this.vw = w;
    this.vh = h;
    // Mostra pelo menos viewWorldW de largura e viewWorldHMin de altura
    this.zoom = Math.min(w / viewWorldW, h / viewWorldHMin);
  }

  get viewW(): number {
    return this.vw / this.zoom;
  }
  get viewH(): number {
    return this.vh / this.zoom;
  }

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  follow(tx: number, ty: number, facing: number, moving: boolean, mapW: number, mapH: number, dt: number, anchorY = 0.5): void {
    this.t += dt;
    const look = moving ? 55 : 25;
    const lk = 1 - Math.exp(-3 * dt);
    this.lookX += (Math.cos(facing) * look - this.lookX) * lk;
    this.lookY += (Math.sin(facing) * look - this.lookY) * lk;
    // anchorY < 0.5 → jogador um pouco abaixo do centro (mais visão à frente/para cima)
    const gx = tx + this.lookX;
    const gy = ty + this.lookY - (0.5 - anchorY) * this.viewH;
    const k = 1 - Math.exp(-7 * dt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.clampTo(mapW, mapH);
    // shake
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    const s = this.trauma * this.trauma * 14;
    this.shakeX = s * (Math.sin(this.t * 67.3) + Math.sin(this.t * 31.1) * 0.5) / 1.5;
    this.shakeY = s * (Math.cos(this.t * 59.7) + Math.cos(this.t * 27.9) * 0.5) / 1.5;
  }

  clampTo(mapW: number, mapH: number): void {
    const margin = 120; // folga para ver barra de vida/nome de quem está colado na borda
    const hw = this.viewW / 2, hh = this.viewH / 2;
    if (this.viewW >= mapW + margin * 2) this.x = mapW / 2;
    else this.x = clamp(this.x, hw - margin, mapW - hw + margin);
    if (this.viewH >= mapH + margin * 2) this.y = mapH / 2;
    else this.y = clamp(this.y, hh - margin, mapH - hh + margin);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Aplica a transformação de mundo → tela no contexto (em px CSS * dpr). */
  apply(c: CanvasRenderingContext2D, dpr: number): void {
    c.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * (this.vx + this.vw / 2 - (this.x + this.shakeX) * this.zoom), dpr * (this.vy + this.vh / 2 - (this.y + this.shakeY) * this.zoom));
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.vx + this.vw / 2 + (wx - this.x) * this.zoom,
      y: this.vy + this.vh / 2 + (wy - this.y) * this.zoom,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.vx - this.vw / 2) / this.zoom + this.x,
      y: (sy - this.vy - this.vh / 2) / this.zoom + this.y,
    };
  }
}
