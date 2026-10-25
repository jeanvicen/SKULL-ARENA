import type {
  AbilityDef, CharacterDef, MinionDef, PetDef, ProjectileDef, StatusApply, StatusKind, ZoneSpawn,
} from '../content/types';

/** Intenção de controle de um lutador num tick. Vem do InputProfile (jogador), da IA (bot) ou da rede (futuro). */
export interface FighterInput {
  /** Direção de movimento com magnitude 0..1. */
  moveX: number;
  moveY: number;
  /** Mira separada (perfil desktop com mouse). Ausente = mira segue o movimento. */
  aimX?: number;
  aimY?: number;
  /** Intenção de atacar: no touch = joystick ativo; no desktop = botão/auto. */
  attackHeld: boolean;
  /** Pulso para usar o especial neste tick. */
  special: boolean;
  specialAimX?: number;
  specialAimY?: number;
}

export const emptyInput = (): FighterInput => ({ moveX: 0, moveY: 0, attackHeld: false, special: false });

export interface ActiveStatus {
  kind: StatusKind;
  t: number;
  dps: number;
  amount: number;
  sourceId: number;
  tick: number;
}

export interface DashState {
  t: number;
  dur: number;
  vx: number;
  vy: number;
  damage: number;
  knockback: number;
  status?: StatusApply;
  hit: number[];
  color: string;
}

export interface BeamState {
  t: number;
  dur: number;
  length: number;
  width: number;
  dps: number;
  status?: StatusApply;
  color: string;
  color2: string;
  /** Ponto final atual do feixe (para render). */
  ex: number;
  ey: number;
}

export interface TransformState {
  t: number;
  dur: number;
  speedMul: number;
  damageMul: number;
  radiusMul: number;
  basicProjectile?: ProjectileDef;
  hpBonus: number;
}

export interface BuffState {
  t: number;
  speedMul: number;
  damageMul: number;
  attackSpeedMul: number;
  lifesteal: number;
}

export interface PetRuntime {
  def: PetDef;
  x: number;
  y: number;
  px: number;
  py: number;
  t: number;
  timer: number;
  /** Fase de animação/órbita. */
  phase: number;
  /** Pulso visual (0..1) quando age. */
  pulse: number;
}

export class Fighter {
  // Identidade
  id = 0;
  name = '';
  team = 0;
  isBot = false;
  isPlayer = false;
  isMinion = false;
  ownerId = -1;
  def!: CharacterDef;
  skinId = 'default';
  level = 1;
  difficulty: 'facil' | 'normal' | 'dificil' = 'normal';

  // Física
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  radius = 22;
  facing = -Math.PI / 2;
  moving = false;
  moveMag = 0;

  // Vida
  hp = 1;
  maxHp = 1;
  baseMaxHp = 1;
  shield = 0;
  shieldMax = 0;
  shieldT = 0;
  shieldReflect = false;
  invuln = 0;
  alive = true;
  respawnT = 0;
  deathTime = -1;

  // Ataque
  basic!: ProjectileDef;
  baseSpeed = 250;
  attackInterval = 0.5;
  attackCd = 0;
  damageMul = 1;
  burstLeft = 0;
  burstT = 0;
  burstAngle = 0;
  burstTargetId = -1;

  // Especial
  ability!: AbilityDef;
  specialCd = 0;
  specialMax = 1;

  // Estados
  statuses: ActiveStatus[] = [];
  dash: DashState | null = null;
  beam: BeamState | null = null;
  transform: TransformState | null = null;
  buffs: BuffState[] = [];
  souls = 0;
  inBrush = false;
  revealT = 0;
  /** Acumulador de dano de feixe recebido (pulsos legíveis). */
  beamAcc = 0;
  pet: PetRuntime | null = null;

  // Minion
  minionDef: MinionDef | null = null;
  lifetime = 0;

  // Telemetria / pontuação
  kills = 0;
  deaths = 0;
  damageDealt = 0;
  healingDone = 0;
  specialsUsed = 0;
  soulsCollected = 0;
  lastDamageTime = -99;
  lastAttackTime = -99;
  lastHitBy = -1;
  placement = 0;

