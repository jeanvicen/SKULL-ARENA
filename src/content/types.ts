/**
 * CONTRATO DE DADOS DO SKULL ARENA
 * ---------------------------------------------------------------
 * Tudo que é conteúdo (personagens, tiros, habilidades, mapas, pets,
 * raridades, economia) é descrito por estes tipos e vive em /data/*.json.
 * O motor NUNCA conhece um personagem específico: ele só interpreta
 * estes esquemas. Adicionar conteúdo = criar JSON.
 */

export type Id = string;

// ───────────────────────────── Raridades ─────────────────────────────
export type RarityId = 'comum' | 'incomum' | 'raro' | 'extrema_rara' | 'max' | 'god' | 'creator';

export interface RarityDef {
  id: RarityId;
  name: string;
  order: number;
  color: string;
  /** Cor secundária para gradientes de moldura/cards. */
  color2: string;
  chestWeight: number;
  glow?: boolean;
  unique?: boolean;
  /** Preço de compra direta na loja (quando permitido). */
  shopPrice?: { coins?: number; gems?: number };
  /** Moedas recebidas quando um baú sorteia um personagem que você já tem. */
  duplicateCoins: number;
  /** Multiplicador de custo de upgrade. */
  upgradeCostMul: number;
}

// ───────────────────────────── Efeitos de status ─────────────────────────────
export type StatusKind =
  | 'burn' | 'poison' | 'slow' | 'stun' | 'freeze' | 'root' | 'weaken' | 'mark'
  | 'haste' | 'rage' | 'regen' | 'reveal' | 'silence';

export interface StatusApply {
  effect: StatusKind;
  duration: number;
  /** Dano/cura por segundo (burn, poison, regen). */
  dps?: number;
  /** Intensidade genérica (slow 0.4 = -40% vel; weaken 0.3 = -30% dano; mark 0.2 = +20% dano recebido; haste 0.3 = +30% vel; rage 0.25 = +25% dano). */
  amount?: number;
}

// ───────────────────────────── Projéteis ─────────────────────────────
export type ProjectileType = 'direct' | 'lob' | 'melee';
export type ProjectileShape = 'orb' | 'dagger' | 'bone' | 'arrow' | 'skull' | 'flame' | 'wave' | 'shard' | 'note' | 'bolt' | 'scythe' | 'bubble';
export type TrailKind = 'none' | 'fire' | 'smoke' | 'spark' | 'ghost' | 'bone' | 'ice' | 'poison' | 'void' | 'gold' | 'neon';
export type ImpactKind = 'burst' | 'ember' | 'shatter' | 'splash' | 'void' | 'electric' | 'gold' | 'poison';

export interface ZoneSpawn {
  radius: number;
  duration: number;
  /** Dano por segundo para inimigos dentro. */
  dps?: number;
  /** Cura por segundo para aliados dentro (inclui o dono). */
  hps?: number;
  status?: StatusApply;
  color: string;
  /** Visual da área persistente. */
  look?: 'fire' | 'poison' | 'ice' | 'void' | 'holy' | 'neon';
}

export interface ProjectileDef {
  id: Id;
  type: ProjectileType;
  /** Distância máxima (direct/lob) ou alcance do golpe (melee). */
  range: number;
  /** Velocidade em unidades/s (lob: velocidade horizontal). */
  speed: number;
  damage: number;
  /** Raio de colisão. */
  radius: number;
  /** Quantidade de projéteis por disparo (spread). */
  count?: number;
  /** Abertura total do leque em graus. */
  spreadDeg?: number;
  /** Rajada: N disparos sequenciais com intervalo. */
  burst?: { count: number; interval: number };
  /** Ricochete: quantas vezes quica em paredes. */
  bounces?: number;
  /** Se true, ao acertar inimigo ricocheteia para o próximo inimigo (cadeia). */
  bounceOnEnemies?: boolean;
  /** Atravessa N inimigos adicionais. */
  pierce?: number;
  /** Teleguiado leve: graus/s de curva em direção ao inimigo mais próximo à frente. */
  homing?: number;
  /** Orbital: gira em volta do dono. */
  orbit?: { radius: number; angularSpeed: number };
  lifetime?: number;
  /** Lob: altura do arco (visual) — passa por cima de obstáculos e corpos. */
  arcHeight?: number;
  /** Explode no impacto/ao fim do alcance, causando dano em área. */
  aoeRadius?: number;
  knockback?: number;
  /** Melee: abertura do golpe em graus. */
  meleeArcDeg?: number;
  /** Cria área persistente (poça, fogo) ao impactar/expirar. */
  zone?: ZoneSpawn;
  onHit?: StatusApply;
  /** Rouba vida: fração do dano causado que vira cura. */
  lifesteal?: number;
  /** Dano extra conforme distância percorrida (sniper): multiplicador no fim do alcance. */
  falloffMul?: number;
  vfx: {
    shape: ProjectileShape;
    color: string;
    color2?: string;
    trail?: TrailKind;
    impact?: ImpactKind;
    /** Escala visual (padrão 1). */
    scale?: number;
  };
  sfx: { fire: string; hit: string };
}

