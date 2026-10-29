import { resolveSound, SOUNDS, type Bus } from './catalog';

/**
 * MOTOR DE ÁUDIO (Web Audio)
 * --------------------------
 * master → compressor → saída
 *   ├─ music (com "ducking": abaixa quando o locutor fala)
 *   ├─ sfx   (som posicional: volume e lado dependem da distância até a câmera)
 *   ├─ ui
 *   └─ voice
 * Os arquivos carregam sob demanda e ficam em cache. Arquivo faltando = silêncio
 * (o jogo nunca trava por causa de som).
 */

const EXT = '.mp3';
const HEAR_RADIUS = 1400;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private duck!: GainNode;
  private buffers = new Map<string, AudioBuffer | null>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private playing = new Map<string, number>();
  private lastAt = new Map<string, number>();
  private music: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantMusic: string | null = null;
  private vols: Record<Bus, number> = { sfx: 0.85, ui: 0.85, voice: 0.9, music: 0.55 };
  private totalVoices = 0;
  listenerX = 0;
  listenerY = 0;
  muted = false;

  /** Precisa ser chamado num toque/clique (regra dos navegadores). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    for (const b of ['sfx', 'ui', 'voice', 'music'] as Bus[]) {
      const g = ctx.createGain();
      g.gain.value = this.vols[b];
      g.connect(b === 'music' ? this.duck : this.master);
      this.buses[b] = g;
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    if (this.wantMusic) this.playMusic(this.wantMusic);
    // pré-carrega o básico
    for (const id of ['ui_click', 'pistol', 'hit', 'explosion', 'kill']) this.preload(id);
  }

  setVolumes(v: { music: number; sfx: number; voice: number }): void {
    this.vols = { music: v.music, sfx: v.sfx, ui: v.sfx, voice: v.voice };
    if (!this.ctx) return;
    for (const b of Object.keys(this.buses) as Bus[]) this.buses[b].gain.setTargetAtTime(this.vols[b], this.ctx.currentTime, 0.05);
  }

  private url(file: string): string {
    return `${import.meta.env?.BASE_URL ?? './'}audio/${file}${file.includes('.') ? '' : EXT}`;
  }

  private load(file: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file)!);
    const ex = this.loading.get(file);
    if (ex) return ex;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const p = fetch(this.url(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => ctx.decodeAudioData(ab))
      .catch(() => null)
      .then((buf) => {
        this.buffers.set(file, buf);
        this.loading.delete(file);
        return buf;
      });
    this.loading.set(file, p);
    return p;
  }

  preload(id: string): void {
    const d = SOUNDS[id];
    if (d && this.ctx) for (const f of d.files) void this.load(f);
  }

  /**
   * Toca um som. `x,y` (opcional) = posição no mundo → volume/lado pela distância.
   */
  play(id: string, x?: number, y?: number, vol = 1): void {
    if (this.muted || !this.ctx) return;
    const d = resolveSound(id);
    if (!d) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (d.gap && now - (this.lastAt.get(id) ?? -9) < d.gap) return;
    const max = d.max ?? 4;
    if ((this.playing.get(id) ?? 0) >= max || this.totalVoices > 40) return;
    let gain = (d.vol ?? 0.7) * vol;
    let pan = 0;
    if (x !== undefined && y !== undefined) {
      const dx = x - this.listenerX;
      const dy = y - this.listenerY;
      const dist = Math.hypot(dx, dy * 1.3);
      if (dist > HEAR_RADIUS) return;
      gain *= Math.max(0, 1 - dist / HEAR_RADIUS) ** 1.6;
      pan = Math.max(-0.85, Math.min(0.85, dx / 700));
    }
    if (gain < 0.01) return;
    const file = d.files[Math.floor(Math.random() * d.files.length)]!;
    const buf = this.buffers.get(file);
    if (buf === undefined) {
      // primeira vez: carrega e toca se ainda der tempo (senão só fica no cache)
      void this.load(file).then((b) => {
        if (b && ctx.currentTime - now < 0.18) this.start(id, d.bus ?? 'sfx', b, gain, pan, d.pitch);
      });
      return;
    }
    if (!buf) return;
    this.lastAt.set(id, now);
    this.start(id, d.bus ?? 'sfx', buf, gain, pan, d.pitch);
  }

  private start(id: string, bus: Bus, buf: AudioBuffer, gain: number, pan: number, pitch?: [number, number]): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (pitch) src.playbackRate.value = pitch[0] + Math.random() * (pitch[1] - pitch[0]);
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(this.buses[bus]);
    src.connect(g);
    this.playing.set(id, (this.playing.get(id) ?? 0) + 1);
    this.totalVoices++;
    src.onended = () => {
      this.playing.set(id, Math.max(0, (this.playing.get(id) ?? 1) - 1));
      this.totalVoices--;
      try {
        node.disconnect();
      } catch {
        /* ok */
      }
    };
    src.start();
    if (bus === 'voice') this.duckMusic(buf.duration);
  }

  /** Abaixa a música enquanto o locutor fala. */
  private duckMusic(dur: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.35, t, 0.04);
    this.duck.gain.setTargetAtTime(1, t + Math.min(2.5, dur), 0.25);
  }

  /** Troca a música com fade cruzado. */
  playMusic(id: string | null): void {
    this.wantMusic = id;
    if (!this.ctx) return;
    if (this.music?.id === id) return;
    const ctx = this.ctx;
    const old = this.music;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      old.src.stop(ctx.currentTime + 2);
      this.music = null;
    }
    if (!id) return;
    const d = SOUNDS[id];
    if (!d) return;
    void this.load(d.files[0]!).then((buf) => {
      if (!buf || this.wantMusic !== id || this.music?.id === id) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(d.vol ?? 0.5, ctx.currentTime, 0.6);
      src.connect(g).connect(this.buses.music);
      src.start();
      this.music = { id, src, gain: g };
    });
  }

  /** Câmera lenta / pausa: abafa tudo um pouco. */
  setRate(r: number): void {
    if (this.music) this.music.src.playbackRate.setTargetAtTime(r, this.ctx!.currentTime, 0.1);
  }
}

export const audio = new AudioEngine();
