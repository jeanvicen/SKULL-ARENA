import type { AbilityDef } from '../content/types';
import { clamp, len, normalize } from '../engine/math';
import { Rng } from '../engine/rng';
import { TILE } from './map';
import { NavGrid } from './nav';
import type { Fighter, FighterInput } from './types';
import type { World } from './world';

/**
 * IA DOS BOTS
 * Os bots usam a MESMA entrada que um jogador (FighterInput) e a MESMA visão
 * (não enxergam quem está no arbusto). A dificuldade (0..1) muda reação, mira e decisões.
 */

interface Brain {
  id: number;
  diff: number;
  thinkT: number;
  target: number;
  goal: { x: number; y: number } | null;
  path: Array<{ x: number; y: number }>;
  pathT: number;
  strafe: number;
  strafeT: number;
  triggerT: number;
  aimErr: number;
  retreat: boolean;
  wander: { x: number; y: number } | null;
  skillT: number;
  stuckT: number;
  lastX: number;
  lastY: number;
}

export class BotDirector {
  private readonly brains = new Map<number, Brain>();
  private readonly nav: NavGrid;
  private readonly rng: Rng;

  constructor(
    private readonly w: World,
    /** dificuldade padrão 0..1 */
    difficulty: number,
    seed = 7,
  ) {
    this.nav = new NavGrid(w.map);
    this.rng = new Rng(seed);
    for (const f of w.fighters) {
      if (!f.isBot) continue;
      const d = clamp(difficulty + this.rng.range(-0.12, 0.12), 0.05, 1);
      this.brains.set(f.id, {
        id: f.id,
        diff: f === w.boss ? 0.8 : d,
        thinkT: this.rng.range(0, 0.3),
        target: -1,
        goal: null,
        path: [],
        pathT: 0,
        strafe: this.rng.chance(0.5) ? 1 : -1,
        strafeT: 0,
        triggerT: 0,
        aimErr: 0,
        retreat: false,
        wander: null,
        skillT: this.rng.range(0.5, 2),
        stuckT: 0,
        lastX: f.x,
        lastY: f.y,
      });
    }
  }

  /** Preenche `out[id]` com a entrada de cada bot neste passo. */
  fill(out: Array<FighterInput | undefined>, dt: number): void {
    for (const b of this.brains.values()) {
      const f = this.w.fighters[b.id]!;
      out[f.id] = this.think(b, f, dt);
    }
  }

  private think(b: Brain, f: Fighter, dt: number): FighterInput {
    const w = this.w;
    const inp: FighterInput = { mx: 0, my: 0, ax: Math.cos(f.aim), ay: Math.sin(f.aim), ad: 1, fire: false, auto: false, skill: -1, aiming: false };
    if (!f.alive || !w.started || w.over) return inp;
    if (w.mode.id === 'treino' && f.isBot) return this.dummy(b, f, inp, dt);

    b.thinkT -= dt;
    b.triggerT -= dt;
    b.skillT -= dt;
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe = -b.strafe;
      b.strafeT = this.rng.range(0.5, 1.4);
    }

    const atk = f.def.attack;
    const range = atk.range;
    const melee = range < 200;

    // --- decisões (não a cada passo: tempo de reação)
    if (b.thinkT <= 0) {
      b.thinkT = 0.12 + (1 - b.diff) * 0.3 + this.rng.range(0, 0.08);
      b.aimErr = this.rng.range(-1, 1) * (1 - b.diff) * 0.32;
      const t = this.pickTarget(f, b);
      b.target = t ? t.id : -1;
      b.retreat = f.hp < f.maxHp * (0.28 + (1 - b.diff) * 0.08) && f !== w.boss;
      b.goal = this.pickGoal(f, b, t, range, melee);
    }

    const target = b.target >= 0 ? w.fighters[b.target] : undefined;
    const valid = target && target.alive && w.visibleTo(target, f.team);