// ───────────────────────────── Habilidades (special) ─────────────────────────────
export type AbilityType =
  | 'dash' | 'aoe_burst' | 'shield' | 'heal' | 'summon' | 'buff' | 'debuff'
  | 'teleport' | 'trap' | 'beam' | 'transform' | 'multi_shot' | 'zone' | 'pull';

export type AbilityAiHint = 'engage' | 'escape' | 'low_hp' | 'enemies_near' | 'in_range' | 'allies_hurt';

export interface MinionDef {
  name: string;
  hp: number;
  moveSpeed: number;
  radius: number;
  lifetime: number;
  projectile: Id;
  attackInterval: number;
  look: { color: string; eyeColor: string; scale?: number };
}

export interface AbilityDef {
  id: Id;
  name: string;
  description: string;
  type: AbilityType;
  /** Recarga em segundos. */
  cooldown: number;
  /** Cada acerto do ataque básico reduz a recarga em X segundos (recompensa quem encara). */
  chargePerHit?: number;
  /** Parâmetros específicos do tipo (ver docs/DATA.md). */
  params: AbilityParams;
  /** Dica para a IA dos bots. */
  ai: AbilityAiHint;
  vfx: { color: string; color2?: string; kind: string };
  sfx: string;
}

/** Union frouxa de parâmetros: cada tipo lê o que precisa (validado em validate.ts). */
export interface AbilityParams {
  distance?: number;
  duration?: number;
  invuln?: number;
  damage?: number;
  damageOnPass?: number;
  radius?: number;
  knockback?: number;
  delay?: number;
  status?: StatusApply;
  absorb?: number;
  reflect?: boolean;
  heal?: number;
  hps?: number;
  count?: number;
  minion?: MinionDef;
  speedMul?: number;
  damageMul?: number;
  attackSpeedMul?: number;
  lifesteal?: number;
  length?: number;
  width?: number;
  dps?: number;
  projectile?: Id;
  waves?: number;
  interval?: number;
  spreadDeg?: number;
  hpMul?: number;
  radiusMul?: number;
  /** transform: troca o ataque básico durante a transformação. */
  basicProjectile?: Id;
  zone?: ZoneSpawn;
  /** Distância até onde a habilidade é lançada (trap/zone/aoe à distância). */
  castRange?: number;
  pullStrength?: number;
}

// ───────────────────────────── Arte procedural ─────────────────────────────
export type SkullShape = 'round' | 'long' | 'wide' | 'cracked' | 'horned' | 'tiny' | 'square';
export type Headwear =
  | 'none' | 'hood' | 'crown' | 'tophat' | 'horns' | 'helmet' | 'bandana' | 'witch_hat'
  | 'halo' | 'mohawk' | 'flame' | 'cap' | 'samurai' | 'antlers' | 'beanie' | 'pharaoh';
export type EyeStyle = 'glow' | 'hollow' | 'angry' | 'cyclops' | 'x' | 'star' | 'spiral' | 'heart' | 'visor';
export type JawStyle = 'grin' | 'fangs' | 'stitched' | 'open' | 'gold_tooth' | 'beard';
export type BodyStyle = 'robe' | 'armor' | 'jacket' | 'ribs' | 'cloak' | 'suit' | 'tunic' | 'bandages' | 'kimono' | 'hoodie';
export type WeaponStyle =
  | 'scythe' | 'pistols' | 'staff' | 'bow' | 'hammer' | 'daggers' | 'cannon' | 'lute'
  | 'chain' | 'book' | 'claws' | 'fist' | 'katana' | 'lantern' | 'trident' | 'guitar' | 'flask' | 'shield' | 'shovel';
