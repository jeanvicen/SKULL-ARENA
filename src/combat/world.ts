import type { ContentDB } from '../content/registry';
import type {
  CharacterDef, MapDef, MinionDef, ModeDef, ObstacleTypeDef, PetDef, ProjectileDef, StatusApply,
} from '../content/types';
import { circleRect, pointInRect, segmentRect, type Rect } from '../engine/collision';
import { clamp, dist, lerpAngle } from '../engine/math';
import { NavGrid } from '../engine/nav';
import { Pool } from '../engine/pool';
import { Rng } from '../engine/rng';
import { castAbility, updateBeam } from './abilities';
import { spawnShot, updateProjectiles } from './projectiles';
import {
  Fighter, Projectile, type AreaZone, type Crate, type GameEvent, type HitKind, type Pickup, type RingState, type Trap,
} from './state';
import { findAttackTarget } from './targeting';

export interface MatchFighterSpec {
  characterId: string;
  name: string;
  team: number;
  isBot: boolean;
  isPlayer?: boolean;
  level: number;
  skinId?: string;
  petId?: string | null;
  difficulty?: 'facil' | 'normal' | 'dificil';
}

export interface MatchSetup {
  mode: ModeDef;
  map: MapDef;
  fighters: MatchFighterSpec[];
  seed: number;
  /** Segundos de contagem regressiva (0 em testes). */
  countdown?: number;
}

export interface WorldObstacle extends Rect {
  type: string;
  def: ObstacleTypeDef;
}

const CRATE_SIZE: Record<Crate['type'], { w: number; h: number }> = {
  crate: { w: 44, h: 40 },
  urn: { w: 34, h: 34 },
  coffin: { w: 36, h: 62 },
};

/**
 * A simulação de combate. Não conhece DOM, canvas, áudio nem menus: recebe
 * intenções (FighterInput) e emite eventos (GameEvent). É isso que um servidor
 * autoritativo rodaria no futuro (ver src/net/contract.ts).
 */
export class World {
  readonly rng: Rng;
  readonly mode: ModeDef;
  readonly map: MapDef;
  readonly nav: NavGrid;

  time = 0;
  tick = 0;
  phase: 'countdown' | 'playing' | 'ended' = 'countdown';
  countdown: number;

  readonly fighters: Fighter[] = [];
  readonly byId = new Map<number, Fighter>();
  readonly projectiles = new Pool<Projectile>(() => new Projectile(), 128);
  readonly zones: AreaZone[] = [];
  readonly traps: Trap[] = [];
  readonly pickups: Pickup[] = [];
  readonly crates: Crate[] = [];
  readonly obstacles: WorldObstacle[] = [];
  readonly moveBlockers: Rect[] = [];
  readonly shotBlockers: Rect[] = [];
  readonly brush: Rect[] = [];
  ring: RingState | null = null;
  readonly teamKills = new Map<number, number>();
  readonly eliminated: number[] = [];
  winnerTeam = -1;
  endReason = '';

  /** Fila de eventos para a camada de apresentação (render/áudio/UI) — quem consome limpa. */
  readonly events: GameEvent[] = [];
  private timers: Array<{ t: number; fn: () => void }> = [];
  private nextId = 1;
  private ringAcc = new Map<number, number>();
  private lastCountdownN = -1;

  constructor(readonly content: ContentDB, setup: MatchSetup) {
    this.rng = new Rng(setup.seed);
    this.mode = setup.mode;
    this.map = setup.map;
    this.countdown = setup.countdown ?? 3;
    if (this.countdown <= 0) this.phase = 'playing';

    for (const o of setup.map.obstacles) {
      const def = content.obstacles[o.type];
      if (!def) continue;
      const wo: WorldObstacle = { x: o.x, y: o.y, w: o.w, h: o.h, type: o.type, def };
      this.obstacles.push(wo);
      if (def.blocksMove) this.moveBlockers.push(wo);
      if (def.blocksShots) this.shotBlockers.push(wo);
    }
    for (const b of setup.map.brush ?? []) this.brush.push({ ...b });
    for (const d of setup.map.destructibles ?? []) {
      const s = CRATE_SIZE[d.type] ?? CRATE_SIZE.crate;
      this.crates.push({ id: this.nextId++, type: d.type, x: d.x - s.w / 2, y: d.y - s.h / 2, w: s.w, h: s.h, hp: d.hp, maxHp: d.hp, alive: true, hurtT: 0 });
    }
    this.nav = new NavGrid(setup.map.size.w, setup.map.size.h, 30, [...this.moveBlockers, ...this.crates], 20);

    if (setup.mode.ring) {
      const { w, h } = setup.map.size;
      const startR = Math.sqrt(w * w + h * h) / 2 + 40;
      this.ring = {
        cx: w / 2, cy: h / 2, r: startR, startR, minR: setup.mode.ring.minRadius,
        delay: setup.mode.ring.delay, duration: setup.mode.ring.duration, dps: setup.mode.ring.dps, active: false,
      };
    }

    // Spawns
    const ffaSpawns = this.rng.shuffle([...setup.map.spawns]);
    const teamIdx = new Map<number, number>();
    setup.fighters.forEach((spec, i) => {
      let sp = ffaSpawns[i % ffaSpawns.length];
      if (setup.mode.kind === 'team' && setup.map.teamSpawns) {
        const list = spec.team === 0 ? setup.map.teamSpawns.a : setup.map.teamSpawns.b;
        const k = teamIdx.get(spec.team) ?? 0;
        teamIdx.set(spec.team, k + 1);
        sp = list[k % list.length];
      }
      const f = this.createFighter(content.character(spec.characterId), spec, sp.x, sp.y);
      if (spec.petId) {
        const pet = content.pets.get(spec.petId);
        if (pet) this.attachPet(f, pet);
      }
      this.teamKills.set(spec.team, 0);
    });
  }

