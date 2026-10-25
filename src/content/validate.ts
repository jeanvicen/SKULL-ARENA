import type { ContentDB } from './registry';
import type { AbilityType } from './types';

export interface ContentIssue {
  level: 'error' | 'warn';
  kind: 'character' | 'ability' | 'projectile' | 'map' | 'pet' | 'skin' | 'mode' | 'chest' | 'economy';
  id: string;
  message: string;
}

const ANIMS = ['idle', 'move', 'attack', 'hurt', 'death', 'special', 'victory'];

/** Parâmetros obrigatórios por tipo de habilidade. */
const REQUIRED_PARAMS: Record<AbilityType, string[]> = {
  dash: ['distance'],
  aoe_burst: ['radius', 'damage'],
  shield: ['absorb', 'duration'],
  heal: ['radius'],
  summon: ['count', 'minion'],
  buff: ['duration'],
  debuff: ['radius', 'status'],
  teleport: ['distance'],
  trap: ['radius', 'damage'],
  beam: ['length', 'width', 'dps', 'duration'],
  transform: ['duration'],
  multi_shot: ['projectile', 'waves', 'interval'],
  zone: ['zone'],
  pull: ['radius', 'pullStrength'],
};

/**
 * Valida referências cruzadas e campos essenciais. Rodado no boot (descarta o
 * que estiver quebrado) e nos testes (CI falha se houver erro).
 */
