import type { AudioEngine } from '../audio/audio';
import type { Fighter } from '../combat/state';
import type { World } from '../combat/world';
import type { GameLoop } from '../engine/loop';
import { TAU } from '../engine/math';
import { lighten } from './art/color';
import type { GameRenderer } from './renderer';

/**
 * Diretor de "game feel": transforma eventos da simulação em partículas,
 * números de dano, som, vibração, screenshake (com parcimônia) e hit-stop.
 * Nada aqui altera a simulação.
 */
export class FxDirector {
  haptics = true;
  shakeScale = 1;
  private ambientAcc = 0;
  private trailFlip = false;
  /** Mensagens para o HUD (ex.: "ABATE!", "NÉVOA FECHANDO"). */
  readonly announcements: Array<{ text: string; kind: 'kill' | 'info' | 'warn' | 'special' | 'count' | 'fight' }> = [];
  /** Feed de abates para o HUD. */
  readonly killFeed: Array<{ killer: string; victim: string; mine: boolean; t: number }> = [];

  constructor(private r: GameRenderer, private audio: AudioEngine, public loop: GameLoop | null) {}

  private vol(world: World, x: number, y: number, viewer: Fighter | undefined): number {
    if (!viewer) return 0.7;
    const d = Math.hypot(x - viewer.x, y - viewer.y);
    return Math.max(0, Math.min(1, 1.15 - d / 650)) * (world.phase === 'ended' ? 0.5 : 1);
  }

