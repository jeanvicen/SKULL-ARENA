import { RARITY } from '../content/rarities';
import { TILE } from '../sim/map';
import type { GameEvent } from '../sim/types';
import type { World } from '../sim/world';
import type { Camera } from './camera';
import type { Particles } from './particles';
import type { Theme } from './theme';

/**
 * EFEITOS: transforma os eventos da simulação em partículas, tremidas de câmera,
 * números de dano, anúncios e sons. Separado do renderer pra ficar fácil de mexer.
 */

export interface FxHooks {
  /** som (id do catálogo, posição no mundo opcional) */
  sound?: (id: string, x?: number, y?: number, vol?: number) => void;
  /** texto grande no meio da tela */
  announce?: (text: string, kind: 'kill' | 'streak' | 'info' | 'warn' | 'big') => void;
  /** pausa curtinha (impacto) */
  hitStop?: (ms: number) => void;
  /** vibração do celular */
  vibrate?: (ms: number) => void;
  /** feed de eliminações */
  killFeed?: (killer: string, victim: string, killerTeam: number, victimTeam: number) => void;
}

const STREAK_TEXT: Record<number, string> = { 2: 'ELIMINAÇÃO DUPLA!', 3: 'TRIPLA!', 4: 'MASSACRE!', 5: 'IMPARÁVEL!', 6: 'LENDÁRIO!', 7: 'CAVEIRA SUPREMA!' };

export class Fx {
  /** mortes recentes: posição da caveira pulando (visual) */
  readonly deathSkulls: Array<{ x: number; y: number; z: number; vz: number; vx: number; vy: number; t: number; rot: number; color: string }> = [];
  readonly meteorMarks: Array<{ x: number; y: number; at: number }> = [];
  flashT = 0;
  flashColor = '#ffffff';

  constructor(
    private readonly world: World,
    private readonly particles: Particles,
    private readonly cam: Camera,
    private readonly theme: Theme,
    private readonly localId: number,
    private readonly hooks: FxHooks,
  ) {}

  private near(x: number, y: number, r = 900): boolean {
    return Math.abs(x - this.cam.x) < r && Math.abs(y - this.cam.y) < r * 0.75;
  }

