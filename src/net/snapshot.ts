import { getCharacter } from '../content/characters';
import type { AbilityDef, ProjectileDef, StatusKind, SummonDef } from '../content/types';
import type { Fighter, GameEvent, MatchStats, Pickup, Projectile, Prop, Summon } from '../sim/types';
import type { World } from '../sim/world';

/**
 * SNAPSHOTS DA PARTIDA ONLINE
 * ---------------------------
 * O servidor roda a simulação de verdade (ninguém trapaceia mexendo no cliente)
 * e manda ~20 fotos por segundo do mundo. O cliente tem uma cópia "espelho" do
 * World (mesmo mapa e elenco), aplica as fotos e só desenha.
 * Números são arredondados pra mensagem ficar pequena (e o WebSocket comprime).
 */

export const SNAP_HZ = 20;

const STATUS: StatusKind[] = ['slow', 'stun', 'root', 'silence', 'burn', 'poison', 'freeze', 'mark', 'weaken', 'haste', 'rage', 'reveal'];
const STATS: Array<keyof MatchStats> = ['kills', 'deaths', 'assists', 'damage', 'healed', 'skulls', 'supers', 'skills', 'boxes', 'coins', 'streak', 'bestStreak'];

type Num = number;
/** fighter: id x y z hp maxHp shield ammo maxAmmo super aim flags stealth invuln respawn status reveal castT castKind castIdx cd0 cd1 cd2 kills deaths */
type FSnap = Num[];
/** projétil: id def x y z vx vy lob */
type PSnap = Num[];

export interface Defs {
  proj: Array<[number, { radius: number; look: ProjectileDef['look'] }]>;
  summon: Array<[number, { look: SummonDef['look'] }]>;
  ability: Array<[number, { sfx?: string; color?: string }]>;
}

export interface Snapshot {
  t: 'match.snap';
  tick: number;
  time: number;
  clock: number;
  started: boolean;
  over: boolean;
  winner: number;
  scores: number[];
  f: FSnap[];
  p: PSnap[];
  /** zonas: x y r kind color */
  z: Array<[Num, Num, Num, string, string]>;
  /** invocações: id def x y hp maxHp team owner aim vx */
  s: Num[][];
  /** armadilhas: x y r team */
  tr: Num[][];
  /** feixes: owner ex ey width color */
  b: Array<[Num, Num, Num, Num, string]>;
  /** objetos: id kind x y z vx r */
  pr: Array<[Num, string, Num, Num, Num, Num, Num]>;
  /** coletáveis: id kind x y z t team */
  pk: Array<[Num, string, Num, Num, Num, Num, Num]>;
  ev: unknown[];
  defs?: Partial<Defs>;
  /** mapa inteiro (base64) quando muda */
  tiles?: string;
  /** estatísticas completas (de vez em quando) */
  stats?: Num[][];
}

const r1 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

