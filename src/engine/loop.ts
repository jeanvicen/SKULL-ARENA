/**
 * Loop de passo fixo: a simulação anda em passos de `step` segundos (60 Hz),
 * a renderização acontece a cada frame com `alpha` (0..1) pra interpolar.
 */
export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  /** Multiplicador de tempo (câmera lenta no fim da partida etc.). */
  timeScale = 1;

  constructor(
    private readonly step: number,
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      let frame = (now - this.last) / 1000;
      this.last = now;
      if (frame > 0.25) frame = 0.25; // aba voltou do background: não tenta compensar tudo
      this.acc += frame * this.timeScale;
      let steps = 0;
      while (this.acc >= this.step && steps < 8) {
        this.update(this.step);
        this.acc -= this.step;
        steps++;
      }
      if (steps >= 8) this.acc = 0;
      this.render(this.acc / this.step, frame);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
