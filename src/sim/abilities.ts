import type { AbilityDef, EffectDef } from '../content/types';
import { len, normalize } from '../engine/math';
import { TILE } from './map';
import type { Fighter } from './types';
import type { World } from './world';

/**
 * EXECUTOR DE HABILIDADES
 * Uma habilidade é uma lista de EFEITOS (peças de LEGO). Este arquivo sabe executar
 * cada tipo de efeito. Pra criar um efeito novo: adicione o tipo em content/types.ts
 * (EffectDef) e um `case` aqui.
 */

export type CastKind = 'attack' | 'skill' | 'super';

export function castAbility(w: World, f: Fighter, ab: AbilityDef, dx: number, dy: number, dist: number, kind: CastKind): void {
  const angle = Math.atan2(dy, dx);
  const reach = ab.aim === 'point' ? Math.max(40, ab.range * dist) : ab.range;
  const tx = f.x + dx * reach;
  const ty = f.y + dy * reach;
  w.events.push({ type: 'shoot', id: f.id, x: f.x, y: f.y, angle, ability: ab, kind });
  const cast = ab.castTime ?? 0;
  for (const e of ab.effects) {
    const delay = cast + (e.delay ?? 0);
    const run = () => runEffect(w, f, e, angle, tx, ty, kind);
    if (delay > 0) w.delayed.push({ at: w.time + delay, run: () => f.alive && run() });
    else run();
  }
}

