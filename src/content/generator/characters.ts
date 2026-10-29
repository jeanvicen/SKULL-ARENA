import { Rng } from '../../engine/rng';
import { atk, skill, sup, st } from '../abilities';
import { RARITY } from '../rarities';
import { attackDamage, defineCharacter } from '../characters/define';
import type {
  AbilityDef,
  AnimStyle,
  CharacterDef,
  HairStyle,
  Look,
  PassiveDef,
  PrintKind,
  RarityId,
  RoleId,
  ShoeStyle,
  Species,
  StatusApply,
  TopStyle,
  PantsStyle,
  WeaponKind,
  ProjLook,
} from '../types';
import * as W from './words';

/**
 * GERADOR DETERMINÍSTICO DE PERSONAGENS
 * ------------------------------------
 * Gera `count` personagens a partir de uma semente fixa: o personagem nº 37 é SEMPRE
 * o mesmo (mesmo nome, roupa, kit e história). Os IDs são "gen_001", "gen_002"...
 * Pra ter mais personagens: aumente GENERATED_COUNT em characters/index.ts.
 * Os que já existem não mudam (os novos entram no fim da lista).
 */

type Gender = 'm' | 'f';

function g(text: string, gender: Gender): string {
  return text.replace(/\{([^|}]*)\|([^}]*)\}/g, (_, m, f) => (gender === 'm' ? m : f));
}

/** Cotas de raridade por bloco de 100 (o gerador segue esse ritmo). */
const RARITY_PATTERN: Array<[RarityId, number]> = [
  ['comum', 30],
  ['incomum', 25],
  ['raro', 20],
  ['extremo', 12],
  ['epico', 8],
  ['god', 5],
];

function rarityFor(i: number): RarityId {
  // embaralha determinístico dentro de cada bloco de 100
  const block = Math.floor(i / 100);
  const pos = i % 100;
  const list: RarityId[] = [];
  for (const [r, n] of RARITY_PATTERN) for (let k = 0; k < n; k++) list.push(r);
  new Rng(`rar-${block}`).shuffle(list);
  return list[pos]!;
}

const ROLES: RoleId[] = ['atacante', 'tanque', 'suporte', 'assassino', 'atirador', 'controle', 'lancador'];
const ROLE_W = [22, 14, 12, 14, 12, 13, 13];

const SPECIES: Species[] = ['human', 'skeleton', 'alien', 'robot', 'demon', 'zombie', 'ghost', 'feline', 'vampire', 'lizard', 'void'];
const SPECIES_W = [44, 15, 8, 8, 6, 6, 4, 4, 2, 2, 1];

const SKINS = ['#f6dcc8', '#f1d2bf', '#e9c3a6', '#d9a882', '#c98e6a', '#a86f4c', '#8a5a3c', '#6b4430', '#4e3122', '#f3d9c9'];
const SPECIES_SKIN: Partial<Record<Species, string[]>> = {
  alien: ['#7ce0c3', '#9ef08a', '#b6a6ff', '#ff9ad5', '#7dc6ff', '#c3f07c'],
  demon: ['#d6453a', '#b0325e', '#7a2a6e', '#e0603a'],
  zombie: ['#8fae8a', '#a3b88a', '#7fa39a', '#b4c49a'],
  ghost: ['#d8e6ff', '#e6dcff', '#d6fff2'],
  vampire: ['#e6eef8', '#efe6ff', '#f2e8e8'],
  lizard: ['#5aa05a', '#4f9a8a', '#8aa04a', '#6a8a3a'],
  void: ['#2a1a40', '#1c1430', '#30163a'],
  feline: SKINS,
  human: SKINS,
};
const HAIR_COLORS = ['#15121c', '#2a1d14', '#5a3a22', '#8a5a2e', '#d9b36a', '#f2efff', '#ff4fb4', '#7a3dff', '#3df2ff', '#58ffd0', '#ff3d3d', '#ffd23f', '#9ef08a', '#4a6aff', '#c0c0c8'];
/** Paletas de roupa streetwear: [principal, secundária, calça, tênis, detalhe] */
const PALETTES: string[][] = [
  ['#1a1820', '#d9d9e3', '#3e6a8a', '#16141c', '#f6f4ee'],
  ['#9a9aa2', '#141218', '#2a2a30', '#f2f2f2', '#16141c'],
  ['#121016', '#ff3d6e', '#141218', '#f2f2f2', '#ff3d6e'],
  ['#17161c', '#58ffd0', '#6e6e74', '#f7f7f7', '#58ffd0'],
  ['#d9452b', '#1d1b26', '#2a2a30', '#2a2622', '#f6f4ee'],
  ['#2f4a3a', '#e8e2cf', '#22262e', '#e8e2cf', '#2f4a3a'],
  ['#2b2a6e', '#7df9ff', '#3d3a5c', '#7df9ff', '#2b2a6e'],
  ['#3a1d5c', '#ff8de8', '#2a1440', '#ff8de8', '#3a1d5c'],
  ['#fbf6ea', '#ff4fb4', '#3b3f5a', '#ff4fb4', '#141218'],
  ['#ffd23f', '#141218', '#2a4a7a', '#141218', '#ffd23f'],
  ['#1f2b1f', '#9ef08a', '#2a2d24', '#9ef08a', '#1f2b1f'],
  ['#20314f', '#bdf3ff', '#1a2438', '#dfe8ff', '#20314f'],
  ['#f2f5f8', '#5dffa0', '#2c3a46', '#f2f5f8', '#5dffa0'],
  ['#3d3a3a', '#cfe2b8', '#2d2a26', '#2a2622', '#cfe2b8'],
  ['#ff7a2e', '#3a3f4d', '#3a3f4d', '#2a2d36', '#ffd23f'],
  ['#0f0b18', '#ffd23f', '#181226', '#121018', '#ffd23f'],
  ['#5b2a86', '#ffb6f2', '#1c1428', '#ffffff', '#ff3df2'],
  ['#0d3b4f', '#ffcf6b', '#16202a', '#ffcf6b', '#0d3b4f'],
  ['#6b1d1d', '#f5e6c8', '#241414', '#f5e6c8', '#c9a24a'],
  ['#e9e3d6', '#2a2a30', '#8a7a62', '#1a1a1f', '#e9e3d6'],
  ['#1e3f2a', '#ff9d3d', '#2b2b2b', '#ff9d3d', '#1e3f2a'],
  ['#c2185b', '#fce4ec', '#212121', '#fce4ec', '#c2185b'],
  ['#004d40', '#80cbc4', '#263238', '#e0f2f1', '#80cbc4'],
  ['#4a148c', '#ffd740', '#1a1033', '#ffd740', '#4a148c'],
];

