import type { AbilityDef } from '../content/types';
import { pointSegmentDist } from '../engine/collision';
import { dist } from '../engine/math';
import { spawnShot } from './projectiles';
import type { Fighter } from './state';
import type { World } from './world';

/**
 * Executor de especiais por TIPO + PARÂMETROS (data-driven).
 * Um novo especial = novo JSON. Um novo `type` aqui só quando a ideia for realmente inédita.
 * O especial "quebra a regra" de propósito: dispara sem precisar de alvo à frente.
 */
export function castAbility(world: World, f: Fighter, ab: AbilityDef, angle: number): void {
  const p = ab.params;
  const dmgMul = world.damageMultiplier(f);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  world.events.push({ t: 'special', fighterId: f.id, ability: ab, x: f.x, y: f.y, angle });

  switch (ab.type) {
    case 'dash': {
      const distance = p.distance ?? 200;
      const dur = p.duration ?? 0.22;
      // Para antes da parede (previsível)
      const free = world.raycastWalls(f.x, f.y, f.x + ca * distance, f.y + sa * distance, f.radius * 0.8);
      const d = Math.max(20, distance * free - 4);
      f.dash = {
        t: 0, dur: dur * (d / distance), vx: (ca * d) / (dur * (d / distance)), vy: (sa * d) / (dur * (d / distance)),
        damage: p.damageOnPass ?? 0, knockback: p.knockback ?? 0, status: p.status, hit: [], color: ab.vfx.color,
      };
      f.invuln = Math.max(f.invuln, p.invuln ?? 0);
      f.facing = angle;
      world.events.push({ t: 'dash', fighterId: f.id, x0: f.x, y0: f.y, x1: f.x + ca * d, y1: f.y + sa * d, color: ab.vfx.color });
      break;
    }

    case 'aoe_burst': {
      const range = p.castRange ?? 0;
      let cx = f.x, cy = f.y;
      if (range > 0) {
        const free = world.raycastWalls(f.x, f.y, f.x + ca * range, f.y + sa * range, 4, false);
        cx = f.x + ca * range * free;
        cy = f.y + sa * range * free;
      }
      const go = () => {
        const radius = p.radius ?? 120;
        world.events.push({ t: 'explode', x: cx, y: cy, radius, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff' });
        for (const e of world.fighters) {
          if (!e.alive || e.team === f.team) continue;
          if (dist(cx, cy, e.x, e.y) > radius + e.radius) continue;
          world.damage(e, (p.damage ?? 0) * dmgMul, f, 'special');
          if (p.knockback) world.knockback(e, cx, cy, p.knockback);
          if (p.status) world.applyStatus(e, p.status, f.id);
        }
        for (const c of world.crates) {
          if (c.alive && dist(cx, cy, c.x + c.w / 2, c.y + c.h / 2) <= radius + 20) world.damageCrate(c, (p.damage ?? 0) * dmgMul);
        }
        if (p.zone) world.zones.push({ id: world.newId(), x: cx, y: cy, radius: p.zone.radius, t: 0, dur: p.zone.duration, team: f.team, ownerId: f.id, spec: p.zone, tickAcc: 0 });
      };
      if (p.delay) world.after(p.delay, go);
      else go();
      break;
    }

    case 'shield': {
      const amt = (p.absorb ?? 800) * (1 + world.content.progression.character.hpPerLevel * (f.level - 1));
      f.shield = amt;
      f.shieldMax = amt;
      f.shieldT = p.duration ?? 3;
      f.shieldReflect = !!p.reflect;
      if (p.speedMul || p.damageMul) {
        f.buffs.push({ t: p.duration ?? 3, speedMul: p.speedMul ?? 1, damageMul: p.damageMul ?? 1, attackSpeedMul: p.attackSpeedMul ?? 1, lifesteal: 0 });
      }
      break;
    }

    case 'heal': {
      const radius = p.radius ?? 160;
      for (const a of world.fighters) {
        if (!a.alive || a.team !== f.team) continue;
        if (dist(a.x, a.y, f.x, f.y) > radius + a.radius) continue;
        if (p.heal) world.heal(a, p.heal * (1 + world.content.progression.character.hpPerLevel * (f.level - 1)), f);
        if (p.hps && p.duration) world.applyStatus(a, { effect: 'regen', duration: p.duration, dps: p.hps }, f.id);
        if (p.status) world.applyStatus(a, p.status, f.id);
      }
      if (p.zone) world.zones.push({ id: world.newId(), x: f.x, y: f.y, radius: p.zone.radius, t: 0, dur: p.zone.duration, team: f.team, ownerId: f.id, spec: p.zone, tickAcc: 0 });
      break;
    }

    case 'summon': {
      const n = p.count ?? 1;
      for (let i = 0; i < n; i++) {
        const a = angle + (i - (n - 1) / 2) * 0.9;
        const r = f.radius + 26;
        let x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r;
        if (world.nav.isBlockedAt(x, y)) {
          x = f.x;
          y = f.y;
        }
        const m = world.spawnMinion(f, p.minion!, x, y);
        m.facing = angle;
        world.collideWorld(m);
      }
      break;
    }

    case 'buff': {
      f.buffs.push({
        t: p.duration ?? 4, speedMul: p.speedMul ?? 1, damageMul: p.damageMul ?? 1,
        attackSpeedMul: p.attackSpeedMul ?? 1, lifesteal: p.lifesteal ?? 0,
      });
      if (p.attackSpeedMul && p.attackSpeedMul > 1) f.attackCd = 0;
      if (p.heal) world.heal(f, p.heal, f);
      if (p.status) world.applyStatus(f, p.status, f.id);
      break;
    }

    case 'debuff': {
      const radius = p.radius ?? 200;
      const ox = f.x + ca * (p.castRange ?? 0), oy = f.y + sa * (p.castRange ?? 0);
      world.events.push({ t: 'explode', x: ox, y: oy, radius, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff' });
      for (const e of world.fighters) {
        if (!e.alive || e.team === f.team) continue;
        if (dist(ox, oy, e.x, e.y) > radius + e.radius) continue;
        if (p.status) world.applyStatus(e, p.status, f.id);
        if (p.damage) world.damage(e, p.damage * dmgMul, f, 'special');
      }
      break;
    }

    case 'teleport': {
      const distance = p.distance ?? 260;
      const free = world.raycastWalls(f.x, f.y, f.x + ca * distance, f.y + sa * distance, f.radius);
      let d = distance * free;
      // Se bateu na parede, tenta atravessar (blink): procura ponto livre além dela
      if (free < 1) {
        for (let extra = distance; extra >= 40; extra -= 20) {
          const tx = f.x + ca * extra, ty = f.y + sa * extra;
          if (!world.nav.isBlockedAt(tx, ty)) {
            d = extra;
            break;
          }
        }
      }
      const x0 = f.x, y0 = f.y;
      f.x += ca * d;
      f.y += sa * d;
      world.collideWorld(f);
      f.invuln = Math.max(f.invuln, p.invuln ?? 0.15);
      world.events.push({ t: 'teleport', fighterId: f.id, x0, y0, x1: f.x, y1: f.y, color: ab.vfx.color });
      if (p.damage && p.radius) {
        world.events.push({ t: 'explode', x: f.x, y: f.y, radius: p.radius, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff' });
        for (const e of world.fighters) {
          if (!e.alive || e.team === f.team) continue;
          if (dist(f.x, f.y, e.x, e.y) <= p.radius + e.radius) {
            world.damage(e, p.damage * dmgMul, f, 'special');
            if (p.status) world.applyStatus(e, p.status, f.id);
          }
        }
      }
      break;
    }

    case 'trap': {
      const n = p.count ?? 1;
      const range = p.castRange ?? 120;
      for (let i = 0; i < n; i++) {
        const a = angle + (i - (n - 1) / 2) * 0.5;
        const free = world.raycastWalls(f.x, f.y, f.x + Math.cos(a) * range, f.y + Math.sin(a) * range, 10, true);
        world.traps.push({
          id: world.newId(), x: f.x + Math.cos(a) * range * free, y: f.y + Math.sin(a) * range * free, radius: p.radius ?? 40,
          team: f.team, ownerId: f.id, t: 0, armT: p.delay ?? 0.5, damage: p.damage ?? 300, status: p.status, color: ab.vfx.color,
        });
      }
      break;
    }

    case 'beam': {
      f.beam = {
        t: 0, dur: p.duration ?? 1.5, length: p.length ?? 400, width: p.width ?? 24, dps: p.dps ?? 600,
        status: p.status, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff', ex: f.x, ey: f.y,
      };
      f.facing = angle;
      break;
    }

    case 'transform': {
      const hpBonus = Math.round(f.baseMaxHp * ((p.hpMul ?? 1) - 1));
      f.transform = {
        t: p.duration ?? 6, dur: p.duration ?? 6, speedMul: p.speedMul ?? 1, damageMul: p.damageMul ?? 1,
        radiusMul: p.radiusMul ?? 1, hpBonus,
        basicProjectile: p.basicProjectile ? world.content.projectile(p.basicProjectile) : undefined,
      };
      f.maxHp += hpBonus;
      f.hp += hpBonus;
      f.radius = (f.def.stats.radius ?? 22) * (p.radiusMul ?? 1);
      f.attackCd = 0;
      if (p.heal) world.heal(f, p.heal, f);
      break;
    }

    case 'multi_shot': {
      const def = world.content.projectile(p.projectile!);
      const waves = p.waves ?? 3;
      const interval = p.interval ?? 0.15;
      const fire = (k: number) => {
        if (!f.alive) return;
        const a = k === 0 ? angle : f.facing;
        const spread = (p.spreadDeg ?? 0) * (Math.PI / 180);
        const off = waves > 1 && spread ? -spread / 2 + (spread * k) / (waves - 1) : 0;
        spawnShot(world, f, def, a + off, f.x + Math.cos(a + off) * def.range, f.y + Math.sin(a + off) * def.range, true, 1);
      };
      fire(0);
      for (let k = 1; k < waves; k++) world.after(interval * k, () => fire(k));
      break;
    }

    case 'zone': {
      const range = p.castRange ?? 0;
      const free = range ? world.raycastWalls(f.x, f.y, f.x + ca * range, f.y + sa * range, 4, false) : 0;
      const x = f.x + ca * range * free, y = f.y + sa * range * free;
      const z = p.zone!;
      world.zones.push({ id: world.newId(), x, y, radius: z.radius, t: 0, dur: z.duration, team: f.team, ownerId: f.id, spec: z, tickAcc: 0.2 });
      if (p.damage) {
        world.events.push({ t: 'explode', x, y, radius: z.radius, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff' });
        for (const e of world.fighters) {
          if (e.alive && e.team !== f.team && dist(x, y, e.x, e.y) <= z.radius + e.radius) world.damage(e, p.damage * dmgMul, f, 'special');
        }
      }
      break;
    }

    case 'pull': {
      const radius = p.radius ?? 220;
      world.events.push({ t: 'explode', x: f.x, y: f.y, radius, color: ab.vfx.color, color2: ab.vfx.color2 ?? '#fff' });
      for (const e of world.fighters) {
        if (!e.alive || e.team === f.team) continue;
        const d = dist(f.x, f.y, e.x, e.y);
        if (d > radius + e.radius) continue;
        // Puxa em direção ao conjurador (knockback negativo)
        const k = p.pullStrength ?? 600;
        e.vx += ((f.x - e.x) / (d || 1)) * k;
        e.vy += ((f.y - e.y) / (d || 1)) * k;
        if (p.damage) world.damage(e, p.damage * dmgMul, f, 'special');
        if (p.status) world.applyStatus(e, p.status, f.id);
      }
      break;
    }
  }
}

/** Feixe canalizado: segue a direção atual, para em paredes, causa dano contínuo. */
export function updateBeam(world: World, f: Fighter, dt: number): void {
  const b = f.beam!;
  b.t += dt;
  const ca = Math.cos(f.facing), sa = Math.sin(f.facing);
  const free = world.raycastWalls(f.x, f.y, f.x + ca * b.length, f.y + sa * b.length, 2, true);
  b.ex = f.x + ca * b.length * free;
  b.ey = f.y + sa * b.length * free;
  const dmg = b.dps * dt * world.damageMultiplier(f);
  for (const e of world.fighters) {
    if (!e.alive || e.team === f.team) continue;
    if (pointSegmentDist(e.x, e.y, f.x, f.y, b.ex, b.ey) <= b.width / 2 + e.radius) {
      // Dano contínuo agregado em "pulsos" para números legíveis
      e.beamAcc += dmg;
      if (e.beamAcc >= 60 || b.t >= b.dur) {
        world.damage(e, e.beamAcc, f, 'special');
        e.beamAcc = 0;
        if (b.status) world.applyStatus(e, b.status, f.id);
      }
    }
  }
  for (const c of world.crates) {
    if (c.alive && pointSegmentDist(c.x + c.w / 2, c.y + c.h / 2, f.x, f.y, b.ex, b.ey) <= b.width / 2 + 18) world.damageCrate(c, dmg);
  }
  if (b.t >= b.dur) f.beam = null;
}
