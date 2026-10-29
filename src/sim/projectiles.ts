import { len, normalize } from '../engine/math';
import { TILE } from './map';
import type { Projectile } from './types';
import type { World } from './world';

/** Atualiza todos os projéteis: movimento, ricochete, teleguiado, arco, órbita, acertos. */
export function updateProjectiles(w: World, dt: number): void {
  for (const p of w.projectiles) {
    if (!p.alive) continue;
    p.age += dt;
    p.px = p.x;
    p.py = p.y;
    const owner = w.fighters[p.owner];
    const def = p.def;

    // --- órbita em volta do dono
    if (p.orbit) {
      if (!owner || !owner.alive || w.time > p.orbit.until) {
        p.alive = false;
        continue;
      }
      p.orbit.angle += p.orbit.speed * dt;
      p.x = owner.x + Math.cos(p.orbit.angle) * p.orbit.radius;
      p.y = owner.y + Math.sin(p.orbit.angle) * p.orbit.radius;
      // pode acertar o mesmo alvo de novo a cada 0,6 s
      if (Math.floor(p.age / 0.6) !== Math.floor((p.age - dt) / 0.6)) p.hit.length = 0;
      hitTargets(w, p);
      continue;
    }

    // --- arremesso em arco (passa por cima das paredes)
    if (p.lob) {
      const l = p.lob;
      l.t += dt;
      const u = Math.min(1, l.t / l.dur);
      p.x = l.sx + (l.tx - l.sx) * u;
      p.y = l.sy + (l.ty - l.sy) * u;
      p.z = Math.sin(u * Math.PI) * Math.min(160, 60 + len(l.tx - l.sx, l.ty - l.sy) * 0.25);
      if (u >= 1) {
        endProjectile(w, p, false, true);
      }
      continue;
    }

    // --- teleguiado
    if (def.homing && !p.returning) {
      const t = w.nearestEnemy({ x: p.x, y: p.y, team: p.team }, 420, true);
      if (t) {
        const want = Math.atan2(t.y - p.y, t.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = Math.max(-def.homing * dt, Math.min(def.homing * dt, d));
        const sp = len(p.vx, p.vy);
        p.vx = Math.cos(cur + turn) * sp;
        p.vy = Math.sin(cur + turn) * sp;
      }
    }

    // --- bumerangue voltando
    if (p.returning && owner) {
      const n = normalize(owner.x - p.x, owner.y - p.y);
      const sp = def.speed * 1.1;
      p.vx = n.x * sp;
      p.vy = n.y * sp;
      if (len(owner.x - p.x, owner.y - p.y) < owner.radius + 10) {
        p.alive = false;
        continue;
      }
    }

    // --- movimento com sub-passos (não atravessa parede fina)
    const speed = len(p.vx, p.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 24));
    const sdt = dt / steps;
    for (let s = 0; s < steps && p.alive; s++) {
      const nx = p.x + p.vx * sdt;
      const ny = p.y + p.vy * sdt;
      const tx = Math.floor(nx / TILE);
      const ty = Math.floor(ny / TILE);
      const tile = w.map.at(tx, ty);
      if (w.map.blocksShot(tile) && !p.returning) {
        // acerta a parede (destrói se for destrutível)
        const owner2 = w.fighters[p.owner] ?? null;
        w.hitTile(tx, ty, p.damage * (def.wallDamage ?? 0.35), owner2);
        if (p.bounces > 0 && w.map.blocksShot(w.map.at(tx, ty))) {
          p.bounces--;
          const ox = Math.floor(p.x / TILE);
          const oy = Math.floor(p.y / TILE);
          if (ox !== tx) p.vx = -p.vx;
          if (oy !== ty) p.vy = -p.vy;
          if (ox === tx && oy === ty) {
            p.vx = -p.vx;
            p.vy = -p.vy;
          }
          p.hit.length = 0;
          break;
        }
        endProjectile(w, p, true, !!def.explode);
        break;
      }
      p.x = nx;
      p.y = ny;
      p.traveled += speed * sdt;
      hitTargets(w, p);
    }
    if (!p.alive) continue;
    if (p.traveled >= p.range && !p.returning) {
      if (def.boomerang) {
        p.returning = true;
        p.hit.length = 0;
      } else endProjectile(w, p, false, !!def.explode);
    }
    if (p.age > 8) p.alive = false;
  }
  if (w.tick % 30 === 0 || w.projectiles.length > 300) w.projectiles = w.projectiles.filter((p) => p.alive);
}