  handle(events: GameEvent[]): void {
    const w = this.world;
    const P = this.particles;
    const local = w.fighters[this.localId];
    for (const e of events) {
      switch (e.type) {
        case 'shoot': {
          const f = w.fighters[e.id];
          if (!f) break;
          if (this.near(e.x, e.y)) {
            const mx = e.x + Math.cos(e.angle) * 34;
            const my = e.y + Math.sin(e.angle) * 34 - 30;
            const col = firstColor(e.ability) ?? '#ffe08a';
            P.spawn({ kind: 'glow', x: mx, y: my, size: 22, max: 0.1, color: col });
            for (let i = 0; i < 4; i++) P.spawn({ kind: 'spark', x: mx, y: my, vx: Math.cos(e.angle + (Math.random() - 0.5)) * 380, vy: Math.sin(e.angle + (Math.random() - 0.5)) * 380, max: 0.14, size: 2.5, color: col });
            this.hooks.sound?.(e.ability.sfx ?? 'pistol', e.x, e.y, e.kind === 'super' ? 1 : 0.8);
          }
          if (e.id === this.localId) {
            this.cam.kick(-Math.cos(e.angle) * (e.kind === 'super' ? 10 : 3), -Math.sin(e.angle) * (e.kind === 'super' ? 10 : 3));
            if (e.kind === 'super') {
              this.cam.addShake(8);
              this.hooks.vibrate?.(30);
            }
          }
          break;
        }
        case 'hit': {
          if (!this.near(e.x, e.y)) break;
          const t = e.target >= 0 ? w.fighters[e.target] : undefined;
          if (e.kind === 'fighter' && t) {
            const mine = e.source === this.localId;
            const onMe = e.target === this.localId;
            const color = e.shield ? '#cfe8ff' : onMe ? '#ff5d6e' : mine ? (e.crit ? '#ffd23f' : '#ffffff') : '#ffb0b0';
            P.spawn({ kind: 'text', x: t.x + (Math.random() - 0.5) * 30, y: t.y - 100, size: mine || onMe ? (e.crit ? 30 : 24) : 18, max: 0.75, color, text: String(e.amount), big: e.crit });
            P.burst(t.x, t.y - 40, mine ? 7 : 4, e.shield ? '#bfe6ff' : '#ff4f6a', 300, 'spark');
            if (mine) {
              this.hooks.sound?.(e.crit ? 'hit_crit' : 'hit', t.x, t.y, 0.9);
              if (e.crit) this.hooks.hitStop?.(45);
            } else if (onMe) {
              this.hooks.sound?.('hurt', t.x, t.y, 0.8);
              this.cam.addShake(Math.min(10, e.amount / 140));
              this.hooks.vibrate?.(18);
              this.flashT = 0.12;
              this.flashColor = '#ff2040';
            } else this.hooks.sound?.('hit_far', t.x, t.y, 0.4);
          } else if (e.kind === 'tile') {
            P.burst(e.x, e.y - 30, 3, this.theme.brickTop, 220, 'debris', { grav: 1400, vz: 300, max: 0.8, size: 4 });
            if (e.source === this.localId) this.hooks.sound?.('hit_wall', e.x, e.y, 0.5);
          } else if (e.kind === 'summon') {
            P.burst(e.x, e.y - 20, 4, '#ffffff', 240);
          }
          break;
        }
        case 'heal': {
          if (!this.near(e.x, e.y)) break;
          P.spawn({ kind: 'text', x: e.x, y: e.y - 96, size: 18, max: 0.8, color: '#5dffa0', text: `+${e.amount}` });
          for (let i = 0; i < 3; i++) P.spawn({ kind: 'star', x: e.x + (Math.random() - 0.5) * 40, y: e.y - 20 - Math.random() * 50, vy: -60, max: 0.6, size: 3, color: '#5dffa0' });
          break;
        }
        case 'kill': {
          const v = w.fighters[e.victim];
          const k = e.killer >= 0 ? w.fighters[e.killer] : undefined;
          if (v) {
            // caveira do personagem voa e quica
            this.deathSkulls.push({ x: e.x, y: e.y, z: 70, vz: 520, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 120, t: 2.4, rot: 0, color: RARITY[v.def.rarity].color });
            P.burst(e.x, e.y - 50, 18, '#efe6d2', 420, 'bone', { grav: 1500, vz: 420, max: 1.6, size: 6, drag: 1 });
            P.burst(e.x, e.y - 50, 14, RARITY[v.def.rarity].color, 380, 'confetti', { grav: 900, vz: 380, max: 1.4, size: 5, drag: 1 });
            P.spawn({ kind: 'ring', x: e.x, y: e.y, size: 70, grow: 160, max: 0.4, color: '#ffffff' });
            if (this.near(e.x, e.y)) this.hooks.sound?.('kill', e.x, e.y, 1);
            this.hooks.killFeed?.(k?.name ?? '???', v.name, k?.team ?? -1, v.team);
          }
          if (e.killer === this.localId && v) {
            this.hooks.hitStop?.(70);
            this.cam.addShake(6);
            this.hooks.vibrate?.(40);
            const st = STREAK_TEXT[Math.min(7, e.streak)];
            this.hooks.announce?.(st ?? `ELIMINOU ${v.name.toUpperCase()}`, st ? 'streak' : 'kill');
            if (e.streak >= 2) this.hooks.sound?.(e.streak >= 3 ? 'vo_multikill' : 'vo_combo');
          }
          if (e.victim === this.localId) {
            this.hooks.announce?.(k ? `${k.name} te pegou!` : 'Você caiu!', 'warn');
            this.hooks.vibrate?.(120);
          }
          break;
        }
        case 'respawn': {
          const f = w.fighters[e.id];
          if (f && this.near(e.x, e.y)) {
            P.spawn({ kind: 'ring', x: e.x, y: e.y, size: 20, grow: 300, max: 0.45, color: '#58ffd0' });
            P.burst(e.x, e.y - 40, 12, '#58ffd0', 260, 'star');
          }
          if (e.id === this.localId) this.hooks.sound?.('respawn');
          break;
        }
        case 'explode': {
          if (!this.near(e.x, e.y, 1100)) break;
          const n = e.big ? 34 : 16;
          P.spawn({ kind: 'glow', x: e.x, y: e.y - 20, size: e.r * 1.6, max: 0.22, color: e.color });
          P.spawn({ kind: 'ring', x: e.x, y: e.y, size: e.r * 0.4, grow: e.r * 3.2, max: 0.35, color: e.color });
          P.burst(e.x, e.y - 20, n, e.color, e.r * 3, 'spark', { max: 0.4 });
          for (let i = 0; i < (e.big ? 10 : 5); i++) P.spawn({ kind: 'smoke', x: e.x + (Math.random() - 0.5) * e.r, y: e.y - 20 + (Math.random() - 0.5) * e.r * 0.6, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, size: 14 + Math.random() * 16, grow: 30, max: 0.8 + Math.random() * 0.5, color: 'rgba(40,30,50,1)', big: true });
          const d = Math.hypot(e.x - this.cam.x, e.y - this.cam.y);
          this.cam.addShake(Math.max(0, (e.big ? 16 : 7) * (1 - d / 1100)));
          this.hooks.sound?.(e.big ? 'explosion_big' : 'explosion', e.x, e.y, 1);
          if (e.big && d < 500) this.hooks.vibrate?.(45);
          break;
        }
        case 'tileBreak': {
          const x = (e.tx + 0.5) * TILE;
          const y = (e.ty + 0.5) * TILE;
          if (!this.near(x, y, 1100)) break;
          const col = e.tile === 3 ? this.theme.glass : e.tile === 9 ? '#8a7aa8' : this.theme.brickTop;
          P.burst(x, y - 30, 22, col, 420, e.tile === 3 ? 'shard' : 'debris', { grav: 1500, vz: 480, max: 1.6, size: 7, drag: 1 });
          for (let i = 0; i < 6; i++) P.spawn({ kind: 'smoke', x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 50, vy: -20, size: 18, grow: 26, max: 0.9, color: 'rgba(160,150,170,1)', big: true });
          this.hooks.sound?.(e.tile === 3 ? 'glass_break' : 'wall_break', x, y, 1);
          break;
        }
        case 'propBreak': {
          if (!this.near(e.x, e.y)) break;
          const col = e.kind === 'barrel' ? '#c0392b' : e.kind === 'tire' ? '#2a2a30' : '#a0703a';
          P.burst(e.x, e.y - 20, 16, col, 360, 'debris', { grav: 1500, vz: 420, max: 1.4, size: 6, drag: 1 });
          this.hooks.sound?.(e.kind === 'crate' ? 'wood_break' : 'metal_hit', e.x, e.y, 0.9);
          break;
        }
        case 'propHit':
          if (this.near(e.x, e.y) && Math.random() < 0.3) this.hooks.sound?.('wood_hit', e.x, e.y, 0.4);
          break;
        case 'pickup': {
          const col = e.kind === 'skull' ? '#efe6d2' : e.kind === 'heal' ? '#5dffa0' : e.kind === 'power' ? '#b77bff' : '#ffd23f';
          P.burst(e.x, e.y - 20, 12, col, 260, 'star');
          if (e.id === this.localId) this.hooks.sound?.(e.kind === 'coin' ? 'coin' : e.kind === 'skull' ? 'skull_pickup' : 'pickup');
          else if (this.near(e.x, e.y)) this.hooks.sound?.('pickup', e.x, e.y, 0.4);
          break;
        }
        case 'projEnd':
          if (this.near(e.x, e.y)) {
            P.burst(e.x, e.y - 20, e.wall ? 6 : 4, e.color, 200, 'spark', { max: 0.2 });
            if (e.wall) P.spawn({ kind: 'dust', x: e.x, y: e.y, size: 8, grow: 20, max: 0.4, color: 'rgba(200,190,210,1)' });
          }
          break;
        case 'blink': {
          for (const [x, y] of [
            [e.fx, e.fy],
            [e.tx, e.ty],
          ]) {
            P.spawn({ kind: 'ring', x: x!, y: y!, size: 30, grow: 200, max: 0.3, color: '#b77bff' });
            P.burst(x!, y! - 40, 14, '#b77bff', 300, 'star');
          }
          this.hooks.sound?.('blink', e.tx, e.ty, 0.8);
          break;
        }
        case 'dash': {
          const f = w.fighters[e.id];
          if (f) P.spawn({ kind: 'dust', x: f.x, y: f.y, size: 16, grow: 50, max: 0.4, color: 'rgba(220,210,230,1)' });
          this.hooks.sound?.('dash', f?.x, f?.y, 0.7);
          break;
        }
        case 'jump':
          this.hooks.sound?.('jump', w.fighters[e.id]?.x, w.fighters[e.id]?.y, 0.7);
          break;
        case 'land':
          P.spawn({ kind: 'ring', x: e.x, y: e.y, size: 20, grow: 140, max: 0.3, color: 'rgba(255,255,255,0.8)' });
          for (let i = 0; i < 6; i++) P.spawn({ kind: 'dust', x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 120, size: 10, grow: 30, max: 0.5, color: 'rgba(220,210,230,1)' });
          this.hooks.sound?.('land', e.x, e.y, 0.7);
          break;
        case 'shield': {
          const f = w.fighters[e.id];
          if (f) P.spawn({ kind: 'ring', x: f.x, y: f.y - 40, size: 30, grow: 90, max: 0.35, color: '#bfe6ff' });
          this.hooks.sound?.('shield', f?.x, f?.y, 0.6);
          break;
        }
        case 'superReady':
          if (e.id === this.localId) {
            this.hooks.sound?.('super_ready');
            this.hooks.vibrate?.(25);
          }
          break;
        case 'score':
          if (w.mode.teams === 2 && local) this.hooks.sound?.(e.team === local.team ? 'score_good' : 'score_bad', undefined, undefined, 0.7);
          break;
        case 'streak':
          break;
        case 'wanted': {
          const f = w.fighters[e.id];
          if (f) this.hooks.announce?.(e.id === this.localId ? 'VOCÊ É O PROCURADO! (vale 2 pontos)' : `${f.name} é PROCURADO!`, 'big');
          this.hooks.sound?.('wanted');
          break;
        }
        case 'summon':
          P.spawn({ kind: 'ring', x: e.x, y: e.y, size: 10, grow: 160, max: 0.35, color: '#efe6d2' });
          this.hooks.sound?.('summon', e.x, e.y, 0.7);
          break;
        case 'zone':
          P.spawn({ kind: 'ring', x: e.x, y: e.y, size: e.r * 0.3, grow: e.r * 2, max: 0.35, color: zoneColor(e.kind) });
          this.hooks.sound?.(e.kind === 'heal' || e.kind === 'music' ? 'heal' : 'zone', e.x, e.y, 0.7);
          break;
        case 'meteor':
          this.meteorMarks.push({ x: e.x, y: e.y, at: e.at });
          this.hooks.sound?.('meteor_warn', e.x, e.y, 0.6);
          break;
        case 'status':
          break;
        case 'countdown':
          this.hooks.announce?.(String(e.n), 'big');
          this.hooks.sound?.(`vo_${e.n}`);
          break;
        case 'start':
          this.hooks.announce?.('LUTE!', 'big');
          this.hooks.sound?.('vo_fight');
          break;
        case 'matchEnd':
          break;
      }
    }
  }