const WEAPONS_BY_ROLE: Record<RoleId, WeaponKind[]> = {
  atacante: ['pistol', 'dual_pistols', 'rifle', 'cards', 'yoyo', 'mic', 'crossbow'],
  tanque: ['hammer', 'axe', 'bat', 'gloves', 'shotgun', 'chain', 'wrench'],
  suporte: ['boombox', 'staff', 'orb', 'guitar', 'mic', 'book', 'umbrella'],
  assassino: ['katana', 'claws', 'scythe', 'chain', 'cards', 'skateboard', 'yoyo'],
  atirador: ['sniper', 'crossbow', 'bow', 'rifle'],
  controle: ['staff', 'orb', 'book', 'guitar', 'umbrella', 'chain'],
  lancador: ['launcher', 'spray', 'orb', 'gloves', 'book'],
};

type Element = 'fire' | 'poison' | 'ice' | 'electric' | 'void' | 'holy' | 'blood' | 'neutral';
const ELEMENT_COLOR: Record<Element, string> = { fire: '#ff8a3d', poison: '#9ef08a', ice: '#9ef0ff', electric: '#7df9ff', void: '#b77bff', holy: '#fff1a8', blood: '#ff3d5c', neutral: '#ffe08a' };
const ELEMENT_ZONE: Record<Element, 'fire' | 'poison' | 'ice' | 'electric' | 'void' | 'holy' | 'smoke'> = {
  fire: 'fire',
  poison: 'poison',
  ice: 'ice',
  electric: 'electric',
  void: 'void',
  holy: 'holy',
  blood: 'void',
  neutral: 'smoke',
};
const ELEMENT_STATUS: Record<Element, StatusApply | undefined> = {
  fire: st.burn(2.5, 260),
  poison: st.poison(3, 240),
  ice: st.slow(1.2, 0.3),
  electric: st.slow(0.6, 0.4),
  void: st.mark(3, 0.15),
  holy: st.weaken(2, 0.2),
  blood: undefined,
  neutral: undefined,
};

function elementFor(rng: Rng, sp: Species): Element {
  const by: Partial<Record<Species, Element[]>> = {
    demon: ['fire', 'fire', 'blood'],
    zombie: ['poison', 'poison', 'neutral'],
    lizard: ['poison', 'neutral'],
    vampire: ['ice', 'blood', 'blood'],
    alien: ['electric', 'electric', 'void'],
    ghost: ['ice', 'void', 'holy'],
    robot: ['electric', 'neutral', 'fire'],
    skeleton: ['void', 'neutral', 'fire', 'holy'],
    void: ['void'],
  };
  return rng.pick(by[sp] ?? ['neutral', 'neutral', 'fire', 'ice', 'electric', 'poison', 'holy', 'void', 'blood']);
}

// ---------------------------------------------------------------------------
// Nome
// ---------------------------------------------------------------------------