  // Animação (dirigida por eventos da simulação, lida pelo render)
  attackT = 0;
  hurtT = 0;
  specialT = 0;
  spawnT = 0;
  healT = 0;
  walkPhase = 0;

  input: FighterInput = { moveX: 0, moveY: 0, attackHeld: false, special: false };

  hasStatus(k: StatusKind): boolean {
    for (const s of this.statuses) if (s.kind === k) return true;
    return false;
  }
  statusAmount(k: StatusKind): number {
    let a = 0;
    for (const s of this.statuses) if (s.kind === k) a = Math.max(a, s.amount);
    return a;
  }
}

export class Projectile {
  active = false;
  id = 0;
  def!: ProjectileDef;
  ownerId = -1;
  team = 0;
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  angle = 0;
  speed = 0;
  traveled = 0;
  range = 0;
  damage = 0;
  radius = 6;
  bouncesLeft = 0;
  pierceLeft = 0;
  hit: number[] = [];
  life = 0;
  age = 0;
  fromSpecial = false;
  reflected = false;
  // Lob
  lob = false;
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  flightDur = 0;
  z = 0;
  // Orbital
  orbitAngle = 0;
  orbitHitT: Map<number, number> | null = null;
}

export interface AreaZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  t: number;
  dur: number;
  team: number;
  ownerId: number;
  spec: ZoneSpawn;
  tickAcc: number;
}

export interface Trap {
  id: number;
  x: number;
  y: number;
  radius: number;
  team: number;
  ownerId: number;
  t: number;
  armT: number;
  damage: number;
  status?: StatusApply;
  color: string;
}

export interface Pickup {
  id: number;
  kind: 'soul' | 'potion';
  x: number;
  y: number;
  t: number;
  bob: number;
}

export interface Crate {
  id: number;
  type: 'crate' | 'urn' | 'coffin';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  hurtT: number;
}

export interface RingState {
  cx: number;
  cy: number;
  r: number;
  startR: number;
  minR: number;
  delay: number;
  duration: number;
  dps: number;
  active: boolean;
}

export type HitKind = 'basic' | 'special' | 'zone' | 'status' | 'ring' | 'pet' | 'trap' | 'minion';

export type GameEvent =
  | { t: 'shot'; x: number; y: number; angle: number; def: ProjectileDef; ownerId: number }
  | { t: 'hit'; x: number; y: number; targetId: number; sourceId: number; amount: number; kind: HitKind; big: boolean; shielded: boolean }
  | { t: 'heal'; x: number; y: number; targetId: number; amount: number }
  | { t: 'impact'; x: number; y: number; def: ProjectileDef; wall: boolean; angle: number }
  | { t: 'explode'; x: number; y: number; radius: number; color: string; color2: string }
  | { t: 'bounce'; x: number; y: number; color: string }
  | { t: 'special'; fighterId: number; ability: AbilityDef; x: number; y: number; angle: number }
  | { t: 'special_ready'; fighterId: number }
  | { t: 'death'; fighterId: number; killerId: number; x: number; y: number }
  | { t: 'spawn'; fighterId: number; x: number; y: number }
  | { t: 'crate_break'; x: number; y: number; type: string }
  | { t: 'crate_hit'; x: number; y: number }
  | { t: 'pickup'; fighterId: number; kind: 'soul' | 'potion'; x: number; y: number }
  | { t: 'shield_break'; fighterId: number; x: number; y: number }
  | { t: 'status'; fighterId: number; effect: StatusKind }
  | { t: 'melee'; x: number; y: number; angle: number; range: number; arc: number; color: string; color2: string; ownerId: number }
  | { t: 'dash'; fighterId: number; x0: number; y0: number; x1: number; y1: number; color: string }
  | { t: 'teleport'; fighterId: number; x0: number; y0: number; x1: number; y1: number; color: string }
  | { t: 'pet_act'; fighterId: number; x: number; y: number; kind: string }
  | { t: 'ring_start' }
  | { t: 'countdown'; n: number }
  | { t: 'fight' }
  | { t: 'match_end'; winnerTeam: number };