  private vibrate(ms: number | number[]): void {
    if (this.haptics && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* sem suporte */
      }
    }
  }

  process(world: World, viewer: Fighter | undefined): void {
    const P = this.r.particles;
    const F = this.r.floaters;
    const cam = this.r.camera;
    for (const e of world.events) {
      switch (e.t) {
        case 'shot': {
          const v = this.vol(world, e.x, e.y, viewer);
          if (v > 0.02) this.audio.play(e.def.sfx.fire, v * (e.ownerId === viewer?.id ? 1 : 0.6));
          const mx = e.x + Math.cos(e.angle) * 22, my = e.y - 18 + Math.sin(e.angle) * 22;
          P.emit({ kind: 'glow', x: mx, y: my, size: 22, color: e.def.vfx.color, life: 0.12, additive: true });
          P.burst(3, { kind: 'spark', x: mx, y: my, color: lighten(e.def.vfx.color, 0.4), size: 3, life: 0.18, drag: 6 }, 260, 0.7, e.angle);
          break;
        }
        case 'melee': {
          P.emit({ kind: 'slash', x: e.x, y: e.y - 18, size: e.range, size2: 10, angle: e.angle, arc: e.arc, color: e.color, color2: e.color2, life: 0.22, drag: 0 });
          break;
        }
        case 'hit': {
          const target = world.byId.get(e.targetId);
          const mineDealt = viewer && e.sourceId === viewer.id;
          const mineTaken = viewer && e.targetId === viewer.id;
          if (e.amount > 0) {
            const col = e.shielded ? '#cfe8ff' : mineTaken ? '#ff5c7a' : e.kind === 'special' ? '#ffb3ff' : e.kind === 'status' || e.kind === 'zone' ? '#c6ff9e' : e.kind === 'ring' ? '#d6a8ff' : mineDealt ? '#fff3a6' : '#ffffff';
            const size = e.big ? 26 : mineDealt || mineTaken ? 20 : 15;
            F.add(e.x, e.y - 70, String(e.amount), col, size);
          }
          if (target) {
            P.burst(e.big ? 10 : 5, { kind: 'dot', x: e.x, y: e.y - 20, color: lighten(target.def.palette[0], 0.3), size: 3.5, life: 0.35, drag: 5 }, 220);
            P.burst(e.big ? 4 : 2, { kind: 'bone', x: e.x, y: e.y - 20, color: '#f3ead8', size: 4, life: 0.5, drag: 3, vr: 12, gravity: 300, vz: 120 }, 140);
          }
          if (mineTaken) {
            this.r.hurtFlash = Math.min(1, this.r.hurtFlash + (e.big ? 0.8 : 0.45));
            cam.shake((e.big ? 0.35 : 0.16) * this.shakeScale);
            this.vibrate(e.big ? 45 : 18);
            this.audio.play('hurt', 0.7, 0.08);
          } else if (mineDealt) {
            if (e.big) {
              this.loop?.hitstop(40);
              cam.shake(0.12 * this.shakeScale);
            }
          }
          break;
        }
        case 'heal': {
          if (e.amount >= 20) F.add(e.x, e.y - 74, `+${e.amount}`, '#5cff9d', 16);
          P.burst(4, { kind: 'dot', x: e.x, y: e.y - 20, color: '#5cff9d', size: 3, life: 0.6, drag: 1 }, 50);
          break;
        }
        case 'impact': {
          const v = this.vol(world, e.x, e.y, viewer);
          if (v > 0.02) this.audio.play(e.def.sfx.hit, v * 0.8);
          this.impactFx(e.x, e.y - 16, e.def.vfx.impact ?? 'burst', e.def.vfx.color, e.def.vfx.color2 ?? '#fff', e.wall);
          break;
        }
        case 'explode': {
          const v = this.vol(world, e.x, e.y, viewer);
          if (v > 0.02) this.audio.play('explosion', v, 0.06);
          P.emit({ kind: 'ring', x: e.x, y: e.y, size: 6, size2: e.radius, arc: 8, color: e.color, life: 0.35, drag: 0 });
          P.emit({ kind: 'glow', x: e.x, y: e.y - 10, size: e.radius * 1.3, color: e.color, life: 0.3, additive: true });
          P.burst(Math.min(24, 8 + e.radius / 8), { kind: 'spark', x: e.x, y: e.y - 10, color: e.color2, size: 4, life: 0.4, drag: 4 }, e.radius * 4);
          P.burst(6, { kind: 'smoke', x: e.x, y: e.y - 10, color: '#3a3044', size: 12, life: 0.8, drag: 3 }, 90);
          if (viewer) {
            const d = Math.hypot(e.x - viewer.x, e.y - viewer.y);
            if (d < 300) cam.shake((0.25 * (1 - d / 300) + (e.radius > 120 ? 0.15 : 0)) * this.shakeScale);
          }
          break;
        }
        case 'bounce':
          P.burst(4, { kind: 'spark', x: e.x, y: e.y - 16, color: e.color, size: 3, life: 0.2, drag: 6 }, 200);
          break;
        case 'special': {
          const caster = world.byId.get(e.fighterId);
          const v = this.vol(world, e.x, e.y, viewer);
          if (v > 0.02) this.audio.play(e.ability.sfx, v);
          P.emit({ kind: 'ring', x: e.x, y: e.y, size: 10, size2: 70, arc: 6, color: e.ability.vfx.color, life: 0.4, drag: 0 });
          P.burst(12, { kind: 'star', x: e.x, y: e.y - 24, color: e.ability.vfx.color, size: 5, life: 0.5, drag: 3, vr: 8 }, 180);
          if (caster && viewer && caster.id === viewer.id) {
            this.r.whiteFlash = 0.5;
            cam.shake(0.1 * this.shakeScale);
            this.vibrate([20, 30, 20]);
          }
          if (caster && !caster.isMinion) F.add(e.x, e.y - 112, e.ability.name.toUpperCase() + '!', e.ability.vfx.color, 15, '#140a24');
          break;
        }
        case 'special_ready':
          if (viewer && e.fighterId === viewer.id) this.audio.play('special_ready', 0.8);
          break;
        case 'death': {
          const f = world.byId.get(e.fighterId);
          const killer = world.byId.get(e.killerId);
          const v = this.vol(world, e.x, e.y, viewer);
          this.audio.play('death', Math.max(0.3, v));
          if (f) {
            P.burst(f.isMinion ? 6 : 14, { kind: 'bone', x: e.x, y: e.y - 24, color: '#f3ead8', size: 6, life: 1.1, drag: 1.5, vr: 14, gravity: 500, vz: 260 }, 230);
            P.burst(10, { kind: 'dot', x: e.x, y: e.y - 24, color: f.def.palette[0], size: 4, life: 0.6, drag: 4 }, 260);
            P.emit({ kind: 'glow', x: e.x, y: e.y - 30, size: 70, color: f.def.palette[2], life: 0.4, additive: true });
            if (!f.isMinion) {
              P.emit({ kind: 'soul', x: e.x, y: e.y - 40, vy: -60, size: 10, color: '#c9a0ff', life: 1.4, drag: 0.5 });
              this.killFeed.push({ killer: killer ? killer.name : 'Névoa', victim: f.name, mine: !!viewer && (killer?.id === viewer.id || f.id === viewer.id), t: performance.now() });
              if (this.killFeed.length > 4) this.killFeed.shift();
            }
          }
          if (viewer && killer && killer.id === viewer.id && f && !f.isMinion) {
            this.audio.play('kill', 1);
            this.loop?.hitstop(70);
            cam.shake(0.2 * this.shakeScale);
            this.announcements.push({ text: 'ABATE!', kind: 'kill' });
            this.vibrate([30, 40, 60]);
          }
          if (viewer && f && f.id === viewer.id) {
            this.loop?.hitstop(110);
            cam.shake(0.6 * this.shakeScale);
            this.vibrate([80, 60, 120]);
          }
          break;
        }
        case 'spawn':
          P.emit({ kind: 'ring', x: e.x, y: e.y, size: 4, size2: 46, arc: 5, color: '#ffffff', life: 0.4, drag: 0 });
          P.emit({ kind: 'glow', x: e.x, y: e.y - 24, size: 50, color: '#c9a0ff', life: 0.35, additive: true });
          break;
        case 'crate_break': {
          this.audio.play('crate_break', this.vol(world, e.x, e.y, viewer));
          const col = e.type === 'urn' ? '#c87a45' : '#9b6a3a';
          P.burst(14, { kind: 'shard', x: e.x, y: e.y - 14, color: col, size: 6, life: 0.9, drag: 1.5, vr: 10, gravity: 450, vz: 220 }, 200);
          P.burst(6, { kind: 'smoke', x: e.x, y: e.y - 10, color: '#6b5a4a', size: 10, life: 0.6, drag: 3 }, 60);
          break;
        }
        case 'crate_hit':
          P.burst(3, { kind: 'shard', x: e.x, y: e.y - 14, color: '#b07a45', size: 3.5, life: 0.4, drag: 2, gravity: 400, vz: 120 }, 120);
          break;
        case 'pickup':
          this.audio.play('pickup', this.vol(world, e.x, e.y, viewer));
          P.burst(10, { kind: 'star', x: e.x, y: e.y - 18, color: e.kind === 'soul' ? '#c9a0ff' : '#ff7a8f', size: 4, life: 0.5, drag: 3, vr: 6 }, 160);
          if (viewer && e.fighterId === viewer.id) F.add(e.x, e.y - 80, e.kind === 'soul' ? '+ALMA' : '+VIDA', e.kind === 'soul' ? '#c9a0ff' : '#5cff9d', 16);
          break;
        case 'shield_break':
          this.audio.play('shield_break', this.vol(world, e.x, e.y, viewer));
          P.burst(12, { kind: 'shard', x: e.x, y: e.y - 26, color: '#cfeaff', size: 5, life: 0.6, drag: 2, vr: 8 }, 260);
          break;
        case 'status':
          if (e.effect === 'freeze' || e.effect === 'stun' || e.effect === 'root') {
            const f = world.byId.get(e.fighterId);
            if (f) P.burst(6, { kind: 'star', x: f.x, y: f.y - 50, color: e.effect === 'freeze' ? '#bff4ff' : '#ffe14d', size: 4, life: 0.5, drag: 3 }, 120);
          }
          break;
        case 'dash': {
          const n = 8;
          for (let i = 0; i < n; i++) {
            const k = i / n;
            P.emit({ kind: 'glow', x: e.x0 + (e.x1 - e.x0) * k, y: e.y0 + (e.y1 - e.y0) * k - 22, size: 26, color: e.color, life: 0.25 + k * 0.15, additive: true });
          }
          P.burst(8, { kind: 'smoke', x: e.x0, y: e.y0 - 6, color: '#8a7a9a', size: 8, life: 0.5, drag: 4 }, 80);
          break;
        }
        case 'teleport':
          for (const [x, y] of [[e.x0, e.y0], [e.x1, e.y1]]) {
            P.emit({ kind: 'ring', x, y, size: 40, size2: 4, arc: 5, color: e.color, life: 0.35, drag: 0 });
            P.emit({ kind: 'glow', x, y: y - 24, size: 60, color: e.color, life: 0.35, additive: true });
            P.burst(10, { kind: 'dot', x, y: y - 24, color: e.color, size: 3, life: 0.5, drag: 3 }, 160);
          }
          break;
        case 'pet_act':
          P.emit({ kind: 'glow', x: e.x, y: e.y, size: 26, color: e.kind === 'heal' ? '#5cff9d' : e.kind === 'shield' ? '#cfeaff' : '#ffffff', life: 0.4, additive: true });
          if (e.kind === 'shield' && viewer && e.fighterId === viewer.id) this.audio.play('shield', 0.5);
          break;
        case 'ring_start':
          this.audio.play('ring', 0.8);
          this.announcements.push({ text: 'A NÉVOA ESTÁ FECHANDO!', kind: 'warn' });
          break;
        case 'countdown':
          this.audio.play('countdown', 0.9);
          this.announcements.push({ text: String(e.n), kind: 'count' });
          break;
        case 'fight':
          this.audio.play('fight', 1);
          this.announcements.push({ text: 'LUTE!', kind: 'fight' });
          break;
        case 'match_end':
          break;
      }
    }
    world.events.length = 0;
  }

  private impactFx(x: number, y: number, kind: string, col: string, col2: string, wall: boolean): void {
    const P = this.r.particles;
    switch (kind) {
      case 'ember':
        P.burst(8, { kind: 'spark', x, y, color: '#ffb347', size: 3, life: 0.35, drag: 4 }, 220);
        P.burst(3, { kind: 'smoke', x, y, color: '#4a3a3a', size: 7, life: 0.5, drag: 3 }, 40);
        break;
      case 'shatter':
        P.burst(7, { kind: 'shard', x, y, color: col, size: 4, life: 0.45, drag: 3, vr: 10 }, 200);
        break;
      case 'splash':
      case 'poison':
        P.burst(9, { kind: 'dot', x, y, color: col, size: 3.5, life: 0.5, drag: 3, gravity: 300, vz: 120 }, 150);
        P.emit({ kind: 'ring', x, y: y + 16, size: 4, size2: 26, arc: 3, color: col, life: 0.3, drag: 0 });
        break;
      case 'void':
        P.emit({ kind: 'glow', x, y, size: 34, color: col, life: 0.25, additive: true });
        P.burst(6, { kind: 'dot', x, y, color: col2, size: 3, life: 0.4, drag: 2 }, 120);
        break;
      case 'electric':
        P.burst(8, { kind: 'spark', x, y, color: col2, size: 2.5, life: 0.25, drag: 6 }, 300);
        P.emit({ kind: 'glow', x, y, size: 26, color: col, life: 0.15, additive: true });
        break;
      case 'gold':
        P.burst(6, { kind: 'star', x, y, color: '#ffe14d', size: 4, life: 0.45, drag: 3, vr: 8 }, 170);
        break;
      case 'burst':
      default:
        P.burst(wall ? 5 : 7, { kind: 'spark', x, y, color: col, size: 3, life: 0.25, drag: 6 }, 220);
        P.emit({ kind: 'ring', x, y, size: 3, size2: 18, arc: 3, color: col, life: 0.18, drag: 0 });
    }
  }

  /** Trilhas, partículas de status e ambiente (contínuas). */
  update(world: World, dt: number, quality: 'alta' | 'media' | 'baixa'): void {
    const P = this.r.particles;
    this.trailFlip = !this.trailFlip;
    const skip = quality === 'baixa' ? !this.trailFlip : false;
    if (!skip) {
      const pool = world.projectiles;
      for (let i = 0; i < pool.count; i++) {
        const p = pool.items[i];
        const trail = p.def.vfx.trail ?? 'none';
        if (trail === 'none') continue;
        const x = p.x, y = p.y - 16 - p.z;
        const col = p.def.vfx.color;
        switch (trail) {
          case 'fire':
            P.emit({ kind: 'glow', x, y, size: 14, color: '#ff8a2e', life: 0.25, additive: true, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20 });
            break;
          case 'smoke':
            P.emit({ kind: 'smoke', x, y, size: 4, color: '#6b6070', life: 0.35, drag: 2 });
            break;
          case 'spark':
            P.emit({ kind: 'spark', x, y, color: col, size: 2, life: 0.18, vx: -p.vx * 0.1 + (Math.random() - 0.5) * 60, vy: -p.vy * 0.1 + (Math.random() - 0.5) * 60, drag: 4 });
            break;
          case 'ghost':
          case 'void':
          case 'neon':
          case 'gold':
            P.emit({ kind: 'glow', x, y, size: 12, color: trail === 'neon' && this.trailFlip ? (p.def.vfx.color2 ?? col) : col, life: 0.22, additive: true });
            break;
          case 'ice':
            P.emit({ kind: 'shard', x, y, size: 2.5, color: '#e6fbff', life: 0.3, drag: 3, vr: 6, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 });
            break;
          case 'poison':
            P.emit({ kind: 'dot', x, y, size: 3, color: col, life: 0.35, drag: 2, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30 });
            break;
          case 'bone':
            P.emit({ kind: 'dot', x, y, size: 2.2, color: '#fff3d6', life: 0.2, drag: 2 });
            break;
        }
      }
      // status
      for (const f of world.fighters) {
        if (!f.alive) continue;
        if (f.hasStatus('burn') && Math.random() < 0.5) P.emit({ kind: 'glow', x: f.x + (Math.random() - 0.5) * 20, y: f.y - 20 - Math.random() * 20, vy: -60, size: 12, color: '#ff7b2e', life: 0.4, additive: true });
        if (f.hasStatus('poison') && Math.random() < 0.3) P.emit({ kind: 'dot', x: f.x + (Math.random() - 0.5) * 20, y: f.y - 30, vy: -40, size: 3, color: '#7dff4f', life: 0.6 });
        if (f.def.rarity === 'creator' && Math.random() < 0.35) {
          P.emit({ kind: 'star', x: f.x + (Math.random() - 0.5) * 40, y: f.y - 20 - Math.random() * 40, vy: -30, size: 3, color: Math.random() < 0.5 ? '#ff2d95' : '#3df2ff', life: 0.7, drag: 1 });
        }
      }
      // zonas
      for (const z of world.zones) {
        if (Math.random() < 0.5) {
          const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * z.radius;
          P.emit({ kind: z.spec.look === 'fire' ? 'glow' : 'dot', x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r, vy: -30, size: z.spec.look === 'fire' ? 12 : 3, color: z.spec.color, life: 0.7, additive: z.spec.look === 'fire' || z.spec.look === 'holy' });
        }
      }
    }
    this.ambient(world, dt, quality);
    this.r.particles.update(dt);
    this.r.floaters.update(dt);
  }

  private ambient(world: World, dt: number, quality: 'alta' | 'media' | 'baixa'): void {
    const rate = quality === 'baixa' ? 4 : quality === 'media' ? 9 : 14;
    this.ambientAcc += dt * rate;
    const cam = this.r.camera;
    const P = this.r.particles;
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      const x = cam.x + (Math.random() - 0.5) * cam.viewW;
      const y = cam.y + (Math.random() - 0.5) * cam.viewH;
      switch (world.map.theme) {
        case 'lava':
          P.emit({ kind: 'glow', x, y, vy: -40, vx: (Math.random() - 0.5) * 20, size: 6, color: '#ff7b2e', life: 1.6, drag: 0.2, additive: true });
          break;
        case 'ice':
          P.emit({ kind: 'dot', x, y: y - 200, vy: 40, vx: -15, size: 2.2, color: '#f2fbff', life: 4, drag: 0 });
          break;
        case 'swamp':
        case 'graveyard':
          P.emit({ kind: 'glow', x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, size: 7, color: world.map.theme === 'swamp' ? '#c6ff6e' : '#9fffe0', life: 2.2, drag: 0.1, additive: true });
          break;
        case 'neon':
          P.emit({ kind: 'glow', x, y, size: 6, color: Math.random() < 0.5 ? '#ff2d95' : '#3df2ff', life: 1.2, additive: true });
          break;
        case 'void':
          P.emit({ kind: 'star', x, y, size: 3, color: '#e3c9ff', life: 1.5, vr: 2 });
          break;
        default:
          P.emit({ kind: 'dot', x, y, vx: 6, vy: -4, size: 1.6, color: 'rgba(255,230,200,0.5)', life: 3, drag: 0 });
      }
    }
  }
}
