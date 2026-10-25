/**
 * Game loop com passo fixo (60 Hz) + renderização interpolada.
 * - Simulação estável e previsível independente do FPS do aparelho.
 * - `hitstop(ms)` congela a simulação por alguns ms (game feel) sem parar o render.
 * - pause/resume tratam app em background / ligação.
 */
export interface LoopCallbacks {
  update(dt: number): void;
  render(alpha: number, frameDt: number): void;
}

export interface LoopStats {
  fps: number;
  frameMs: number;
  updateMs: number;
  renderMs: number;
}

export class GameLoop {
  readonly step = 1 / 60;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private paused = false;
  private hitstopLeft = 0;
  timeScale = 1;
  readonly stats: LoopStats = { fps: 60, frameMs: 16.7, updateMs: 0, renderMs: 0 };
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    this.acc = 0;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  hitstop(ms: number): void {
    this.hitstopLeft = Math.max(this.hitstopLeft, ms / 1000);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25; // evita "espiral da morte" após travadas/aba em background

    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.stats.frameMs = (this.fpsAcc / this.fpsFrames) * 1000;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    const t0 = performance.now();
    if (!this.paused) {
      if (this.hitstopLeft > 0) {
        this.hitstopLeft -= dt;
      } else {
        this.acc += dt * this.timeScale;
        let steps = 0;
        while (this.acc >= this.step && steps < 5) {
          this.cb.update(this.step);
          this.acc -= this.step;
          steps++;
        }
        if (steps === 5) this.acc = 0;
      }
    }
    const t1 = performance.now();
    this.cb.render(this.paused ? 1 : this.acc / this.step, dt);
    const t2 = performance.now();
    this.stats.updateMs = this.stats.updateMs * 0.9 + (t1 - t0) * 0.1;
    this.stats.renderMs = this.stats.renderMs * 0.9 + (t2 - t1) * 0.1;
  };
}
