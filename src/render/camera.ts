import { clamp, damp } from '../engine/math';

/** Câmera que segue o jogador, olha um pouco pra onde ele mira e treme nas explosões. */
export class Camera {
  x = 0;
  y = 0;
  /** px de tela (CSS) por px de mundo */
  zoom = 1;
  shake = 0;
  private sx = 0;
  private sy = 0;
  kickX = 0;
  kickY = 0;

  /** Ajusta o zoom pra mostrar ~`worldWidth` px de mundo na largura da tela. */
  fit(cssW: number, cssH: number): void {
    const landscape = cssW >= cssH;
    const target = landscape ? 1180 : 760;
    this.zoom = clamp(cssW / target, 0.45, 1.6);
    // telas muito baixas (celular deitado): garante ~11 blocos de altura
    const minH = 11 * 64;
    if (cssH / this.zoom < minH) this.zoom = Math.max(0.42, cssH / minH);
  }

  follow(tx: number, ty: number, dt: number, snap = false): void {
    if (snap) {
      this.x = tx;
      this.y = ty;
      return;
    }
    this.x = damp(this.x, tx, 7, dt);
    this.y = damp(this.y, ty, 7, dt);
  }

  clampTo(wpx: number, hpx: number, cssW: number, cssH: number): void {
    const hw = cssW / this.zoom / 2;
    const hh = cssH / this.zoom / 2;
    const m = 40;
    this.x = wpx < hw * 2 - m * 2 ? wpx / 2 : clamp(this.x, hw - m, wpx - hw + m);
    this.y = hpx < hh * 2 - m * 2 ? hpx / 2 : clamp(this.y, hh - m - 40, hpx - hh + m);
  }

  addShake(a: number): void {
    this.shake = Math.min(28, this.shake + a);
  }

  kick(dx: number, dy: number): void {
    this.kickX += dx;
    this.kickY += dy;
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 60);
    const s = this.shake;
    this.sx = (Math.random() * 2 - 1) * s * 0.5;
    this.sy = (Math.random() * 2 - 1) * s * 0.5;
    this.kickX *= Math.exp(-14 * dt);
    this.kickY *= Math.exp(-14 * dt);
  }

  /** Centro final (com tremida) */
  get cx(): number {
    return this.x + this.sx + this.kickX;
  }
  get cy(): number {
    return this.y + this.sy + this.kickY;
  }
}
