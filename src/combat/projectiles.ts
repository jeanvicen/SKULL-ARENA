import type { ProjectileDef } from '../content/types';
import { rectNormalAt, segmentRect } from '../engine/collision';
import { angleDiff, clamp, DEG, dist, rotateTowards } from '../engine/math';
import type { Fighter, HitKind, Projectile } from './state';
import type { World } from './world';

/**
 * Dispara um ataque definido por dados. Todos os comportamentos (direto, arco,
 * ricochete, perfurante, leque, rajada, melee, teleguiado, orbital, área
 * persistente) são combinações de campos do ProjectileDef — nenhum é "código de personagem".
 */
export function spawnShot(
  world: World,
  owner: Fighter,
  def: ProjectileDef,
  angle: number,
  tx: number,
  ty: number,
  fromSpecial: boolean,
  damageScale: number,
  ox = owner.x,
  oy = owner.y,
  kind: HitKind = fromSpecial ? 'special' : 'basic',
): void {
  const dmg = def.damage * world.damageMultiplier(owner) * damageScale;
  world.events.push({ t: 'shot', x: ox, y: oy, angle, def, ownerId: owner.id });

  if (def.type === 'melee') {
    doMelee(world, owner, def, angle, dmg, kind);
    return;
  }

  const count = Math.max(1, def.count ?? 1);
  const spread = (def.spreadDeg ?? 0) * DEG;
  for (let i = 0; i < count; i++) {
    const off = count > 1 ? -spread / 2 + (spread * i) / (count - 1) : 0;
    const a = angle + off;
    const p = world.projectiles.acquire();
    p.active = true;
    p.id = world.newId();
    p.def = def;
    p.ownerId = owner.id;
    p.team = owner.team;
    p.angle = a;
    p.speed = def.speed;
    p.traveled = 0;
    p.range = def.range;
    p.damage = dmg;
    p.radius = def.radius;
    p.bouncesLeft = def.bounces ?? 0;
    p.pierceLeft = def.pierce ?? 0;
    p.hit.length = 0;
    p.life = def.lifetime ?? 99;
    p.age = 0;
    p.fromSpecial = kind !== 'basic';
    p.reflected = false;
    p.z = 0;
    p.orbitHitT = null;
    // Nasce na "mão" do personagem
    const muzzle = def.orbit ? 0 : owner.radius * 0.6;
    p.x = p.px = ox + Math.cos(a) * muzzle;
    p.y = p.py = oy + Math.sin(a) * muzzle;
    p.vx = Math.cos(a) * def.speed;
    p.vy = Math.sin(a) * def.speed;
    p.lob = def.type === 'lob';
    if (p.lob) {
      // Alvo no chão, preso ao alcance; leque de lobs gira o ponto de impacto
      let dx = tx - ox, dy = ty - oy;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) {
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        d = 1;
      }
      const l = clamp(d, 60, def.range);
      const ta = Math.atan2(dy, dx) + off;
      p.sx = ox;
      p.sy = oy;
      p.tx = ox + Math.cos(ta) * l;
      p.ty = oy + Math.sin(ta) * l;
      p.flightDur = Math.max(0.28, l / def.speed);
      p.x = p.px = ox;
      p.y = p.py = oy;
    }
    if (def.orbit) {
      p.orbitAngle = a;
      p.orbitHitT = new Map();
      p.x = p.px = owner.x + Math.cos(a) * def.orbit.radius;
      p.y = p.py = owner.y + Math.sin(a) * def.orbit.radius;
    }
  }
}

