import type { AbilityDef, CharacterDef, MapDef, ModeDef, PetDef, StatusApply, StatusKind } from '../content/types';
import { RARITY } from '../content/rarities';
import { Rng } from '../engine/rng';
import { circleRectPush, clamp, len, normalize } from '../engine/math';
import { GameMap, T, TILE } from './map';
import { castAbility } from './abilities';
import { updateProjectiles } from './projectiles';
import type { Beam, Delayed, Fighter, FighterInput, GameEvent, Pickup, PickupKind, Projectile, Prop, PropKind, Summon, Trap, Zone } from './types';

/**
 * O MUNDO DA PARTIDA — simulação determinística em passo fixo (60 Hz).
 * Não conhece DOM nem canvas: roda igual no navegador, nos testes e no servidor online.
 * Entrada: FighterInput por lutador. Saída: estado + lista de eventos do passo.
 */

export const STEP = 1 / 60;
export const FIGHTER_RADIUS = 26;
const REGEN_DELAY = 3;
const REGEN_RATE = 0.12;
const BUSH_SEE = 170;
const COUNTDOWN = 3;

export interface RosterEntry {
  name: string;
  def: CharacterDef;
  team: number;
  isBot: boolean;
  isLocal?: boolean;
  pet?: PetDef | null;
  level?: number;
}

export interface WorldOpts {
  map: MapDef;
  mode: ModeDef;
  seed: number;
  roster: RosterEntry[];
  /** pula a contagem 3-2-1 (testes) */
  skipCountdown?: boolean;
  /** chefão (modo Caveira Gigante) */
  boss?: CharacterDef;
}

export interface DamageOpts {
  knock?: number;
  /** direção do empurrão (se não vier, usa a direção atacante → alvo) */
  dirX?: number;
  dirY?: number;
  status?: StatusApply;
  isSuper?: boolean;
  noCharge?: boolean;
  lifesteal?: number;
  /** atinge também o escudo? (padrão sim) */
  pierceShield?: boolean;
}

