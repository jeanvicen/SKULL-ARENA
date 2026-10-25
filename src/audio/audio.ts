/**
 * Áudio 100% sintetizado (WebAudio) — sem arquivos, funciona offline e pesa zero.
 * Cada nome de som usado nos JSONs (sfx.fire, sfx.hit, ability.sfx) mapeia para
 * uma "receita". Arquivos finais de áudio podem substituir as receitas depois
 * (slot: voiceLines.audio / sfx → url) sem tocar no motor.
 */
type Recipe = (a: AudioEngine, t: number, v: number) => void;

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private voices = 0;
  sfxVolume = 0.8;
  musicVolume = 0.45;
  muted = false;
  private music: MusicPlayer | null = null;

  /** Precisa ser chamado num gesto do usuário (política de autoplay). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(comp);
      this.musicBus.connect(comp);
      comp.connect(this.master);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfxBus.gain.value = this.sfxVolume;
    this.musicBus.gain.value = this.musicVolume * 0.6;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  play(name: string, volume = 1, minGap = 0.03): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < minGap) return;
    if (this.voices > 24) return;
    this.last.set(name, now);
    const r = RECIPES[name] ?? RECIPES.default;
    r(this, now, volume);
  }

  // ───────── primitivas ─────────
  tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.voices++;
    o.onended = () => this.voices--;
  }

  noise(t: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, freqTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    this.voices++;
    src.onended = () => this.voices--;
  }

  // ───────── música ─────────
  playMusic(track: 'menu' | 'battle' | 'none'): void {
    if (!this.ctx) return;
    if (this.music && this.music.track === track) return;
    this.music?.stop();
    this.music = track === 'none' ? null : new MusicPlayer(this.ctx, this.musicBus, track);
  }

  get musicOut(): GainNode | null {
    return this.ctx ? this.musicBus : null;
  }
}

const RECIPES: Record<string, Recipe> = {
  default: (a, t, v) => a.tone(t, 440, 0.08, 'triangle', 0.15 * v, 220),
  // ── tiros ──
  throw: (a, t, v) => { a.noise(t, 0.09, 0.25 * v, 'bandpass', 1800, 2, 600); a.tone(t, 300, 0.08, 'triangle', 0.12 * v, 160); },
  throw_fast: (a, t, v) => a.noise(t, 0.07, 0.25 * v, 'highpass', 2500, 1, 5000),
  gunshot: (a, t, v) => { a.noise(t, 0.08, 0.4 * v, 'lowpass', 3000, 1, 400); a.tone(t, 180, 0.06, 'square', 0.12 * v, 60); },
  shotgun: (a, t, v) => { a.noise(t, 0.2, 0.5 * v, 'lowpass', 2400, 1, 200); a.tone(t, 110, 0.15, 'square', 0.18 * v, 40); },
  lob: (a, t, v) => a.tone(t, 260, 0.22, 'sine', 0.18 * v, 520),
  note: (a, t, v) => { const n = [523, 587, 659, 784][Math.floor(Math.random() * 4)]; a.tone(t, n, 0.18, 'triangle', 0.16 * v); a.tone(t, n * 2, 0.1, 'sine', 0.05 * v); },
  bow: (a, t, v) => { a.tone(t, 900, 0.05, 'triangle', 0.1 * v, 300); a.noise(t, 0.12, 0.18 * v, 'bandpass', 3000, 3, 1200); },
  swing: (a, t, v) => a.noise(t, 0.16, 0.28 * v, 'bandpass', 600, 1.5, 2400),
  swing_heavy: (a, t, v) => { a.noise(t, 0.22, 0.35 * v, 'bandpass', 300, 1.2, 1400); a.tone(t, 90, 0.18, 'sine', 0.2 * v, 50); },
  slash: (a, t, v) => { a.noise(t, 0.14, 0.32 * v, 'highpass', 1500, 1, 6000); a.tone(t, 1200, 0.08, 'sawtooth', 0.04 * v, 400); },
  boing: (a, t, v) => a.tone(t, 180, 0.2, 'square', 0.1 * v, 520),
  wisp: (a, t, v) => { a.tone(t, 660, 0.25, 'sine', 0.1 * v, 990); a.tone(t + 0.03, 990, 0.2, 'sine', 0.06 * v, 1320); },
  magic: (a, t, v) => a.tone(t, 500, 0.2, 'sawtooth', 0.07 * v, 1500),
  ice: (a, t, v) => { a.tone(t, 1800, 0.12, 'sine', 0.08 * v, 2600); a.noise(t, 0.1, 0.12 * v, 'highpass', 5000); },
  sun: (a, t, v) => { a.tone(t, 330, 0.25, 'sawtooth', 0.06 * v, 660); a.tone(t, 495, 0.25, 'sine', 0.08 * v, 990); },
  zap: (a, t, v) => { a.tone(t, 1400, 0.12, 'square', 0.07 * v, 200); a.noise(t, 0.08, 0.12 * v, 'highpass', 4000); },
  whoosh: (a, t, v) => a.noise(t, 0.3, 0.2 * v, 'bandpass', 400, 2, 2000),
  pet_shot: (a, t, v) => a.tone(t, 1200, 0.06, 'triangle', 0.06 * v, 1800),
  // ── acertos ──
  bone_hit: (a, t, v) => { a.tone(t, 420, 0.07, 'square', 0.1 * v, 180); a.noise(t, 0.06, 0.2 * v, 'bandpass', 1400, 3); },
  punch: (a, t, v) => { a.tone(t, 140, 0.12, 'sine', 0.35 * v, 50); a.noise(t, 0.08, 0.3 * v, 'lowpass', 1200); },
  bullet_hit: (a, t, v) => a.noise(t, 0.05, 0.22 * v, 'bandpass', 2500, 2),
  splash: (a, t, v) => a.noise(t, 0.3, 0.3 * v, 'lowpass', 1800, 1, 300),
  note_hit: (a, t, v) => a.tone(t, 880, 0.1, 'triangle', 0.1 * v, 1320),
  arrow_hit: (a, t, v) => { a.noise(t, 0.05, 0.25 * v, 'bandpass', 2000, 4); a.tone(t, 300, 0.06, 'square', 0.08 * v, 120); },
  slash_hit: (a, t, v) => { a.noise(t, 0.09, 0.3 * v, 'highpass', 2000); a.tone(t, 220, 0.08, 'sawtooth', 0.08 * v, 90); },
  magic_hit: (a, t, v) => { a.tone(t, 700, 0.14, 'sine', 0.12 * v, 350); a.noise(t, 0.08, 0.12 * v, 'bandpass', 3000, 2); },
  explosion: (a, t, v) => { a.noise(t, 0.6, 0.6 * v, 'lowpass', 1600, 0.8, 80); a.tone(t, 90, 0.4, 'sine', 0.4 * v, 30); },
  ice_hit: (a, t, v) => { a.tone(t, 2400, 0.08, 'triangle', 0.08 * v, 1200); a.noise(t, 0.12, 0.2 * v, 'highpass', 3000); },
  zap_hit: (a, t, v) => a.noise(t, 0.1, 0.25 * v, 'bandpass', 4000, 6, 1000),
  pet_hit: (a, t, v) => a.tone(t, 1600, 0.05, 'sine', 0.05 * v),
  // ── especiais ──
  orbit: (a, t, v) => { for (let i = 0; i < 4; i++) a.noise(t + i * 0.06, 0.12, 0.15 * v, 'bandpass', 800 + i * 300, 3); },
  quake: (a, t, v) => { a.tone(t, 70, 0.6, 'sawtooth', 0.25 * v, 35); a.noise(t, 0.6, 0.35 * v, 'lowpass', 400, 1, 60); },
  dash: (a, t, v) => a.noise(t, 0.25, 0.3 * v, 'bandpass', 300, 1.5, 3000),
  splash_big: (a, t, v) => { a.noise(t, 0.5, 0.4 * v, 'lowpass', 2000, 1, 200); a.tone(t, 160, 0.4, 'sine', 0.2 * v, 60); },
  heal: (a, t, v) => [523, 659, 784, 1046].forEach((f, i) => a.tone(t + i * 0.07, f, 0.35, 'triangle', 0.1 * v)),
  mark: (a, t, v) => { a.tone(t, 1200, 0.3, 'sine', 0.12 * v, 600); a.tone(t + 0.1, 1800, 0.2, 'sine', 0.06 * v); },
  dig: (a, t, v) => { for (let i = 0; i < 3; i++) a.noise(t + i * 0.08, 0.1, 0.25 * v, 'lowpass', 900, 1); },
  powerup: (a, t, v) => [330, 440, 554, 660, 880].forEach((f, i) => a.tone(t + i * 0.05, f, 0.15, 'square', 0.06 * v)),
  teleport: (a, t, v) => { a.tone(t, 200, 0.25, 'sine', 0.15 * v, 1600); a.noise(t + 0.15, 0.2, 0.2 * v, 'highpass', 2000); },
  fuse: (a, t, v) => { a.noise(t, 0.6, 0.12 * v, 'highpass', 5000); a.tone(t + 0.55, 80, 0.5, 'sine', 0.4 * v, 30); a.noise(t + 0.55, 0.7, 0.55 * v, 'lowpass', 1400, 0.8, 60); },
  summon: (a, t, v) => { a.tone(t, 110, 0.6, 'sawtooth', 0.12 * v, 220); a.tone(t + 0.1, 165, 0.5, 'sawtooth', 0.08 * v, 330); },
  freeze: (a, t, v) => { a.noise(t, 0.5, 0.3 * v, 'highpass', 3000, 1, 9000); a.tone(t, 2000, 0.4, 'sine', 0.08 * v, 3000); },
  shield: (a, t, v) => { a.tone(t, 300, 0.4, 'triangle', 0.15 * v, 600); a.tone(t, 450, 0.4, 'sine', 0.1 * v, 900); },
  beam: (a, t, v) => { a.tone(t, 220, 1.8, 'sawtooth', 0.08 * v, 240); a.tone(t, 440, 1.8, 'sine', 0.06 * v, 470); },
  transform: (a, t, v) => [196, 247, 294, 392, 494, 587].forEach((f, i) => a.tone(t + i * 0.06, f, 0.3, 'square', 0.07 * v)),
  // ── jogo / UI ──
  click: (a, t, v) => a.tone(t, 900, 0.05, 'triangle', 0.12 * v, 1300),
  back: (a, t, v) => a.tone(t, 700, 0.06, 'triangle', 0.1 * v, 400),
  open: (a, t, v) => { a.tone(t, 500, 0.1, 'sine', 0.1 * v, 900); a.noise(t, 0.12, 0.08 * v, 'bandpass', 2000, 2); },
  coin: (a, t, v) => { a.tone(t, 1320, 0.06, 'square', 0.06 * v); a.tone(t + 0.06, 1760, 0.12, 'square', 0.06 * v); },
  reward: (a, t, v) => [784, 988, 1175, 1568].forEach((f, i) => a.tone(t + i * 0.08, f, 0.25, 'triangle', 0.1 * v)),
  level_up: (a, t, v) => [523, 659, 784, 1046, 1318].forEach((f, i) => a.tone(t + i * 0.09, f, 0.4, 'square', 0.07 * v)),
  chest_shake: (a, t, v) => { a.noise(t, 0.12, 0.2 * v, 'bandpass', 500, 2); a.tone(t, 120, 0.1, 'square', 0.06 * v, 90); },
  chest_open: (a, t, v) => { a.noise(t, 0.5, 0.35 * v, 'lowpass', 3000, 1, 300); [392, 523, 659, 784].forEach((f, i) => a.tone(t + 0.1 + i * 0.06, f, 0.4, 'triangle', 0.1 * v)); },
  legendary: (a, t, v) => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { a.tone(t + i * 0.1, f, 0.6, 'sawtooth', 0.05 * v); a.tone(t + i * 0.1, f / 2, 0.6, 'sine', 0.08 * v); }); },
  countdown: (a, t, v) => a.tone(t, 660, 0.15, 'square', 0.12 * v),
  fight: (a, t, v) => { a.tone(t, 880, 0.35, 'square', 0.14 * v); a.tone(t, 440, 0.35, 'sawtooth', 0.1 * v); a.noise(t, 0.3, 0.2 * v, 'highpass', 3000); },
  victory: (a, t, v) => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => a.tone(t + i * 0.12, f, 0.35, 'square', 0.08 * v)),
  defeat: (a, t, v) => [392, 370, 349, 262].forEach((f, i) => a.tone(t + i * 0.22, f, 0.4, 'triangle', 0.12 * v)),
  death: (a, t, v) => { a.noise(t, 0.4, 0.35 * v, 'bandpass', 1200, 2, 200); a.tone(t, 300, 0.4, 'square', 0.1 * v, 60); },
  kill: (a, t, v) => { a.tone(t, 1046, 0.12, 'square', 0.1 * v); a.tone(t + 0.08, 1568, 0.2, 'square', 0.1 * v); },
  special_ready: (a, t, v) => { a.tone(t, 880, 0.12, 'triangle', 0.1 * v); a.tone(t + 0.08, 1320, 0.2, 'triangle', 0.1 * v); },
  pickup: (a, t, v) => [880, 1175, 1568].forEach((f, i) => a.tone(t + i * 0.04, f, 0.12, 'sine', 0.1 * v)),
  hurt: (a, t, v) => { a.tone(t, 200, 0.12, 'sawtooth', 0.12 * v, 100); a.noise(t, 0.08, 0.2 * v, 'lowpass', 900); },
  shield_break: (a, t, v) => { a.noise(t, 0.3, 0.35 * v, 'highpass', 2500, 1, 8000); a.tone(t, 900, 0.2, 'triangle', 0.1 * v, 300); },
  crate_break: (a, t, v) => { a.noise(t, 0.25, 0.35 * v, 'lowpass', 1400, 1, 200); a.tone(t, 160, 0.15, 'square', 0.08 * v, 70); },
  ring: (a, t, v) => { a.tone(t, 150, 1, 'sawtooth', 0.08 * v, 120); a.tone(t, 155, 1, 'sawtooth', 0.08 * v, 118); },
};

/**
 * Sequenciador procedural simples: baixo + bateria + arpejo em escala
 * menor harmônica (clima de cripta, mas com groove).
 */