  // ─────────────────────────── criação ───────────────────────────

  createFighter(def: CharacterDef, spec: MatchFighterSpec, x: number, y: number): Fighter {
    const prog = this.content.progression.character;
    const f = new Fighter();
    f.id = this.nextId++;
    f.name = spec.name;
    f.team = spec.team;
    f.isBot = spec.isBot;
    f.isPlayer = !!spec.isPlayer;
    f.def = def;
    f.skinId = spec.skinId ?? 'default';
    f.level = clamp(spec.level, 1, prog.maxLevel);
    f.difficulty = spec.difficulty ?? 'normal';
    f.x = f.px = x;
    f.y = f.py = y;
    f.radius = def.stats.radius ?? 22;
    f.baseMaxHp = Math.round(def.stats.hp * (1 + prog.hpPerLevel * (f.level - 1)));
    f.maxHp = f.hp = f.baseMaxHp;
    f.baseSpeed = def.stats.moveSpeed;
    f.attackInterval = def.stats.attackInterval;
    f.damageMul = 1 + prog.damagePerLevel * (f.level - 1);
    f.basic = this.content.projectile(def.basicAttack.projectile);
    f.ability = this.content.ability(def.special.ability);
    f.specialMax = f.ability.cooldown;
    f.specialCd = f.ability.cooldown * 0.5; // começa meio carregado: primeiro especial chega rápido
    f.facing = y > this.map.size.h / 2 ? -Math.PI / 2 : Math.PI / 2;
    f.invuln = this.content.control.spawnInvuln;
    f.spawnT = 1;
    this.fighters.push(f);
    this.byId.set(f.id, f);
    return f;
  }

  attachPet(f: Fighter, def: PetDef): void {
    f.pet = { def, x: f.x - 30, y: f.y - 20, px: f.x - 30, py: f.y - 20, t: 0, timer: def.params.interval ?? 1, phase: this.rng.next() * 6.28, pulse: 0 };
  }

  spawnMinion(owner: Fighter, m: MinionDef, x: number, y: number): Fighter {
    const def: CharacterDef = {
      id: `minion_${owner.def.id}`,
      name: m.name,
      title: '',
      rarity: owner.def.rarity,
      role: 'lutador',
      lore: '',
      voiceLines: { select: [], victory: [], defeat: [] },
      stats: { hp: m.hp, moveSpeed: m.moveSpeed, attackInterval: m.attackInterval, radius: m.radius },
      basicAttack: { projectile: m.projectile },
      special: { ability: owner.def.special.ability },
      animations: [],
      portrait: 'procedural',
      sprite: 'procedural',
      palette: [m.look.color, owner.def.palette[1], m.look.eyeColor],
      art: { skull: 'tiny', headwear: 'none', eyes: 'glow', eyeColor: m.look.eyeColor, jaw: 'grin', body: 'ribs', weapon: 'fist', scale: m.look.scale ?? 0.7 },
      skins: [],
      obtain: [],
    };
    const f = this.createFighter(def, { characterId: def.id, name: m.name, team: owner.team, isBot: true, level: owner.level }, x, y);
    f.isMinion = true;
    f.ownerId = owner.id;
    f.minionDef = m;
    f.lifetime = m.lifetime;
    f.specialCd = Infinity;
    f.invuln = 0;
    f.damageMul = owner.damageMul;
    this.events.push({ t: 'spawn', fighterId: f.id, x, y });
    return f;
  }

  newId(): number {
    return this.nextId++;
  }

  after(seconds: number, fn: () => void): void {
    this.timers.push({ t: this.time + seconds, fn });
  }

  // ─────────────────────────── consultas ───────────────────────────

  get player(): Fighter | undefined {
    return this.fighters.find((f) => f.isPlayer);
  }

  /** Visibilidade (mato/arbustos). Bots usam exatamente a mesma regra — sem trapaça. */
  canSee(viewer: Fighter, target: Fighter): boolean {
    if (viewer.team === target.team) return true;
    if (!target.inBrush) return true;
    if (target.revealT > 0 || target.hasStatus('reveal')) return true;
    const rd = this.content.control.brush.revealDistance;
    return dist(viewer.x, viewer.y, target.x, target.y) <= rd + target.radius;
  }

  hasLineOfSight(x0: number, y0: number, x1: number, y1: number, pad = 0): boolean {
    for (const o of this.shotBlockers) if (segmentRect(x0, y0, x1, y1, o, pad) >= 0) return false;
    for (const c of this.crates) if (c.alive && segmentRect(x0, y0, x1, y1, c, pad) >= 0) return false;
    return true;
  }