function doMelee(world: World, owner: Fighter, def: ProjectileDef, angle: number, dmg: number, kind: HitKind): void {
  const arc = (def.meleeArcDeg ?? 90) * DEG;
  world.events.push({ t: 'melee', x: owner.x, y: owner.y, angle, range: def.range + owner.radius, arc, color: def.vfx.color, color2: def.vfx.color2 ?? '#ffffff', ownerId: owner.id });
  let hits = 0;
  for (const e of world.fighters) {
    if (!e.alive || e.team === owner.team) continue;
    const d = dist(owner.x, owner.y, e.x, e.y);
    if (d - e.radius > def.range + owner.radius) continue;
    const off = angleDiff(Math.atan2(e.y - owner.y, e.x - owner.x), angle);
    if (off > arc / 2 + Math.atan2(e.radius, Math.max(d, 1))) continue;
    if (!world.hasLineOfSight(owner.x, owner.y, e.x, e.y, 2)) continue;
    onFighterHit(world, owner, def, dmg, e, kind, owner.x, owner.y);
    hits++;
  }
  for (const c of world.crates) {
    if (!c.alive) continue;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const d = dist(owner.x, owner.y, cx, cy);
    if (d - Math.min(c.w, c.h) / 2 > def.range + owner.radius) continue;
    if (angleDiff(Math.atan2(cy - owner.y, cx - owner.x), angle) > arc / 2 + 0.3) continue;
    world.damageCrate(c, dmg);
    hits++;
  }
  if (def.zone) {
    const zx = owner.x + Math.cos(angle) * def.range * 0.7, zy = owner.y + Math.sin(angle) * def.range * 0.7;
    spawnZone(world, owner, def, zx, zy);
  }
  void hits;
}

function onFighterHit(world: World, owner: Fighter | null, def: ProjectileDef, dmg: number, e: Fighter, kind: HitKind, fromX: number, fromY: number): void {
  const dealt = world.damage(e, dmg, owner, kind, def.lifesteal ?? 0);
  if (dealt > 0 && owner) {
    if (def.knockback) world.knockback(e, fromX, fromY, def.knockback);
    if (def.onHit) world.applyStatus(e, def.onHit, owner.id);
    // Acertar o básico carrega o especial: recompensa quem encara
    if (kind === 'basic' && owner.ability?.chargePerHit) owner.specialCd = Math.max(0, owner.specialCd - owner.ability.chargePerHit);
  }
}

function spawnZone(world: World, owner: Fighter, def: ProjectileDef, x: number, y: number): void {
  if (!def.zone) return;
  world.zones.push({ id: world.newId(), x, y, radius: def.zone.radius, t: 0, dur: def.zone.duration, team: owner.team, ownerId: owner.id, spec: def.zone, tickAcc: 0.2 });
}

function explode(world: World, p: Projectile, owner: Fighter | null, x: number, y: number): void {
  const r = p.def.aoeRadius ?? p.radius;
  world.events.push({ t: 'explode', x, y, radius: r, color: p.def.vfx.color, color2: p.def.vfx.color2 ?? '#ffffff' });
  const kind: HitKind = p.fromSpecial ? 'special' : 'basic';
  for (const e of world.fighters) {
    if (!e.alive || e.team === p.team) continue;
    if (dist(x, y, e.x, e.y) <= r + e.radius) onFighterHit(world, owner, p.def, p.damage, e, kind, x, y);
  }
  for (const c of world.crates) {
    if (!c.alive) continue;
    if (dist(x, y, c.x + c.w / 2, c.y + c.h / 2) <= r + Math.min(c.w, c.h) / 2) world.damageCrate(c, p.damage);
  }
}

/** Termina o projétil: explosão, zona persistente e evento de impacto. */
function finish(world: World, p: Projectile, owner: Fighter | null, wall: boolean): void {
  if (p.def.aoeRadius) explode(world, p, owner, p.x, p.y);
  else world.events.push({ t: 'impact', x: p.x, y: p.y, def: p.def, wall, angle: Math.atan2(p.vy, p.vx) });
  if (p.def.zone && owner) spawnZone(world, owner, p.def, p.x, p.y);
  p.active = false;
}

export function updateProjectiles(world: World, dt: number): void {
  const pool = world.projectiles;
  for (let i = 0; i < pool.count; i++) {
    const p = pool.items[i];
    const owner = world.byId.get(p.ownerId) ?? null;
    p.px = p.x;
    p.py = p.y;
    p.age += dt;

    if (p.lob) {
      updateLob(world, p, owner);
    } else if (p.def.orbit) {
      updateOrbit(world, p, owner, dt);
    } else {
      updateDirect(world, p, owner, dt);
    }

    if (!p.active) {
      pool.releaseAt(i);
      i--;
    }
  }
}

