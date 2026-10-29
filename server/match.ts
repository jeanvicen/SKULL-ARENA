import { BOSS, getCharacter } from '../src/content/characters';
import { getMap, mapsForMode } from '../src/content/maps';
import { MODE } from '../src/content/modes';
import { getPet } from '../src/content/pets';
import type { ModeId } from '../src/content/types';
import { Rng } from '../src/engine/rng';
import { buildRoster } from '../src/game/roster';
import type { MatchSummary } from '../src/meta/economy';
import { SNAP_HZ, SnapEncoder } from '../src/net/snapshot';
import { BotDirector } from '../src/sim/bots';
import { NO_INPUT, type FighterInput, type GameEvent } from '../src/sim/types';
import { STEP, World } from '../src/sim/world';

/**
 * PARTIDA ONLINE (no servidor)
 * O servidor é a "verdade": roda a simulação a 60 Hz, recebe só as INTENÇÕES dos
 * jogadores (andar/mirar/atirar) e manda fotos do mundo ~20x por segundo.
 * Quem cai da conexão vira BOT até voltar.
 */

export interface Player {
  accountId: string;
  name: string;
  charId: string;
  petId: string | null;
  level: number;
  send: (msg: unknown) => void;
}

export interface MatchStartInfo {
  t: 'match.start';
  id: string;
  mode: ModeId;
  map: string;
  seed: number;
  boss: boolean;
  /** elenco na ordem dos lutadores */
  roster: Array<{ name: string; charId: string; team: number; isBot: boolean; petId: string | null; level: number }>;
  /** índice do SEU lutador */
  you: number;
}

const MAX_STEPS_PER_TICK = 4;

export class ServerMatch {
  readonly world: World;
  private bots: BotDirector;
  private enc: SnapEncoder;
  private inputs: Array<FighterInput | undefined> = [];
  private latched = new Map<number, { fire: boolean; auto: boolean; skill: number }>();
  /** conta → índice do lutador */
  readonly seats = new Map<string, number>();
  private players = new Map<string, Player>();
  private pendingEvents: GameEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private last = 0;
  private acc = 0;
  private steps = 0;
  private endAt = 0;
  private finished = false;
  readonly startInfo: Omit<MatchStartInfo, 'you'>;

  constructor(
    readonly id: string,
    modeId: ModeId,
    players: Player[],
    private readonly onEnd: (m: ServerMatch, results: Array<{ player: Player; summary: MatchSummary }>) => void,
  ) {
    const mode = MODE[modeId] ?? MODE.guerra;
    const seed = (Math.random() * 2 ** 31) | 0;
    const rng = new Rng(seed);
    const maps = mapsForMode(mode.id);
    const map = maps[rng.int(0, maps.length - 1)] ?? getMap('necropolis');
    const { roster, boss } = buildRoster(
      mode,
      rng,
      players.map((p) => ({ name: p.name, def: getCharacter(p.charId), pet: getPet(p.petId), level: p.level })),
    );
    this.world = new World({ map, mode, seed, roster, boss: boss ? BOSS : undefined });
    this.bots = new BotDirector(this.world, 0.6, seed ^ 0x5bd1);
    // testes: MATCH_SECONDS=10 faz a partida durar só 10 s
    if (process.env.MATCH_SECONDS) this.world.clock = Math.max(0, mode.duration - Number(process.env.MATCH_SECONDS));
    this.enc = new SnapEncoder(this.world);
    players.forEach((p, i) => {
      this.seats.set(p.accountId, i);
      this.players.set(p.accountId, p);
    });
    this.startInfo = {
      t: 'match.start',
      id,
      mode: mode.id,
      map: map.id,
      seed,
      boss,
      roster: roster.map((r) => ({ name: r.name, charId: r.def.id, team: r.team, isBot: r.isBot, petId: r.pet?.id ?? null, level: r.level ?? 1 })),
    };
  }

