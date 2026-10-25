import { dist, DEG, wrapAngle } from '../engine/math';
import type { Rng } from '../engine/rng';
import type { Fighter, Projectile } from '../combat/state';
import type { World } from '../combat/world';

/**
 * IA dos bots. Regras de honestidade:
 *  - Usa o MESMO FighterInput do jogador (move / ataque / especial) — sem atalhos.
 *  - Obedece a regra assinatura: para atacar precisa ENCARAR o alvo (andar na direção dele).
 *  - Só enxerga o que a visibilidade do mato permite (world.canSee).
 *  - Dificuldade muda tempo de reação, precisão e esperteza — nunca dano ou vida.
 */
export type Difficulty = 'facil' | 'normal' | 'dificil';

interface DiffProfile {
  /** Abaixo desta fração de vida o bot recua para regenerar. */
  retreatAt: number;
  reaction: number;
  jitterDeg: number;
  dodge: number;
  specialSmart: number;
  aggression: number;
}

const PROFILES: Record<Difficulty, DiffProfile> = {
  facil: { retreatAt: 0.22, reaction: 0.42, jitterDeg: 16, dodge: 0.12, specialSmart: 0.35, aggression: 0.55 },
  normal: { retreatAt: 0.38, reaction: 0.24, jitterDeg: 8, dodge: 0.42, specialSmart: 0.75, aggression: 0.75 },
  dificil: { retreatAt: 0.45, reaction: 0.12, jitterDeg: 3, dodge: 0.78, specialSmart: 1, aggression: 0.9 },
};

type Mode = 'hunt' | 'attack' | 'kite' | 'retreat' | 'dodge' | 'loot' | 'roam' | 'ring';

export class BotBrain {
  private readonly prof: DiffProfile;
  private thinkT = 0;
  private target: Fighter | null = null;
  private mode: Mode = 'roam';
  private path: Array<{ x: number; y: number }> = [];
  private pathGoal = { x: 0, y: 0 };
  private pathT = 0;
  private strafe = 1;
  private strafeT = 0;
  private dodgeDir = { x: 0, y: 0 };
  private dodgeT = 0;
  private roamGoal: { x: number; y: number } | null = null;
  private lastPos = { x: 0, y: 0 };
  private stuckT = 0;
  private unstickT = 0;
  private unstick = { x: 0, y: 0 };
  private jitter = 0;
  private specialWant = false;
  /** Recuando para regenerar (histerese até ~80% de vida). */
  private recovering = false;

  constructor(private readonly world: World, readonly f: Fighter, private readonly rng: Rng) {
    this.prof = PROFILES[f.difficulty] ?? PROFILES.normal;
    this.thinkT = rng.next() * this.prof.reaction;
    this.strafe = rng.chance(0.5) ? 1 : -1;
  }

  update(dt: number): void {
    const f = this.f;
    const inp = f.input;
    if (!f.alive || this.world.phase !== 'playing') {
      inp.moveX = inp.moveY = 0;
      inp.attackHeld = false;
      inp.special = false;
      return;
    }

    this.thinkT -= dt;
    this.pathT -= dt;
    this.strafeT -= dt;
    this.dodgeT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.prof.reaction * (0.7 + this.rng.next() * 0.6);
      this.think();
    }

    // Detecta "travado" (parede/canto) e dá uma desviada
    if (this.unstickT > 0) {
      this.unstickT -= dt;
      this.setMove(this.unstick.x, this.unstick.y);
      return;
    }
    const moved = dist(f.x, f.y, this.lastPos.x, this.lastPos.y);
    this.lastPos.x = f.x;
    this.lastPos.y = f.y;
    if (f.moving && moved < f.baseSpeed * dt * 0.15 && !f.dash) {
      this.stuckT += dt;
      if (this.stuckT > 0.35) {
        this.stuckT = 0;
        this.path = [];
        const a = this.rng.next() * Math.PI * 2;
        this.unstick = { x: Math.cos(a), y: Math.sin(a) };
        this.unstickT = 0.3;
        this.strafe *= -1;
      }
    } else {
      this.stuckT = 0;
    }