export class World {
  readonly map: GameMap;
  readonly mode: ModeDef;
  readonly rng: Rng;
  readonly fighters: Fighter[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  summons: Summon[] = [];
  traps: Trap[] = [];
  beams: Beam[] = [];
  props: Prop[] = [];
  pickups: Pickup[] = [];
  delayed: Delayed[] = [];
  events: GameEvent[] = [];
  /** mira de meteoros (evento) */
  meteors: Array<{ x: number; y: number; at: number }> = [];
  tick = 0;
  time = 0;
  /** tempo de jogo (depois da contagem) */
  clock = 0;
  started = false;
  over = false;
  winner = -2;
  scores: number[] = [];
  private nextId = 1;
  private countdownLeft: number;
  private lastCountdownN = -1;
  private healT = 0;
  private powerT = 0;
  private meteorT = 4;
  readonly boss: Fighter | null = null;

  constructor(opts: WorldOpts) {
    this.map = new GameMap(opts.map);
    this.mode = opts.mode;
    this.rng = new Rng(opts.seed);
    this.countdownLeft = opts.skipCountdown ? 0 : COUNTDOWN;
    this.started = !!opts.skipCountdown;
    const nTeams = opts.mode.teams === 0 ? opts.roster.length : opts.mode.teams;
    this.scores = new Array(Math.max(1, nTeams)).fill(0);
    for (const r of opts.roster) this.addFighter(r);
    if (opts.boss) {
      const b = this.addFighter({ name: 'CAVEIRA GIGANTE', def: opts.boss, team: 1, isBot: true, level: 1 });
      b.maxHp *= 30 + opts.roster.length * 4;
      b.hp = b.maxHp;
      b.radius = 62;
      (this as { boss: Fighter | null }).boss = b;
    }
    for (const p of this.map.spawns.props) this.addProp(p.kind, p.x, p.y);
    if (this.started) this.events.push({ type: 'start' });
  }

  uid(): number {
    return this.nextId++;
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  addFighter(r: RosterEntry): Fighter {
    const level = clamp(r.level ?? 1, 1, 10);
    const lvl = 1 + 0.05 * (level - 1);
    const rar = RARITY[r.def.rarity].power;
    const pet = r.pet ?? null;
    const pb = pet?.bonus ?? {};
    const passive = r.def.passive;
    const maxHp = Math.round(r.def.stats.hp * rar * lvl * (1 + (pb.hp ?? 0)));
    const id = this.fighters.length;
    const f: Fighter = {
      id,
      name: r.name,
      def: r.def,
      team: this.mode.teams === 0 ? id : r.team,
      isBot: r.isBot,
      isLocal: !!r.isLocal,
      pet,
      level,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      kx: 0,
      ky: 0,
      z: 0,
      radius: FIGHTER_RADIUS,
      hp: maxHp,
      maxHp,
      shield: 0,
      shieldT: 0,
      ammo: r.def.stats.ammo,
      maxAmmo: r.def.stats.ammo,
      reload: r.def.stats.reload,
      superCharge: 0,
      skillCd: r.def.skills.map(() => 0),
      atkCd: 0,
      statuses: [],
      buffs: [],
      alive: true,
      respawnT: 0,
      invulnT: 2,
      aim: 0,
      aiming: false,
      moving: false,
      inBush: false,
      revealT: 0,
      stealthT: 0,
      dash: null,
      jump: null,
      lastHurtT: -99,
      lastAtkT: -99,
      lastHitBy: -1,
      assistIds: new Map(),
      stats: { kills: 0, deaths: 0, assists: 0, damage: 0, healed: 0, skulls: 0, supers: 0, skills: 0, boxes: 0, coins: 0, streak: 0, bestStreak: 0 },
      history: [],
      petShieldUsed: false,
      petSparkT: 2,
      dmgMult: rar * lvl * (1 + (pb.damage ?? 0)) * (passive?.damageMult ?? 1) * (this.mode.modifiers?.damageMult ?? 1),
      hpMult: 1,
      wanted: false,
      idleTicks: 0,
      lastCast: null,
      hazardT: 0,
    };
    this.fighters.push(f);
    const sp = this.spawnPoint(f);
    f.x = f.px = sp.x;
    f.y = f.py = sp.y;
    f.aim = f.team === 1 ? Math.PI : 0;
    return f;
  }

  addProp(kind: PropKind, x: number, y: number): Prop {
    const p: Prop = {
      id: this.uid(),
      kind,
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      rot: this.rng.range(-0.3, 0.3),
      vr: 0,
      radius: kind === 'barrel' ? 20 : kind === 'tire' ? 18 : 24,
      mass: kind === 'barrel' ? 2 : kind === 'tire' ? 1 : 3,
      hp: kind === 'barrel' ? 600 : kind === 'tire' ? 900 : 1300,
      alive: true,
      z: 0,
      vz: 0,
    };
    this.props.push(p);
    return p;
  }

  addPickup(kind: PickupKind, x: number, y: number, team = -1, killerTeam = -1, value = 1): Pickup {
    const p: Pickup = {
      id: this.uid(),
      kind,
      x,
      y,
      team,
      killerTeam,
      t: kind === 'skull' ? 16 : kind === 'coin' ? 20 : 30,
      value,
      z: 0,
      vz: 260,
      vx: this.rng.range(-80, 80),
      vy: this.rng.range(-80, 80),
    };
    this.pickups.push(p);
    return p;
  }

  spawnPoint(f: Fighter): { x: number; y: number } {
    const sp = this.map.spawns;
    let list = sp.free;
    if (this.mode.teams === 2) list = f.team === 0 ? (sp.teamA.length ? sp.teamA : sp.free) : sp.teamB.length ? sp.teamB : sp.free;
    // escolhe o ponto mais longe dos inimigos vivos (evita nascer do lado de alguém)
    let best = list[0]!;
    let bestScore = -Infinity;
    for (const p of list) {
      let minD = 1e9;
      for (const o of this.fighters) {
        if (o === f || !o.alive || o.team === f.team) continue;
        const d = len(o.x - p.x, o.y - p.y);
        if (d < minD) minD = d;
      }
      const crowd = this.fighters.filter((o) => o !== f && o.alive && len(o.x - p.x, o.y - p.y) < 50).length;
      const score = Math.min(minD, 900) - crowd * 300 + this.rng.range(0, 120);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return this.map.nearestFree(best.x + this.rng.range(-14, 14), best.y + this.rng.range(-14, 14));
  }

  // -------------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------------

  fighter(id: number): Fighter | undefined {
    return this.fighters[id];
  }

  isEnemy(a: { team: number }, b: { team: number }): boolean {
    return a.team !== b.team;
  }

  /** O lutador `f` é visível pro time `team`? (arbusto, furtividade) */
  visibleTo(f: Fighter, team: number): boolean {
    if (f.team === team) return true;
    if (!f.alive) return false;
    if (f.revealT > this.time) return true;
    if (this.hasStatus(f, 'reveal')) return true;
    const hidden = f.inBush || f.stealthT > 0;
    if (!hidden) return true;
    const near = f.stealthT > 0 ? 110 : BUSH_SEE;
    for (const o of this.fighters) {
      if (o.alive && o.team === team && len(o.x - f.x, o.y - f.y) < near) return true;
      const rr = o.pet?.bonus.revealRadius;
      if (rr && o.alive && o.team === team && f.stealthT <= 0 && len(o.x - f.x, o.y - f.y) < rr) return true;
    }
    return false;
  }

  hasStatus(f: Fighter, k: StatusKind): boolean {
    for (const s of f.statuses) if (s.kind === k) return true;
    return false;
  }

  statusPower(f: Fighter, k: StatusKind): number {
    let p = 0;
    for (const s of f.statuses) if (s.kind === k) p = Math.max(p, s.power);
    return p;
  }

  canAct(f: Fighter): boolean {
    return f.alive && !this.hasStatus(f, 'stun') && !this.hasStatus(f, 'freeze') && this.started && !this.over;
  }

  speedOf(f: Fighter): number {
    let s = f.def.stats.speed;
    s *= f.def.passive?.speedMult ?? 1;
    s *= 1 + (f.pet?.bonus.speed ?? 0);
    s *= this.mode.modifiers?.speedMult ?? 1;
    for (const b of f.buffs) if (b.stat === 'speed') s *= b.mult;
    const slow = this.statusPower(f, 'slow');
    const haste = this.statusPower(f, 'haste');
    return s * (1 - slow) * (1 + haste);
  }

  armorOf(f: Fighter): number {
    let a = f.def.passive?.armor ?? 0;
    for (const b of f.buffs) if (b.stat === 'armor') a = 1 - (1 - a) * (1 - (b.mult - 1));
    return clamp(a, 0, 0.8);
  }

  damageMultOf(f: Fighter): number {
    let m = f.dmgMult;
    for (const b of f.buffs) if (b.stat === 'damage') m *= b.mult;
    m *= 1 + this.statusPower(f, 'rage');
    m *= 1 - this.statusPower(f, 'weaken');
    const low = f.def.passive?.lowHpRage;
    if (low && f.hp < f.maxHp * 0.4) m *= 1 + low;
    return m;
  }

  nearestEnemy(f: { x: number; y: number; team: number }, range: number, needLos = true): Fighter | null {
    let best: Fighter | null = null;
    let bd = range;
    for (const o of this.fighters) {
      if (!o.alive || o.team === f.team || !this.visibleTo(o, f.team)) continue;
      const d = len(o.x - f.x, o.y - f.y);
      if (d < bd && (!needLos || this.map.los(f.x, f.y, o.x, o.y))) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Passo
  // -------------------------------------------------------------------------

  step(inputs: ReadonlyArray<FighterInput | undefined>): GameEvent[] {
    this.events = [];
    const dt = STEP;
    this.tick++;
    this.time += dt;

    if (!this.started) {
      this.countdownLeft -= dt;
      const n = Math.ceil(this.countdownLeft);
      if (n !== this.lastCountdownN && n > 0) {
        this.lastCountdownN = n;
        this.events.push({ type: 'countdown', n });
      }
      if (this.countdownLeft <= 0) {
        this.started = true;
        this.events.push({ type: 'start' });
      }
    } else if (!this.over) this.clock += dt;

    // efeitos atrasados (rajadas, áreas com atraso...)
    if (this.delayed.length) {
      const due = this.delayed.filter((d) => d.at <= this.time);
      if (due.length) {
        this.delayed = this.delayed.filter((d) => d.at > this.time);
        for (const d of due) d.run();
      }
    }

    for (const f of this.fighters) this.updateFighter(f, inputs[f.id], dt);
    updateProjectiles(this, dt);
    this.updateBeams(dt);
    this.updateZones(dt);
    this.updateSummons(dt);
    this.updateTraps(dt);
    this.updateProps(dt);
    this.updatePickups(dt);
    this.updateSpawners(dt);
    if (this.mode.modifiers?.meteors && this.started && !this.over) this.updateMeteors(dt);
    for (const g of this.map.expireTemp(this.time)) this.events.push({ type: 'tileBreak', tx: g.tx, ty: g.ty, tile: T.TempWall });
    this.updateMode();
    return this.events;
  }

  private updateFighter(f: Fighter, input: FighterInput | undefined, dt: number): void {
    f.px = f.x;
    f.py = f.y;
    if (!f.alive) {
      if (this.over) return;
      f.respawnT -= dt;
      if (f.respawnT <= 0 && f !== this.boss) this.respawn(f);
      return;
    }
    // timers
    if (f.invulnT > 0) f.invulnT -= dt;
    if (f.stealthT > 0) f.stealthT -= dt;
    if (f.atkCd > 0) f.atkCd -= dt;
    for (let i = 0; i < f.skillCd.length; i++) if (f.skillCd[i]! > 0) f.skillCd[i]! -= dt;
    if (f.shieldT > 0) {
      f.shieldT -= dt;
      if (f.shieldT <= 0) f.shield = 0;
    }
    for (const b of f.buffs) b.t -= dt;
    f.buffs = f.buffs.filter((b) => b.t > 0);
    this.tickStatuses(f, dt);
    if (!f.alive) return;

    // histórico (voltar no tempo) a cada 6 passos, guarda ~4 s
    if (this.tick % 6 === 0) {
      f.history.push({ x: f.x, y: f.y, hp: f.hp, t: this.time });
      if (f.history.length > 40) f.history.shift();
    }

    const inp = input ?? null;
    const act = this.canAct(f);
    const rooted = this.hasStatus(f, 'root');

    // munição
    if (f.ammo < f.maxAmmo) {
      let rate = 1 / f.reload;
      rate *= 1 + (f.pet?.bonus.reload ?? 0);
      for (const b of f.buffs) if (b.stat === 'reload') rate *= b.mult;
      f.ammo = Math.min(f.maxAmmo, f.ammo + rate * dt);
    }
    // regeneração fora de combate
    const regenOk = this.time - f.lastHurtT > REGEN_DELAY && this.time - f.lastAtkT > REGEN_DELAY && !this.hasStatus(f, 'poison') && !this.hasStatus(f, 'burn');
    if (f.hp < f.maxHp && f !== this.boss) {
      let r = regenOk ? f.maxHp * REGEN_RATE : 0;
      r += (f.def.passive?.regen ?? 0) + (f.pet?.bonus.regen ?? 0);
      if (f.inBush && f.def.passive?.bushHeal) r += f.def.passive.bushHeal;
      if (r > 0) f.hp = Math.min(f.maxHp, f.hp + r * dt);
    }

    // pulo (pad de salto): ignora paredes até pousar
    if (f.jump) {
      const j = f.jump;
      j.t += dt;
      const u = Math.min(1, j.t / j.dur);
      f.x = j.sx + (j.tx - j.sx) * u;
      f.y = j.sy + (j.ty - j.sy) * u;
      f.z = Math.sin(u * Math.PI) * 120;
      if (u >= 1) {
        f.jump = null;
        f.z = 0;
        const free = this.map.nearestFree(f.x, f.y, f.radius);
        f.x = free.x;
        f.y = free.y;
        this.events.push({ type: 'land', id: f.id, x: f.x, y: f.y });
      }
      return;
    }

    // dash
    if (f.dash) {
      const d = f.dash;
      d.t -= dt;
      const nx = f.x + d.vx * dt;
      const ny = f.y + d.vy * dt;
      f.x = nx;
      f.y = ny;
      const blocked = this.collideWalls(f);
      if (d.damage > 0 || d.knockback > 0) {
        for (const o of this.fighters) {
          if (!o.alive || o.team === f.team || d.hit.includes(o.id)) continue;
          if (len(o.x - f.x, o.y - f.y) < d.radius + o.radius) {
            d.hit.push(o.id);
            const n = normalize(d.vx, d.vy);
            this.damageFighter(o, d.damage, f, { knock: d.knockback, dirX: n.x, dirY: n.y, status: d.status, isSuper: false });
          }
        }
        for (const p of this.props) if (p.alive && len(p.x - f.x, p.y - f.y) < d.radius + p.radius) this.pushProp(p, d.vx * 0.6, d.vy * 0.6, 220);
      }
      if (d.t <= 0 || blocked) f.dash = null;
      f.vx = d.vx;
      f.vy = d.vy;
      f.moving = true;
      this.afterMove(f, dt);
      return;
    }

    // movimento
    let mx = 0;
    let my = 0;
    if (inp && act && !rooted) {
      mx = inp.mx;
      my = inp.my;
      const l = len(mx, my);
      if (l > 1) {
        mx /= l;
        my /= l;
      }
      if (l > 0.05 || inp.fire || inp.skill >= 0) f.idleTicks = 0;
      else f.idleTicks++;
    }
    const sp = this.speedOf(f);
    const tvx = mx * sp;
    const tvy = my * sp;
    const k = 1 - Math.exp(-22 * dt);
    f.vx += (tvx - f.vx) * k;
    f.vy += (tvy - f.vy) * k;
    // knockback amortecido
    f.kx *= Math.exp(-7 * dt);
    f.ky *= Math.exp(-7 * dt);
    f.x += (f.vx + f.kx) * dt;
    f.y += (f.vy + f.ky) * dt;
    f.moving = len(mx, my) > 0.1;
    this.collideWalls(f);

    // mira + ações
    if (inp) {
      if (inp.ax !== 0 || inp.ay !== 0) f.aim = Math.atan2(inp.ay, inp.ax);
      else if (f.moving) f.aim = Math.atan2(my, mx);
      f.aiming = inp.aiming;
      if (act) this.handleActions(f, inp);
    }
    this.afterMove(f, dt);
  }

  /** depois de mover: arbusto, perigo, pad, pet */
  private afterMove(f: Fighter, dt: number): void {
    const tile = this.map.atPx(f.x, f.y);
    f.inBush = tile === T.Bush;
    if (tile === T.Hazard && f.z <= 0) {
      f.hazardT -= dt;
      if (f.hazardT <= 0) {
        f.hazardT = 0.25;
        this.damageFighter(f, 260, null, {});
      }
    }
    if (tile === T.Pad && !f.jump && f.alive) {
      const dir = len(f.vx, f.vy) > 20 ? normalize(f.vx, f.vy) : { x: Math.cos(f.aim), y: Math.sin(f.aim) };
      const dist = TILE * 5;
      const tx = clamp(f.x + dir.x * dist, TILE * 1.5, this.map.widthPx - TILE * 1.5);
      const ty = clamp(f.y + dir.y * dist, TILE * 1.5, this.map.heightPx - TILE * 1.5);
      f.jump = { sx: f.x, sy: f.y, tx, ty, t: 0, dur: 0.7 };
      f.dash = null;
      this.events.push({ type: 'jump', id: f.id });
    }
    // pet: faísca automática
    const spark = f.pet?.bonus.spark;
    if (spark && this.started) {
      f.petSparkT -= dt;
      if (f.petSparkT <= 0) {
        const target = this.nearestEnemy(f, spark.range);
        if (target) {
          f.petSparkT = spark.interval;
          const a = Math.atan2(target.y - f.y, target.x - f.x);
          this.spawnProjectile(
            f,
            f.x - Math.cos(a) * 30,
            f.y - 34,
            a,
            { speed: 900, range: spark.range + 60, radius: 10, damage: spark.damage, homing: 6, look: { shape: 'orb', color: f.pet!.colors[2], trail: 'glow', size: 0.7 } },
            { noCharge: true },
          );
        } else f.petSparkT = 0.5;
      }
    }
  }

  private handleActions(f: Fighter, inp: FighterInput): void {
    const def = f.def;
    // ataque básico
    if (inp.fire && f.atkCd <= 0 && f.ammo >= 1) {
      const dir = this.resolveAim(f, def.attack, inp);
      f.ammo -= 1;
      f.atkCd = def.attack.cooldown ?? 0.32;
      f.lastAtkT = this.time;
      f.revealT = this.time + 1.2;
      f.stealthT = 0;
      f.aim = Math.atan2(dir.y, dir.x);
      f.lastCast = { kind: 'attack', t: this.time, idx: 0 };
      castAbility(this, f, def.attack, dir.x, dir.y, dir.d, 'attack');
    }
    if (inp.skill < 0) return;
    const silenced = this.hasStatus(f, 'silence');
    if (silenced) return;
    if (inp.skill === 3) {
      if (f.superCharge >= 1) {
        const dir = this.resolveAim(f, def.super, inp);
        f.superCharge = 0;
        f.stats.supers++;
        f.lastAtkT = this.time;
        f.revealT = this.time + 1.2;
        f.stealthT = 0;
        f.aim = Math.atan2(dir.y, dir.x);
        f.lastCast = { kind: 'super', t: this.time, idx: 3 };
        castAbility(this, f, def.super, dir.x, dir.y, dir.d, 'super');
      }
      return;
    }
    const ab = def.skills[inp.skill];
    if (!ab || f.skillCd[inp.skill]! > 0) return;
    const dir = this.resolveAim(f, ab, inp);
    f.skillCd[inp.skill] = ab.cooldown ?? 8;
    f.stats.skills++;
    f.lastAtkT = this.time;
    f.aim = Math.atan2(dir.y, dir.x);
    f.lastCast = { kind: 'skill', t: this.time, idx: inp.skill };
    castAbility(this, f, ab, dir.x, dir.y, dir.d, 'skill');
  }

  /** Mira final: manual ou automática (toque rápido) com antecipação do alvo. */
  resolveAim(f: Fighter, ab: AbilityDef, inp: FighterInput): { x: number; y: number; d: number } {
    if (ab.aim === 'self') return { x: Math.cos(f.aim), y: Math.sin(f.aim), d: 0 };
    if (inp.auto) {
      const t = this.nearestEnemy(f, ab.range + 80, ab.aim !== 'point');
      if (t) {
        // antecipa o movimento do alvo
        const speed = firstProjSpeed(ab) ?? 1100;
        const dd = len(t.x - f.x, t.y - f.y);
        const lead = Math.min(0.5, dd / speed);
        const tx = t.x + t.vx * lead * 0.7;
        const ty = t.y + t.vy * lead * 0.7;
        const n = normalize(tx - f.x, ty - f.y);
        return { x: n.x, y: n.y, d: clamp(len(tx - f.x, ty - f.y) / Math.max(1, ab.range), 0.1, 1) };
      }
      return { x: Math.cos(f.aim), y: Math.sin(f.aim), d: 1 };
    }
    const n = normalize(inp.ax, inp.ay);
    if (n.x === 0 && n.y === 0) return { x: Math.cos(f.aim), y: Math.sin(f.aim), d: clamp(inp.ad, 0.1, 1) };
    return { x: n.x, y: n.y, d: clamp(inp.ad, 0.1, 1) };
  }

  /** Empurra o círculo pra fora das células sólidas. Devolve true se bateu. */
  collideWalls(f: { x: number; y: number; radius: number }): boolean {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      const tx0 = Math.floor((f.x - f.radius) / TILE);
      const ty0 = Math.floor((f.y - f.radius) / TILE);
      const tx1 = Math.floor((f.x + f.radius) / TILE);
      const ty1 = Math.floor((f.y + f.radius) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!this.map.solid(this.map.at(tx, ty))) continue;
          const push = circleRectPush(f.x, f.y, f.radius, tx * TILE, ty * TILE, TILE, TILE);
          if (push) {
            f.x += push.x;
            f.y += push.y;
            hit = true;
          }
        }
      }
    }
    // props empurráveis
    for (const p of this.props) {
      if (!p.alive || p === (f as unknown)) continue;
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d = len(dx, dy);
      const min = p.radius + f.radius;
      if (d < min && d > 0.001) {
        const over = min - d;
        const nx = dx / d;
        const ny = dy / d;
        const share = 1 / (1 + p.mass);
        f.x -= nx * over * (1 - share);
        f.y -= ny * over * (1 - share);
        p.x += nx * over * share;
        p.y += ny * over * share;
        p.vx += nx * 30;
        p.vy += ny * 30;
      }
    }
    return hit;
  }

  respawn(f: Fighter): void {
    const sp = this.spawnPoint(f);
    f.x = f.px = sp.x;
    f.y = f.py = sp.y;
    f.alive = true;
    f.hp = f.maxHp;
    f.ammo = f.maxAmmo;
    f.shield = 0;
    f.statuses = [];
    f.buffs = [];
    f.invulnT = 2.2;
    f.dash = null;
    f.jump = null;
    f.kx = f.ky = 0;
    f.vx = f.vy = 0;
    f.superCharge *= 0.5;
    f.petShieldUsed = false;
    f.history = [];
    f.lastHurtT = -99;
    this.events.push({ type: 'respawn', id: f.id, x: f.x, y: f.y });
  }

  // -------------------------------------------------------------------------
  // Dano / cura / status
  // -------------------------------------------------------------------------

  damageFighter(t: Fighter, amount: number, src: Fighter | null, o: DamageOpts): number {
    if (!t.alive || amount <= 0) return 0;
    if (src && src.team === t.team && src !== t) return 0;
    if (t.invulnT > 0 || (t.dash?.invuln ?? false) || t.jump) return 0;
    let amt = amount;
    amt *= 1 + this.statusPower(t, 'mark');
    amt *= 1 - this.armorOf(t);
    if (this.hasStatus(t, 'freeze') && amt > 600) t.statuses = t.statuses.filter((s) => s.kind !== 'freeze');
    amt = Math.max(1, Math.round(amt));
    let toShield = 0;
    if (t.shield > 0 && !o.pierceShield) {
      toShield = Math.min(t.shield, amt);
      t.shield -= toShield;
    }
    const toHp = amt - toShield;
    t.hp -= toHp;
    t.lastHurtT = this.time;
    t.revealT = Math.max(t.revealT, this.time + 1);
    if (t.stealthT > 0) t.stealthT = Math.min(t.stealthT, 0.2);
    this.events.push({ type: 'hit', target: t.id, source: src?.id ?? -1, x: t.x, y: t.y, amount: amt, crit: amt >= 1500, shield: toShield > 0 && toHp === 0, kind: 'fighter' });
    if (src) {
      t.lastHitBy = src.id;
      t.assistIds.set(src.id, this.time);
      src.stats.damage += amt;
      src.lastAtkT = this.time;
      if (!o.noCharge && !o.isSuper) this.chargeSuper(src, amt);
      const ls = (o.lifesteal ?? 0) + (src.def.passive?.lifesteal ?? 0) + src.buffs.filter((b) => b.stat === 'lifesteal').reduce((a, b) => a + (b.mult - 1), 0);
      if (ls > 0) this.heal(src, amt * ls, src);
      const thorns = t.def.passive?.thorns;
      if (thorns && len(src.x - t.x, src.y - t.y) < 120 && src !== t) this.damageFighter(src, amt * thorns, t, { noCharge: true });
    }
    if (o.knock && o.knock > 0 && t !== this.boss) {
      let dx = o.dirX;
      let dy = o.dirY;
      if (dx === undefined || dy === undefined) {
        const n = src ? normalize(t.x - src.x, t.y - src.y) : { x: 0, y: 0 };
        dx = n.x;
        dy = n.y;
      }
      const resist = t.def.role === 'tanque' ? 0.6 : 1;
      t.kx += dx * o.knock * resist;
      t.ky += dy * o.knock * resist;
    }
    if (o.status) this.applyStatus(t, o.status, src?.id ?? -1);
    // escudo do pet quando a vida fica baixa
    const ps = t.pet?.bonus.lowHpShield;
    if (ps && !t.petShieldUsed && t.hp > 0 && t.hp < t.maxHp * 0.35) {
      t.petShieldUsed = true;
      t.shield += ps;
      t.shieldT = 4;
      this.events.push({ type: 'shield', id: t.id });
    }
    if (t.hp <= 0) this.kill(t, src);
    return amt;
  }

  chargeSuper(f: Fighter, dmg: number): void {
    if (f.superCharge >= 1) return;
    const mult = (f.def.passive?.superChargeMult ?? 1) * (1 + (f.pet?.bonus.superCharge ?? 0)) * (this.mode.modifiers?.superChargeMult ?? 1);
    f.superCharge = Math.min(1, f.superCharge + dmg * f.def.stats.superRate * mult);
    if (f.superCharge >= 1) this.events.push({ type: 'superReady', id: f.id });
  }

  heal(t: Fighter, amount: number, src: Fighter | null): number {
    if (!t.alive || amount <= 0) return 0;
    let amt = amount;
    if (this.hasStatus(t, 'poison')) amt *= 0.5;
    const real = Math.min(t.maxHp - t.hp, amt);
    if (real <= 0) return 0;
    t.hp += real;
    if (src && src !== t) {
      src.stats.healed += real;
      this.chargeSuper(src, real * 0.6);
    }
    if (real >= 40) this.events.push({ type: 'heal', target: t.id, x: t.x, y: t.y, amount: Math.round(real) });
    return real;
  }

  applyStatus(t: Fighter, s: StatusApply, source: number): void {
    if (!t.alive) return;
    if (t === this.boss && (s.kind === 'stun' || s.kind === 'freeze' || s.kind === 'root')) return;
    const existing = t.statuses.find((x) => x.kind === s.kind);
    const power = s.power ?? defaultPower(s.kind);
    if (existing) {
      existing.t = Math.max(existing.t, s.duration);
      existing.power = Math.max(existing.power, power);
      existing.source = source;
    } else t.statuses.push({ kind: s.kind, t: s.duration, power, source });
    if (s.kind === 'stun' || s.kind === 'freeze') t.dash = null;
    this.events.push({ type: 'status', id: t.id, kind: s.kind });
  }

  private tickStatuses(f: Fighter, dt: number): void {
    if (!f.statuses.length) return;
    for (const s of f.statuses) {
      s.t -= dt;
      if (s.kind === 'burn' || s.kind === 'poison') {
        const src = s.source >= 0 ? (this.fighters[s.source] ?? null) : null;
        // dano em pulsos de 0,5 s pra mostrar números legíveis
        const before = Math.floor((s.t + dt) * 2);
        const after = Math.floor(s.t * 2);
        if (before !== after && f.alive) this.damageFighter(f, s.power * 0.5, src, { noCharge: true });
      }
    }
    f.statuses = f.statuses.filter((s) => s.t > 0);
  }

  kill(t: Fighter, src: Fighter | null): void {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    t.respawnT = this.mode.respawn;
    t.stats.deaths++;
    t.stats.streak = 0;
    t.dash = null;
    t.jump = null;
    t.statuses = [];
    const killer = src && src !== t ? src : t.lastHitBy >= 0 && this.time - (t.assistIds.get(t.lastHitBy) ?? -99) < 5 ? (this.fighters[t.lastHitBy] ?? null) : null;
    let streak = 0;
    if (killer && killer !== t) {
      killer.stats.kills++;
      killer.stats.streak++;
      streak = killer.stats.streak;
      killer.stats.bestStreak = Math.max(killer.stats.bestStreak, killer.stats.streak);
      if (killer.def.passive?.killHeal) this.heal(killer, killer.def.passive.killHeal, killer);
      if (streak >= 2) this.events.push({ type: 'streak', id: killer.id, count: streak });
      for (const [aid, at] of t.assistIds) {
        if (aid !== killer.id && this.time - at < 5) {
          const a = this.fighters[aid];
          if (a && a.team !== t.team) a.stats.assists++;
        }
      }
    }
    t.assistIds.clear();
    this.events.push({ type: 'kill', killer: killer?.id ?? -1, victim: t.id, x: t.x, y: t.y, streak });
    this.onKillScore(t, killer);
    // espalha moedinhas
    if (this.rng.chance(0.35)) this.addPickup('coin', t.x, t.y, -1, -1, 1);
  }

  private onKillScore(victim: Fighter, killer: Fighter | null): void {
    const m = this.mode;
    if (m.id === 'treino') return;
    if (m.modifiers?.boss) {
      if (victim === this.boss) this.finish(0);
      return;
    }
    if (m.skullPickup) {
      const kt = killer ? killer.team : victim.team === 0 ? 1 : 0;
      this.addPickup('skull', victim.x, victim.y, victim.team, kt, 1);
      return;
    }
    if (m.teams === 0 && killer) {
      let pts = 1;
      if (victim.wanted) pts = 2;
      this.scores[killer.team] = (this.scores[killer.team] ?? 0) + pts;
      this.events.push({ type: 'score', team: killer.team, score: this.scores[killer.team]!, byId: killer.id });
      if (victim.wanted) victim.wanted = false;
      if (killer.stats.streak >= 3 && !killer.wanted) {
        killer.wanted = true;
        this.events.push({ type: 'wanted', id: killer.id });
      }
    }
    if (m.teams === 2 && !m.skullPickup && killer) {
      this.scores[killer.team] = (this.scores[killer.team] ?? 0) + 1;
      this.events.push({ type: 'score', team: killer.team, score: this.scores[killer.team]!, byId: killer.id });
    }
  }

  // -------------------------------------------------------------------------
  // Dano em área (usado por explosões, habilidades, meteoros)
  // -------------------------------------------------------------------------

  areaDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    src: Fighter | null,
    team: number,
    o: DamageOpts & { wallDamage?: number; propForce?: number; heal?: number; pull?: number } = {},
  ): number {
    let hits = 0;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const d = len(f.x - x, f.y - y);
      if (d > radius + f.radius) continue;
      if (f.team === team) {
        if (o.heal) this.heal(f, o.heal, src);
        continue;
      }
      const n = normalize(f.x - x, f.y - y);
      if (o.pull) {
        f.kx -= n.x * o.pull;
        f.ky -= n.y * o.pull;
      }
      if (damage > 0) {
        this.damageFighter(f, damage, src, { ...o, dirX: n.x, dirY: n.y });
        hits++;
      } else if (o.status) this.applyStatus(f, o.status, src?.id ?? -1);
    }
    for (const s of this.summons) {
      if (!s.alive || s.team === team) continue;
      if (len(s.x - x, s.y - y) < radius + 20 && damage > 0) this.damageSummon(s, damage, src);
    }
    for (const p of this.props) {
      if (!p.alive) continue;
      const d = len(p.x - x, p.y - y);
      if (d > radius + p.radius) continue;
      const n = d > 1 ? normalize(p.x - x, p.y - y) : { x: this.rng.range(-1, 1), y: this.rng.range(-1, 1) };
      const force = (o.propForce ?? 500) * (1 - d / (radius + p.radius + 1)) + 120;
      this.pushProp(p, n.x * force, n.y * force, force * 0.6);
      if (damage > 0) this.damageProp(p, damage * 0.8, src);
    }
    if (o.wallDamage && o.wallDamage > 0 && damage > 0) {
      const r = radius;
      const tx0 = Math.floor((x - r) / TILE);
      const ty0 = Math.floor((y - r) / TILE);
      const tx1 = Math.floor((x + r) / TILE);
      const ty1 = Math.floor((y + r) / TILE);
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const cx = (tx + 0.5) * TILE;
          const cy = (ty + 0.5) * TILE;
          if (len(cx - x, cy - y) <= r + TILE * 0.35) this.hitTile(tx, ty, damage * o.wallDamage, src);
        }
    }
    return hits;
  }

  hitTile(tx: number, ty: number, dmg: number, src: Fighter | null): void {
    const t = this.map.at(tx, ty);
    if (!this.map.destructible(t)) return;
    const broke = this.map.damageTile(tx, ty, dmg);
    if (broke !== null) {
      this.events.push({ type: 'tileBreak', tx, ty, tile: broke });
      if (src) src.stats.boxes++;
    } else this.events.push({ type: 'hit', target: -1, source: src?.id ?? -1, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, amount: Math.round(dmg), crit: false, shield: false, kind: 'tile' });
  }

  // -------------------------------------------------------------------------
  // Física dos objetos (caixas, barris, pneus)
  // -------------------------------------------------------------------------

  pushProp(p: Prop, ix: number, iy: number, up = 0): void {
    p.vx += ix / p.mass;
    p.vy += iy / p.mass;
    p.vr += ((ix - iy) / p.mass) * 0.004;
    if (up > 0 && p.z <= 0.5) p.vz = Math.max(p.vz, (up / p.mass) * 0.9);
  }

  damageProp(p: Prop, dmg: number, src: Fighter | null): void {
    if (!p.alive) return;
    p.hp -= dmg;
    this.events.push({ type: 'propHit', id: p.id, x: p.x, y: p.y });
    if (p.hp > 0) return;
    p.alive = false;
    if (src) src.stats.boxes++;
    this.events.push({ type: 'propBreak', id: p.id, kind: p.kind, x: p.x, y: p.y });
    if (p.kind === 'barrel') {
      // barril explosivo: dano em área + reação em cadeia
      this.events.push({ type: 'explode', x: p.x, y: p.y, r: 150, color: '#ff8a3d', big: true });
      const x = p.x;
      const y = p.y;
      this.delayed.push({ at: this.time + 0.05, run: () => this.areaDamage(x, y, 150, 1300, src, src?.team ?? -99, { knock: 520, wallDamage: 1.2, propForce: 900 }) });
    } else if (p.kind === 'crate') {
      const r = this.rng.next();
      if (r < 0.45) this.addPickup('heal', p.x, p.y);
      else if (r < 0.75) this.addPickup('coin', p.x, p.y, -1, -1, 2);
      else if (r < 0.85) this.addPickup('power', p.x, p.y);
    }
  }

  private updateProps(dt: number): void {
    for (const p of this.props) {
      if (!p.alive) continue;
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      // gravidade no eixo Z (quica)
      if (p.z > 0 || p.vz > 0) {
        p.vz -= 1600 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = p.vz < -160 ? -p.vz * 0.35 : 0;
        }
      }
      const fr = Math.exp((p.z > 0 ? -1.2 : p.kind === 'tire' ? -2.2 : -5.5) * dt);
      p.vx *= fr;
      p.vy *= fr;
      p.vr *= Math.exp(-3 * dt);
      const sp = len(p.vx, p.vy);
      const ox = p.x;
      const oy = p.y;
      if (this.collideWalls(p)) {
        // quica na parede perdendo energia
        if (Math.abs(p.x - ox) > Math.abs(p.y - oy)) p.vx = -p.vx * 0.45;
        else p.vy = -p.vy * 0.45;
        if (sp > 380) this.damageProp(p, sp * 0.4, null);
      }
      // empurra lutadores um pouquinho e causa dano se vier muito rápido
      if (sp > 520) {
        for (const f of this.fighters) {
          if (!f.alive) continue;
          if (len(f.x - p.x, f.y - p.y) < f.radius + p.radius) {
            this.damageFighter(f, Math.min(500, sp * 0.5), null, { knock: sp * 0.4, dirX: p.vx / sp, dirY: p.vy / sp });
            p.vx *= 0.4;
            p.vy *= 0.4;
          }
        }
      }
    }
    // colisão entre props (simples, poucos objetos)
    const ps = this.props;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j]!;
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = len(dx, dy);
        const min = a.radius + b.radius;
        if (d < min && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          const over = (min - d) / 2;
          a.x -= nx * over;
          a.y -= ny * over;
          b.x += nx * over;
          b.y += ny * over;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = (-(1 + 0.4) * rel) / (1 / a.mass + 1 / b.mass);
            a.vx -= (imp * nx) / a.mass;
            a.vy -= (imp * ny) / a.mass;
            b.vx += (imp * nx) / b.mass;
            b.vy += (imp * ny) / b.mass;
          }
        }
      }
    }
    if (this.tick % 120 === 0) this.props = this.props.filter((p) => p.alive);
  }

  // -------------------------------------------------------------------------
  // Coletáveis
  // -------------------------------------------------------------------------

  private updatePickups(dt: number): void {
    for (const p of this.pickups) {
      p.t -= dt;
      if (p.z > 0 || p.vz > 0) {
        p.vz -= 1400 * dt;
        p.z += p.vz * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = p.vz < -150 ? -p.vz * 0.4 : 0;
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
        if (this.map.solidAt(p.x, p.y)) {
          p.x -= p.vx * dt * 2;
          p.y -= p.vy * dt * 2;
          p.vx = p.vy = 0;
        }
      }
      if (p.t <= 0) {
        if (p.kind === 'skull' && p.killerTeam >= 0) this.scoreTeam(p.killerTeam, -1);
        continue;
      }
      for (const f of this.fighters) {
        if (!f.alive || f === this.boss) continue;
        if (len(f.x - p.x, f.y - p.y) > f.radius + 22) continue;
        if (p.kind === 'heal') {
          if (f.hp >= f.maxHp) continue;
          this.heal(f, f.maxHp * 0.3, null);
        } else if (p.kind === 'power') {
          f.buffs.push({ stat: 'damage', mult: 1.25, t: 10 });
          f.buffs.push({ stat: 'speed', mult: 1.1, t: 10 });
        } else if (p.kind === 'skull') {
          if (f.team === p.team) {
            // negou o ponto
          } else {
            this.scoreTeam(f.team, f.id);
            f.stats.skulls++;
          }
        } else if (p.kind === 'coin') {
          f.stats.coins += p.value;
        }
        p.t = 0;
        this.events.push({ type: 'pickup', id: f.id, kind: p.kind, x: p.x, y: p.y, team: p.team });
        break;
      }
    }
    this.pickups = this.pickups.filter((p) => p.t > 0);
  }

  private scoreTeam(team: number, byId: number): void {
    if (this.over) return;
    this.scores[team] = (this.scores[team] ?? 0) + 1;
    this.events.push({ type: 'score', team, score: this.scores[team]!, byId });
  }

  private updateSpawners(dt: number): void {
    if (!this.started || this.over) return;
    this.healT -= dt;
    if (this.healT <= 0) {
      this.healT = 9;
      for (const h of this.map.spawns.heals) {
        const has = this.pickups.some((p) => p.kind === 'heal' && len(p.x - h.x, p.y - h.y) < 30);
        if (!has) {
          const p = this.addPickup('heal', h.x, h.y);
          p.vz = 0;
          p.vx = p.vy = 0;
        }
      }
    }
    this.powerT -= dt;
    if (this.powerT <= 0) {
      this.powerT = 22;
      for (const h of this.map.spawns.powers) {
        const has = this.pickups.some((p) => p.kind === 'power' && len(p.x - h.x, p.y - h.y) < 30);
        if (!has) {
          const p = this.addPickup('power', h.x, h.y);
          p.vz = 0;
          p.vx = p.vy = 0;
        }
      }
    }
  }

  private updateMeteors(dt: number): void {
    this.meteorT -= dt;
    if (this.meteorT <= 0) {
      this.meteorT = this.rng.range(1.2, 2.4);
      const alive = this.fighters.filter((f) => f.alive);
      const target = alive.length ? this.rng.pick(alive) : null;
      const x = (target?.x ?? this.map.widthPx / 2) + this.rng.range(-260, 260);
      const y = (target?.y ?? this.map.heightPx / 2) + this.rng.range(-260, 260);
      const at = this.time + 1.4;
      this.meteors.push({ x, y, at });
      this.events.push({ type: 'meteor', x, y, at });
    }
    const due = this.meteors.filter((m) => m.at <= this.time);
    if (due.length) {
      this.meteors = this.meteors.filter((m) => m.at > this.time);
      for (const m of due) {
        this.events.push({ type: 'explode', x: m.x, y: m.y, r: 140, color: '#ff5a2a', big: true });
        this.areaDamage(m.x, m.y, 140, 1400, null, -99, { knock: 600, wallDamage: 1, propForce: 1000 });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Zonas, invocações, armadilhas, feixes
  // -------------------------------------------------------------------------

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.t -= dt;
      if (z.follow) {
        const o = this.fighters[z.owner];
        if (o && o.alive) {
          z.x = o.x;
          z.y = o.y;
        }
      }
      z.tickT -= dt;
      if (z.tickT > 0) continue;
      z.tickT = 0.25;
      const owner = this.fighters[z.owner] ?? null;
      for (const f of this.fighters) {
        if (!f.alive || len(f.x - z.x, f.y - z.y) > z.radius + f.radius * 0.5) continue;
        if (f.team === z.team) {
          if (z.hps) this.heal(f, z.hps * 0.25, owner);
        } else {
          if (z.dps) this.damageFighter(f, z.dps * 0.25, owner, { noCharge: false, isSuper: false, status: z.status });
          else if (z.status) this.applyStatus(f, z.status, z.owner);
        }
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  damageSummon(s: Summon, dmg: number, src: Fighter | null): void {
    if (!s.alive) return;
    s.hp -= dmg;
    this.events.push({ type: 'hit', target: -1, source: src?.id ?? -1, x: s.x, y: s.y, amount: Math.round(dmg), crit: false, shield: false, kind: 'summon' });
    if (src) this.chargeSuper(src, dmg * 0.5);
    if (s.hp <= 0) {
      s.alive = false;
      this.events.push({ type: 'explode', x: s.x, y: s.y, r: 50, color: s.def.look.color, big: false });
    }
  }

  private updateSummons(dt: number): void {
    for (const s of this.summons) {
      if (!s.alive) continue;
      s.px = s.x;
      s.py = s.y;
      s.t -= dt;
      if (s.t <= 0) {
        s.alive = false;
        this.events.push({ type: 'explode', x: s.x, y: s.y, r: 40, color: s.def.look.color, big: false });
        continue;
      }
      const owner = this.fighters[s.owner] ?? null;
      const speed = s.def.speed ?? 0;
      if (s.def.look.kind === 'clone') {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const body = { x: s.x, y: s.y, radius: 24 };
        if (this.collideWalls(body)) {
          s.vx = -s.vx;
          s.vy = -s.vy;
        }
        s.x = body.x;
        s.y = body.y;
      } else if (speed > 0) {
        const t = this.nearestEnemy(s, 700);
        if (t) {
          const n = normalize(t.x - s.x, t.y - s.y);
          const d = len(t.x - s.x, t.y - s.y);
          if (d > (s.def.attack?.range ?? 60) * 0.7) {
            s.x += n.x * speed * dt;
            s.y += n.y * speed * dt;
          }
        } else if (owner && owner.alive) {
          const d = len(owner.x - s.x, owner.y - s.y);
          if (d > 120) {
            const n = normalize(owner.x - s.x, owner.y - s.y);
            s.x += n.x * speed * dt;
            s.y += n.y * speed * dt;
          }
        }
        const body = { x: s.x, y: s.y, radius: s.def.radius ?? 20 };
        this.collideWalls(body);
        s.x = body.x;
        s.y = body.y;
      }
      if (s.def.healAura) {
        for (const f of this.fighters) if (f.alive && f.team === s.team && len(f.x - s.x, f.y - s.y) < s.def.healAura.radius) this.heal(f, s.def.healAura.hps * dt, owner);
      }
      const atk = s.def.attack;
      if (atk && owner) {
        s.atkT -= dt;
        if (s.atkT <= 0) {
          const t = this.nearestEnemy(s, atk.range);
          if (t) {
            s.atkT = atk.interval;
            s.aim = Math.atan2(t.y - s.y, t.x - s.x);
            this.spawnProjectile(owner, s.x, s.y - 20, s.aim, atk.projectile, { noCharge: true });
            this.events.push({ type: 'shoot', id: owner.id, x: s.x, y: s.y, angle: s.aim, ability: owner.def.attack, kind: 'skill' });
          } else s.atkT = 0.3;
        }
      }
    }
    this.summons = this.summons.filter((s) => s.alive);
  }

  private updateTraps(dt: number): void {
    for (const tr of this.traps) {
      tr.t -= dt;
      if (tr.armed > 0) {
        tr.armed -= dt;
        continue;
      }
      for (const f of this.fighters) {
        if (!f.alive || f.team === tr.team) continue;
        if (len(f.x - tr.x, f.y - tr.y) < tr.radius + f.radius * 0.6) {
          const owner = this.fighters[tr.owner] ?? null;
          this.events.push({ type: 'explode', x: tr.x, y: tr.y, r: tr.radius * 1.6, color: '#ffd23f', big: false });
          this.areaDamage(tr.x, tr.y, tr.radius * 1.6, tr.damage, owner, tr.team, { status: tr.status, knock: 200 });
          tr.t = 0;
          break;
        }
      }
    }
    this.traps = this.traps.filter((t) => t.t > 0);
  }

  private updateBeams(dt: number): void {
    for (const b of this.beams) {
      b.t -= dt;
      const o = this.fighters[b.owner];
      if (!o || !o.alive) {
        b.t = 0;
        continue;
      }
      const dx = Math.cos(o.aim);
      const dy = Math.sin(o.aim);
      let ex = o.x + dx * b.length;
      let ey = o.y + dy * b.length;
      const hit = this.map.rayHit(o.x, o.y, ex, ey);
      if (hit) {
        ex = hit.x;
        ey = hit.y;
        if (this.tick % 10 === 0) this.hitTile(hit.tx, hit.ty, b.dps * 0.4, o);
      }
      b.ex = ex;
      b.ey = ey;
      if (this.tick % 6 !== 0) continue;
      const tickDmg = b.dps * 0.1;
      for (const f of this.fighters) {
        if (!f.alive || f.team === b.team) continue;
        const along = (f.x - o.x) * dx + (f.y - o.y) * dy;
        if (along < 0 || along > len(ex - o.x, ey - o.y)) continue;
        const perp = Math.abs((f.x - o.x) * -dy + (f.y - o.y) * dx);
        if (perp < b.width / 2 + f.radius) this.damageFighter(f, tickDmg, o, { status: b.status, dirX: dx, dirY: dy, knock: 30 });
      }
      for (const p of this.props) {
        if (!p.alive) continue;
        const along = (p.x - o.x) * dx + (p.y - o.y) * dy;
        const perp = Math.abs((p.x - o.x) * -dy + (p.y - o.y) * dx);
        if (along > 0 && along < b.length && perp < b.width / 2 + p.radius) this.damageProp(p, tickDmg, o);
      }
    }
    this.beams = this.beams.filter((b) => b.t > 0);
  }

  // -------------------------------------------------------------------------
  // Projéteis
  // -------------------------------------------------------------------------

  spawnProjectile(
    owner: Fighter,
    x: number,
    y: number,
    angle: number,
    def: import('../content/types').ProjectileDef,
    o: { isSuper?: boolean; noCharge?: boolean; targetX?: number; targetY?: number; dmgMult?: number } = {},
  ): Projectile {
    const dmg = def.damage * (o.dmgMult ?? this.damageMultOf(owner));
    const p: Projectile = {
      id: this.uid(),
      owner: owner.id,
      team: owner.team,
      def,
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * def.speed,
      vy: Math.sin(angle) * def.speed,
      traveled: 0,
      range: def.range,
      damage: dmg,
      hit: [],
      bounces: def.bounces ?? 0,
      pierce: def.pierce === true ? 999 : typeof def.pierce === 'number' ? def.pierce : 0,
      alive: true,
      returning: false,
      chainLeft: def.chain?.count ?? 0,
      lob: null,
      z: 0,
      orbit: null,
      isSuper: !!o.isSuper,
      noCharge: !!o.noCharge,
      age: 0,
    };
    if (def.lob) {
      const tx = o.targetX ?? x + Math.cos(angle) * def.range;
      const ty = o.targetY ?? y + Math.sin(angle) * def.range;
      const d = len(tx - x, ty - y);
      p.lob = { sx: x, sy: y, tx, ty, t: 0, dur: Math.max(0.35, d / def.speed) };
    }
    this.projectiles.push(p);
    return p;
  }

  // -------------------------------------------------------------------------
  // Regras do modo / fim
  // -------------------------------------------------------------------------

  timeLeft(): number {
    return Math.max(0, this.mode.duration - this.clock);
  }

  private updateMode(): void {
    if (this.over || !this.started) return;
    const m = this.mode;
    if (m.modifiers?.boss) {
      if (this.clock >= m.duration) this.finish(1);
      return;
    }
    for (let t = 0; t < this.scores.length; t++) {
      if ((this.scores[t] ?? 0) >= m.scoreToWin) {
        this.finish(t);
        return;
      }
    }
    if (this.clock >= m.duration) {
      let best = -1;
      let bestScore = -1;
      let tie = false;
      for (let t = 0; t < this.scores.length; t++) {
        const s = this.scores[t] ?? 0;
        if (s > bestScore) {
          bestScore = s;
          best = t;
          tie = false;
        } else if (s === bestScore) tie = true;
      }
      if (m.teams === 0 && tie) {
        // desempate no FFA: mais eliminações, depois menos mortes
        const top = this.fighters.filter((f) => (this.scores[f.team] ?? 0) === bestScore).sort((a, b) => b.stats.kills - a.stats.kills || a.stats.deaths - b.stats.deaths);
        best = top[0]?.team ?? best;
        tie = false;
      }
      this.finish(tie ? -1 : best);
    }
  }

  finish(winner: number): void {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    this.events.push({ type: 'matchEnd', winner });
  }

  /** Posição final no FFA (1 = primeiro) */
  placement(f: Fighter): number {
    if (this.mode.teams !== 0) return this.winner === f.team ? 1 : 2;
    const sorted = this.fighters.slice().sort((a, b) => (this.scores[b.team] ?? 0) - (this.scores[a.team] ?? 0) || b.stats.kills - a.stats.kills || a.stats.deaths - b.stats.deaths);
    return sorted.indexOf(f) + 1;
  }
}

function defaultPower(k: StatusKind): number {
  switch (k) {
    case 'slow':
      return 0.35;
    case 'burn':
      return 300;
    case 'poison':
      return 260;
    case 'mark':
      return 0.2;
    case 'weaken':
      return 0.25;
    case 'haste':
      return 0.25;
    case 'rage':
      return 0.2;
    default:
      return 1;
  }
}

function firstProjSpeed(ab: AbilityDef): number | null {
  for (const e of ab.effects) if (e.kind === 'projectile') return e.proj.speed;
  return null;
}