export type AuraStyle = 'none' | 'flame' | 'void' | 'gold' | 'creator' | 'frost' | 'toxic' | 'electric';

export interface CharacterArt {
  skull: SkullShape;
  headwear: Headwear;
  eyes: EyeStyle;
  eyeColor: string;
  jaw: JawStyle;
  body: BodyStyle;
  weapon: WeaponStyle;
  aura?: AuraStyle;
  /** Cor do osso (padrão marfim). */
  boneColor?: string;
  /** Escala do corpo (tanques são maiores). */
  scale?: number;
}

// ───────────────────────────── Personagens ─────────────────────────────
export type Role = 'tanque' | 'assassino' | 'atirador' | 'suporte' | 'lutador' | 'controlador' | 'artilheiro';

export interface CharacterDef {
  id: Id;
  name: string;
  /** Epíteto curto exibido sob o nome. */
  title: string;
  rarity: RarityId;
  role: Role;
  lore: string;
  voiceLines: {
    select: string[];
    victory: string[];
    defeat: string[];
    kill?: string[];
    audio?: Record<string, string>;
  };
  stats: {
    hp: number;
    moveSpeed: number;
    /** Intervalo entre ataques básicos (s). */
    attackInterval: number;
    /** Raio do corpo (colisão). Padrão 22. */
    radius?: number;
  };
  basicAttack: { projectile: Id };
  special: { ability: Id };
  animations: string[];
  /** "procedural" = desenhado pelo motor a partir de `art`; ou caminho de imagem final. */
  portrait: string;
  sprite: string;
  palette: [string, string, string];
  art: CharacterArt;
  /** IDs de skins (ver data/skins.json). "default" sempre existe. */
  skins: Id[];
  /** Como se obtém: starter (inicial), chest (baú), shop (loja), event, creator. */
  obtain: Array<'starter' | 'chest' | 'shop' | 'event' | 'creator'>;
}

// ───────────────────────────── Skins ─────────────────────────────
export interface SkinDef {
  id: Id;
  name: string;
  tier: 'padrao' | 'rara' | 'epica' | 'lendaria';
  /** Se definido, a skin é exclusiva deste personagem (skins lendárias). */
  characterId?: Id;
  /** Sobrescreve paleta [primária, escura, destaque]. Ausente = usa a do personagem. */
  palette?: [string, string, string];
  boneColor?: string;
  eyeColor?: string;
  aura?: AuraStyle;
  headwear?: Headwear;
  price?: { coins?: number; gems?: number };
}

// ───────────────────────────── Pets ─────────────────────────────
export type PetAbility = 'aura_heal' | 'mirror_shot' | 'reveal' | 'shield_pulse';

export interface PetDef {
  id: Id;
  name: string;
  rarity: RarityId;
  description: string;
  ability: PetAbility;
  params: {
    hps?: number;
    radius?: number;
    damageMul?: number;
    shield?: number;
    interval?: number;
    projectile?: Id;
  };
  sprite: string;
  look: { kind: 'bat' | 'skull' | 'ghost' | 'crow' | 'spider'; color: string; color2: string; eyeColor: string };
  price?: { coins?: number; gems?: number };
}

// ───────────────────────────── Mapas ─────────────────────────────
export type MapTheme = 'crypt' | 'graveyard' | 'lava' | 'ice' | 'swamp' | 'neon' | 'temple' | 'void';
export type ObstacleType = 'wall' | 'tomb' | 'pillar' | 'crystal' | 'water' | 'bones' | 'fence' | 'statue';

export interface ObstacleTypeDef {
  blocksMove: boolean;
  blocksShots: boolean;
  /** Altura visual (perspectiva top-down inclinada). */
  height: number;
}

export interface RectDef { x: number; y: number; w: number; h: number }
export interface ObstacleDef extends RectDef { type: ObstacleType }
export interface DestructibleDef { type: 'crate' | 'urn' | 'coffin'; x: number; y: number; hp: number }

export interface MapDef {
  id: Id;
  name: string;
  description: string;
  theme: MapTheme;
  size: { w: number; h: number };
  /** Simetria aplicada pelo loader (dados enxutos + arena justa). */
  symmetry?: 'none' | 'mirror_x' | 'mirror_y' | 'point' | 'quad';
  spawns: Array<{ x: number; y: number }>;
  teamSpawns?: { a: Array<{ x: number; y: number }>; b: Array<{ x: number; y: number }> };
  obstacles: ObstacleDef[];
  brush?: RectDef[];
  destructibles?: DestructibleDef[];
  /** Modos em que o mapa entra na rotação. */
  modes: Id[];
  bg: string;
  palette: [string, string, string?];
  /** Semente da decoração procedural. */
  decorSeed?: number;
}