  update(dt: number): void {
    for (const s of this.deathSkulls) {
      s.t -= dt;
      s.vz -= 1500 * dt;
      s.z += s.vz * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vx * dt * 0.03;
      if (s.z < 0) {
        s.z = 0;
        s.vz = Math.abs(s.vz) > 120 ? -s.vz * 0.45 : 0;
        s.vx *= 0.7;
        s.vy *= 0.7;
      }
    }
    for (let i = this.deathSkulls.length - 1; i >= 0; i--) if (this.deathSkulls[i]!.t <= 0) this.deathSkulls.splice(i, 1);
    for (let i = this.meteorMarks.length - 1; i >= 0; i--) if (this.meteorMarks[i]!.at < this.world.time - 0.05) this.meteorMarks.splice(i, 1);
    if (this.flashT > 0) this.flashT -= dt;
  }
}

function firstColor(ab: { effects: Array<{ kind: string; proj?: { look: { color: string } }; color?: string; fx?: string }> }): string | undefined {
  for (const e of ab.effects) {
    if (e.proj) return e.proj.look.color;
    if (e.color) return e.color;
    if (e.fx) return e.fx;
  }
  return undefined;
}

export function zoneColor(kind: string): string {
  switch (kind) {
    case 'poison':
      return '#9ef08a';
    case 'fire':
      return '#ff8a3d';
    case 'heal':
    case 'music':
      return '#5dffa0';
    case 'void':
      return '#b77bff';
    case 'ice':
      return '#9ef0ff';
    case 'electric':
      return '#7df9ff';
    case 'holy':
      return '#fff1a8';
    default:
      return '#cfc6dd';
  }
}