function b64(u: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
  let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------------------
// SERVIDOR: codifica
// ---------------------------------------------------------------------------

export class SnapEncoder {
  private projIds = new Map<ProjectileDef, number>();
  private summonIds = new Map<SummonDef, number>();
  private abilityIds = new Map<AbilityDef, number>();
  private pending: Defs = { proj: [], summon: [], ability: [] };
  private mapVersion = -1;
  private n = 0;

  constructor(private readonly w: World) {}

  private projId(d: ProjectileDef): number {
    let id = this.projIds.get(d);
    if (id === undefined) {
      id = this.projIds.size + 1;
      this.projIds.set(d, id);
      this.pending.proj.push([id, { radius: d.radius, look: d.look }]);
    }
    return id;
  }
  private summonId(d: SummonDef): number {
    let id = this.summonIds.get(d);
    if (id === undefined) {
      id = this.summonIds.size + 1;
      this.summonIds.set(d, id);
      this.pending.summon.push([id, { look: d.look }]);
    }
    return id;
  }
  private abilityId(a: AbilityDef): number {
    let id = this.abilityIds.get(a);
    if (id === undefined) {
      id = this.abilityIds.size + 1;
      this.abilityIds.set(a, id);
      let color: string | undefined;
      for (const e of a.effects) {
        if (e.kind === 'projectile' || e.kind === 'orbit') {
          color = e.proj.look.color;
          break;
        }
        if (e.kind === 'beam') {
          color = e.color;
          break;
        }
      }
      this.pending.ability.push([id, { sfx: a.sfx, color }]);
    }
    return id;
  }

  /** Foto do mundo + eventos acumulados desde a última foto. */
  encode(events: GameEvent[]): Snapshot {
    const w = this.w;
    this.n++;
    const ev = events.map((e) => (e.type === 'shoot' ? { ...e, ability: this.abilityId(e.ability) } : e));
    const f = w.fighters.map((x) => fighterSnap(x));
    const p: PSnap[] = [];
    for (const x of w.projectiles) if (x.alive) p.push([x.id, this.projId(x.def), r1(x.x), r1(x.y), r1(x.z), r1(x.vx), r1(x.vy), x.lob ? 1 : 0]);
    const snap: Snapshot = {
      t: 'match.snap',
      tick: w.tick,
      time: r2(w.time),
      clock: r2(w.clock),
      started: w.started,
      over: w.over,
      winner: w.winner,
      scores: w.scores,
      f,
      p,
      z: w.zones.map((z) => [r1(z.x), r1(z.y), r1(z.radius), z.look.kind, z.look.color]),
      s: w.summons.filter((s) => s.alive).map((s) => [s.id, this.summonId(s.def), r1(s.x), r1(s.y), r1(s.hp), r1(s.maxHp), s.team, s.owner, r2(s.aim), r1(s.vx)]),
      tr: w.traps.map((t) => [r1(t.x), r1(t.y), r1(t.radius), t.team]),
      b: w.beams.map((b) => [b.owner, r1(b.ex), r1(b.ey), r1(b.width), b.color]),
      pr: w.props.filter((x) => x.alive).map((x) => [x.id, x.kind, r1(x.x), r1(x.y), r1(x.z), r1(x.vx), r1(x.radius)]),
      pk: w.pickups.map((x) => [x.id, x.kind, r1(x.x), r1(x.y), r1(x.z), r2(x.t), x.team]),
      ev,
    };
    if (this.pending.proj.length || this.pending.summon.length || this.pending.ability.length) {
      snap.defs = this.pending;
      this.pending = { proj: [], summon: [], ability: [] };
    }
    if (w.map.version !== this.mapVersion) {
      this.mapVersion = w.map.version;
      snap.tiles = b64(w.map.tiles);
    }
    if (this.n % SNAP_HZ === 0 || w.over) snap.stats = w.fighters.map((x) => STATS.map((k) => r1(x.stats[k])));
    return snap;
  }

  /** Força reenviar defs e mapa (jogador entrou/voltou no meio). */
  resetFor(): { defs: Defs; tiles: string } {
    return {
      defs: {
        proj: [...this.projIds].map(([d, id]) => [id, { radius: d.radius, look: d.look }] as [number, { radius: number; look: ProjectileDef['look'] }]),
        summon: [...this.summonIds].map(([d, id]) => [id, { look: d.look }] as [number, { look: SummonDef['look'] }]),
        ability: [...this.abilityIds].map(([a, id]) => [id, { sfx: a.sfx }] as [number, { sfx?: string }]),
      },
      tiles: b64(this.w.map.tiles),
    };
  }
}

function fighterSnap(x: Fighter): FSnap {
  let flags = 0;
  if (x.alive) flags |= 1;
  if (x.aiming) flags |= 2;
  if (x.moving) flags |= 4;
  if (x.inBush) flags |= 8;
  if (x.dash) flags |= 16;
  if (x.jump) flags |= 32;
  if (x.wanted) flags |= 64;
  let mask = 0;
  for (const s of x.statuses) {
    const i = STATUS.indexOf(s.kind);
    if (i >= 0) mask |= 1 << i;
  }
  const lc = x.lastCast;
  return [
    x.id,
    r1(x.x),
    r1(x.y),
    r1(x.z),
    r1(x.hp),
    r1(x.maxHp),
    r1(x.shield),
    r2(x.ammo),
    x.maxAmmo,
    r2(x.superCharge),
    r2(x.aim),
    flags,
    r2(x.stealthT),
    r2(x.invulnT),
    r2(x.respawnT),
    mask,
    r2(x.revealT),
    lc ? r2(lc.t) : -1,
    lc ? ['attack', 'skill', 'super'].indexOf(lc.kind) : 0,
    lc ? lc.idx : 0,
    r2(x.skillCd[0] ?? 0),
    r2(x.skillCd[1] ?? 0),
    r2(x.skillCd[2] ?? 0),
    x.stats.kills,
    x.stats.deaths,
  ];
}

// ---------------------------------------------------------------------------
// CLIENTE: aplica no mundo espelho
// ---------------------------------------------------------------------------

export class SnapDecoder {
  private proj = new Map<number, { radius: number; look: ProjectileDef['look'] }>();
  private summon = new Map<number, { look: SummonDef['look'] }>();
  private ability = new Map<number, AbilityDef>();
  /** posições anteriores (pra interpolação) */
  private prevP = new Map<number, [number, number]>();

  constructor(private readonly w: World) {}

  addDefs(d: Partial<Defs>): void {
    for (const [id, v] of d.proj ?? []) this.proj.set(id, v);
    for (const [id, v] of d.summon ?? []) this.summon.set(id, v);
    for (const [id, v] of d.ability ?? [])
      this.ability.set(id, {
        id: `net_${id}`,
        name: '',
        desc: '',
        icon: '',
        aim: 'direction',
        range: 0,
        indicator: 'none',
        sfx: v.sfx,
        effects: v.color ? [{ kind: 'projectile', proj: { speed: 0, range: 0, radius: 8, damage: 0, look: { shape: 'bullet', color: v.color } } }] : [],
      });
  }

  /** Aplica a foto e devolve os eventos prontos pro Fx/som. */
  apply(s: Snapshot): GameEvent[] {
    const w = this.w;
    if (s.defs) this.addDefs(s.defs);
    if (s.tiles) {
      const t = unb64(s.tiles);
      if (t.length === w.map.tiles.length) {
        w.map.tiles.set(t);
        w.map.version++;
      }
    }
    (w as { time: number }).time = s.time;
    w.clock = s.clock;
    w.started = s.started;
    w.over = s.over;
    w.winner = s.winner;
    w.tick = s.tick;
    w.scores = s.scores;
    for (const a of s.f) {
      const f = w.fighters[a[0]!];
      if (!f) continue;
      f.px = f.x;
      f.py = f.y;
      const wasAlive = f.alive;
      f.x = a[1]!;
      f.y = a[2]!;
      if (!wasAlive) {
        f.px = f.x;
        f.py = f.y;
      }
      f.z = a[3]!;
      f.hp = a[4]!;
      f.maxHp = a[5]!;
      f.shield = a[6]!;
      f.ammo = a[7]!;
      f.maxAmmo = a[8]!;
      f.superCharge = a[9]!;
      f.aim = a[10]!;
      const fl = a[11]!;
      f.alive = !!(fl & 1);
      f.aiming = !!(fl & 2);
      f.moving = !!(fl & 4);
      f.inBush = !!(fl & 8);
      f.dash = fl & 16 ? ((f.dash ?? {}) as Fighter['dash']) : null;
      f.jump = fl & 32 ? ((f.jump ?? {}) as Fighter['jump']) : null;
      f.wanted = !!(fl & 64);
      f.stealthT = a[12]!;
      f.invulnT = a[13]!;
      f.respawnT = a[14]!;
      const mask = a[15]!;
      f.statuses = STATUS.filter((_, i) => mask & (1 << i)).map((kind) => ({ kind, t: 1, power: 1, source: -1 }));
      f.revealT = a[16]!;
      const ct = a[17]!;
      if (ct >= 0 && (!f.lastCast || f.lastCast.t !== ct)) f.lastCast = { t: ct, kind: (['attack', 'skill', 'super'] as const)[a[18]!] ?? 'attack', idx: a[19]! };
      f.skillCd = [a[20]!, a[21]!, a[22]!];
      f.stats.kills = a[23]!;
      f.stats.deaths = a[24]!;
    }
    if (s.stats)
      s.stats.forEach((row, i) => {
        const f = w.fighters[i];
        if (f) STATS.forEach((k, j) => (f.stats[k] = row[j]!));
      });
    // projéteis
    const prev = this.prevP;
    const nextPrev = new Map<number, [number, number]>();
    w.projectiles = s.p.map((a) => {
      const d = this.proj.get(a[1]!) ?? { radius: 8, look: { shape: 'bullet', color: '#ffffff' } };
      const old = prev.get(a[0]!);
      nextPrev.set(a[0]!, [a[2]!, a[3]!]);
      return {
        id: a[0]!,
        def: d as ProjectileDef,
        x: a[2]!,
        y: a[3]!,
        px: old ? old[0] : a[2]!,
        py: old ? old[1] : a[3]!,
        z: a[4]!,
        vx: a[5]!,
        vy: a[6]!,
        lob: a[7] ? {} : null,
        alive: true,
      } as unknown as Projectile;
    });
    this.prevP = nextPrev;
    w.zones = s.z.map(([x, y, r, kind, color]) => ({ x, y, radius: r, look: { kind, color } }) as unknown as World['zones'][number]);
    w.summons = s.s.map(
      (a) =>
        ({
          id: a[0],
          def: { look: (this.summon.get(a[1]!) ?? { look: { kind: 'totem', color: '#ffffff' } }).look },
          x: a[2],
          y: a[3],
          px: a[2],
          py: a[3],
          hp: a[4],
          maxHp: a[5],
          team: a[6],
          owner: a[7],
          aim: a[8],
          vx: a[9],
          vy: 0,
          alive: true,
        }) as unknown as Summon,
    );
    w.traps = s.tr.map(([x, y, r, team]) => ({ x, y, radius: r, team }) as unknown as World['traps'][number]);
    w.beams = s.b.map(([owner, ex, ey, width, color]) => ({ owner, ex, ey, width, color }) as unknown as World['beams'][number]);
    const oldProps = new Map(w.props.map((p) => [p.id, p]));
    w.props = s.pr.map(([id, kind, x, y, z, vx, radius]) => {
      const o = oldProps.get(id);
      return { id, kind, x, y, px: o ? o.x : x, py: o ? o.y : y, z, vx, vy: 0, radius, alive: true } as unknown as Prop;
    });
    w.pickups = s.pk.map(([id, kind, x, y, z, t, team]) => ({ id, kind, x, y, z, t, team }) as unknown as Pickup);
    // eventos
    return (s.ev as Array<GameEvent & { ability?: unknown }>).map((e) =>
      e.type === 'shoot' ? { ...e, ability: this.ability.get(e.ability as unknown as number) ?? getCharacter('kaze').attack } : e,
    ) as GameEvent[];
  }
}
