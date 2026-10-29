import type { AbilityDef, CharacterDef, PetDef, ProjectileDef, StatusKind, SummonDef, ZoneEffect } from '../content/types';

/** Intenção do jogador num passo da simulação (vem do controle, da IA ou da rede). */
export interface FighterInput {
  /** movimento (-1..1) */
  mx: number;
  my: number;
  /** direção da mira (normalizada) */
  ax: number;
  ay: number;
  /** distância da mira 0..1 (pra habilidades de "ponto") */
  ad: number;
  /** soltou o ataque neste passo */
  fire: boolean;
  /** toque rápido: mira automática no inimigo mais perto */
  auto: boolean;
  /** habilidade solta neste passo: -1 nenhuma, 0..2 habilidades, 3 = SUPER */
  skill: number;
  /** está segurando a mira (só visual) */
  aiming: boolean;
}

export const NO_INPUT: FighterInput = { mx: 0, my: 0, ax: 1, ay: 0, ad: 1, fire: false, auto: false, skill: -1, aiming: false };

export interface ActiveStatus {
  kind: StatusKind;
  t: number;
  power: number;
  source: number;
}

export interface ActiveBuff {
  stat: 'speed' | 'damage' | 'reload' | 'armor' | 'lifesteal';
  mult: number;
  t: number;
}

export interface DashState {
  vx: number;
  vy: number;
  t: number;
  damage: number;
  radius: number;
  knockback: number;
  status?: { kind: StatusKind; duration: number; power?: number };
  hit: number[];
  invuln: boolean;
}

export interface JumpState {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
}

export interface MatchStats {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  healed: number;
  skulls: number;
  supers: number;
  skills: number;
  boxes: number;
  /** moedinhas pegas no chão (viram bônus de Moedas da Morte) */
  coins: number;
  streak: number;
  bestStreak: number;
}

export interface Fighter {
  id: number;
  name: string;
  def: CharacterDef;
  team: number;
  isBot: boolean;
  /** humano local (pro HUD/câmera) */
  isLocal: boolean;
  pet: PetDef | null;
  level: number;
  x: number;
  y: number;
  /** posição anterior (interpolação no render) */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** empurrão (knockback) separado do movimento */
  kx: number;
  ky: number;
  /** altura (pulos) */
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  shieldT: number;
  ammo: number;
  maxAmmo: number;
  reload: number;
  superCharge: number;
  skillCd: number[];
  atkCd: number;
  statuses: ActiveStatus[];
  buffs: ActiveBuff[];
  alive: boolean;
  respawnT: number;
  invulnT: number;
  /** ângulo da mira */
  aim: number;
  aiming: boolean;
  moving: boolean;
  inBush: boolean;
  /** visível pros inimigos até este tempo (atirou/levou dano) */
  revealT: number;
  stealthT: number;
  dash: DashState | null;
  jump: JumpState | null;
  /** tempo do último dano levado / causado (regeneração) */
  lastHurtT: number;
  lastAtkT: number;
  lastHitBy: number;
  assistIds: Map<number, number>;
  stats: MatchStats;
  /** histórico de posição/vida pra "voltar no tempo" */
  history: Array<{ x: number; y: number; hp: number; t: number }>;
  /** 1x por vida: escudo do pet */
  petShieldUsed: boolean;
  petSparkT: number;
  /** multiplicadores do evento/modo */
  dmgMult: number;
  hpMult: number;
  /** contador de "procurado" (FFA) */
  wanted: boolean;
  /** contagem de quadros sem input (AFK) */
  idleTicks: number;
  /** pra animação: último uso de ataque/habilidade */
  lastCast: { kind: 'attack' | 'skill' | 'super'; t: number; idx: number } | null;
  hazardT: number;
}