export function validateContent(db: ContentDB): ContentIssue[] {
  const out: ContentIssue[] = [];
  const err = (kind: ContentIssue['kind'], id: string, message: string) => out.push({ level: 'error', kind, id, message });
  const warn = (kind: ContentIssue['kind'], id: string, message: string) => out.push({ level: 'warn', kind, id, message });

  for (const p of db.projectiles.values()) {
    if (!(p.range > 0)) err('projectile', p.id, 'range deve ser > 0');
    if (p.type !== 'melee' && !(p.speed > 0)) err('projectile', p.id, 'speed deve ser > 0');
    if (!(p.damage >= 0)) err('projectile', p.id, 'damage inválido');
    if (p.type === 'lob' && !p.aoeRadius) warn('projectile', p.id, 'lob sem aoeRadius usa radius como área');
  }

  for (const a of db.abilities.values()) {
    const req = REQUIRED_PARAMS[a.type];
    if (!req) {
      err('ability', a.id, `tipo desconhecido: ${a.type}`);
      continue;
    }
    for (const k of req) {
      if ((a.params as Record<string, unknown>)[k] === undefined) err('ability', a.id, `params.${k} é obrigatório para ${a.type}`);
    }
    if (!(a.cooldown > 0)) err('ability', a.id, 'cooldown deve ser > 0');
    if (a.params.projectile && !db.projectiles.has(a.params.projectile)) err('ability', a.id, `projétil inexistente: ${a.params.projectile}`);
    if (a.params.basicProjectile && !db.projectiles.has(a.params.basicProjectile)) err('ability', a.id, `projétil inexistente: ${a.params.basicProjectile}`);
    if (a.params.minion && !db.projectiles.has(a.params.minion.projectile)) err('ability', a.id, `projétil do minion inexistente: ${a.params.minion.projectile}`);
  }

  const seenSignatures = new Map<string, string>();
  for (const c of db.characters.values()) {
    if (!db.rarities.has(c.rarity)) err('character', c.id, `raridade inexistente: ${c.rarity}`);
    if (!db.projectiles.has(c.basicAttack?.projectile)) err('character', c.id, `projétil inexistente: ${c.basicAttack?.projectile}`);
    if (!db.abilities.has(c.special?.ability)) err('character', c.id, `habilidade inexistente: ${c.special?.ability}`);
    if (!(c.stats?.hp > 0) || !(c.stats?.moveSpeed > 0) || !(c.stats?.attackInterval > 0)) err('character', c.id, 'stats inválidos');
    for (const anim of ANIMS) if (!c.animations?.includes(anim)) warn('character', c.id, `animação ausente: ${anim}`);
    if (!c.lore || c.lore.length < 20) warn('character', c.id, 'lore curta demais');
    if (!c.voiceLines?.select?.length) warn('character', c.id, 'sem falas de seleção');
    for (const s of c.skins ?? []) if (!db.skins.has(s)) err('character', c.id, `skin inexistente: ${s}`);
    // "Nunca dois iguais": mesma combinação tiro+especial+papel é proibida
    const sig = `${c.basicAttack?.projectile}|${c.special?.ability}`;
    const prev = seenSignatures.get(sig);
    if (prev) err('character', c.id, `kit idêntico ao de ${prev} (${sig})`);
    else seenSignatures.set(sig, c.id);
  }

  for (const s of db.skins.values()) {
    if (s.characterId && !db.characters.has(s.characterId)) err('skin', s.id, `personagem inexistente: ${s.characterId}`);
  }

  for (const p of db.pets.values()) {
    if (p.ability === 'mirror_shot' && (!p.params.projectile || !db.projectiles.has(p.params.projectile))) {
      err('pet', p.id, 'mirror_shot exige params.projectile válido');
    }
  }

  for (const m of db.maps.values()) {
    const { w, h } = m.size;
    if (!(w > 0 && h > 0)) err('map', m.id, 'size inválido');
    if (!m.spawns?.length) err('map', m.id, 'sem spawns');
    for (const s of m.spawns ?? []) if (s.x < 0 || s.y < 0 || s.x > w || s.y > h) err('map', m.id, `spawn fora do mapa (${s.x},${s.y})`);
    for (const o of m.obstacles) {
      if (!db.obstacles[o.type]) err('map', m.id, `tipo de obstáculo desconhecido: ${o.type}`);
      if (o.x < 0 || o.y < 0 || o.x + o.w > w || o.y + o.h > h) warn('map', m.id, `obstáculo sai do mapa (${o.x},${o.y})`);
      for (const s of m.spawns ?? []) {
        if (s.x > o.x - 24 && s.x < o.x + o.w + 24 && s.y > o.y - 24 && s.y < o.y + o.h + 24 && db.obstacles[o.type]?.blocksMove) {
          err('map', m.id, `spawn (${s.x},${s.y}) dentro de obstáculo`);
        }
      }
    }
    for (const mode of m.modes) if (!db.modes.has(mode)) warn('map', m.id, `modo desconhecido: ${mode}`);
  }

  for (const mode of db.modes.values()) {
    const maps = db.mapsForMode(mode.id);
    if (!maps.length) err('mode', mode.id, 'nenhum mapa na rotação');
    for (const map of maps) {
      if (mode.kind === 'team' && !map.teamSpawns) err('mode', mode.id, `mapa ${map.id} sem teamSpawns`);
      if (mode.kind !== 'team' && map.spawns.length < mode.players) err('mode', mode.id, `mapa ${map.id} tem ${map.spawns.length} spawns para ${mode.players} jogadores`);
      if (mode.kind === 'team' && map.teamSpawns && (map.teamSpawns.a.length < (mode.teamSize ?? 3) || map.teamSpawns.b.length < (mode.teamSize ?? 3))) {
        err('mode', mode.id, `mapa ${map.id} com teamSpawns insuficientes`);
      }
    }
  }

  for (const c of db.chests.values()) {
    if (c.coins[0] > c.coins[1]) err('chest', c.id, 'faixa de moedas invertida');
  }

  for (const id of db.progression.starterCharacters) if (!db.characters.has(id)) err('economy', id, 'starter inexistente');
  for (const id of db.shop.chests) if (!db.chests.has(id)) err('economy', id, 'baú da loja inexistente');
  if (db.progression.starterPet && !db.pets.has(db.progression.starterPet)) err('economy', db.progression.starterPet, 'pet inicial inexistente');

  return out;
}
