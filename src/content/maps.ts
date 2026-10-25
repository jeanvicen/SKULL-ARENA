import type { DestructibleDef, MapDef, ObstacleDef, RectDef } from './types';

/**
 * Expande a simetria declarada no mapa. Permite escrever só metade (ou um quarto)
 * da arena no JSON e garante que ela seja justa para todos os lados.
 * Duplicatas exatas (peças no eixo de simetria) são removidas.
 */
export function expandMapSymmetry(map: MapDef): MapDef {
  const sym = map.symmetry ?? 'none';
  if (sym === 'none') return map;
  const { w, h } = map.size;

  const mx = <T extends RectDef>(r: T): T => ({ ...r, x: w - r.x - r.w });
  const my = <T extends RectDef>(r: T): T => ({ ...r, y: h - r.y - r.h });
  const mp = <T extends RectDef>(r: T): T => my(mx(r));

  const rectVariants = <T extends RectDef>(r: T): T[] => {
    switch (sym) {
      case 'mirror_x': return [r, mx(r)];
      case 'mirror_y': return [r, my(r)];
      case 'point': return [r, mp(r)];
      case 'quad': return [r, mx(r), my(r), mp(r)];
      default: return [r];
    }
  };

  const dx = (d: DestructibleDef): DestructibleDef => ({ ...d, x: w - d.x });
  const dy = (d: DestructibleDef): DestructibleDef => ({ ...d, y: h - d.y });
  const pointVariants = (d: DestructibleDef): DestructibleDef[] => {
    switch (sym) {
      case 'mirror_x': return [d, dx(d)];
      case 'mirror_y': return [d, dy(d)];
      case 'point': return [d, dy(dx(d))];
      case 'quad': return [d, dx(d), dy(d), dy(dx(d))];
      default: return [d];
    }
  };

  const uniq = <T>(arr: T[]): T[] => {
    const seen = new Set<string>();
    return arr.filter((a) => {
      const k = JSON.stringify(a);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    ...map,
    symmetry: 'none',
    obstacles: uniq(map.obstacles.flatMap((o) => rectVariants<ObstacleDef>(o))),
    brush: uniq((map.brush ?? []).flatMap((b) => rectVariants(b))),
    destructibles: uniq((map.destructibles ?? []).flatMap(pointVariants)),
  };
}