    this.act();
  }

  // ───────────────────────── decisão (em ritmo de reação) ─────────────────────────

  private think(): void {
    const w = this.world, f = this.f;
    this.jitter = (this.rng.next() * 2 - 1) * this.prof.jitterDeg * DEG;

    // Alvo: inimigo visível com melhor custo (perto + ferido)
    let best: Fighter | null = null;
    let bestScore = Infinity;
    for (const e of w.fighters) {
      if (!e.alive || e.team === f.team || !w.canSee(f, e)) continue;
      const d = dist(f.x, f.y, e.x, e.y);
      if (d > 380 + 420 * this.prof.aggression) continue;
      const score = d * (0.55 + 0.45 * (e.hp / e.maxHp)) * (e.isMinion ? 1.6 : 1) * (e === this.target ? 0.8 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    this.target = best;

    // Esquiva de projéteis
    if (this.rng.chance(this.prof.dodge)) {
      const threat = this.incomingThreat();
      if (threat) {
        const a = Math.atan2(threat.vy, threat.vx) + (Math.PI / 2) * (this.rng.chance(0.5) ? 1 : -1);
        this.dodgeDir = { x: Math.cos(a), y: Math.sin(a) };
        this.dodgeT = 0.28;
      }
    }

    const hpFrac = f.hp / f.maxHp;
    if (hpFrac < this.prof.retreatAt) this.recovering = true;
    else if (hpFrac > 0.8) this.recovering = false;
    const ring = w.ring;
    if (ring && ring.active && dist(f.x, f.y, ring.cx, ring.cy) > ring.r - 70) {
      this.mode = 'ring';
    } else if (best) {
      const d = dist(f.x, f.y, best.x, best.y);
      const range = this.attackRange();
      // Recuar = dar as costas (não ataca). Mas se o perseguidor está mais fraco, encara.
      const chaserWeaker = best.hp < f.hp * 0.7;
      // Escudo refletor ativo: atirar nele é dar tiro no próprio pé
      const reflecting = best.shieldReflect && best.shield > 0 && f.basic.type !== 'melee';
      if (this.recovering && !chaserWeaker && !f.isMinion) this.mode = 'retreat';
      else if (reflecting) this.mode = 'kite';
      else if (f.attackCd <= 0.12 && d <= range + 40) this.mode = 'attack';
      else if (d > range * 1.05) this.mode = this.recovering ? 'roam' : 'hunt';
      else this.mode = 'kite';
    } else {
      const loot = this.nearestPickup();
      this.mode = loot && !this.recovering ? 'loot' : 'roam';
    }

    this.specialWant = this.shouldUseSpecial();
  }

  private attackRange(): number {
    const b = this.f.transform?.basicProjectile ?? this.f.basic;
    return b.type === 'melee' ? b.range + this.f.radius + 8 : b.range * 0.95;
  }

  private incomingThreat(): Projectile | null {
    const w = this.world, f = this.f;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = w.projectiles.items[i];
      if (p.team === f.team || p.lob || p.def.orbit) continue;
      const rx = f.x - p.x, ry = f.y - p.y;
      const sp2 = p.vx * p.vx + p.vy * p.vy;
      if (sp2 < 1) continue;
      const t = (rx * p.vx + ry * p.vy) / sp2;
      if (t < 0 || t > 0.5) continue;
      const cx = p.x + p.vx * t - f.x, cy = p.y + p.vy * t - f.y;
      if (cx * cx + cy * cy < (f.radius + p.radius + 8) ** 2) return p;
    }
    return null;
  }

  private nearestPickup(): { x: number; y: number } | null {
    const w = this.world, f = this.f;
    let best: { x: number; y: number } | null = null;
    let bd = 420;
    for (const p of w.pickups) {
      if (p.kind === 'soul' && f.souls >= w.content.control.souls.max) continue;
      if (p.kind === 'potion' && f.hp > f.maxHp * 0.8) continue;
      const d = dist(f.x, f.y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) {
      for (const c of w.crates) {
        if (!c.alive) continue;
        const d = dist(f.x, f.y, c.x + c.w / 2, c.y + c.h / 2);
        if (d < bd + 80) {
          bd = d;
          best = { x: c.x + c.w / 2, y: c.y + c.h / 2 };
        }
      }
    }
    return best;
  }

  private shouldUseSpecial(): boolean {
    const w = this.world, f = this.f;
    if (f.specialCd > 0 || !this.rng.chance(this.prof.specialSmart)) return false;
    const ab = f.ability;
    const t = this.target;
    const hpFrac = f.hp / f.maxHp;
    const d = t ? dist(f.x, f.y, t.x, t.y) : Infinity;
    const p = ab.params;
    switch (ab.ai) {
      case 'escape':
        return hpFrac < 0.45 && d < 260;
      case 'low_hp':
        return hpFrac < 0.6 && d < 360;
      case 'enemies_near': {
        const r = (p.radius ?? 160) * 0.85;
        return !!t && d < r + t.radius;
      }
      case 'allies_hurt': {
        let hurt = hpFrac < 0.6;
        for (const a of w.fighters) if (a.alive && a.team === f.team && a !== f && dist(a.x, a.y, f.x, f.y) < (p.radius ?? 160) && a.hp / a.maxHp < 0.6) hurt = true;
        return hurt && (d < 500 || hpFrac < 0.4);
      }
      case 'in_range': {
        if (!t) return false;
        const reach = (p.castRange ?? 0) + (p.radius ?? 0) + (p.length ?? 0) + (p.zone?.radius ?? 0);
        return d < Math.max(reach, 140) && w.hasLineOfSight(f.x, f.y, t.x, t.y, 2);
      }
      case 'engage':
      default: {
        if (!t) return false;
        const reach = Math.max(p.distance ?? 0, (p.castRange ?? 0) + (p.radius ?? 0), 200);
        return d < reach && (t.hp / t.maxHp < 0.75 || hpFrac > 0.6);
      }
    }
  }

  // ───────────────────────── ação (todo tick) ─────────────────────────

  private act(): void {
    const w = this.world, f = this.f, inp = f.input;
    const t = this.target && this.target.alive ? this.target : null;
    inp.aimX = inp.aimY = undefined;
    inp.attackHeld = true;

    if (this.specialWant && f.specialCd <= 0) {
      this.specialWant = false;
      inp.special = true;
      let a = t ? Math.atan2(t.y - f.y, t.x - f.x) : f.facing;
      if (f.ability.ai === 'escape' && t) a = wrapAngle(a + Math.PI + this.jitter * 2);
      inp.specialAimX = Math.cos(a);
      inp.specialAimY = Math.sin(a);
    } else {
      inp.special = false;
    }

    if (this.dodgeT > 0) {
      this.setMove(this.dodgeDir.x, this.dodgeDir.y);
      return;
    }

    switch (this.mode) {
      case 'ring': {
        const r = w.ring!;
        this.goTo(r.cx, r.cy);
        return;
      }
      case 'attack': {
        if (!t) break;
        // ENCARAR: anda na direção do alvo para o ataque disparar
        const a = Math.atan2(t.y - f.y, t.x - f.x) + this.jitter;
        if (w.hasLineOfSight(f.x, f.y, t.x, t.y, 4) || f.basic.type === 'lob') {
          this.setMove(Math.cos(a), Math.sin(a));
          if (f.attackCd > 0.05 && f.burstLeft === 0) this.mode = 'kite';
        } else {
          this.goTo(t.x, t.y);
        }
        return;
      }
      case 'hunt': {
        if (!t) break;
        this.goTo(t.x, t.y);
        return;
      }
      case 'kite': {
        if (!t) break;
        const d = dist(f.x, f.y, t.x, t.y);
        const range = this.attackRange();
        const role = f.def.role;
        const melee = (f.transform?.basicProjectile ?? f.basic).type === 'melee';
        const pref = melee || role === 'tanque' || role === 'assassino' ? range * 0.6 : range * 0.78;
        const to = Math.atan2(t.y - f.y, t.x - f.x);
        if (this.strafeT <= 0) {
          this.strafeT = 0.6 + this.rng.next() * 0.9;
          if (this.rng.chance(0.35)) this.strafe *= -1;
        }
        let a: number;
        if (d < pref * 0.75 && !melee) a = to + Math.PI + this.strafe * 0.5; // dá meia-volta (sem atacar)
        else if (d > pref * 1.2) a = to + this.strafe * 0.35;
        else a = to + this.strafe * (Math.PI / 2); // circula
        if (f.attackCd <= 0.05 && !(t.shieldReflect && t.shield > 0)) this.mode = 'attack';
        this.setMove(Math.cos(a), Math.sin(a));
        return;
      }
      case 'retreat': {
        if (!t) break;
        // Foge para o mato mais próximo longe do alvo (ou só para longe)
        let goal: { x: number; y: number } | null = null;
        let bd = Infinity;
        for (const b of w.brush) {
          const bx = b.x + b.w / 2, by = b.y + b.h / 2;
          const dm = dist(f.x, f.y, bx, by);
          if (dist(t.x, t.y, bx, by) < dm) continue;
          if (dm < bd) {
            bd = dm;
            goal = { x: bx, y: by };
          }
        }
        if (!goal) {
          const a = Math.atan2(f.y - t.y, f.x - t.x) + this.strafe * 0.4;
          goal = { x: f.x + Math.cos(a) * 220, y: f.y + Math.sin(a) * 220 };
        }
        this.goTo(goal.x, goal.y);
        return;
      }
      case 'loot': {
        const loot = this.nearestPickup();
        if (loot) {
          this.goTo(loot.x, loot.y);
          return;
        }
        break;
      }
    }
    // roam
    if (!this.roamGoal || dist(f.x, f.y, this.roamGoal.x, this.roamGoal.y) < 40 || this.rng.chance(0.004)) {
      const { w: mw, h: mh } = w.map.size;
      const cx = w.ring?.active ? w.ring.cx : mw / 2, cy = w.ring?.active ? w.ring.cy : mh / 2;
      const spread = w.ring?.active ? Math.max(60, w.ring.r * 0.6) : Math.min(mw, mh) * 0.4;
      this.roamGoal = { x: cx + (this.rng.next() * 2 - 1) * spread, y: cy + (this.rng.next() * 2 - 1) * spread };
    }
    this.goTo(this.roamGoal.x, this.roamGoal.y);
  }

  private setMove(x: number, y: number): void {
    const inp = this.f.input;
    const l = Math.hypot(x, y) || 1;
    inp.moveX = x / l;
    inp.moveY = y / l;
    // O bot mantém o "polegar no joystick": se estiver encarando alguém no alcance,
    // dispara — exatamente como o jogador. Virar as costas = não ataca.
    inp.attackHeld = true;
  }

  /** Vai até um ponto: linha reta se livre, senão A*. */
  private goTo(tx: number, ty: number): void {
    const w = this.world, f = this.f;
    const free = w.raycastWalls(f.x, f.y, tx, ty, f.radius * 0.9) >= 1;
    if (free) {
      this.path = [];
      this.setMove(tx - f.x, ty - f.y);
      return;
    }
    if (this.pathT <= 0 || !this.path.length || dist(tx, ty, this.pathGoal.x, this.pathGoal.y) > 60) {
      this.pathT = 0.6;
      this.pathGoal = { x: tx, y: ty };
      this.path = w.nav.findPath(f.x, f.y, tx, ty) ?? [];
    }
    while (this.path.length > 1 && dist(f.x, f.y, this.path[0].x, this.path[0].y) < 22) this.path.shift();
    // Atalho: pula waypoints visíveis
    while (this.path.length > 1 && w.raycastWalls(f.x, f.y, this.path[1].x, this.path[1].y, f.radius * 0.9) >= 1) this.path.shift();
    const wp = this.path[0];
    if (wp) this.setMove(wp.x - f.x, wp.y - f.y);
    else this.setMove(tx - f.x, ty - f.y);
  }
}