export interface Projectile {
  id: number;
  owner: number;
  team: number;
  def: ProjectileDef;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  traveled: number;
  range: number;
  damage: number;
  hit: number[];
  bounces: number;
  pierce: number;
  alive: boolean;
  returning: boolean;
  chainLeft: number;
  /** arremesso em arco */
  lob: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number } | null;
  z: number;
  /** orbitando o dono */
  orbit: { angle: number; radius: number; until: number; speed: number } | null;
  isSuper: boolean;
  /** projétil vem de pet/torreta (não carrega super) */
  noCharge: boolean;
  age: number;
}

export interface Zone extends ZoneEffect {
  id: number;
  owner: number;
  team: number;
  x: number;
  y: number;
  t: number;
  tickT: number;
}

export interface Summon {
  id: number;
  owner: number;
  team: number;
  def: SummonDef;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  t: number;
  atkT: number;
  aim: number;
  alive: boolean;
  /** clone: anda numa direção */
  vx: number;
  vy: number;
}

export interface Trap {
  id: number;
  owner: number;
  team: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  status?: { kind: StatusKind; duration: number; power?: number };
  t: number;
  armed: number;
}

export interface Beam {
  id: number;
  owner: number;
  team: number;
  length: number;
  width: number;
  t: number;
  dps: number;
  color: string;
  status?: { kind: StatusKind; duration: number; power?: number };
  /** ponto final atual (render) */
  ex: number;
  ey: number;
}

export type PropKind = 'crate' | 'barrel' | 'tire';

export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** giro (visual) */
  rot: number;
  vr: number;
  radius: number;
  mass: number;
  hp: number;
  alive: boolean;
  z: number;
  vz: number;
}

export type PickupKind = 'skull' | 'heal' | 'power' | 'coin';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  /** time da vítima (caveiras) */
  team: number;
  /** quem matou (caveira expira → ponto pro time do matador) */
  killerTeam: number;
  t: number;
  value: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
}

export interface Delayed {
  at: number;
  run: () => void;
}

/** Eventos emitidos a cada passo — o renderer/áudio/HUD consomem. */
export type GameEvent =
  | { type: 'shoot'; id: number; x: number; y: number; angle: number; ability: AbilityDef; kind: 'attack' | 'skill' | 'super' }
  | { type: 'hit'; target: number; source: number; x: number; y: number; amount: number; crit: boolean; shield: boolean; kind: 'fighter' | 'summon' | 'prop' | 'tile' }
  | { type: 'heal'; target: number; x: number; y: number; amount: number }
  | { type: 'kill'; killer: number; victim: number; x: number; y: number; streak: number }
  | { type: 'respawn'; id: number; x: number; y: number }
  | { type: 'explode'; x: number; y: number; r: number; color: string; big: boolean }
  | { type: 'tileBreak'; tx: number; ty: number; tile: number }
  | { type: 'propBreak'; id: number; kind: PropKind; x: number; y: number }
  | { type: 'propHit'; id: number; x: number; y: number }
  | { type: 'pickup'; id: number; kind: PickupKind; x: number; y: number; team: number }
  | { type: 'projEnd'; x: number; y: number; color: string; wall: boolean }
  | { type: 'blink'; id: number; fx: number; fy: number; tx: number; ty: number }
  | { type: 'dash'; id: number }
  | { type: 'jump'; id: number }
  | { type: 'land'; id: number; x: number; y: number }
  | { type: 'shield'; id: number }
  | { type: 'status'; id: number; kind: StatusKind }
  | { type: 'superReady'; id: number }
  | { type: 'score'; team: number; score: number; byId: number }
  | { type: 'streak'; id: number; count: number }
  | { type: 'wanted'; id: number }
  | { type: 'summon'; id: number; x: number; y: number }
  | { type: 'zone'; x: number; y: number; r: number; kind: string }
  | { type: 'meteor'; x: number; y: number; at: number }
  | { type: 'countdown'; n: number }
  | { type: 'start' }
  | { type: 'matchEnd'; winner: number };

export type { ZoneEffect };