  /** Raycast contra paredes: retorna a fração livre (0..1) do segmento. */
  raycastWalls(x0: number, y0: number, x1: number, y1: number, pad: number, includeCrates = true): number {
    let best = 1;
    for (const o of this.moveBlockers) {
      const t = segmentRect(x0, y0, x1, y1, o, pad);
      if (t >= 0 && t < best) best = t;
    }
    if (includeCrates) {
      for (const c of this.crates) {
        if (!c.alive) continue;
        const t = segmentRect(x0, y0, x1, y1, c, pad);
        if (t >= 0 && t < best) best = t;
      }
    }
    return best;
  }

  isEnemy(a: Fighter, b: Fighter): boolean {
    return a.team !== b.team;
  }

  aliveTeams(): Set<number> {
    const s = new Set<number>();
    for (const f of this.fighters) if (f.alive && !f.isMinion) s.add(f.team);
    return s;
  }

  aliveCount(): number {
    let n = 0;
    for (const f of this.fighters) if (f.alive && !f.isMinion) n++;
    return n;
  }

  ownerOf(f: Fighter | null | undefined): Fighter | null {
    if (!f) return null;
    if (f.isMinion) return this.byId.get(f.ownerId) ?? f;
    return f;
  }

  // ─────────────────────────── modificadores ───────────────────────────

  speedOf(f: Fighter): number {
    let s = f.baseSpeed;
    s *= 1 - f.statusAmount('slow');
    s *= 1 + f.statusAmount('haste');
    for (const b of f.buffs) s *= b.speedMul;
    if (f.transform) s *= f.transform.speedMul;
    if (f.beam) s *= 0.45;
    return s;
  }

  damageMultiplier(f: Fighter): number {
    let m = f.damageMul;
    m *= 1 + f.souls * this.content.control.souls.damageBonus;
    m *= 1 + f.statusAmount('rage');
    m *= 1 - f.statusAmount('weaken');
    for (const b of f.buffs) m *= b.damageMul;
    if (f.transform) m *= f.transform.damageMul;
    return m;
  }

  attackSpeedMultiplier(f: Fighter): number {
    let m = 1;
    for (const b of f.buffs) m *= b.attackSpeedMul;
    return m;
  }

  // ─────────────────────────── dano / cura / status ───────────────────────────