class MusicPlayer {
  private timer = 0;
  private step = 0;
  private nextT: number;
  private stopped = false;
  private readonly bpm: number;
  private readonly out: GainNode;

  constructor(private ctx: AudioContext, bus: GainNode, readonly track: 'menu' | 'battle') {
    this.bpm = track === 'battle' ? 132 : 96;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    this.out.connect(bus);
    this.nextT = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => this.out.disconnect(), 800);
  }

  private schedule(): void {
    if (this.stopped) return;
    const spb = 60 / this.bpm / 4; // semicolcheia
    while (this.nextT < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextT);
      this.nextT += spb;
      this.step++;
    }
  }

  private note(t: number, freq: number, dur: number, type: OscillatorType, vol: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(t: number, kind: 'kick' | 'hat' | 'snare', vol: number): void {
    if (kind === 'kick') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(this.out);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.out);
    s.start(t);
  }

  private playStep(step: number, t: number): void {
    // Lá menor harmônico
    const root = 110;
    const scale = [0, 2, 3, 5, 7, 8, 11, 12];
    const prog = this.track === 'battle' ? [0, 0, 5, 4] : [0, 5, 3, 4];
    const bar = Math.floor(step / 16) % prog.length;
    const deg = prog[bar];
    const s = step % 16;
    const f = (semi: number) => root * Math.pow(2, semi / 12);
    if (this.track === 'battle') {
      if (s % 4 === 0) this.drum(t, 'kick', 0.5);
      if (s % 8 === 4) this.drum(t, 'snare', 0.22);
      if (s % 2 === 1) this.drum(t, 'hat', 0.06);
      if (s % 2 === 0) this.note(t, f(scale[deg]) / 2, 0.18, 'sawtooth', 0.07);
      if (s % 4 === 2) {
        const arp = [0, 2, 4, 7][Math.floor(step / 4) % 4];
        this.note(t, f(scale[(deg + arp) % 8] + 12), 0.16, 'square', 0.035);
      }
    } else {
      if (s === 0 || s === 10) this.drum(t, 'kick', 0.3);
      if (s % 4 === 2) this.drum(t, 'hat', 0.035);
      if (s % 8 === 0) this.note(t, f(scale[deg]) / 2, 0.9, 'triangle', 0.09);
      if (s % 2 === 0) {
        const arp = [0, 2, 4, 2, 7, 4, 2, 4][(s / 2) % 8];
        this.note(t, f(scale[(deg + arp) % 8] + 12), 0.28, 'triangle', 0.035);
      }
    }
  }
}

export const audio = new AudioEngine();