    // --- movimento
    let mv = { x: 0, y: 0 };
    if (b.goal) {
      const dGoal = len(b.goal.x - f.x, b.goal.y - f.y);
      if (dGoal > 24) {
        const direct = this.nav.clearLine(f, b.goal);
        if (direct) mv = normalize(b.goal.x - f.x, b.goal.y - f.y);
        else {
          b.pathT -= dt;
          if (b.pathT <= 0 || b.path.length === 0) {
            b.path = this.nav.path(f.x, f.y, b.goal.x, b.goal.y) ?? [];
            b.pathT = 0.7;
          }
          while (b.path.length > 1 && len(b.path[0]!.x - f.x, b.path[0]!.y - f.y) < 30) b.path.shift();
          const nxt = b.path[0] ?? b.goal;
          mv = normalize(nxt.x - f.x, nxt.y - f.y);
        }
      }
    }
    // em combate: anda de lado (zigue-zague) pra dificultar a mira
    if (valid && !b.retreat) {
      const d = len(target!.x - f.x, target!.y - f.y);
      if (d < range * 1.1) {
        const n = normalize(target!.x - f.x, target!.y - f.y);
        const side = { x: -n.y * b.strafe, y: n.x * b.strafe };
        const k = melee ? 0.25 : 0.65;
        mv = normalize(mv.x * (1 - k) + side.x * k, mv.y * (1 - k) + side.y * k);
      }
    }
    // desvia de projéteis vindo na direção
    const dodge = this.dodge(f, b);
    if (dodge) mv = normalize(mv.x * 0.4 + dodge.x, mv.y * 0.4 + dodge.y);
    // destrava se ficou preso
    b.stuckT += dt;
    if (b.stuckT > 0.8) {
      if (len(f.x - b.lastX, f.y - b.lastY) < 12 && (mv.x !== 0 || mv.y !== 0)) {
        b.path = [];
        b.pathT = 0;
        b.wander = null;
        mv = normalize(mv.x + this.rng.range(-1.5, 1.5), mv.y + this.rng.range(-1.5, 1.5));
      }
      b.stuckT = 0;
      b.lastX = f.x;
      b.lastY = f.y;
    }
    inp.mx = mv.x;
    inp.my = mv.y;