function updateLob(world: World, p: Projectile, owner: Fighter | null): void {
  const k = Math.min(1, p.age / p.flightDur);
  p.x = p.sx + (p.tx - p.sx) * k;
  p.y = p.sy + (p.ty - p.sy) * k;
  p.z = Math.sin(k * Math.PI) * (p.def.arcHeight ?? 90);
  if (k >= 1) {
    p.z = 0;
    // Passa por cima de tudo e só "existe" no ponto de queda
    if (!p.def.aoeRadius) {
      const r = p.radius;
      for (const e of world.fighters) {
        if (!e.alive || e.team === p.team) continue;
        if (dist(p.x, p.y, e.x, e.y) <= r + e.radius) onFighterHit(world, owner, p.def, p.damage, e, p.fromSpecial ? 'special' : 'basic', p.x, p.y);
      }
    }
    finish(world, p, owner, false);
  }
}

function updateOrbit(world: World, p: Projectile, owner: Fighter | null, dt: number): void {
  if (!owner || !owner.alive || p.age >= p.life) {
    world.events.push({ t: 'impact', x: p.x, y: p.y, def: p.def, wall: false, angle: 0 });
    p.active = false;
    return;
  }
  const o = p.def.orbit!;
  p.orbitAngle += o.angularSpeed * DEG * dt;
  p.x = owner.x + Math.cos(p.orbitAngle) * o.radius;
  p.y = owner.y + Math.sin(p.orbitAngle) * o.radius;
  p.vx = -Math.sin(p.orbitAngle);
  p.vy = Math.cos(p.orbitAngle);
  const hitT = p.orbitHitT!;
  for (const e of world.fighters) {
    if (!e.alive || e.team === p.team) continue;
    if (dist(p.x, p.y, e.x, e.y) > p.radius + e.radius) continue;
    const last = hitT.get(e.id) ?? -99;
    if (world.time - last < 0.45) continue;
    hitT.set(e.id, world.time);
    onFighterHit(world, owner, p.def, p.damage, e, 'special', owner.x, owner.y);
  }
}