// ───────────────────────────── Modos ─────────────────────────────
export interface ModeDef {
  id: Id;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  kind: 'ffa' | 'team' | 'duel';
  players: number;
  teamSize?: number;
  win: { type: 'last_standing' | 'kill_target'; target?: number; timeLimit?: number };
  respawn?: number;
  ring?: { delay: number; duration: number; minRadius: number; dps: number };
  souls?: boolean;
  /** Bônus de sorte de baú por jogar offline contra bots. */
  chestLuck?: number;
  /** Requer servidor para a versão "de verdade" (UI avisa). */
  onlineRequired?: boolean;
  /** Rótulo de honestidade exibido na UI. */
  botNotice: string;
  unlockLevel?: number;
  rewards: { xpBase: number; xpWin: number; coinsBase: number; coinsWin: number; trophiesWin: number; trophiesLose: number };
}

// ───────────────────────────── Economia ─────────────────────────────
export interface ChestDef {
  id: Id;
  name: string;
  tier: number;
  color: string;
  color2: string;
  price?: { coins?: number; gems?: number };
  rolls: number;
  coins: [number, number];
  gems: { chance: number; min: number; max: number };
  /** Chance (0–1) de cada rolagem virar personagem. */
  characterChance: number;
  /** Multiplicadores sobre chestWeight por raridade (baús melhores favorecem raras). */
  rarityBoost?: Partial<Record<RarityId, number>>;
  description: string;
}

export interface ShopDef {
  featuredSlots: number;
  dailyFreeGems: number;
  dailyFreeCoins: number;
  chests: Id[];
  gemPacks: Array<{ id: Id; gems: number; label: string; realPrice: string }>;
  realPaymentsEnabled: boolean;
}

export interface ProgressionDef {
  maxPlayerLevel: number;
  xpCurve: { base: number; growth: number };
  levelUpReward: { coins: number; gems: number; chestEvery: number; chest: Id };
  character: {
    maxLevel: number;
    /** Bônus por nível acima do 1 (fração): hp e dano. */
    hpPerLevel: number;
    damagePerLevel: number;
    /** Custo em moedas por nível (índice = nível atual). */
    upgradeCosts: number[];
  };
  starterCharacters: Id[];
  starterPet: Id | null;
  startingCoins: number;
  startingGems: number;
  startingChests: Id[];
  trophyRoad: Array<{ trophies: number; reward: { coins?: number; gems?: number; chest?: Id; title?: Id } }>;
}

export interface TitleDef { id: Id; name: string; color: string; unlock: string }

export interface AchievementDef {
  id: Id;
  name: string;
  description: string;
  stat: StatKey;
  target: number;
  reward: { coins?: number; gems?: number; title?: Id; chest?: Id };
}

export type StatKey =
  | 'matches' | 'wins' | 'kills' | 'damage' | 'specials' | 'chestsOpened'
  | 'souls' | 'heals' | 'botMatches' | 'duelWins' | 'teamWins' | 'upgrades' | 'level';

export interface EventDef {
  id: Id;
  name: string;
  kind: 'daily' | 'weekly' | 'seasonal';
  description: string;
  quests: Array<{ id: Id; text: string; stat: StatKey; target: number; reward: { coins?: number; gems?: number; chest?: Id; xp?: number; title?: Id } }>;
  /** Para sazonais: janela ISO. */
  start?: string;
  end?: string;
  theme?: string;
}

// ───────────────────────────── Ajuste do controle ─────────────────────────────
export interface ControlTuning {
  /** Meia-abertura (graus) do cone de ataque na direção do movimento. */
  attackConeHalfDeg: number;
  /** 0–1: quanto o tiro "puxa" para o alvo dentro do cone. */
  aimAssist: number;
  /** Exige linha de visão para tiros diretos (não desperdiça ataque na parede). */
  requireLineOfSight: boolean;
  joystick: { deadZone: number; radius: number; smoothing: number };
  regen: { delay: number; percentPerSec: number };
  spawnInvuln: number;
  brush: { revealDistance: number; revealOnAttack: number };
  souls: { hpBonus: number; damageBonus: number; max: number };
}