function hitTargets(w: World, p: Projectile): void {
  const def = p.def;
  const owner = w.fighters[p.owner] ?? null;
  for (const f of w.fighters) {
    if (!f.alive || f.jump || p.hit.includes(f.id)) continue;
    const r = def.radius + f.radius;
    const dx = f.x - p.x;
    const dy = f.y - p.y;
    if (dx * dx + dy * dy > r * r) continue;
    if (f.team === p.team) {
      if (def.heal && f.id !== p.owner) {
        p.hit.push(f.id);
        w.heal(f, def.heal, owner);
        if (p.pierce <= 0) {
          endProjectile(w, p, false, false);
          return;
        }
        p.pierce--;
      }
      continue;
    }
    p.hit.push(f.id);
    let dmg = p.damage;
    const frac = Math.min(1, p.traveled / Math.max(1, p.range));
    if (def.falloff !== undefined) dmg *= 1 + (def.falloff - 1) * frac;
    if (def.ramp) dmg *= 1 + def.ramp * frac;
    const n = normalize(p.vx, p.vy);
    w.damageFighter(f, dmg, owner, {
      knock: def.knockback,
      dirX: n.x,
      dirY: n.y,
      status: def.status,
      isSuper: p.isSuper,
      noCharge: p.noCharge,
      lifesteal: def.lifesteal,
    });
    if (def.pull && owner) {
      const pn = normalize(owner.x - f.x, owner.y - f.y);
      f.kx += pn.x * def.pull;
      f.ky += pn.y * def.pull;
    }
    if (p.chainLeft > 0) chain(w, p, f.x, f.y);
    if (def.explode) {
      endProjectile(w, p, false, true);
      return;
    }
    if (p.pierce > 0) {
      p.pierce--;
      continue;
    }
    endProjectile(w, p, false, false);
    return;
  }
  for (const s of w.summons) {
    if (!s.alive || s.team === p.team || p.hit.includes(-s.id)) continue;
    if (len(s.x - p.x, s.y - p.y) < def.radius + (s.def.radius ?? 20)) {
      p.hit.push(-s.id);
      w.damageSummon(s, p.damage, owner);
      if (p.pierce > 0) p.pierce--;
      else {
        endProjectile(w, p, false, !!def.explode);
        return;
      }
    }
  }
  for (const pr of w.props) {
    if (!pr.alive || pr.z > 30 || p.hit.includes(-100000 - pr.id)) continue;
    if (len(pr.x - p.x, pr.y - p.y) < def.radius + pr.radius) {
      p.hit.push(-100000 - pr.id);
      const n = normalize(p.vx, p.vy);
      w.pushProp(pr, n.x * (220 + (def.knockback ?? 0)), n.y * (220 + (def.knockback ?? 0)), 60);
      w.damageProp(pr, p.damage * 0.9, owner);
      if (p.pierce > 0) p.pierce--;
      else {
        endProjectile(w, p, false, !!def.explode);
        return;
      }
    }
  }
}

function chain(w: World, p: Projectile, x: number, y: number): void {
  const c = p.def.chain!;
  let best = null;
  let bd = c.range;
  for (const f of w.fighters) {
    if (!f.alive || f.team === p.team || p.hit.includes(f.id)) continue;
    const d = len(f.x - x, f.y - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  if (!best) return;
  const owner = w.fighters[p.owner];
  if (!owner) return;
  const a = Math.atan2(best.y - y, best.x - x);
  const np = w.spawnProjectile(owner, x, y, a, { ...p.def, chain: undefined, range: c.range + 40 }, { noCharge: true, dmgMult: 1 });
  np.damage = p.damage * (c.falloff ?? 0.75);
  np.hit = [...p.hit];
  np.chainLeft = p.chainLeft - 1;
  if (np.chainLeft > 0) np.def = { ...np.def, chain: c };
}

function endProjectile(w: World, p: Projectile, wall: boolean, explode: boolean): void {
  if (!p.alive) return;
  p.alive = false;
  const def = p.def;
  const owner = w.fighters[p.owner] ?? null;
  if (explode && def.explode) {
    const e = def.explode;
    const mult = owner ? p.damage / Math.max(1, def.damage) : 1;
    w.events.push({ type: 'explode', x: p.x, y: p.y, r: e.radius, color: def.look.color, big: e.radius >= 120 });
    w.areaDamage(p.x, p.y, e.radius, e.damage * mult, owner, p.team, { knock: e.knockback, status: e.status, isSuper: p.isSuper, noCharge: p.noCharge, wallDamage: 1, propForce: (e.knockback ?? 300) * 1.8 });
    if (e.zone && owner) {
      w.zones.push({ ...e.zone, id: w.uid(), owner: owner.id, team: p.team, x: p.x, y: p.y, t: e.zone.duration, tickT: 0, dps: e.zone.dps ? e.zone.dps * mult : undefined });
      w.events.push({ type: 'zone', x: p.x, y: p.y, r: e.zone.radius, kind: e.zone.look.kind });
    }
  } else if (p.lob && !def.explode) {
    // arremesso sem explosão: acerta quem estiver no ponto de queda
    w.areaDamage(p.x, p.y, def.radius * 2.2, p.damage, owner, p.team, { status: def.status, knock: def.knockback, isSuper: p.isSuper });
    w.events.push({ type: 'projEnd', x: p.x, y: p.y, color: def.look.color, wall: false });
  } else w.events.push({ type: 'projEnd', x: p.x, y: p.y, color: def.look.color, wall });
}
