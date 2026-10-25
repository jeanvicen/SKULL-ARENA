import { angleDiff, DEG } from '../engine/math';
import type { Crate, Fighter } from './state';
import type { World } from './world';

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  A REGRA QUE DEFINE O JOGO (seção 6 do briefing):
 *  O personagem SÓ dispara quando há um inimigo DENTRO DO ALCANCE e NA
 *  DIREÇÃO PARA ONDE ESTÁ VIRADO (= direção do movimento). Sem alvo válido
 *  à frente, ele só anda — não desperdiça ataque.
 *  Virar as costas e correr = não ataca. "A caveira encara, não foge."
 * ═══════════════════════════════════════════════════════════════════════
 */
export interface AttackTarget {
  x: number;
  y: number;
  r: number;
  fighter: Fighter | null;
  crate: Crate | null;
  /** Desvio angular entre a direção do personagem e o alvo (rad). */
  off: number;
  dist: number;
}

const _best: AttackTarget = { x: 0, y: 0, r: 0, fighter: null, crate: null, off: 0, dist: 0 };

export function findAttackTarget(world: World, f: Fighter, range: number, needsLos: boolean): AttackTarget | null {
  const coneHalf = world.content.control.attackConeHalfDeg * DEG;
  let bestScore = Infinity;
  let found = false;

  for (const e of world.fighters) {
    if (!e.alive || e.team === f.team || e.id === f.id) continue;
    if (!world.canSee(f, e)) continue;
    const dx = e.x - f.x, dy = e.y - f.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const edge = d - e.radius;
    if (edge > range) continue;
    const off = angleDiff(Math.atan2(dy, dx), f.facing);
    // Tolerância cresce com o tamanho aparente do alvo (alvos colados são fáceis de "encarar")
    const tol = coneHalf + Math.atan2(e.radius, Math.max(d, 1));
    if (off > tol) continue;
    if (needsLos && !world.hasLineOfSight(f.x, f.y, e.x, e.y, 4)) continue;
    const score = off * 2.2 + d / range;
    if (score < bestScore) {
      bestScore = score;
      _best.x = e.x; _best.y = e.y; _best.r = e.radius; _best.fighter = e; _best.crate = null; _best.off = off; _best.dist = d;
      found = true;
    }
  }
  if (found) return _best;

  // Sem inimigos à frente: caixas/urnas destrutíveis também são alvos válidos
  for (const c of world.crates) {
    if (!c.alive) continue;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const dx = cx - f.x, dy = cy - f.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const cr = Math.min(c.w, c.h) / 2;
    if (d - cr > range) continue;
    const off = angleDiff(Math.atan2(dy, dx), f.facing);
    if (off > coneHalf + Math.atan2(cr, Math.max(d, 1))) continue;
    const score = off * 2.2 + d / range;
    if (score < bestScore) {
      bestScore = score;
      _best.x = cx; _best.y = cy; _best.r = cr; _best.fighter = null; _best.crate = c; _best.off = off; _best.dist = d;
      found = true;
    }
  }
  return found ? _best : null;
}