function makeName(rng: Rng, sp: Species, gender: Gender, used: Set<string>): string {
  for (let tries = 0; tries < 60; tries++) {
    let n: string;
    const r = rng.next();
    if (sp === 'robot' && r < 0.6) n = `${rng.pick(W.ROBOT_CODES)}-${rng.int(1, 99)} ${rng.pick(W.STREET)}`;
    else if (sp === 'alien' && r < 0.6) {
      const s = rng.pick(W.ALIEN_SYL) + rng.pick(W.ALIEN_SYL) + (rng.chance(0.4) ? rng.pick(W.ALIEN_SYL) : '');
      n = s.charAt(0).toUpperCase() + s.slice(1);
    } else if (r < 0.3) {
      const pre = rng.pick(W.PREFIX);
      const pg = W.PREFIX_GENDERED[pre];
      if (pg !== 'x' && pg !== gender) continue;
      n = `${pre} ${rng.pick(W.STREET)}`;
    } else if (r < 0.72) n = `${rng.pick(gender === 'm' ? W.NICK_M : W.NICK_F)} ${rng.pick(W.STREET)}`;
    else n = rng.pick(W.STREET) + (rng.chance(0.3) ? ` ${rng.int(2, 99)}` : '');
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  const fallback = `${rng.pick(W.STREET)} ${used.size}`;
  used.add(fallback);
  return fallback;
}

// ---------------------------------------------------------------------------
// Visual
// ---------------------------------------------------------------------------

function makeLook(rng: Rng, sp: Species, role: RoleId, rarity: RarityId, element: Element, gender: Gender): Look {
  const tier = RARITY[rarity].tier;
  const pal = rng.pick(PALETTES);
  const skin = rng.pick(SPECIES_SKIN[sp] ?? SKINS);
  const body = role === 'tanque' ? rng.pick(['broad', 'heavy'] as const) : role === 'assassino' || role === 'atirador' ? 'slim' : rng.pick(['slim', 'normal', 'normal', 'broad'] as const);
  const hairStyles: HairStyle[] =
    gender === 'f'
      ? ['long', 'bun', 'ponytail', 'bob', 'twintails', 'curly', 'afro', 'messy', 'locs', 'undercut', 'spiky']
      : ['messy', 'curly', 'buzz', 'mohawk', 'spiky', 'undercut', 'afro', 'locs', 'messy', 'ponytail', 'none'];
  let hairStyle = rng.pick(hairStyles);
  if (sp === 'skeleton' || sp === 'robot') hairStyle = rng.chance(0.75) ? 'none' : hairStyle;
  if (sp === 'lizard') hairStyle = rng.chance(0.7) ? 'none' : 'mohawk';
  const tops: TopStyle[] =
    role === 'tanque'
      ? ['puffer', 'puffer', 'turtleneck_jacket', 'vest', 'hoodie', 'varsity']
      : role === 'suporte'
        ? ['ribbed_tee', 'hoodie', 'varsity', 'trench', 'oversized_tee', 'robe']
        : role === 'assassino'
          ? ['hoodie', 'hoodie', 'kimono', 'tracksuit', 'turtleneck_jacket']
          : role === 'controle'
            ? ['robe', 'trench', 'hoodie', 'kimono', 'turtleneck_jacket']
            : ['hoodie', 'oversized_tee', 'tracksuit', 'varsity', 'ribbed_tee', 'turtleneck_jacket', 'puffer', 'tank'];
  const topStyle = rng.pick(tops);
  const pantsStyle: PantsStyle = rng.pick(
    topStyle === 'kimono' || topStyle === 'robe'
      ? ['hakama', 'baggy', 'wide_jeans']
      : gender === 'f'
        ? ['baggy', 'cargo', 'wide_jeans', 'skirt', 'track', 'shorts']
        : ['baggy', 'baggy', 'cargo', 'wide_jeans', 'track', 'shorts'],
  );
  const shoes: ShoeStyle = rng.pick(role === 'tanque' ? ['boots', 'chunky', 'hightop'] : ['chunky', 'chunky', 'hightop', 'skate', 'runner', 'boots', 'slides']);
  const prints: PrintKind[] = ['skull', 'text', 'stripe', 'flame', 'star', 'cross', 'bolt', 'heart', 'eye', 'rune', 'none', 'none'];
  const print = rng.pick(prints);
  const texts = ['SKULL', 'RIP', 'VOID', '13', 'NEON', 'ZN', 'OSSO', 'MORTE', 'LAJE', 'K.O.', 'F*', '99'];
  const eyesStyle =
    sp === 'skeleton'
      ? rng.pick(['glow', 'hollow'] as const)
      : sp === 'robot'
        ? 'visor'
        : sp === 'void' || sp === 'ghost'
          ? rng.pick(['glow', 'hollow', 'round'] as const)
          : rng.pick(['sleepy', 'sharp', 'round', 'wide', 'lazy', 'sleepy', 'sharp'] as const);
  const elemC = ELEMENT_COLOR[element];
  const look: Look = {
    species: sp,
    skin,
    body,
    hair: { style: hairStyle, color: sp === 'void' ? '#0c0814' : rng.pick(HAIR_COLORS), color2: elemC },
    eyes: {
      style: eyesStyle,
      color: sp === 'skeleton' || sp === 'robot' || sp === 'void' || sp === 'ghost' ? elemC : rng.pick(['#2a1a12', '#3b2a1e', '#2b6a8a', '#3a8f6a', '#5a4a6e', '#8a5a2e', elemC]),
    },
    brows: rng.pick(['flat', 'angry', 'sad', 'raised', 'flat'] as const),
    mouth: sp === 'vampire' || sp === 'demon' ? 'fangs' : sp === 'zombie' ? rng.pick(['stitch', 'neutral'] as const) : rng.pick(['neutral', 'smirk', 'frown', 'teeth', 'neutral', 'smirk'] as const),
    face: {
      scar: rng.chance(0.15),
      freckles: sp === 'human' && rng.chance(0.18),
      blush: rng.chance(0.12),
      piercings: rng.chance(0.25) ? rng.int(1, 3) : 0,
      bandaid: rng.chance(0.1),
      paint: rng.chance(0.08) ? elemC : undefined,
    },
    top: { style: topStyle, color: pal[0]!, color2: pal[1]!, print, text: rng.pick(texts), hood: topStyle === 'hoodie' && rng.chance(0.25) ? 'up' : 'down' },
    pants: { style: pantsStyle, color: pal[2]!, color2: pal[1]! },
    shoes: { style: shoes, color: pal[3]!, sole: rng.chance(0.75) ? '#f6f4ee' : pal[4]!, accent: pal[4]! },
    acc: {},
    weapon: { kind: rng.pick(WEAPONS_BY_ROLE[role]), color: rng.chance(0.5) ? elemC : pal[1]!, color2: pal[0]! },
  };
  const acc = look.acc!;
  if (rng.chance(0.22)) acc.glasses = rng.pick(['rect', 'round', 'shades', 'visor', 'goggles'] as const);
  if (rng.chance(0.2) && sp !== 'robot') acc.earbuds = true;
  else if (rng.chance(0.12)) acc.headphones = rng.pick([pal[1]!, pal[4]!, elemC]);
  if (rng.chance(0.14) && !acc.glasses) acc.mask = rng.pick(['cloth', 'skull', 'gas', 'bandana', 'oni'] as const);
  if (rng.chance(0.3)) acc.chain = rng.pick(['#ffd23f', '#c9ccd6', '#c9ccd6', elemC]);
  if (rng.chance(0.25)) acc.watch = true;
  if (rng.chance(0.2)) acc.backpack = rng.pick([pal[0]!, pal[2]!, '#2f2a3d']);
  const hats = ['cap_back', 'cap', 'beanie', 'bucket'] as const;
  if (rng.chance(0.3)) {
    acc.hat = rng.pick(hats);
    acc.hatColor = rng.pick([pal[0]!, pal[1]!, pal[4]!]);
  }
  if (sp === 'demon') {
    acc.hat = 'horns';
    acc.hatColor = rng.pick(['#2a1d22', '#e9e2d0', '#1a1020']);
    acc.tail = rng.chance(0.7);
  }
  if (sp === 'alien' && rng.chance(0.6)) {
    acc.hat = 'antenna';
    acc.hatColor = elemC;
  }
  if (sp === 'feline') {
    acc.hat = 'cat_ears';
    acc.tail = true;
  }
  if (sp === 'robot' && rng.chance(0.4)) {
    acc.hat = 'antenna';
    acc.hatColor = elemC;
  }
  // raridades altas ganham asas, coroas, auréolas e aura
  if (tier >= 4 && rng.chance(0.35)) acc.wings = rng.pick(['bat', 'bone', 'angel', 'void'] as const);
  if (tier >= 5) {
    if (rng.chance(0.45)) {
      acc.hat = rng.pick(['crown', 'halo'] as const);
      acc.hatColor = rng.pick(['#ffd23f', '#fff1a8', elemC]);
    }
    look.aura = { kind: rng.pick(['flame', 'void', 'sparkle', 'glitch', 'electric', 'holy', 'prism'] as const), color: elemC, color2: pal[1] };
  } else if (tier >= 3 && rng.chance(0.4)) look.aura = { kind: rng.pick(['sparkle', 'smoke', 'electric', 'flame'] as const), color: elemC };
  if (role === 'tanque') look.scale = 1.05;
  return look;
}

// ---------------------------------------------------------------------------
// Kit de habilidades
// ---------------------------------------------------------------------------

const ROLE_BASE: Record<RoleId, { hp: number; speed: number; reload: number; dmg: number }> = {
  atacante: { hp: 3300, speed: 260, reload: 1.35, dmg: 1100 },
  tanque: { hp: 5900, speed: 240, reload: 1.5, dmg: 1350 },
  suporte: { hp: 3300, speed: 255, reload: 1.4, dmg: 720 },
  assassino: { hp: 3400, speed: 282, reload: 1.15, dmg: 880 },
  atirador: { hp: 2800, speed: 250, reload: 1.55, dmg: 1200 },
  controle: { hp: 3200, speed: 255, reload: 1.35, dmg: 760 },
  lancador: { hp: 3000, speed: 252, reload: 1.45, dmg: 950 },
};

const ATK_NAMES: Record<string, string[]> = {
  burst: ['Rajada', 'Saraivada Curta', 'Tiro Triplo', 'Chumbo Quente', 'Pipoco'],
  shotgun: ['Estouro', 'Chuva de Chumbo', 'Leque Bruto', 'Cara a Cara'],
  sniper: ['Ponto Final', 'Mira Certeira', 'Tiro Longo', 'Agulhada'],
  lob: ['Bomba Caseira', 'Arremesso', 'Presente Explosivo', 'Lata Voadora'],
  melee: ['Pancada', 'Golpe Seco', 'Corte', 'Varrida', 'Sacudida'],
  boomerang: ['Bumerangue', 'Vai e Volta', 'Ioiô Assassino'],
  chain: ['Faísca', 'Choque em Cadeia', 'Curto-Circuito'],
  wave: ['Onda Sonora', 'Batida', 'Vibração', 'Eco'],
  homing: ['Orbe Caçador', 'Esfera Faminta', 'Bolha Teleguiada'],
  spray: ['Jato', 'Bafo', 'Spray'],
  ricochet: ['Ricochete', 'Tabelinha', 'Quique'],
  fan: ['Leque', 'Cartas Afiadas', 'Estilhaços'],
  punch: ['Combo de Socos', 'Direto e Cruzado', 'Tapa na Orelha'],
};

function attackFor(rng: Rng, role: RoleId, w: WeaponKind, el: Element, dmg: number, color: string): AbilityDef {
  const nm = (k: string) => rng.pick(ATK_NAMES[k]!);
  const shapeFor = (): ProjLook['shape'] =>
    el === 'fire' ? 'fire' : el === 'ice' ? 'shard' : el === 'electric' ? 'bolt' : el === 'void' ? 'glyph' : el === 'poison' ? 'bubble' : el === 'holy' ? 'orb' : el === 'blood' ? 'blade' : 'bullet';
  const status = ELEMENT_STATUS[el];
  switch (w) {
    case 'pistol':
      return atk.burst({ name: nm('burst'), dmg: dmg / 3, n: 3, color, range: rng.int(520, 620), shape: el === 'neutral' ? 'bullet' : shapeFor() });
    case 'dual_pistols':
      return atk.burst({ name: nm('burst'), dmg: dmg / 4, n: 4, color, range: rng.int(500, 580) });
    case 'rifle':
      return rng.chance(0.5)
        ? atk.burst({ name: nm('burst'), dmg: dmg / 5, n: 5, color, range: rng.int(600, 700) })
        : atk.ricochet({ name: nm('ricochet'), dmg: dmg / 2, color, n: 2, shape: 'bullet' });
    case 'cards':
      return rng.chance(0.5) ? atk.fan({ name: nm('fan'), dmg: dmg / 3, color, n: 3, shape: 'card', status }) : atk.ricochet({ name: nm('ricochet'), dmg: dmg / 2, color, shape: 'card' });
    case 'yoyo':
    case 'skateboard':
      return role === 'assassino' && w === 'skateboard'
        ? atk.melee({ name: nm('melee'), dmg, range: 145 })
        : atk.boomerang({ name: nm('boomerang'), dmg: dmg / 1.6, color, shape: w === 'yoyo' ? 'orb' : 'blade' });
    case 'mic':
    case 'guitar':
    case 'boombox':
      return atk.wave({ name: nm('wave'), dmg: dmg * (role === 'suporte' ? 1 : 0.9), color, heal: role === 'suporte' ? Math.round(dmg * 0.45) : undefined, n: rng.chance(0.3) ? 2 : 1, shape: 'note' });
    case 'crossbow':
    case 'bow':
      return role === 'atirador' ? atk.sniper({ name: nm('sniper'), dmg, color, shape: 'arrow', pierce: rng.chance(0.3) }) : atk.fan({ name: nm('fan'), dmg: dmg / 3, color, shape: 'arrow', status });
    case 'sniper':
      return atk.sniper({ name: nm('sniper'), dmg, color, shape: el === 'neutral' ? 'bolt' : shapeFor() });
    case 'hammer':
    case 'axe':
    case 'bat':
    case 'wrench':
      return atk.melee({ name: nm('melee'), dmg, range: rng.int(150, 175), arc: rng.int(100, 130), knock: rng.int(160, 260), heavy: true, status: role === 'tanque' ? undefined : status });
    case 'gloves':
      return role === 'lancador' ? atk.lob({ name: nm('lob'), dmg, color, shape: 'rock', radius: 90 }) : atk.punch({ name: nm('punch'), dmg, knock: 260 });
    case 'shotgun':
      return atk.shotgun({ name: nm('shotgun'), dmg: dmg / 3.2, n: 5, color, shape: shapeFor() });
    case 'chain':
      return role === 'controle' ? atk.chain({ name: nm('chain'), dmg, color, jumps: 2 }) : atk.melee({ name: nm('melee'), dmg, range: 190, arc: 70, knock: 140, status });
    case 'katana':
    case 'claws':
    case 'scythe':
      return atk.melee({ name: nm('melee'), dmg, range: w === 'scythe' ? 175 : 145, arc: w === 'scythe' ? 140 : 100, knock: 90, status, lifesteal: el === 'blood' ? 0.2 : undefined });
    case 'staff':
    case 'orb':
    case 'book':
      return el === 'electric' || rng.chance(0.3) ? atk.chain({ name: nm('chain'), dmg, color, jumps: 2 }) : atk.homing({ name: nm('homing'), dmg: dmg / 2, color, n: 2, shape: shapeFor() });
    case 'umbrella':
      return atk.shotgun({ name: nm('shotgun'), dmg: dmg / 3, n: 5, color, shape: 'bubble', spread: 40 });
    case 'spray':
    case 'flamethrower':
      return role === 'lancador' ? atk.lob({ name: nm('lob'), dmg, color, shape: 'spray', status, radius: 85 }) : atk.spray({ name: nm('spray'), dmg: dmg / 7, color, status });
    case 'launcher':
      return atk.lob({ name: nm('lob'), dmg, color, shape: 'skull', radius: rng.int(85, 105), status });
    default:
      return atk.burst({ name: nm('burst'), dmg: dmg / 3, color });
  }
}

const SKILL_POOLS: Record<RoleId, string[]> = {
  atacante: ['dash', 'haste', 'rage', 'grenade', 'barrage', 'reload', 'blades', 'blink'],
  tanque: ['dashHit', 'armor', 'wall', 'shieldSelf', 'novaKnock', 'hook', 'rage'],
  suporte: ['healArea', 'shieldArea', 'healTotem', 'cleanse', 'hasteArea', 'healZone'],
  assassino: ['dashHit', 'blinkHit', 'stealth', 'clone', 'blades', 'rage', 'hook'],
  atirador: ['trap', 'blink', 'barrage', 'laser', 'haste', 'reload', 'slowZone'],
  controle: ['freeze', 'elemZone', 'wall', 'novaPull', 'trap', 'laser', 'hook'],
  lancador: ['grenade', 'elemZone', 'turret', 'trap', 'novaKnock', 'minions', 'wall'],
};

const SKILL_NAMES: Record<string, string[]> = {
  dash: ['Arrancada', 'Disparada', 'Pique', 'Fuga Rápida'],
  dashHit: ['Atropelo', 'Ombrada', 'Investida', 'Trombada'],
  haste: ['Turbo', 'Pé no Acelerador', 'Adrenalina'],
  hasteArea: ['Ritmo Acelerado', 'Vento a Favor'],
  rage: ['Fúria', 'Sangue Quente', 'Modo Raiva'],
  grenade: ['Granada', 'Bomba Relógio', 'Presente', 'Coquetel'],
  barrage: ['Saraivada', 'Metralha', 'Chuva Rápida'],
  reload: ['Recarga Rápida', 'Pente Extra'],
  blades: ['Lâminas Giratórias', 'Ciclone', 'Roda Viva'],
  blink: ['Teleporte', 'Salto Quântico', 'Atalho'],
  blinkHit: ['Aparição', 'Golpe Fantasma'],
  armor: ['Casca Dura', 'Pele de Pedra', 'Blindagem'],
  wall: ['Barricada', 'Muro', 'Trincheira'],
  shieldSelf: ['Escudo', 'Proteção'],
  shieldArea: ['Escudo do Time', 'Bolha Protetora'],
  novaKnock: ['Explosão', 'Pisão', 'Onda de Choque'],
  novaPull: ['Buraco Negro', 'Vórtice', 'Imã'],
  hook: ['Gancho', 'Corrente', 'Laço'],
  healArea: ['Pulso de Cura', 'Remédio Caseiro', 'Abraço'],
  healTotem: ['Totem de Cura', 'Caixa de Primeiros Socorros', 'Altar'],
  healZone: ['Jardim', 'Fonte Viva', 'Chá da Vó'],
  cleanse: ['Purificar', 'Desintoxicar', 'Banho de Sal'],
  stealth: ['Sumir', 'Neblina', 'Invisível'],
  clone: ['Clone', 'Sósia', 'Isca'],
  trap: ['Armadilha', 'Mina', 'Arapuca'],
  laser: ['Laser', 'Raio', 'Feixe'],
  slowZone: ['Piche', 'Lama', 'Cola'],
  elemZone: ['Zona', 'Nuvem', 'Poça'],
  freeze: ['Congelar', 'Paralisar', 'Choque'],
  turret: ['Torreta', 'Sentinela', 'Canhão Fixo'],
  minions: ['Capangas', 'Parças', 'Bonde'],
};

function skillFor(rng: Rng, key: string, el: Element, color: string, dmg: number, tier: number): AbilityDef {
  const name = rng.pick(SKILL_NAMES[key]!);
  const cdMul = 1 - tier * 0.03;
  const cd = (n: number) => Math.round(n * cdMul * 10) / 10;
  const zoneKind = ELEMENT_ZONE[el];
  const status = ELEMENT_STATUS[el];
  switch (key) {
    case 'dash':
      return skill.dash({ name, dist: rng.int(260, 340), cd: cd(6) });
    case 'dashHit':
      return skill.dash({ name, dist: rng.int(280, 340), dmg: dmg * 0.55, cd: cd(8), status: rng.chance(0.5) ? st.stun(0.5) : status });
    case 'haste':
      return skill.haste({ name, mult: 1.4, dur: 3, cd: cd(9) });
    case 'hasteArea':
      return skill.haste({ name, mult: 1.3, dur: 3.5, radius: 260, cd: cd(11) });
    case 'rage':
      return skill.rage({ name, mult: 1.3, dur: 4, cd: cd(11) });
    case 'grenade':
      return skill.grenade({ name, dmg: dmg * 0.85, radius: rng.int(100, 125), color, status, cd: cd(8), shape: el === 'fire' ? 'fire' : el === 'poison' ? 'bubble' : 'skull' });
    case 'barrage':
      return skill.barrage({ name, dmg: dmg * 0.22, n: 8, color, cd: cd(9) });
    case 'reload':
      return skill.reload({ name, cd: cd(10) });
    case 'blades':
      return skill.blades({ name, dmg: dmg * 0.4, n: 3, color, cd: cd(11), shape: el === 'ice' ? 'shard' : 'blade' });
    case 'blink':
      return skill.blink({ name, dist: rng.int(260, 320), cd: cd(8) });
    case 'blinkHit':
      return skill.blink({ name, dist: rng.int(260, 320), cd: cd(7), dmg: dmg * 0.6 });
    case 'armor':
      return skill.armor({ name, mult: 1.4, dur: 3, cd: cd(11) });
    case 'wall':
      return skill.wall({ name, len: rng.pick([192, 256]), hp: 2200, dur: 6, cd: cd(12) });
    case 'shieldSelf':
      return skill.shield({ name, amount: 1800, dur: 4, cd: cd(10) });
    case 'shieldArea':
      return skill.shield({ name, amount: 1200, dur: 4, radius: 230, cd: cd(11) });
    case 'novaKnock':
      return skill.nova({ name, dmg: dmg * 0.6, radius: 165, color, status: rng.chance(0.4) ? st.stun(0.6) : status, cd: cd(9) });
    case 'novaPull':
      return skill.nova({ name, dmg: dmg * 0.5, radius: 210, pull: 520, color, cd: cd(11) });
    case 'hook':
      return skill.hook({ name, dmg: dmg * 0.5, cd: cd(10), color });
    case 'healArea':
      return skill.heal({ name, amount: 1100 + tier * 120, radius: 230, cd: cd(10) });
    case 'healTotem':
      return skill.healTotem({ name, hps: 380 + tier * 40, cd: cd(13), color });
    case 'healZone':
      return skill.zone({ name, kind: 'heal', color: '#5dffa0', radius: 160, dur: 5, hps: 420 + tier * 40, cd: cd(12) });
    case 'cleanse':
      return skill.cleanse({ name, radius: 240, cd: cd(12), heal: 500 });
    case 'stealth':
      return skill.stealth({ name, dur: 3, cd: cd(12) });
    case 'clone':
      return skill.clone({ name, hp: 1200, cd: cd(12) });
    case 'trap':
      return skill.trap({ name, dmg: dmg * 0.5, n: rng.int(1, 2), status: rng.chance(0.5) ? st.root(1.1) : (status ?? st.slow(1.5, 0.4)), cd: cd(9) });
    case 'laser':
      return skill.laser({ name, dps: dmg * 1.3, len: 600, dur: 1.4, color, status, cd: cd(11) });
    case 'slowZone':
      return skill.zone({ name, kind: 'smoke', color: '#7a6a4a', radius: 140, dur: 4, status: st.slow(0.6, 0.45), dps: 120, cd: cd(10) });
    case 'elemZone':
      return skill.zone({ name: `${name} ${elementWord(el)}`, kind: zoneKind, color, radius: rng.int(125, 155), dur: 4, dps: dmg * 0.35, status, cd: cd(10) });
    case 'freeze':
      return skill.freeze({ name, dmg: dmg * 0.55, radius: 155, dur: 1.1, cd: cd(12) });
    case 'turret':
      return skill.turret({ name, dmg: dmg * 0.3, color, cd: cd(12) });
    case 'minions':
      return skill.minions({ name, n: 2, dmg: dmg * 0.25, color: '#efe6d2', cd: cd(13) });
    default:
      return skill.dash({ name });
  }
}

function elementWord(el: Element): string {
  return { fire: 'de Fogo', poison: 'Tóxica', ice: 'Gelada', electric: 'Elétrica', void: 'do Vazio', holy: 'Sagrada', blood: 'Sangrenta', neutral: 'de Fumaça' }[el];
}

const SUPER_POOLS: Record<RoleId, string[]> = {
  atacante: ['rain', 'bigShot', 'frenzy'],
  tanque: ['quake', 'charge', 'fortress'],
  suporte: ['healField', 'fortress', 'healField'],
  assassino: ['shadow', 'frenzy', 'charge'],
  atirador: ['bigShot', 'megaLaser', 'rain'],
  controle: ['storm', 'megaLaser', 'army'],
  lancador: ['nuke', 'rain', 'army'],
};

const SUPER_NAMES: Record<string, string[]> = {
  rain: ['Chuva de Caveiras', 'Bombardeio', 'Tempestade de Chumbo', 'Chuva Ácida'],
  bigShot: ['Tiro de Misericórdia', 'Canhão do Vazio', 'Bala Gigante', 'Cometa'],
  frenzy: ['Frenesi', 'Modo Monstro', 'Última Rodada'],
  quake: ['Terremoto', 'Pisão do Gigante', 'Desabamento'],
  charge: ['Rolo Compressor', 'Estouro da Boiada', 'Trem Desgovernado'],
  fortress: ['Fortaleza', 'Muralha Viva', 'Bunker'],
  healField: ['Festa da Cura', 'Milagre', 'Fonte da Juventude', 'Drop Curativo'],
  shadow: ['Sombra Assassina', 'Golpe Final', 'Apagão'],
  megaLaser: ['Raio da Morte', 'Feixe Supremo', 'Holofote Final'],
  storm: ['Tempestade', 'Furacão', 'Nevasca', 'Nuvem Venenosa'],
  army: ['Exército de Ossos', 'Bonde Inteiro', 'Invasão'],
  nuke: ['Bomba Nuclear', 'Fim do Quarteirão', 'Caveira Atômica'],
};

function superFor(rng: Rng, key: string, el: Element, color: string, dmg: number, tier: number): AbilityDef {
  const name = rng.pick(SUPER_NAMES[key]!);
  const boost = 1 + tier * 0.05;
  switch (key) {
    case 'rain':
      return sup.rain({ name, dmg: dmg * 2.3 * boost, color, n: 6 + Math.floor(tier / 2) });
    case 'bigShot':
      return sup.bigShot({ name, dmg: dmg * 2.4 * boost, color, explode: rng.chance(0.4) ? 140 : undefined });
    case 'frenzy':
      return sup.frenzy({ name, dur: 5 + tier * 0.4 });
    case 'quake':
      return sup.quake({ name, dmg: dmg * 1.7 * boost, color });
    case 'charge':
      return sup.charge({ name, dmg: dmg * 1.4 * boost });
    case 'fortress':
      return sup.fortress({ name, shield: 1800 + tier * 180 });
    case 'healField':
      return sup.healField({ name, hps: 650 + tier * 70, dmg: rng.chance(0.5) ? dmg : undefined });
    case 'shadow':
      return sup.shadowStrike({ name, dmg: dmg * 2.3 * boost });
    case 'megaLaser':
      return sup.megaLaser({ name, dps: dmg * 2 * boost, color });
    case 'storm':
      return sup.storm({ name, dps: dmg * 0.95 * boost, kind: ELEMENT_ZONE[el] === 'smoke' ? 'electric' : ELEMENT_ZONE[el], color, status: ELEMENT_STATUS[el] ?? st.slow(0.5, 0.3) });
    case 'army':
      return sup.army({ name, dmg: dmg * 0.4, n: 3 + Math.floor(tier / 2) });
    case 'nuke':
      return sup.nuke({ name, dmg: dmg * 2.4 * boost, color });
    default:
      return sup.rain({ name, dmg: dmg * 2 });
  }
}

const PASSIVES: Array<(tier: number) => PassiveDef> = [
  (t) => ({ name: 'Couro Grosso', desc: `Recebe ${8 + t * 2}% menos dano.`, armor: (8 + t * 2) / 100 }),
  (t) => ({ name: 'Sangue Quente', desc: `+${12 + t * 2}% de dano com pouca vida.`, lowHpRage: (12 + t * 2) / 100 }),
  (t) => ({ name: 'Vampiro de Rua', desc: `Rouba ${6 + t}% do dano como vida.`, lifesteal: (6 + t) / 100 }),
  (t) => ({ name: 'Fôlego', desc: `Regenera ${50 + t * 15} de vida por segundo.`, regen: 50 + t * 15 }),
  (t) => ({ name: 'Caçador', desc: `Cura ${700 + t * 100} ao eliminar alguém.`, killHeal: 700 + t * 100 }),
  (t) => ({ name: 'Pé Leve', desc: `${5 + t}% mais rápido.`, speedMult: 1 + (5 + t) / 100 }),
  (t) => ({ name: 'Carga Rápida', desc: `Super carrega ${8 + t * 2}% mais rápido.`, superChargeMult: 1 + (8 + t * 2) / 100 }),
  (t) => ({ name: 'Espinhos', desc: `Devolve ${10 + t * 2}% do dano corpo a corpo.`, thorns: (10 + t * 2) / 100 }),
  (t) => ({ name: 'Camuflagem', desc: `Regenera ${80 + t * 10}/s dentro do arbusto.`, bushHeal: 80 + t * 10 }),
];

function animFor(rng: Rng, role: RoleId, w: WeaponKind, sp: Species): AnimStyle {
  const attack: AnimStyle['attack'] =
    w === 'pistol' || w === 'mic'
      ? 'pistol'
      : w === 'dual_pistols'
        ? 'dual'
        : w === 'rifle' || w === 'sniper' || w === 'shotgun' || w === 'launcher' || w === 'flamethrower' || w === 'crossbow' || w === 'umbrella'
          ? 'rifle'
          : w === 'bow'
            ? 'bow'
            : w === 'boombox' || w === 'guitar'
              ? 'boombox'
              : w === 'hammer' || w === 'axe'
                ? 'heavy_swing'
                : w === 'gloves'
                  ? role === 'lancador'
                    ? 'throw'
                    : 'punch'
                  : w === 'cards' || w === 'spray' || w === 'yoyo'
                    ? 'throw'
                    : w === 'staff' || w === 'orb' || w === 'book'
                      ? 'cast'
                      : 'swing';
  const idle: AnimStyle['idle'] = sp === 'ghost' || sp === 'void' ? 'float' : role === 'tanque' ? 'heavy' : rng.pick(['chill', 'bounce', 'hype', 'stoic', 'nervous', 'cocky']);
  const run: AnimStyle['run'] = sp === 'ghost' || sp === 'void' ? 'glide' : role === 'tanque' ? 'stomp' : rng.pick(['normal', 'sprint', 'skip', 'normal']);
  const victory: AnimStyle['victory'] = rng.pick(['peace', 'flex', 'dance', 'bow', 'laugh', 'point', 'spin']);
  return { idle, run, attack, victory, tempo: rng.range(0.92, 1.1) };
}

// ---------------------------------------------------------------------------
// História
// ---------------------------------------------------------------------------

function makeBio(rng: Rng, name: string, sp: Species, role: RoleId, gender: Gender, others: string[]): CharacterDef['bio'] {
  const district = rng.pick(W.DISTRICTS);
  let origem = district;
  let idade = `${rng.int(16, 34)} anos`;
  let p1: string;
  const parts = name.split(' ');
  const first = parts.length > 1 && (W.PREFIX.includes(parts[0]!) || /^[A-Z0-9-]+$/.test(parts[0]!)) ? parts.slice(1).join(' ') : parts[0]!;
  switch (sp) {
    case 'skeleton':
      idade = `${rng.int(14, 60)} anos (morreu há ${rng.int(10, 300)})`;
      p1 = `${name} morreu ${rng.pick(W.DEATH)} e acordou caveira no meio do Cemitério Velho, sem pele, sem documento e sem a menor vontade de descansar em paz. Passou as primeiras semanas assustando coveiros sem querer e as seguintes assustando de propósito.`;
      break;
    case 'zombie':
      idade = `${rng.int(20, 70)} anos de vida + ${rng.int(2, 50)} de morte`;
      p1 = `${name} levantou do túmulo numa noite de lua-caveira, faminto e confuso, e descobriu que a cidade tinha mudado inteira enquanto estava enterrad${gender === 'm' ? 'o' : 'a'}. Em vez de cérebros, ${gender === 'm' ? 'ele' : 'ela'} desenvolveu uma fome insaciável por pastel de feira — e por briga.`;
      break;
    case 'robot':
      origem = 'Fábrica de Ossos, linha de montagem 3';
      idade = `Modelo ${rng.int(1990, 2025)}, revisão ${rng.int(2, 60)}`;
      p1 = g(
        `${name} foi fabricad{o|a} ${rng.pick(W.ROBOT_JOB)}, ${rng.pick(W.ROBOT_TWIST)}. Desde então, anda pela cidade testando tudo o que é proibido pra um robô: rir, chorar e perder a paciência.`,
        gender,
      );
      break;
    case 'alien':
      origem = rng.pick(W.PLANETS);
      idade = `${rng.int(80, 900)} ciclos (jovem, pros padrões de lá)`;
      p1 = g(
        `${name} chegou a Necrópolis ${rng.pick(W.ALIEN_ARRIVAL)}. Achou o planeta barulhento, sujo e absolutamente fascinante — principalmente as tomadas, os fliperamas e o pastel de queijo. Decidiu ficar sem avisar ninguém em casa.`,
        gender,
      );
      break;
    case 'demon':
      origem = rng.pick(W.UNDERWORLDS);
      idade = `${rng.int(200, 999)} anos (diz que tem ${rng.int(20, 30)})`;
      p1 = g(`${name} ${rng.pick(W.DEMON_REASON)}. Subiu pela tubulação da Avenida Calor com uma mala, um par de chifres polidos e nenhuma ideia de como pagar aluguel na superfície.`, gender);
      break;
    case 'ghost':
      idade = `${rng.int(12, 40)} anos (desde ${rng.int(1950, 2005)})`;
      origem = rng.pick(W.GHOST_HAUNT);
      p1 = g(
        `${name} assombra ${origem} há décadas, desde a noite em que morreu de susto num apagão. Por anos, ajudou os vivos sem que eles percebessem: apagava luzes pra salvar quem se escondia e soprava respostas de prova no ouvido dos alunos.`,
        gender,
      );
      break;
    case 'vampire':
      idade = `${rng.int(150, 700)} anos`;
      origem = 'Castelo da Serra Branca';
      p1 = g(`${name} é vampir{o|a} desde antes da cidade ter nome. Trocou o sangue por suco de groselha e o caixão por uma rede no terraço, mas ainda odeia sol, alho e música baixa.`, gender);
      break;
    case 'feline':
      p1 = g(`${name} nasceu com orelhas de gato, sete vidas e um péssimo hábito de derrubar coisas da mesa. Cresceu ${rng.pick(W.CHILDHOOD)}, sempre caindo de pé — às vezes literalmente.`, gender);
      break;
    case 'lizard':
      origem = 'Galerias de Esgoto do Porto Ferrugem';
      p1 = g(
        `${name} nasceu human{o|a} nas galerias de esgoto, onde os vazamentos da Fábrica de Ossos brilham em verde. As escamas vieram aos poucos, depois os olhos de fenda. Aprendeu a ver no escuro e a sentir o calor de quem se aproxima.`,
        gender,
      );
      break;
    case 'void':
      origem = 'O Vazio entre as linhas do código';
      idade = 'Impossível medir';
      p1 = g(
        `${name} veio do Vazio — o espaço preto entre os mapas da arena, onde o código não chega. Saiu por uma rachadura no chão do Distrito Neon e trouxe junto um pouco daquela escuridão estrelada na pele.`,
        gender,
      );
      break;
    default: {
      const ev = rng.pick(W.EVENT_HUMAN).replace('{n}', String(rng.int(8, 16)));
      p1 = g(`${name} cresceu ${rng.pick(W.CHILDHOOD)}. ${ev}`, gender);
    }
  }
  const style = rng.pick(W.STYLE_BY_ROLE[role]!);
  const p2 = g(`${first} entrou na Skull Arena ${rng.pick(W.ARENA_REASON)}. ${style} ${rng.pick(W.PERSONALITY)}`, gender);
  return {
    origem: origem.charAt(0).toUpperCase() + origem.slice(1),
    idade,
    historia: [p1, p2],
    sonho: g(rng.pick(W.DREAMS), gender),
    medo: g(rng.pick(W.FEARS), gender),
    rival: others.length ? rng.pick(others) : undefined,
    curiosidade: g(rng.pick(W.TRIVIA), gender),
  };
}

function makeTitle(rng: Rng, gender: Gender): string {
  const noun = rng.pick(gender === 'm' ? W.TITLE_NOUN_M : W.TITLE_NOUN_F);
  return `${gender === 'm' ? 'O' : 'A'} ${noun} ${rng.pick(W.TITLE_OF)}`;
}

const QUOTES = [
  'Chega mais que hoje tem.',
  'Corre não, que é pior.',
  'Eu vim pela caveira, fiquei pela treta.',
  'Respeita o bairro.',
  'Já era, parceiro.',
  'Uma moeda pela sua alma? Fechado.',
  'Isso foi só o aquecimento.',
  'Se cair, levanta. Se levantar, cai de novo.',
  'Pode chorar, eu espero.',
  'A arena é minha casa. Tira o tênis.',
  'Hoje não, morte. Hoje não.',
  'Tem caveira no seu nome.',
  'Quem ri por último? Eu. Sempre eu.',
  'Silêncio... tô mirando.',
  'Bora, que o bonde não espera.',
  'Nem a lua-caveira me segura.',
];

// ---------------------------------------------------------------------------
// Gerador principal
// ---------------------------------------------------------------------------

export function generateCharacters(count: number, reservedNames: string[]): CharacterDef[] {
  const used = new Set(reservedNames);
  const out: CharacterDef[] = [];
  for (let i = 0; i < count; i++) {
    const rng = new Rng(`skull-arena-char-${i}`);
    const rarity = rarityFor(i);
    const tier = RARITY[rarity].tier;
    const role = rng.weighted(ROLES, ROLE_W);
    const species = rng.weighted(
      SPECIES,
      SPECIES_W.map((w, k) => (SPECIES[k] === 'void' ? (tier >= 4 ? 6 : 0) : w)),
    );
    const gender: Gender = rng.chance(0.5) ? 'm' : 'f';
    const element = elementFor(rng, species);
    const name = makeName(rng, species, gender, used);
    const look = makeLook(rng, species, role, rarity, element, gender);
    const color = ELEMENT_COLOR[element] === '#ffe08a' ? (look.top.color2 ?? '#ffe08a') : ELEMENT_COLOR[element];
    const base = ROLE_BASE[role];
    const dmg = base.dmg * rng.range(0.92, 1.08);
    const attack = attackFor(rng, role, look.weapon.kind, element, dmg, color);
    const [smin, smax] = RARITY[rarity].skills;
    const nSkills = rng.int(smin, smax);
    const pool = rng.shuffle([...SKILL_POOLS[role]!]);
    const skills = pool.slice(0, nSkills).map((k) => skillFor(rng, k, element, color, dmg, tier));
    const superDef = superFor(rng, rng.pick(SUPER_POOLS[role]!), element, color, dmg, tier);
    const passive = tier >= 2 || rng.chance(0.35) ? rng.pick(PASSIVES)(tier) : undefined;
    const others = out.slice(-40).map((c) => c.name);
    const def = defineCharacter({
      id: `gen_${String(i + 1).padStart(3, '0')}`,
      name,
      rarity,
      role,
      title: makeTitle(rng, gender),
      quote: rng.pick(QUOTES),
      bio: makeBio(rng, name, species, role, gender, others.length ? others : ['Kaze', 'Marreta', 'DJ Kiko']),
      stats: {
        hp: Math.round((base.hp * rng.range(0.94, 1.06)) / 50) * 50,
        speed: Math.round(base.speed * rng.range(0.97, 1.04)),
        reload: Math.round(base.reload * rng.range(0.92, 1.08) * 100) / 100,
        ammo: 3,
      },
      attack,
      skills,
      super: superDef,
      passive,
      look,
      anim: animFor(rng, role, look.weapon.kind, species),
      voice:
        species === 'robot'
          ? 'robot'
          : species === 'skeleton'
            ? 'skull'
            : species === 'demon' || species === 'zombie' || species === 'lizard'
              ? 'monster'
              : species === 'alien'
                ? 'cute'
                : gender === 'm'
                  ? 'male'
                  : 'female',
      unlock: { kind: 'chest' },
      handmade: false,
    });
    def.handmade = false;
    def.stats.superRate = 1 / Math.max(200, attackDamage(attack) * 4.5);
    out.push(def);
  }
  return out;
}

/**
 * Visual aleatório (usado no Estúdio: botão "🎲 Visual aleatório").
 * Mesma semente = mesmo visual. Copie o resultado pro seu personagem.
 */
export function randomLook(seed: number, role: RoleId = 'atacante', rarity: RarityId = 'raro'): { look: Look; anim: AnimStyle } {
  const rng = new Rng(`studio-${seed}`);
  const species = rng.weighted(SPECIES, SPECIES_W);
  const gender: Gender = rng.chance(0.5) ? 'm' : 'f';
  const look = makeLook(rng, species, role, rarity, elementFor(rng, species), gender);
  return { look, anim: animFor(rng, role, look.weapon.kind, species) };
}