  start(): void {
    for (const p of this.players.values()) p.send({ ...this.startInfo, you: this.seats.get(p.accountId) });
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 1000 / 60);
  }

  /** Entrada de um jogador (validada: só números em faixas seguras). */
  input(accountId: string, raw: Partial<FighterInput>): void {
    const id = this.seats.get(accountId);
    if (id === undefined) return;
    const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    const ax = num(raw.ax, -1, 1, 1);
    const ay = num(raw.ay, -1, 1, 0);
    const n = Math.hypot(ax, ay) || 1;
    this.inputs[id] = { mx: num(raw.mx, -1, 1), my: num(raw.my, -1, 1), ax: ax / n, ay: ay / n, ad: num(raw.ad, 0, 1, 1), fire: false, auto: false, skill: -1, aiming: !!raw.aiming };
    // gatilhos ficam "travados" até o próximo passo da simulação (não se perdem)
    const l = this.latched.get(id) ?? { fire: false, auto: false, skill: -1 };
    if (raw.fire) l.fire = true;
    if (raw.auto) l.auto = true;
    const sk = num(raw.skill, -1, 3, -1);
    if (sk >= 0) l.skill = Math.round(sk);
    this.latched.set(id, l);
  }

  disconnect(accountId: string): void {
    const id = this.seats.get(accountId);
    if (id === undefined) return;
    this.bots.adopt(id, 0.5);
    this.inputs[id] = undefined;
  }

  reconnect(accountId: string, send: (m: unknown) => void): void {
    const p = this.players.get(accountId);
    const id = this.seats.get(accountId);
    if (!p || id === undefined) return;
    p.send = send;
    this.bots.release(id);
    const r = this.enc.resetFor();
    send({ ...this.startInfo, you: id, resume: r });
  }

  private tick(): void {
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS_PER_TICK) {
      this.acc -= STEP;
      n++;
      this.step();
    }
    if (n >= MAX_STEPS_PER_TICK) this.acc = 0;
  }

  private step(): void {
    const w = this.world;
    this.bots.fill(this.inputs, STEP);
    // aplica gatilhos travados dos humanos
    for (const [id, l] of this.latched) {
      const inp = this.inputs[id] ?? { ...NO_INPUT };
      this.inputs[id] = { ...inp, fire: l.fire, auto: l.auto, skill: l.skill };
    }
    this.latched.clear();
    const events = w.step(this.inputs);
    // depois do passo, humanos voltam a ter só movimento/mira
    for (const id of this.seats.values()) {
      const inp = this.inputs[id];
      if (inp) this.inputs[id] = { ...inp, fire: false, auto: false, skill: -1 };
    }
    this.pendingEvents.push(...events);
    this.steps++;
    if (this.steps % (60 / SNAP_HZ) === 0) this.broadcast();
    if (w.over && !this.endAt) this.endAt = performance.now() + 3200;
    if (this.endAt && performance.now() >= this.endAt) this.finish();
  }

  private broadcast(): void {
    const snap = this.enc.encode(this.pendingEvents);
    this.pendingEvents = [];
    const msg = JSON.stringify(snap);
    for (const p of this.players.values()) p.send(msg);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.broadcast();
    this.stop();
    const w = this.world;
    const results = [...this.players.values()].map((player) => {
      const f = w.fighters[this.seats.get(player.accountId)!]!;
      const summary: MatchSummary = {
        mode: w.mode.id,
        map: w.map.id,
        charId: f.def.id,
        win: w.winner === -1 ? null : w.winner === f.team,
        placement: w.placement(f),
        players: w.fighters.length,
        stats: { ...f.stats },
      };
      return { player, summary };
    });
    this.onEnd(this, results);
  }

  /** Todo mundo saiu: encerra sem prêmios. */
  abort(): void {
    this.finished = true;
    this.stop();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get humans(): number {
    return this.players.size;
  }
}