  damage(target: Fighter, amount: number, source: Fighter | null, kind: HitKind, lifesteal = 0): number {
    if (!target.alive || target.invuln > 0 || this.phase !== 'playing' || amount <= 0) return 0;
    amount *= 1 + target.statusAmount('mark');
    let absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
      if (target.shield <= 0.5) {
        target.shield = 0;
        target.shieldT = 0;
        this.events.push({ t: 'shield_break', fighterId: target.id, x: target.x, y: target.y });
      }
    }
    const dealt = Math.round(amount);
    target.hp -= dealt;
    target.lastDamageTime = this.time;
    target.hurtT = 1;
    target.revealT = Math.max(target.revealT, 0.6);
    const credit = this.ownerOf(source);
    if (credit && credit !== target) {
      credit.damageDealt += dealt + absorbed;
      target.lastHitBy = credit.id;
    }
    if (source && lifesteal > 0 && dealt > 0) this.heal(source, dealt * lifesteal, source, true);
    for (const b of source?.buffs ?? []) if (b.lifesteal > 0 && dealt > 0) this.heal(source!, dealt * b.lifesteal, source, true);
    this.events.push({
      t: 'hit', x: target.x, y: target.y, targetId: target.id, sourceId: credit?.id ?? -1,
      amount: Math.round(dealt + absorbed), kind, big: dealt + absorbed >= 450 || kind === 'special', shielded: absorbed > 0 && dealt === 0,
    });
    if (target.hp <= 0) this.kill(target, credit);
    return dealt + absorbed;
  }

  heal(target: Fighter, amount: number, source: Fighter | null, silent = false): number {
    if (!target.alive || amount <= 0) return 0;
    if (target.hasStatus('poison')) amount *= 0.5;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    if (healed > 0) {
      const credit = this.ownerOf(source);
      if (credit) credit.healingDone += healed;
      if (!silent && healed >= 1) {
        target.healT = 1;
        this.events.push({ t: 'heal', x: target.x, y: target.y, targetId: target.id, amount: Math.round(healed) });
      }
    }
    return healed;
  }

  applyStatus(target: Fighter, s: StatusApply, sourceId: number): void {
    if (!target.alive) return;
    if (target.invuln > 0 && isNegative(s.effect)) return;
    const existing = target.statuses.find((x) => x.kind === s.effect);
    if (existing) {
      existing.t = Math.max(existing.t, s.duration);
      existing.amount = Math.max(existing.amount, s.amount ?? 0);
      existing.dps = Math.max(existing.dps, s.dps ?? 0);
      existing.sourceId = sourceId;
    } else {
      target.statuses.push({ kind: s.effect, t: s.duration, dps: s.dps ?? 0, amount: s.amount ?? 0, sourceId, tick: 0 });
    }
    if (s.effect === 'stun' || s.effect === 'freeze') {
      target.dash = null;
      target.beam = null;
      target.burstLeft = 0;
    }
    this.events.push({ t: 'status', fighterId: target.id, effect: s.effect });
  }

  knockback(target: Fighter, fromX: number, fromY: number, force: number): void {
    if (!target.alive || force <= 0) return;
    if (target.transform && target.transform.radiusMul > 1.2) force *= 0.4; // gigantes resistem a empurrão
    const dx = target.x - fromX, dy = target.y - fromY;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    target.vx += (dx / d) * force;
    target.vy += (dy / d) * force;
  }

  damageCrate(c: Crate, amount: number): void {
    if (!c.alive) return;
    c.hp -= amount;
    c.hurtT = 1;
    this.events.push({ t: 'crate_hit', x: c.x + c.w / 2, y: c.y + c.h / 2 });
    if (c.hp <= 0) {
      c.alive = false;
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      this.events.push({ t: 'crate_break', x: cx, y: cy, type: c.type });
      if (this.mode.souls) this.dropPickup('soul', cx, cy);
      else if (this.rng.chance(0.45)) this.dropPickup('potion', cx, cy);
      this.rebuildNav();
    }
  }

  private rebuildNav(): void {
    const grid = new NavGrid(this.map.size.w, this.map.size.h, 30, [...this.moveBlockers, ...this.crates.filter((c) => c.alive)], 20);
    this.nav.blocked.set(grid.blocked);
  }

  dropPickup(kind: Pickup['kind'], x: number, y: number): void {
    this.pickups.push({ id: this.nextId++, kind, x, y, t: 0, bob: this.rng.next() * 6.28 });
  }

  kill(target: Fighter, killer: Fighter | null): void {
    if (!target.alive) return;
    target.alive = false;
    target.hp = 0;
    target.deathTime = this.time;
    target.deaths++;
    target.dash = null;
    target.beam = null;
    target.statuses.length = 0;
    target.shield = 0;
    this.events.push({ t: 'death', fighterId: target.id, killerId: killer?.id ?? -1, x: target.x, y: target.y });
    if (target.isMinion) return;

    if (killer && killer !== target && killer.team !== target.team) {
      killer.kills++;
      this.teamKills.set(killer.team, (this.teamKills.get(killer.team) ?? 0) + 1);
    }
    // Minions morrem com o dono
    for (const m of this.fighters) if (m.isMinion && m.ownerId === target.id && m.alive) this.kill(m, null);

    if (this.mode.souls) {
      const n = 1 + Math.floor(target.souls / 2);
      for (let i = 0; i < n; i++) {
        const a = this.rng.next() * Math.PI * 2, r = 10 + this.rng.next() * 26;
        this.dropPickup('soul', target.x + Math.cos(a) * r, target.y + Math.sin(a) * r);
      }
    }
    if (this.mode.respawn !== undefined && this.mode.win.type === 'kill_target') {
      target.respawnT = this.mode.respawn;
    } else {
      target.placement = this.aliveCount() + 1;
      this.eliminated.push(target.id);
    }
  }

  // ─────────────────────────── passo de simulação ───────────────────────────

  step(dt: number): void {
    this.tick++;
    for (const f of this.fighters) {
      f.px = f.x;
      f.py = f.y;
      if (f.pet) {
        f.pet.px = f.pet.x;
        f.pet.py = f.pet.y;
      }
    }

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCountdownN && n > 0) {
        this.lastCountdownN = n;
        this.events.push({ t: 'countdown', n });
      }
      for (const f of this.fighters) this.tickAnim(f, dt);
      this.updatePets(dt);
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.events.push({ t: 'fight' });
      }
      return;
    }

    if (this.phase === 'ended') {
      for (const f of this.fighters) this.tickAnim(f, dt);
      this.updatePets(dt);
      updateProjectiles(this, dt);
      return;
    }

    this.time += dt;
    this.runTimers();
    this.thinkMinions();
    for (let i = 0; i < this.fighters.length; i++) this.updateFighter(this.fighters[i], dt);
    this.separateBodies();
    updateProjectiles(this, dt);
    this.updateZones(dt);
    this.updateTraps(dt);
    this.updatePickups(dt);
    this.updatePets(dt);
    this.updateRing(dt);
    for (const c of this.crates) if (c.hurtT > 0) c.hurtT = Math.max(0, c.hurtT - dt * 4);
    this.checkWin();
  }

  private runTimers(): void {
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.t <= this.time);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.t > this.time);
    for (const t of due) t.fn();
  }

  private tickAnim(f: Fighter, dt: number): void {
    f.attackT = Math.max(0, f.attackT - dt * 5);
    f.hurtT = Math.max(0, f.hurtT - dt * 5);
    f.specialT = Math.max(0, f.specialT - dt * 2.5);
    f.spawnT = Math.max(0, f.spawnT - dt * 2);
    f.healT = Math.max(0, f.healT - dt * 2);
  }

  private updateFighter(f: Fighter, dt: number): void {
    this.tickAnim(f, dt);
    if (!f.alive) {
      if (f.respawnT > 0) {
        f.respawnT -= dt;
        if (f.respawnT <= 0) this.respawn(f);
      }
      return;
    }

    if (f.isMinion) {
      f.lifetime -= dt;
      if (f.lifetime <= 0) {
        this.kill(f, null);
        return;
      }
    }

    f.invuln = Math.max(0, f.invuln - dt);
    f.revealT = Math.max(0, f.revealT - dt);
    if (f.shieldT > 0) {
      f.shieldT -= dt;
      if (f.shieldT <= 0) {
        f.shield = 0;
        f.shieldReflect = false;
      }
    }
    for (let i = f.buffs.length - 1; i >= 0; i--) {
      f.buffs[i].t -= dt;
      if (f.buffs[i].t <= 0) f.buffs.splice(i, 1);
    }
    if (f.transform) {
      f.transform.t -= dt;
      if (f.transform.t <= 0) {
        f.maxHp -= f.transform.hpBonus;
        f.hp = Math.min(f.hp, f.maxHp);
        f.radius = f.def.stats.radius ?? 22;
        f.transform = null;
      }
    }
    this.updateStatuses(f, dt);
    if (!f.alive) return;

    const stunned = f.hasStatus('stun') || f.hasStatus('freeze');
    const rooted = stunned || f.hasStatus('root');
    const silenced = stunned || f.hasStatus('silence');
    const inp = f.input;

    // Direção: mira separada (desktop/mouse) ou a direção do movimento (assinatura do jogo)
    let mag = Math.sqrt(inp.moveX * inp.moveX + inp.moveY * inp.moveY);
    if (mag > 1) mag = 1;
    if (!stunned && !f.dash) {
      if (inp.aimX !== undefined && inp.aimY !== undefined && (inp.aimX !== 0 || inp.aimY !== 0)) {
        f.facing = Math.atan2(inp.aimY, inp.aimX);
      } else if (mag > 0.01) {
        f.facing = Math.atan2(inp.moveY, inp.moveX);
      }
    }

    // Movimento
    if (f.dash) {
      const d = f.dash;
      const step = Math.min(dt, d.dur - d.t);
      f.x += d.vx * step;
      f.y += d.vy * step;
      d.t += dt;
      if (d.damage > 0 || d.status) {
        for (const e of this.fighters) {
          if (!e.alive || e.team === f.team || d.hit.includes(e.id)) continue;
          if (dist(f.x, f.y, e.x, e.y) <= f.radius + e.radius + 10) {
            d.hit.push(e.id);
            if (d.damage > 0) this.damage(e, d.damage * this.damageMultiplier(f), f, 'special');
            if (d.knockback) this.knockback(e, f.x, f.y, d.knockback);
            if (d.status) this.applyStatus(e, d.status, f.id);
          }
        }
      }
      if (d.t >= d.dur) {
        f.dash = null;
        f.moving = false;
      }
      f.moving = true;
    } else if (!rooted && mag > 0.01) {
      const sp = this.speedOf(f) * mag;
      f.x += (inp.moveX / (Math.sqrt(inp.moveX * inp.moveX + inp.moveY * inp.moveY) || 1)) * sp * dt;
      f.y += (inp.moveY / (Math.sqrt(inp.moveX * inp.moveX + inp.moveY * inp.moveY) || 1)) * sp * dt;
      f.moving = true;
      f.moveMag = mag;
      f.walkPhase += dt * sp * 0.045;
    } else {
      f.moving = false;
      f.moveMag = 0;
    }
    // Empurrão (knockback) com atrito
    if (f.vx !== 0 || f.vy !== 0) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const fr = Math.exp(-9 * dt);
      f.vx *= fr;
      f.vy *= fr;
      if (Math.abs(f.vx) < 2 && Math.abs(f.vy) < 2) f.vx = f.vy = 0;
    }
    this.collideWorld(f);

    f.inBrush = false;
    for (const b of this.brush) {
      if (pointInRect(f.x, f.y, b)) {
        f.inBrush = true;
        break;
      }
    }

    // Ataque básico — a regra assinatura
    f.attackCd -= dt * this.attackSpeedMultiplier(f);
    if (f.burstLeft > 0) {
      f.burstT -= dt;
      if (f.burstT <= 0) {
        const def = f.transform?.basicProjectile ?? f.basic;
        const tgt = f.burstTargetId >= 0 ? this.byId.get(f.burstTargetId) : undefined;
        const ang = tgt && tgt.alive ? lerpAngle(f.burstAngle, Math.atan2(tgt.y - f.y, tgt.x - f.x), 0.6) : f.burstAngle;
        spawnShot(this, f, def, ang, tgt?.x ?? f.x + Math.cos(ang) * def.range, tgt?.y ?? f.y + Math.sin(ang) * def.range, false, 1);
        f.burstLeft--;
        f.burstT = def.burst?.interval ?? 0.1;
      }
    } else if (!stunned && !f.beam && inp.attackHeld && f.attackCd <= 0) {
      const def = f.transform?.basicProjectile ?? f.basic;
      const needsLos = def.type !== 'lob' && this.content.control.requireLineOfSight;
      const range = def.type === 'melee' ? def.range + 4 : def.range;
      const target = findAttackTarget(this, f, range, needsLos);
      if (target) this.fireBasic(f, def, target.x, target.y, target.fighter);
    }
    if (f.attackCd < 0) f.attackCd = 0;

    // Especial
    if (inp.special) {
      inp.special = false;
      if (f.specialCd <= 0 && !silenced && !f.beam) {
        let ang = f.facing;
        if (inp.specialAimX !== undefined && inp.specialAimY !== undefined && (inp.specialAimX || inp.specialAimY)) {
          ang = Math.atan2(inp.specialAimY, inp.specialAimX);
        }
        castAbility(this, f, f.ability, ang);
        f.specialCd = f.specialMax;
        f.specialT = 1;
        f.specialsUsed++;
        f.revealT = Math.max(f.revealT, 1);
        f.lastAttackTime = this.time;
      }
    }
    if (f.specialCd > 0) {
      f.specialCd -= dt;
      if (f.specialCd <= 0) {
        f.specialCd = 0;
        this.events.push({ t: 'special_ready', fighterId: f.id });
      }
    }

    if (f.beam) updateBeam(this, f, dt);

    // Regeneração fora de combate
    const reg = this.content.control.regen;
    if (f.hp < f.maxHp && this.time - Math.max(f.lastDamageTime, f.lastAttackTime) > reg.delay && !f.isMinion) {
      this.heal(f, f.maxHp * reg.percentPerSec * dt, null, true);
    }
  }

  fireBasic(f: Fighter, def: ProjectileDef, tx: number, ty: number, target: Fighter | null): void {
    const toTarget = Math.atan2(ty - f.y, tx - f.x);
    const ang = lerpAngle(f.facing, toTarget, this.content.control.aimAssist);
    f.attackCd = f.attackInterval;
    f.attackT = 1;
    f.lastAttackTime = this.time;
    f.revealT = Math.max(f.revealT, this.content.control.brush.revealOnAttack);
    if (def.burst && def.burst.count > 1) {
      f.burstLeft = def.burst.count - 1;
      f.burstT = def.burst.interval;
      f.burstAngle = ang;
      f.burstTargetId = target?.id ?? -1;
    }
    spawnShot(this, f, def, ang, tx, ty, false, 1);
    // Pet "atira junto"
    if (f.pet && f.pet.def.ability === 'mirror_shot' && f.pet.def.params.projectile) {
      const pdef = this.content.projectiles.get(f.pet.def.params.projectile);
      if (pdef) {
        const pa = Math.atan2(ty - f.pet.y, tx - f.pet.x);
        spawnShot(this, f, pdef, pa, tx, ty, false, f.pet.def.params.damageMul ?? 0.3, f.pet.x, f.pet.y, 'pet');
        f.pet.pulse = 1;
      }
    }
  }

  private updateStatuses(f: Fighter, dt: number): void {
    for (let i = f.statuses.length - 1; i >= 0; i--) {
      const s = f.statuses[i];
      s.t -= dt;
      if (s.dps > 0) {
        s.tick += dt;
        if (s.tick >= 0.5) {
          s.tick -= 0.5;
          const src = this.byId.get(s.sourceId) ?? null;
          if (s.kind === 'regen') this.heal(f, s.dps * 0.5, src);
          else if (s.kind === 'burn' || s.kind === 'poison') this.damage(f, s.dps * 0.5, src, 'status');
          if (!f.alive) return;
        }
      }
      if (s.t <= 0) f.statuses.splice(i, 1);
    }
  }

  collideWorld(f: Fighter): void {
    const { w, h } = this.map.size;
    for (let iter = 0; iter < 2; iter++) {
      for (const o of this.moveBlockers) {
        const hit = circleRect(f.x, f.y, f.radius, o);
        if (hit) {
          f.x += hit.nx * hit.depth;
          f.y += hit.ny * hit.depth;
          if (f.dash) {
            // Bater na parede encerra o dash (previsível)
            f.dash.t = f.dash.dur;
          }
        }
      }
      for (const c of this.crates) {
        if (!c.alive) continue;
        const hit = circleRect(f.x, f.y, f.radius, c);
        if (hit) {
          f.x += hit.nx * hit.depth;
          f.y += hit.ny * hit.depth;
        }
      }
    }
    f.x = clamp(f.x, f.radius, w - f.radius);
    f.y = clamp(f.y, f.radius, h - f.radius);
  }

  /** "Bumper": corpos se empurram, ninguém atravessa ninguém. */
  private separateBodies(): void {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (rr - d) / 2;
        const nx = d2 > 0 ? dx / d : 1, ny = d2 > 0 ? dy / d : 0;
        const wa = a.dash ? 0.2 : 1, wb = b.dash ? 0.2 : 1;
        const tot = wa + wb;
        a.x -= nx * push * 2 * (wa / tot);
        a.y -= ny * push * 2 * (wa / tot);
        b.x += nx * push * 2 * (wb / tot);
        b.y += ny * push * 2 * (wb / tot);
      }
    }
    for (const f of fs) if (f.alive) this.collideWorld(f);
  }

  private thinkMinions(): void {
    for (const m of this.fighters) {
      if (!m.isMinion || !m.alive) continue;
      let best: Fighter | null = null;
      let bd = 520;
      for (const e of this.fighters) {
        if (!e.alive || e.team === m.team || !this.canSee(m, e)) continue;
        const d = dist(m.x, m.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const inp = m.input;
      inp.special = false;
      if (!best) {
        const owner = this.byId.get(m.ownerId);
        if (owner && owner.alive && dist(m.x, m.y, owner.x, owner.y) > 70) {
          inp.moveX = owner.x - m.x;
          inp.moveY = owner.y - m.y;
          const l = Math.hypot(inp.moveX, inp.moveY);
          inp.moveX /= l;
          inp.moveY /= l;
        } else {
          inp.moveX = inp.moveY = 0;
        }
        inp.attackHeld = false;
        inp.aimX = inp.aimY = undefined;
        continue;
      }
      const dx = best.x - m.x, dy = best.y - m.y;
      const l = Math.hypot(dx, dy) || 1;
      const want = m.basic.range * 0.75;
      inp.aimX = dx / l;
      inp.aimY = dy / l;
      if (l > want) {
        inp.moveX = dx / l;
        inp.moveY = dy / l;
      } else {
        inp.moveX = inp.moveY = 0;
      }
      inp.attackHeld = true;
    }
  }

  private respawn(f: Fighter): void {
    const list = this.map.teamSpawns ? (f.team === 0 ? this.map.teamSpawns.a : this.map.teamSpawns.b) : this.map.spawns;
    // Spawn mais longe dos inimigos vivos
    let best = list[0], bestScore = -Infinity;
    for (const s of list) {
      let minD = Infinity;
      for (const e of this.fighters) if (e.alive && e.team !== f.team) minD = Math.min(minD, dist(s.x, s.y, e.x, e.y));
      if (minD > bestScore) {
        bestScore = minD;
        best = s;
      }
    }
    f.alive = true;
    f.x = f.px = best.x;
    f.y = f.py = best.y;
    f.vx = f.vy = 0;
    f.maxHp = f.baseMaxHp + f.souls * this.content.control.souls.hpBonus * f.baseMaxHp;
    f.hp = f.maxHp;
    f.invuln = this.content.control.spawnInvuln;
    f.spawnT = 1;
    f.transform = null;
    f.buffs.length = 0;
    f.burstLeft = 0;
    f.radius = f.def.stats.radius ?? 22;
    this.events.push({ t: 'spawn', fighterId: f.id, x: f.x, y: f.y });
  }

  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      z.tickAcc += dt;
      if (z.tickAcc >= 0.25) {
        z.tickAcc -= 0.25;
        const owner = this.byId.get(z.ownerId) ?? null;
        for (const f of this.fighters) {
          if (!f.alive) continue;
          if (dist(f.x, f.y, z.x, z.y) > z.radius + f.radius * 0.5) continue;
          if (f.team !== z.team) {
            if (z.spec.dps) this.damage(f, z.spec.dps * 0.25 * (owner ? this.damageMultiplier(owner) : 1), owner, 'zone');
            if (z.spec.status) this.applyStatus(f, z.spec.status, z.ownerId);
          } else if (z.spec.hps) {
            this.heal(f, z.spec.hps * 0.25, owner, true);
            f.healT = Math.max(f.healT, 0.5);
          }
        }
      }
      if (z.t >= z.dur) this.zones.splice(i, 1);
    }
  }

  private updateTraps(dt: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.t += dt;
      if (tr.t > 14) {
        this.traps.splice(i, 1);
        continue;
      }
      if (tr.t < tr.armT) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.team === tr.team) continue;
        if (dist(f.x, f.y, tr.x, tr.y) <= tr.radius + f.radius * 0.4) {
          const owner = this.byId.get(tr.ownerId) ?? null;
          for (const g of this.fighters) {
            if (!g.alive || g.team === tr.team) continue;
            if (dist(g.x, g.y, tr.x, tr.y) <= tr.radius * 1.4 + g.radius) {
              this.damage(g, tr.damage * (owner ? this.damageMultiplier(owner) : 1), owner, 'trap');
              if (tr.status) this.applyStatus(g, tr.status, tr.ownerId);
            }
          }
          this.events.push({ t: 'explode', x: tr.x, y: tr.y, radius: tr.radius * 1.4, color: tr.color, color2: '#ffffff' });
          this.traps.splice(i, 1);
          break;
        }
      }
    }
  }

  private updatePickups(dt: number): void {
    const souls = this.content.control.souls;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      for (const f of this.fighters) {
        if (!f.alive || f.isMinion) continue;
        if (dist(f.x, f.y, p.x, p.y) > f.radius + 18) continue;
        if (p.kind === 'soul') {
          if (f.souls >= souls.max) continue;
          f.souls++;
          f.soulsCollected++;
          const bonus = f.baseMaxHp * souls.hpBonus;
          f.maxHp += bonus;
          f.hp += bonus;
        } else {
          if (f.hp >= f.maxHp) continue;
          this.heal(f, f.maxHp * 0.35, null);
        }
        this.events.push({ t: 'pickup', fighterId: f.id, kind: p.kind, x: p.x, y: p.y });
        this.pickups.splice(i, 1);
        break;
      }
    }
  }

  private updatePets(dt: number): void {
    for (const f of this.fighters) {
      const pet = f.pet;
      if (!pet) continue;
      pet.t += dt;
      pet.pulse = Math.max(0, pet.pulse - dt * 2);
      // Segue o dono flutuando atrás do ombro
      const back = f.facing + Math.PI * 0.75;
      const tx = f.x + Math.cos(back) * 34 + Math.cos(pet.t * 2 + pet.phase) * 6;
      const ty = f.y + Math.sin(back) * 26 - 18 + Math.sin(pet.t * 3 + pet.phase) * 5;
      const k = 1 - Math.exp(-8 * dt);
      pet.x += (tx - pet.x) * k;
      pet.y += (ty - pet.y) * k;
      if (!f.alive || this.phase !== 'playing') continue;
      const p = pet.def.params;
      switch (pet.def.ability) {
        case 'aura_heal':
          if (f.hp < f.maxHp) {
            this.heal(f, (p.hps ?? 20) * dt, f, true);
            if (pet.timer <= 0) {
              pet.timer = 1.2;
              pet.pulse = 1;
              this.events.push({ t: 'pet_act', fighterId: f.id, x: pet.x, y: pet.y, kind: 'heal' });
            }
          }
          pet.timer -= dt;
          break;
        case 'reveal': {
          pet.timer -= dt;
          if (pet.timer <= 0) {
            pet.timer = p.interval ?? 1;
            let any = false;
            for (const e of this.fighters) {
              if (!e.alive || e.team === f.team) continue;
              if (dist(e.x, e.y, f.x, f.y) <= (p.radius ?? 320)) {
                this.applyStatus(e, { effect: 'reveal', duration: (p.interval ?? 1) + 0.2 }, f.id);
                if (e.inBrush) any = true;
              }
            }
            if (any) {
              pet.pulse = 1;
              this.events.push({ t: 'pet_act', fighterId: f.id, x: pet.x, y: pet.y, kind: 'reveal' });
            }
          }
          break;
        }
        case 'shield_pulse':
          pet.timer -= dt;
          if (pet.timer <= 0) {
            pet.timer = p.interval ?? 8;
            const amt = (p.shield ?? 300) * (1 + this.content.progression.character.hpPerLevel * (f.level - 1));
            if (f.shield < amt) {
              f.shield = amt;
              f.shieldMax = amt;
              f.shieldT = 4;
              pet.pulse = 1;
              this.events.push({ t: 'pet_act', fighterId: f.id, x: pet.x, y: pet.y, kind: 'shield' });
            }
          }
          break;
        case 'mirror_shot':
          break; // tratado em fireBasic
      }
    }
  }

  private updateRing(dt: number): void {
    const r = this.ring;
    if (!r) return;
    if (this.time < r.delay) return;
    if (!r.active) {
      r.active = true;
      this.events.push({ t: 'ring_start' });
    }
    const k = clamp((this.time - r.delay) / r.duration, 0, 1);
    r.r = r.startR + (r.minR - r.startR) * k;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (dist(f.x, f.y, r.cx, r.cy) <= r.r) {
        this.ringAcc.set(f.id, 0);
        continue;
      }
      const acc = (this.ringAcc.get(f.id) ?? 0) + dt;
      if (acc >= 0.5) {
        this.ringAcc.set(f.id, acc - 0.5);
        const over = 1 + Math.max(0, this.time - r.delay - r.duration) / 20;
        this.damage(f, r.dps * 0.5 * over, null, 'ring');
      } else {
        this.ringAcc.set(f.id, acc);
      }
    }
  }

  private checkWin(): void {
    if (this.phase !== 'playing') return;
    const win = this.mode.win;
    if (win.type === 'last_standing') {
      const teams = this.aliveTeams();
      if (teams.size <= 1) {
        this.end(teams.size === 1 ? [...teams][0] : -1, 'last_standing');
        return;
      }
      if (win.timeLimit && this.time >= win.timeLimit) {
        // Tempo esgotado: vence quem tem mais vida proporcional
        let best: Fighter | null = null;
        for (const f of this.fighters) if (f.alive && !f.isMinion && (!best || f.hp / f.maxHp > best.hp / best.maxHp)) best = f;
        this.end(best ? best.team : -1, 'time');
      }
    } else {
      const target = win.target ?? 10;
      for (const [team, k] of this.teamKills) {
        if (k >= target) {
          this.end(team, 'kills');
          return;
        }
      }
      if (win.timeLimit && this.time >= win.timeLimit) {
        let bestTeam = -1, bestK = -1, tie = false;
        for (const [team, k] of this.teamKills) {
          if (k > bestK) {
            bestK = k;
            bestTeam = team;
            tie = false;
          } else if (k === bestK) tie = true;
        }
        this.end(tie ? -1 : bestTeam, 'time');
      }
    }
  }

  end(winnerTeam: number, reason: string): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.winnerTeam = winnerTeam;
    this.endReason = reason;
    for (const f of this.fighters) {
      if (f.isMinion) continue;
      if (f.alive && f.team === winnerTeam) f.placement = 1;
    }
    // Sobreviventes que não venceram (tempo) ficam logo atrás
    const survivors = this.fighters.filter((f) => !f.isMinion && f.alive && f.team !== winnerTeam).sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp);
    let place = this.fighters.some((f) => f.placement === 1) ? 2 : 1;
    for (const f of survivors) f.placement = place++;
    this.events.push({ t: 'match_end', winnerTeam });
  }

  /** Chamado pela UI quando o jogador desiste/sai. */
  forfeit(f: Fighter): void {
    if (f.alive) this.kill(f, null);
  }
}

function isNegative(k: string): boolean {
  return k === 'burn' || k === 'poison' || k === 'slow' || k === 'stun' || k === 'freeze' || k === 'root' || k === 'weaken' || k === 'mark' || k === 'silence';
}