    // --- mira + tiro
    if (valid) {
      const t = target!;
      const d = len(t.x - f.x, t.y - f.y);
      const speed = projSpeed(atk) ?? 1000;
      const lead = Math.min(0.45, d / speed) * (0.4 + b.diff * 0.6);
      const px = t.x + t.vx * lead;
      const py = t.y + t.vy * lead;
      const a = Math.atan2(py - f.y, px - f.x) + b.aimErr;
      inp.ax = Math.cos(a);
      inp.ay = Math.sin(a);
      inp.ad = clamp(d / Math.max(1, range), 0.15, 1);
      inp.aiming = true;
      const lob = atk.effects.some((e) => e.kind === 'projectile' && e.proj.lob);
      const canHit = d < range * (melee ? 1 : 0.97) && (lob || w.map.los(f.x, f.y, t.x, t.y));
      if (canHit && b.triggerT <= 0 && f.ammo >= 1) {
        // bot fraco não descarrega tudo de uma vez
        const keepAmmo = b.diff < 0.5 && f.ammo < 2 && d > range * 0.6;
        if (!keepAmmo) {
          inp.fire = true;
          b.triggerT = 0.18 + (1 - b.diff) * 0.55 + this.rng.range(0, 0.15);
        }
      }
      // super
      if (f.superCharge >= 1 && this.wantsAbility(f, f.def.super, t, d)) {
        inp.skill = 3;
        aimFor(inp, f, t, f.def.super, b.aimErr);
      } else if (b.skillT <= 0) {
        for (let i = 0; i < f.def.skills.length; i++) {
          if (f.skillCd[i]! > 0) continue;
          const ab = f.def.skills[i]!;
          if (this.wantsAbility(f, ab, t, d)) {
            inp.skill = i;
            aimFor(inp, f, t, ab, b.aimErr);
            b.skillT = 0.6 + (1 - b.diff) * 1.6;
            break;
          }
        }
      }
    } else {
      // sem alvo: olha pra onde anda; usa cura/escudo se precisar
      if (mv.x !== 0 || mv.y !== 0) {
        inp.ax = mv.x;
        inp.ay = mv.y;
      }
      if (b.skillT <= 0 && f.hp < f.maxHp * 0.5) {
        for (let i = 0; i < f.def.skills.length; i++) {
          if (f.skillCd[i]! > 0) continue;
          const ab = f.def.skills[i]!;
          if (ab.effects.some((e) => e.kind === 'heal' || e.kind === 'shield' || e.kind === 'cleanse')) {
            inp.skill = i;
            b.skillT = 1;
            break;
          }
        }
      }
    }
    return inp;
  }

  private dummy(b: Brain, f: Fighter, inp: FighterInput, dt: number): FighterInput {
    // bonecos do treino: andam devagar pra lá e pra cá
    b.strafeT -= dt;
    inp.mx = b.strafe * 0.35;
    inp.my = 0;
    void f;
    return inp;
  }

  private pickTarget(f: Fighter, b: Brain): Fighter | null {
    const w = this.w;
    let best: Fighter | null = null;
    let bestScore = Infinity;
    const sight = 950;
    for (const o of w.fighters) {
      if (!o.alive || o.team === f.team || !w.visibleTo(o, f.team)) continue;
      const d = len(o.x - f.x, o.y - f.y);
      if (d > sight) continue;
      let s = d;
      s += (o.hp / o.maxHp) * 260;
      if (!w.map.los(f.x, f.y, o.x, o.y)) s += 380;
      if (o.wanted) s -= 160;
      if (o.id === b.target) s -= 120; // não troca de alvo à toa
      if (s < bestScore) {
        bestScore = s;
        best = o;
      }
    }
    return best;
  }

  private pickGoal(f: Fighter, b: Brain, t: Fighter | null, range: number, melee: boolean): { x: number; y: number } | null {
    const w = this.w;
    // recuar: procura cura ou volta pra base
    if (b.retreat) {
      let heal: { x: number; y: number } | null = null;
      let hd = 700;
      for (const p of w.pickups) {
        if (p.kind !== 'heal') continue;
        const d = len(p.x - f.x, p.y - f.y);
        if (d < hd) {
          hd = d;
          heal = p;
        }
      }
      if (heal) return heal;
      if (t) {
        const n = normalize(f.x - t.x, f.y - t.y);
        return clampToMap(w, f.x + n.x * 300, f.y + n.y * 300);
      }
      return this.home(f);
    }
    // caveiras no chão (modo Guerra)
    if (w.mode.skullPickup) {
      let best: { x: number; y: number } | null = null;
      let bd = t ? 380 : 900;
      for (const p of w.pickups) {
        if (p.kind !== 'skull') continue;
        const d = len(p.x - f.x, p.y - f.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) return best;
    }
    // power-up perto
    for (const p of w.pickups) if ((p.kind === 'power' || (p.kind === 'heal' && f.hp < f.maxHp * 0.7)) && len(p.x - f.x, p.y - f.y) < 320) return p;
    if (t) {
      const d = len(t.x - f.x, t.y - f.y);
      const want = melee ? 0 : range * (0.55 + b.diff * 0.2);
      if (melee || d > want) return { x: t.x, y: t.y };
      // muito perto: se afasta mantendo distância
      const n = normalize(f.x - t.x, f.y - t.y);
      return clampToMap(w, t.x + n.x * want, t.y + n.y * want);
    }
    // patrulha: vai pro lado inimigo / meio do mapa
    if (!b.wander || len(b.wander.x - f.x, b.wander.y - f.y) < 80) {
      const cx = w.map.widthPx / 2;
      const cy = w.map.heightPx / 2;
      let gx = cx + this.rng.range(-w.map.widthPx * 0.3, w.map.widthPx * 0.3);
      const gy = cy + this.rng.range(-w.map.heightPx * 0.35, w.map.heightPx * 0.35);
      if (w.mode.teams === 2) gx = f.team === 0 ? cx + this.rng.range(-200, w.map.widthPx * 0.3) : cx - this.rng.range(-200, w.map.widthPx * 0.3);
      // persegue o último inimigo conhecido mais perto (mesmo invisível agora, por som/memória)
      const near = w.fighters.filter((o) => o.alive && o.team !== f.team).sort((a, c) => len(a.x - f.x, a.y - f.y) - len(c.x - f.x, c.y - f.y))[0];
      b.wander = near && this.rng.chance(0.6) ? { x: near.x + this.rng.range(-200, 200), y: near.y + this.rng.range(-200, 200) } : { x: gx, y: gy };
      b.wander = clampToMap(w, b.wander.x, b.wander.y);
    }
    return b.wander;
  }

  private home(f: Fighter): { x: number; y: number } {
    const sp = this.w.map.spawns;
    const list = this.w.mode.teams === 2 ? (f.team === 0 ? sp.teamA : sp.teamB) : sp.free;
    return list[0] ?? sp.free[0]!;
  }

  private dodge(f: Fighter, b: Brain): { x: number; y: number } | null {
    if (b.diff < 0.3) return null;
    for (const p of this.w.projectiles) {
      if (!p.alive || p.team === f.team || p.lob || p.orbit) continue;
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const d = len(dx, dy);
      if (d > 260) continue;
      const sp = len(p.vx, p.vy) || 1;
      const ux = p.vx / sp;
      const uy = p.vy / sp;
      const along = dx * ux + dy * uy;
      if (along < 0) continue;
      const perp = dx * -uy + dy * ux;
      if (Math.abs(perp) < f.radius + p.def.radius + 14 && this.rng.chance(b.diff * 0.9)) {
        const s = perp >= 0 ? 1 : -1;
        return { x: -uy * s, y: ux * s };
      }
    }
    return null;
  }

  /** Heurística: vale usar esta habilidade agora? */
  private wantsAbility(f: Fighter, ab: AbilityDef, t: Fighter, d: number): boolean {
    const kinds = ab.effects.map((e) => e.kind);
    const hpf = f.hp / f.maxHp;
    if (kinds.includes('heal') || kinds.includes('shield') || kinds.includes('cleanse')) {
      if (hpf < 0.6) return true;
      const ally = this.w.fighters.some((o) => o !== f && o.alive && o.team === f.team && o.hp / o.maxHp < 0.5 && len(o.x - f.x, o.y - f.y) < 300);
      if (ally) return true;
    }
    if (kinds.includes('rewind') || kinds.includes('stealth') || kinds.includes('clone')) return hpf < 0.4;
    if (kinds.includes('buff')) return d < ab.range + f.def.attack.range;
    if (kinds.includes('dash') || kinds.includes('blink')) {
      if (hpf < 0.3) return true; // fuga
      const hasDmg = ab.effects.some((e) => e.kind === 'dash' && (e.damage ?? 0) > 0);
      return d < ab.range * 1.1 && (hasDmg || f.def.attack.range < 220);
    }
    if (ab.aim === 'self') return d < Math.max(150, effectRadius(ab));
    return d < ab.range * 1.05 && (ab.effects.some((e) => e.kind === 'projectile' && e.proj.lob) || this.w.map.los(f.x, f.y, t.x, t.y));
  }
}