function runEffect(w: World, f: Fighter, e: EffectDef, angle: number, tx: number, ty: number, kind: CastKind): void {
  const isSuper = kind === 'super';
  const dmgMult = w.damageMultOf(f);
  switch (e.kind) {
    case 'projectile': {
      const count = e.count ?? 1;
      const spread = ((e.spread ?? 0) * Math.PI) / 180;
      const burst = e.burst ?? 1;
      for (let b = 0; b < burst; b++) {
        const shoot = () => {
          if (!f.alive) return;
          const a0 = burst > 1 ? f.aim : angle;
          for (let i = 0; i < count; i++) {
            const a = count > 1 ? a0 - spread / 2 + (spread * i) / (count - 1) : a0 + (spread > 0 ? w.rng.range(-spread / 2, spread / 2) : 0);
            const ox = f.x + Math.cos(a) * (f.radius + 4);
            const oy = f.y + Math.sin(a) * (f.radius + 4) - 6;
            w.spawnProjectile(f, ox, oy, a, e.proj, { isSuper, targetX: tx, targetY: ty });
          }
        };
        if (b === 0) shoot();
        else w.delayed.push({ at: w.time + b * (e.burstDelay ?? 0.08), run: shoot });
      }
      break;
    }
    case 'melee': {
      const arc = (e.arc * Math.PI) / 180;
      for (const o of w.fighters) {
        if (!o.alive || o.team === f.team) continue;
        const d = len(o.x - f.x, o.y - f.y);
        if (d > e.range + o.radius) continue;
        const a = Math.atan2(o.y - f.y, o.x - f.x);
        let diff = Math.abs(a - angle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > arc / 2 + 0.25) continue;
        w.damageFighter(o, e.damage * dmgMult, f, { knock: e.knockback, dirX: Math.cos(a), dirY: Math.sin(a), status: e.status, isSuper, lifesteal: e.lifesteal });
      }
      for (const s of w.summons) if (s.alive && s.team !== f.team && len(s.x - f.x, s.y - f.y) < e.range + 20) w.damageSummon(s, e.damage * dmgMult, f);
      for (const p of w.props) {
        if (!p.alive || len(p.x - f.x, p.y - f.y) > e.range + p.radius) continue;
        const n = normalize(p.x - f.x, p.y - f.y);
        w.pushProp(p, n.x * 500, n.y * 500, 200);
        w.damageProp(p, e.damage * dmgMult * 0.8, f);
      }
      // corpo a corpo quebra parede na frente
      const hx = f.x + Math.cos(angle) * (e.range * 0.8);
      const hy = f.y + Math.sin(angle) * (e.range * 0.8);
      w.hitTile(Math.floor(hx / TILE), Math.floor(hy / TILE), e.damage * dmgMult * (e.wallDamage ?? 0.5), f);
      break;
    }
    case 'dash': {
      const speed = e.speed ?? 1500;
      const dur = e.distance / speed;
      f.dash = {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        t: dur,
        damage: (e.damage ?? 0) * dmgMult,
        radius: e.radius ?? f.radius + 12,
        knockback: e.knockback ?? 0,
        status: e.status,
        hit: [],
        invuln: !!e.invuln,
      };
      f.statuses = f.statuses.filter((s) => s.kind !== 'root' && s.kind !== 'slow');
      w.events.push({ type: 'dash', id: f.id });
      break;
    }
    case 'blink': {
      const fx = f.x;
      const fy = f.y;
      let d = e.distance;
      let nx = f.x + Math.cos(angle) * d;
      let ny = f.y + Math.sin(angle) * d;
      // recua até achar um lugar livre
      while (d > 0 && w.map.solidAt(nx, ny)) {
        d -= 16;
        nx = f.x + Math.cos(angle) * d;
        ny = f.y + Math.sin(angle) * d;
      }
      const free = w.map.nearestFree(nx, ny, f.radius);
      f.x = f.px = free.x;
      f.y = f.py = free.y;
      w.events.push({ type: 'blink', id: f.id, fx, fy, tx: f.x, ty: f.y });
      break;
    }
    case 'leap': {
      const dur = e.duration ?? 0.45;
      const dest = w.map.nearestFree(tx, ty, f.radius);
      f.jump = { sx: f.x, sy: f.y, tx: dest.x, ty: dest.y, t: 0, dur };
      f.dash = null;
      w.events.push({ type: 'jump', id: f.id });
      break;
    }
    case 'aoe': {
      const x = e.at === 'self' ? f.x : tx;
      const y = e.at === 'self' ? f.y : ty;
      w.events.push({ type: 'explode', x, y, r: e.radius, color: e.fx ?? (e.heal ? '#5dffa0' : '#ffb347'), big: e.radius > 140 });
      w.areaDamage(x, y, e.radius, (e.damage ?? 0) * dmgMult, f, f.team, { knock: e.knockback, status: e.status, isSuper, heal: e.heal, pull: e.pull, wallDamage: e.wallDamage, propForce: (e.knockback ?? 200) * 1.6 });
      if (e.heal && e.at === 'self') w.heal(f, e.heal, f);
      break;
    }
    case 'zone': {
      w.zones.push({
        id: w.uid(),
        owner: f.id,
        team: f.team,
        x: e.at === 'self' ? f.x : tx,
        y: e.at === 'self' ? f.y : ty,
        t: e.duration,
        tickT: 0,
        radius: e.radius,
        duration: e.duration,
        dps: e.dps ? e.dps * dmgMult : undefined,
        hps: e.hps,
        status: e.status,
        follow: e.follow,
        look: e.look,
      });
      w.events.push({ type: 'zone', x: e.at === 'self' ? f.x : tx, y: e.at === 'self' ? f.y : ty, r: e.radius, kind: e.look.kind });
      break;
    }
    case 'heal': {
      w.heal(f, e.amount, f);
      if (e.radius) for (const o of w.fighters) if (o !== f && o.alive && o.team === f.team && len(o.x - f.x, o.y - f.y) < e.radius) w.heal(o, e.amount, f);
      w.events.push({ type: 'zone', x: f.x, y: f.y, r: e.radius ?? 60, kind: 'heal' });
      break;
    }
    case 'shield': {
      const give = (o: Fighter) => {
        o.shield = Math.max(o.shield, e.amount);
        o.shieldT = e.duration;
        w.events.push({ type: 'shield', id: o.id });
      };
      give(f);
      if (e.radius) for (const o of w.fighters) if (o !== f && o.alive && o.team === f.team && len(o.x - f.x, o.y - f.y) < e.radius) give(o);
      break;
    }
    case 'buff': {
      const give = (o: Fighter) => o.buffs.push({ stat: e.stat, mult: e.mult, t: e.duration });
      give(f);
      if (e.radius) for (const o of w.fighters) if (o !== f && o.alive && o.team === f.team && len(o.x - f.x, o.y - f.y) < e.radius) give(o);
      w.events.push({ type: 'status', id: f.id, kind: e.stat === 'speed' ? 'haste' : 'rage' });
      break;
    }
    case 'summon': {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) {
        const bx = e.at === 'self' ? f.x : tx;
        const by = e.at === 'self' ? f.y : ty;
        const off = n > 1 ? ((i / n) * Math.PI * 2) : 0;
        const pos = w.map.nearestFree(bx + Math.cos(off) * (n > 1 ? 50 : 0), by + Math.sin(off) * (n > 1 ? 50 : 0), 20);
        const hp = e.unit.hp * f.dmgMult;
        w.summons.push({ id: w.uid(), owner: f.id, team: f.team, def: e.unit, x: pos.x, y: pos.y, px: pos.x, py: pos.y, hp, maxHp: hp, t: e.unit.duration, atkT: 0.4, aim: angle, alive: true, vx: 0, vy: 0 });
        w.events.push({ type: 'summon', id: f.id, x: pos.x, y: pos.y });
      }
      break;
    }
    case 'wall': {
      const x = e.at === 'self' ? f.x + Math.cos(angle) * 90 : tx;
      const y = e.at === 'self' ? f.y + Math.sin(angle) * 90 : ty;
      const px = -Math.sin(angle);
      const py = Math.cos(angle);
      const cells = Math.max(1, Math.round(e.length / TILE));
      for (let i = 0; i < cells; i++) {
        const o = (i - (cells - 1) / 2) * TILE;
        const cx = Math.floor((x + px * o) / TILE);
        const cy = Math.floor((y + py * o) / TILE);
        // não prende ninguém dentro da parede
        const occupied = w.fighters.some((ff) => ff.alive && Math.floor(ff.x / TILE) === cx && Math.floor(ff.y / TILE) === cy);
        if (!occupied && w.map.placeTemp(cx, cy, w.time + e.duration)) {
          w.map.hp[w.map.idx(cx, cy)] = e.hp;
        }
      }
      w.events.push({ type: 'zone', x, y, r: e.length / 2, kind: 'smoke' });
      break;
    }
    case 'beam': {
      w.beams.push({ id: w.uid(), owner: f.id, team: f.team, length: e.length, width: e.width, t: e.duration, dps: e.dps * dmgMult, color: e.color, status: e.status, ex: f.x, ey: f.y });
      break;
    }
    case 'trap': {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) {
        const spread = n > 1 ? (i - (n - 1) / 2) * 70 : 0;
        const bx = (e.at === 'self' ? f.x : tx) - Math.sin(angle) * spread;
        const by = (e.at === 'self' ? f.y : ty) + Math.cos(angle) * spread;
        w.traps.push({ id: w.uid(), owner: f.id, team: f.team, x: bx, y: by, radius: e.radius, damage: e.damage * dmgMult, status: e.status, t: e.duration, armed: 0.6 });
      }
      break;
    }
    case 'stealth': {
      f.stealthT = e.duration;
      w.events.push({ type: 'status', id: f.id, kind: 'reveal' });
      break;
    }
    case 'clone': {
      const def = {
        id: 'clone',
        name: 'Clone',
        hp: e.hp,
        duration: e.duration,
        speed: f.def.stats.speed,
        radius: 24,
        look: { kind: 'clone' as const, color: '#b78bff' },
      };
      w.summons.push({ id: w.uid(), owner: f.id, team: f.team, def, x: f.x, y: f.y, px: f.x, py: f.y, hp: e.hp, maxHp: e.hp, t: e.duration, atkT: 99, aim: angle, alive: true, vx: Math.cos(angle) * f.def.stats.speed, vy: Math.sin(angle) * f.def.stats.speed });
      f.stealthT = Math.max(f.stealthT, 1.2);
      w.events.push({ type: 'summon', id: f.id, x: f.x, y: f.y });
      break;
    }
    case 'rewind': {
      const target = w.time - e.seconds;
      let snap = f.history[0];
      for (const h of f.history) if (h.t <= target) snap = h;
      if (snap) {
        const fx = f.x;
        const fy = f.y;
        const free = w.map.nearestFree(snap.x, snap.y, f.radius);
        f.x = f.px = free.x;
        f.y = f.py = free.y;
        f.hp = Math.max(f.hp, Math.min(f.maxHp, snap.hp + (e.heal ?? 0)));
        f.statuses = [];
        w.events.push({ type: 'blink', id: f.id, fx, fy, tx: f.x, ty: f.y });
      }
      break;
    }
    case 'orbit': {
      for (let i = 0; i < e.count; i++) {
        const p = w.spawnProjectile(f, f.x, f.y, 0, e.proj, { isSuper });
        p.orbit = { angle: (i / e.count) * Math.PI * 2, radius: e.radius, until: w.time + e.duration, speed: 4.2 };
        p.range = 1e9;
      }
      break;
    }
    case 'cleanse': {
      const clean = (o: Fighter) => (o.statuses = o.statuses.filter((s) => s.kind === 'haste' || s.kind === 'rage'));
      clean(f);
      if (e.radius) for (const o of w.fighters) if (o.alive && o.team === f.team && len(o.x - f.x, o.y - f.y) < e.radius) clean(o);
      break;
    }
    case 'ammo': {
      f.ammo = Math.min(f.maxAmmo, f.ammo + e.amount);
      break;
    }
  }
}