function updateDirect(world: World, p: Projectile, owner: Fighter | null, dt: number): void {
  // Teleguiado leve: curva em direção ao inimigo visível mais próximo à frente
  if (p.def.homing && owner) {
    let best: Fighter | null = null;
    let bd = Infinity;
    const cur = Math.atan2(p.vy, p.vx);
    for (const e of world.fighters) {
      if (!e.alive || e.team === p.team || p.hit.includes(e.id) || !world.canSee(owner, e)) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > p.range - p.traveled + 60) continue;
      if (angleDiff(Math.atan2(e.y - p.y, e.x - p.x), cur) > 70 * DEG) continue;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      const na = rotateTowards(cur, Math.atan2(best.y - p.y, best.x - p.x), p.def.homing * DEG * dt);
      p.vx = Math.cos(na) * p.speed;
      p.vy = Math.sin(na) * p.speed;
    }
  }

  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;

  // Paredes (+ ricochete)
  let tWall = 2;
  let wallRect = null as null | { x: number; y: number; w: number; h: number };
  for (const o of world.shotBlockers) {
    const t = segmentRect(p.x, p.y, nx, ny, o, p.radius * 0.6);
    if (t >= 0 && t < tWall) {
      tWall = t;
      wallRect = o;
    }
  }
  let crateHit = null as null | (typeof world.crates)[number];
  for (const c of world.crates) {
    if (!c.alive) continue;
    const t = segmentRect(p.x, p.y, nx, ny, c, p.radius * 0.6);
    if (t >= 0 && t < tWall) {
      tWall = t;
      wallRect = c;
      crateHit = c;
    }
  }

  // Corpos inimigos (antes da parede no segmento)
  let tBody = 2;
  let bodyHit: Fighter | null = null;
  for (const e of world.fighters) {
    if (!e.alive || e.team === p.team || p.hit.includes(e.id)) continue;
    if (e.invuln > 0 && e.dash) continue; // atravessa quem está "fantasma" no dash
    const t = segmentRect(p.x, p.y, nx, ny, { x: e.x - e.radius, y: e.y - e.radius, w: e.radius * 2, h: e.radius * 2 }, p.radius);
    if (t >= 0 && t < tBody) {
      // refinamento circular
      const cx = p.x + (nx - p.x) * t, cy = p.y + (ny - p.y) * t;
      if (dist(cx, cy, e.x, e.y) <= e.radius + p.radius + 6) {
        tBody = t;
        bodyHit = e;
      }
    }
  }

  if (bodyHit && tBody <= tWall) {
    p.x = p.x + (nx - p.x) * tBody;
    p.y = p.y + (ny - p.y) * tBody;
    const e = bodyHit;
    // Escudo refletor devolve o tiro
    if (e.shieldReflect && e.shield > 0 && !p.reflected) {
      p.reflected = true;
      p.team = e.team;
      p.ownerId = e.id;
      p.vx = -p.vx;
      p.vy = -p.vy;
      p.traveled = 0;
      p.hit.length = 0;
      world.events.push({ t: 'bounce', x: p.x, y: p.y, color: '#9ff' });
      return;
    }
    p.hit.push(e.id);
    if (p.def.aoeRadius) {
      finish(world, p, owner, false);
      return;
    }
    let dmg = p.damage;
    if (p.def.falloffMul) dmg *= 1 + (p.def.falloffMul - 1) * clamp(p.traveled / p.range, 0, 1);
    onFighterHit(world, owner, p.def, dmg, e, p.fromSpecial ? 'special' : 'basic', p.x - p.vx * 0.05, p.y - p.vy * 0.05);
    world.events.push({ t: 'impact', x: p.x, y: p.y, def: p.def, wall: false, angle: Math.atan2(p.vy, p.vx) });

    if (p.def.bounceOnEnemies && p.bouncesLeft > 0) {
      // Ricochete em cadeia para o próximo inimigo
      let next: Fighter | null = null;
      let nd = p.def.range * 0.8;
      for (const g of world.fighters) {
        if (!g.alive || g.team === p.team || p.hit.includes(g.id)) continue;
        const d = dist(p.x, p.y, g.x, g.y);
        if (d < nd && world.hasLineOfSight(p.x, p.y, g.x, g.y, 2)) {
          nd = d;
          next = g;
        }
      }
      if (next) {
        p.bouncesLeft--;
        const a = Math.atan2(next.y - p.y, next.x - p.x);
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
        p.traveled = Math.max(0, p.traveled - p.def.range * 0.5);
        world.events.push({ t: 'bounce', x: p.x, y: p.y, color: p.def.vfx.color });
        return;
      }
    }
    if (p.pierceLeft > 0) {
      p.pierceLeft--;
      return;
    }
    if (p.def.zone && owner) spawnZone(world, owner, p.def, p.x, p.y);
    p.active = false;
    return;
  }

  if (wallRect && tWall <= 1) {
    const hx = p.x + (nx - p.x) * tWall, hy = p.y + (ny - p.y) * tWall;
    if (crateHit) world.damageCrate(crateHit, p.damage);
    if (p.bouncesLeft > 0 && !crateHit) {
      const n = rectNormalAt(hx, hy, p.vx, p.vy, wallRect, p.radius * 0.6);
      if (n.nx !== 0) p.vx = -p.vx;
      if (n.ny !== 0) p.vy = -p.vy;
      p.x = hx + n.nx * 1.5;
      p.y = hy + n.ny * 1.5;
      p.bouncesLeft--;
      p.hit.length = 0; // pode acertar de novo após quicar
      world.events.push({ t: 'bounce', x: hx, y: hy, color: p.def.vfx.color });
      return;
    }
    p.x = hx;
    p.y = hy;
    finish(world, p, owner, true);
    return;
  }

  const step = Math.sqrt((nx - p.x) ** 2 + (ny - p.y) ** 2);
  p.x = nx;
  p.y = ny;
  p.traveled += step;
  // Limites do mapa
  const { w, h } = world.map.size;
  if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) {
    if (p.bouncesLeft > 0) {
      if (p.x < 0 || p.x > w) p.vx = -p.vx;
      if (p.y < 0 || p.y > h) p.vy = -p.vy;
      p.x = clamp(p.x, 0, w);
      p.y = clamp(p.y, 0, h);
      p.bouncesLeft--;
      world.events.push({ t: 'bounce', x: p.x, y: p.y, color: p.def.vfx.color });
    } else {
      finish(world, p, owner, true);
      return;
    }
  }
  if (p.traveled >= p.range || p.age >= p.life) finish(world, p, owner, false);
}