function aimFor(inp: FighterInput, f: Fighter, t: Fighter, ab: AbilityDef, err: number): void {
  if (ab.aim === 'self') return;
  const d = len(t.x - f.x, t.y - f.y);
  const a = Math.atan2(t.y + t.vy * 0.25 - f.y, t.x + t.vx * 0.25 - f.x) + err * 0.6;
  const hp = f.hp / f.maxHp;
  const flee = hp < 0.3 && ab.effects.some((e) => e.kind === 'dash' || e.kind === 'blink');
  inp.ax = Math.cos(flee ? a + Math.PI : a);
  inp.ay = Math.sin(flee ? a + Math.PI : a);
  inp.ad = clamp(d / Math.max(1, ab.range), 0.15, 1);
}

function projSpeed(ab: AbilityDef): number | null {
  for (const e of ab.effects) if (e.kind === 'projectile') return e.proj.lob ? null : e.proj.speed;
  return null;
}

function effectRadius(ab: AbilityDef): number {
  let r = 0;
  for (const e of ab.effects) {
    if (e.kind === 'aoe' || e.kind === 'zone') r = Math.max(r, e.radius);
    if (e.kind === 'melee') r = Math.max(r, e.range);
    if (e.kind === 'orbit') r = Math.max(r, e.radius + 40);
  }
  return r;
}

function clampToMap(w: World, x: number, y: number): { x: number; y: number } {
  return { x: clamp(x, TILE * 1.5, w.map.widthPx - TILE * 1.5), y: clamp(y, TILE * 1.5, w.map.heightPx - TILE * 1.5) };
}
