/**
 * CONTRATO DE CONTEÚDO DO SKULL ARENA
 * ------------------------------------
 * Tudo que é "dado" (personagens, habilidades, pets, mapas, eventos, códigos, baús...)
 * segue estes tipos. O TypeScript avisa na hora se faltar algo ou se um nome estiver errado.
 * Leia o README (seção "Criar conteúdo") pra exemplos prontos de copiar e colar.
 */

// ---------------------------------------------------------------------------
// Raridades e papéis
// ---------------------------------------------------------------------------

export type RarityId = 'comum' | 'incomum' | 'raro' | 'extremo' | 'epico' | 'god' | 'creators';

export type RoleId =
  | 'atacante' // dano a média distância, fácil de jogar
  | 'tanque' // muita vida, perto do inimigo
  | 'suporte' // cura, escudo, utilidade
  | 'assassino' // rápido, corpo a corpo, explode quem está sozinho
  | 'atirador' // longa distância, pouca vida
  | 'controle' // áreas, lentidão, atordoar
  | 'lancador'; // arremessa por cima das paredes

// ---------------------------------------------------------------------------
// Efeitos de status
// ---------------------------------------------------------------------------

export type StatusKind =
  | 'slow' // lentidão (power = fração de redução, ex. 0.35)
  | 'stun' // atordoado: não anda nem ataca
  | 'root' // preso: não anda, mas ataca
  | 'silence' // não usa habilidades nem super
  | 'burn' // dano por segundo (power = dps)
  | 'poison' // dano por segundo + corta cura pela metade
  | 'freeze' // congelado = stun azul que quebra com dano forte
  | 'mark' // marcado: recebe +power de dano (ex. 0.2 = +20%)
  | 'weaken' // causa -power de dano
  | 'haste' // +power de velocidade (positivo)
  | 'rage' // +power de dano (positivo)
  | 'reveal'; // visível mesmo no arbusto

export interface StatusApply {
  kind: StatusKind;
  duration: number;
  power?: number;
}

// ---------------------------------------------------------------------------
// Projéteis
// ---------------------------------------------------------------------------

export type ProjShape = 'bullet' | 'orb' | 'skull' | 'note' | 'blade' | 'arrow' | 'fire' | 'shard' | 'bone' | 'coin' | 'glyph' | 'rock' | 'bubble' | 'card' | 'bolt' | 'spray' | 'wave';

export interface ProjLook {
  shape: ProjShape;
  color: string;
  color2?: string;
  size?: number; // multiplicador visual
  trail?: 'none' | 'smoke' | 'spark' | 'glow' | 'fire' | 'void';
  spin?: boolean;
}

export interface ExplodeDef {
  radius: number;
  damage: number;
  knockback?: number;
  status?: StatusApply;
  /** deixa uma zona no chão ao explodir */
  zone?: ZoneEffect;
}

export interface ProjectileDef {
  speed: number; // px/s
  range: number; // px até sumir
  radius: number; // raio de colisão (px)
  damage: number;
  /** atravessa inimigos (true = todos, número = quantos) */
  pierce?: boolean | number;
  /** ricocheteia nas paredes N vezes */
  bounces?: number;
  /** curva em direção ao inimigo mais perto (radianos/s) */
  homing?: number;
  /** arremesso em arco: passa por cima de paredes e explode no ponto mirado */
  lob?: boolean;
  /** volta pro dono depois do alcance máximo */
  boomerang?: boolean;
  /** pula pra outros inimigos próximos */
  chain?: { count: number; range: number; falloff?: number };
  explode?: ExplodeDef;
  status?: StatusApply;
  knockback?: number;
  /** puxa o alvo atingido até o dono (gancho) */
  pull?: number;
  /** cura aliados atingidos */
  heal?: number;
  /** % do dano vira vida pro dono */
  lifesteal?: number;
  /** dano no fim do alcance (1 = igual, 0.5 = metade) */
  falloff?: number;
  /** aumenta dano com a distância (atirador) até ×(1+ramp) */
  ramp?: number;
  /** atinge paredes destrutíveis com dano extra (× multiplicador) */
  wallDamage?: number;
  look: ProjLook;
}

// ---------------------------------------------------------------------------
// Invocações (torretas, minions)
// ---------------------------------------------------------------------------

export interface SummonDef {
  id: string;
  name: string;
  hp: number;
  duration: number;
  speed?: number; // 0 = parado (torreta)
  radius?: number;
  attack?: { projectile: ProjectileDef; interval: number; range: number };
  /** cura aliados em volta por segundo */
  healAura?: { radius: number; hps: number };
  look: { kind: 'turret' | 'minion' | 'totem' | 'drone' | 'clone' | 'speaker' | 'skeleton'; color: string; color2?: string };
}

// ---------------------------------------------------------------------------
// Efeitos de habilidade (as peças de LEGO de qualquer habilidade)
// ---------------------------------------------------------------------------

export interface ZoneEffect {
  radius: number;
  duration: number;
  /** dano por segundo em inimigos */
  dps?: number;
  /** cura por segundo em aliados */
  hps?: number;
  status?: StatusApply;
  /** segue o dono */
  follow?: boolean;
  look: { color: string; kind: 'poison' | 'fire' | 'heal' | 'void' | 'ice' | 'music' | 'electric' | 'smoke' | 'holy' };
}

export type EffectDef =
  | { kind: 'projectile'; proj: ProjectileDef; count?: number; spread?: number; burst?: number; burstDelay?: number; delay?: number }
  | { kind: 'melee'; range: number; arc: number; damage: number; knockback?: number; status?: StatusApply; lifesteal?: number; delay?: number; wallDamage?: number }
  | { kind: 'dash'; distance: number; speed?: number; damage?: number; radius?: number; knockback?: number; invuln?: boolean; status?: StatusApply; delay?: number }
  | { kind: 'blink'; distance: number; delay?: number }
  /** pula até o ponto mirado (por cima das paredes) */
  | { kind: 'leap'; duration?: number; delay?: number }
  | { kind: 'aoe'; at: 'self' | 'target'; radius: number; damage?: number; heal?: number; knockback?: number; pull?: number; status?: StatusApply; delay?: number; fx?: string; wallDamage?: number }
  | ({ kind: 'zone'; at: 'self' | 'target'; delay?: number } & ZoneEffect)
  | { kind: 'heal'; amount: number; radius?: number; delay?: number }
  | { kind: 'shield'; amount: number; duration: number; radius?: number; delay?: number }
  | { kind: 'buff'; stat: 'speed' | 'damage' | 'reload' | 'armor' | 'lifesteal'; mult: number; duration: number; radius?: number; delay?: number }
  | { kind: 'summon'; unit: SummonDef; count?: number; at: 'self' | 'target'; delay?: number }
  | { kind: 'wall'; length: number; hp: number; duration: number; at: 'self' | 'target'; delay?: number }
  | { kind: 'beam'; length: number; width: number; duration: number; dps: number; status?: StatusApply; color: string; delay?: number }
  | { kind: 'trap'; radius: number; damage: number; status?: StatusApply; duration: number; count?: number; at: 'self' | 'target'; delay?: number }
  | { kind: 'stealth'; duration: number; delay?: number }
  | { kind: 'clone'; duration: number; hp: number; delay?: number }
  | { kind: 'rewind'; seconds: number; heal?: number; delay?: number }
  | { kind: 'orbit'; proj: ProjectileDef; count: number; radius: number; duration: number; delay?: number }
  | { kind: 'cleanse'; radius?: number; delay?: number }
  | { kind: 'ammo'; amount: number; delay?: number };

export type AimMode =
  | 'direction' // aponta numa direção (linha/cone)
  | 'point' // escolhe um ponto no chão (arremessos, áreas)
  | 'self'; // sem mira, efeito em volta de si

export type IndicatorKind = 'line' | 'cone' | 'circle' | 'none';

export type CastPose = 'shoot' | 'swing' | 'throw' | 'cast' | 'slam' | 'dash' | 'play';

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  icon: string; // emoji/ícone do botão
  /** recarga em segundos (habilidades). Ataque básico usa munição; super usa carga. */
  cooldown?: number;
  aim: AimMode;
  range: number;
  indicator: IndicatorKind;
  /** largura da linha (px) ou abertura do cone (graus) ou raio do círculo */
  indicatorSize?: number;
  /** tempo de preparo antes de soltar (s) */
  castTime?: number;
  pose?: CastPose;
  /** som do disparo (id do catálogo de sons) */
  sfx?: string;
  effects: EffectDef[];
}

export interface PassiveDef {
  name: string;
  desc: string;
  /** efeitos passivos simples, combináveis */
  regen?: number; // vida/s fora de combate (extra)
  speedMult?: number;
  damageMult?: number;
  armor?: number; // fração de redução de dano
  lifesteal?: number;
  lowHpRage?: number; // +dano quando < 40% de vida
  killHeal?: number; // cura ao eliminar
  superChargeMult?: number;
  thorns?: number; // reflete fração do dano corpo a corpo
  bushHeal?: number; // cura/s dentro do arbusto
}

// ---------------------------------------------------------------------------
// Aparência (2.5D procedural)
// ---------------------------------------------------------------------------

export type Species = 'human' | 'skeleton' | 'alien' | 'robot' | 'demon' | 'zombie' | 'ghost' | 'feline' | 'vampire' | 'lizard' | 'void';

export type BodyType = 'slim' | 'normal' | 'broad' | 'heavy';

export type HairStyle =
  | 'messy' // bagunçado espetado (ref. 1)
  | 'curly' // cacheado/afro curto (ref. 4)
  | 'long'
  | 'bun'
  | 'mohawk'
  | 'buzz'
  | 'ponytail'
  | 'spiky'
  | 'bob'
  | 'twintails'
  | 'locs'
  | 'undercut'
  | 'afro'
  | 'none';

export type EyeStyle = 'sleepy' | 'sharp' | 'round' | 'glow' | 'closed' | 'wide' | 'hollow' | 'visor' | 'cyclops' | 'lazy';

export type TopStyle = 'hoodie' | 'oversized_tee' | 'puffer' | 'turtleneck_jacket' | 'varsity' | 'tank' | 'trench' | 'tracksuit' | 'ribbed_tee' | 'kimono' | 'vest' | 'robe';

export type PantsStyle = 'baggy' | 'cargo' | 'wide_jeans' | 'shorts' | 'track' | 'hakama' | 'skirt';
export type ShoeStyle = 'chunky' | 'hightop' | 'skate' | 'boots' | 'slides' | 'runner';
export type PrintKind = 'none' | 'skull' | 'text' | 'stripe' | 'flame' | 'star' | 'cross' | 'bolt' | 'heart' | 'eye' | 'rune';

export type WeaponKind =
  | 'pistol'
  | 'dual_pistols'
  | 'shotgun'
  | 'rifle'
  | 'sniper'
  | 'launcher'
  | 'bat'
  | 'hammer'
  | 'katana'
  | 'scythe'
  | 'boombox'
  | 'spray'
  | 'guitar'
  | 'staff'
  | 'cards'
  | 'chain'
  | 'gloves'
  | 'bow'
  | 'book'
  | 'skateboard'
  | 'axe'
  | 'claws'
  | 'flamethrower'
  | 'orb'
  | 'yoyo'
  | 'umbrella'
  | 'mic'
  | 'wrench'
  | 'crossbow'
  | 'none';

export interface Look {
  species: Species;
  skin: string;
  body: BodyType;
  hair: { style: HairStyle; color: string; color2?: string };
  eyes: { style: EyeStyle; color: string };
  brows?: 'flat' | 'angry' | 'sad' | 'raised' | 'none';
  mouth?: 'neutral' | 'smirk' | 'frown' | 'teeth' | 'open' | 'fangs' | 'stitch';
  face?: { scar?: boolean; freckles?: boolean; blush?: boolean; tattoo?: string; piercings?: number; paint?: string; bandaid?: boolean };
  top: { style: TopStyle; color: string; color2?: string; print?: PrintKind; text?: string; hood?: 'down' | 'up' };
  pants: { style: PantsStyle; color: string; color2?: string };
  shoes: { style: ShoeStyle; color: string; sole?: string; accent?: string };
  acc?: {
    glasses?: 'rect' | 'round' | 'shades' | 'visor' | 'goggles';
    earbuds?: boolean;
    headphones?: string;
    mask?: 'cloth' | 'skull' | 'gas' | 'oni' | 'bandana';
    chain?: string;
    watch?: boolean;
    backpack?: string;
    hat?: 'cap_back' | 'cap' | 'beanie' | 'bucket' | 'crown' | 'halo' | 'horns' | 'antenna' | 'cat_ears' | 'hood_ears';
    hatColor?: string;
    wings?: 'bat' | 'bone' | 'angel' | 'void';
    tail?: boolean;
  };
  weapon: { kind: WeaponKind; color: string; color2?: string };
  aura?: { color: string; color2?: string; kind: 'flame' | 'void' | 'sparkle' | 'glitch' | 'smoke' | 'electric' | 'holy' | 'prism' };
  /** escala final (todos ~1.0; tanques até 1.08, mantendo "mesmo tamanho" de jogo) */
  scale?: number;
}

/** Personalidade de animação: escolhe as variações do pacote de animações. */
export interface AnimStyle {
  idle: 'chill' | 'bounce' | 'hype' | 'stoic' | 'nervous' | 'float' | 'heavy' | 'cocky';
  run: 'normal' | 'sprint' | 'stomp' | 'glide' | 'skip';
  attack: 'pistol' | 'dual' | 'rifle' | 'swing' | 'throw' | 'cast' | 'punch' | 'boombox' | 'heavy_swing' | 'bow';
  victory: 'peace' | 'flex' | 'dance' | 'bow' | 'laugh' | 'point' | 'spin';
  /** velocidade geral das animações (1 = normal) */
  tempo?: number;
}

// ---------------------------------------------------------------------------
// Personagem
// ---------------------------------------------------------------------------

export interface CharacterBio {
  /** "Bairro/planeta/dimensão" de origem */
  origem: string;
  idade: string;
  /** texto principal, 2+ parágrafos */
  historia: string[];
  sonho: string;
  medo: string;
  rival?: string;
  curiosidade: string;
}

export interface BaseStats {
  hp: number;
  /** px/s (normal ≈ 250) */
  speed: number;
  ammo: number;
  /** segundos pra recarregar 1 barra */
  reload: number;
  /** quanto do super enche por ponto de dano causado (normal ≈ 1/2400) */
  superRate: number;
}

export type UnlockRule =
  | { kind: 'starter' }
  | { kind: 'chest' }
  | { kind: 'trophyRoad'; trophies: number }
  | { kind: 'event'; eventId: string }
  | { kind: 'shop'; price: number; currency: 'moedas' | 'isvoid' }
  | { kind: 'pass'; tier: number };

/**
 * Folha de sprite desenhada à mão (Piskel/Aseprite). Só o `src` é obrigatório se
 * você usar o formato padrão (quadros 72×84, pés em 36,76, uma animação por linha —
 * veja pixel/sprite.ts ou exporte um modelo no Estúdio do jogo).
 */
export interface SheetDef {
  /** caminho dentro de public/, ex.: 'sprites/kaze.png' */
  src: string;
  frameW?: number;
  frameH?: number;
  originX?: number;
  originY?: number;
  /** quantos quadros cada linha tem (se for diferente do padrão) */
  frames?: Partial<Record<'idle' | 'run' | 'attack' | 'cast' | 'hit' | 'victory' | 'defeat' | 'dash', number>>;
}

export interface CharacterDef {
  id: string;
  name: string;
  rarity: RarityId;
  role: RoleId;
  /** apelido curto: "O Fantasma do Beco" */
  title: string;
  /** fala de efeito (aparece no menu e ao vencer) */
  quote: string;
  bio: CharacterBio;
  stats: BaseStats;
  attack: AbilityDef;
  skills: AbilityDef[];
  super: AbilityDef;
  passive?: PassiveDef;
  look: Look;
  /** (opcional) seu próprio desenho em pixel art — substitui o gerado */
  sheet?: string | SheetDef;
  anim: AnimStyle;
  /** banco de voz (sons de ataque/dano/vitória) */
  voice?: 'male' | 'female' | 'robot' | 'monster' | 'skull' | 'cute';
  unlock: UnlockRule;
  /** feito à mão (true) ou gerado pelo gerador procedural */
  handmade?: boolean;
  status?: 'live' | 'test';
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

export type PetBody =
  'bat' | 'crow' | 'cat' | 'ghost' | 'slime' | 'drone' | 'skull' | 'dragon' | 'jelly' | 'frog' | 'snake' | 'eye' | 'flame' | 'robot' | 'bunny' | 'fox' | 'spider' | 'fish' | 'owl' | 'crystal';

export interface PetBonus {
  speed?: number; // +fração
  damage?: number;
  hp?: number;
  regen?: number; // vida/s
  reload?: number; // fração mais rápida
  superCharge?: number;
  /** faísca automática fraca a cada X s */
  spark?: { damage: number; interval: number; range: number };
  /** escudo automático quando vida < 35% (1x por vida) */
  lowHpShield?: number;
  /** revela inimigos em arbustos num raio */
  revealRadius?: number;
  /** moedas extras no fim da partida */
  coinBonus?: number;
}

export interface PetDef {
  id: string;
  name: string;
  rarity: RarityId;
  desc: string;
  body: PetBody;
  colors: [string, string, string]; // corpo, detalhe, olhos/brilho
  /** jeito de se mexer */
  motion: 'float' | 'flap' | 'hop' | 'slither' | 'orbit' | 'bounce';
  bonus: PetBonus;
  handmade?: boolean;
  unlock: UnlockRule;
  /** (opcional) desenho seu: PNG com quadros 32×32 lado a lado (4 quadros) */
  sheet?: string;
}

// ---------------------------------------------------------------------------
// Mapas
// ---------------------------------------------------------------------------

export type MapTheme = 'cemiterio_neon' | 'quarteirao' | 'fabrica' | 'ilha_vazio' | 'templo' | 'escola' | 'treino' | 'deserto' | 'gelo' | 'lava';

export interface MapDef {
  id: string;
  name: string;
  theme: MapTheme;
  /** modos onde o mapa aparece */
  modes: ModeId[];
  /**
   * Desenho do mapa, uma string por linha. Legenda (ver content/maps/legend.ts):
   *  .  chão        #  parede        B  parede destrutível (tijolo)    W  água
   *  "  arbusto     x  caixa (física) o  barril explosivo (física)     t  pneu/lata (física)
   *  A  spawn time A   Z  spawn time B   S  spawn livre (FFA)          +  altar de cura
   *  *  power-up      ^  pad de salto   ~  lava/veneno (dano)          =  vidro (destrutível fraco)
   */
  grid: string[];
  /** escreva só metade e espelhe: 'mirror_x' (esq→dir), 'mirror_y' (cima→baixo), 'point' (rotação 180°), 'none' */
  symmetry: 'none' | 'mirror_x' | 'mirror_y' | 'point';
  /** cor ambiente opcional (sobrepõe o tema) */
  ambient?: string;
}

// ---------------------------------------------------------------------------
// Modos de jogo
// ---------------------------------------------------------------------------

export type ModeId = 'guerra' | 'ffa' | 'treino' | 'chefao' | 'meteoro' | 'so_super';

export interface ModeDef {
  id: ModeId;
  name: string;
  short: string;
  desc: string;
  icon: string;
  teams: number; // 2 = equipes, 0 = todos contra todos
  teamSize: number;
  players: number;
  duration: number; // segundos
  scoreToWin: number;
  respawn: number; // segundos
  /** pontua por caveira coletada (true) ou por eliminação direta (false) */
  skullPickup: boolean;
  /** modificadores especiais (eventos) */
  modifiers?: ModeModifiers;
  /** aparece no seletor normal (false = só por evento) */
  listed: boolean;
  trophies: boolean;
}

export interface ModeModifiers {
  speedMult?: number;
  damageMult?: number;
  superChargeMult?: number;
  meteors?: boolean;
  boss?: boolean;
  lowGravity?: boolean;
}

// ---------------------------------------------------------------------------
// Recompensas, baús, eventos, códigos
// ---------------------------------------------------------------------------

export type Reward =
  | { kind: 'moedas'; amount: number }
  | { kind: 'isvoid'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'passXp'; amount: number }
  | { kind: 'trophies'; amount: number }
  | { kind: 'character'; id: string }
  | { kind: 'pet'; id: string }
  | { kind: 'chest'; id: string; count?: number }
  | { kind: 'skin'; characterId: string; variant: number }
  | { kind: 'randomCharacter'; rarity: RarityId }
  | { kind: 'randomPet'; rarity: RarityId }
  | { kind: 'title'; id: string; text: string };

export interface ChestDef {
  id: string;
  name: string;
  desc: string;
  /** visual: cor principal e de brilho */
  color: string;
  glow: string;
  tier: number; // 1..5 (tamanho/tremidas na animação)
  price?: { currency: 'moedas' | 'isvoid'; amount: number };
  /** quantas "cartas" saem */
  rolls: number;
  /** moedas garantidas (min..max) */
  moedas: [number, number];
  isvoid?: [number, number];
  /** chance (0..1) de cada cart sair personagem por raridade */
  characterOdds: Partial<Record<RarityId, number>>;
  petOdds: Partial<Record<RarityId, number>>;
  /** chance de Vicen₹ por abertura (0.01 = 1%) */
  vicenOdds?: number;
  /** garantia: após N aberturas sem CREATORs, o próximo garante */
  pity?: { rarity: RarityId; after: number };
}

export interface EventDef {
  id: string;
  name: string;
  desc: string;
  /** ISO: '2026-10-20T00:00:00-03:00' */
  start: string;
  end: string;
  banner: { color: string; color2: string; emoji: string };
  /** multiplica moedas/xp/troféus ganhos nas partidas */
  multipliers?: { moedas?: number; xp?: number; trophies?: number; passXp?: number };
  /** modo especial liberado durante o evento */
  modeId?: ModeId;
  mapId?: string;
  /** personagem em destaque (chance x2 nos baús) */
  featuredCharacter?: string;
  /** baú especial vendido na loja durante o evento */
  chestId?: string;
  /** missões do evento */
  missions?: MissionDef[];
  /** presente ao abrir o jogo durante o evento (1x por conta) */
  loginGift?: Reward[];
  /**
   * (opcional) evento que REPETE toda semana dentro de start..end:
   * dias da semana em que fica ativo (0 = domingo … 6 = sábado).
   */
  weekly?: number[];
}

export interface PromoCodeDef {
  /** o código digitado (maiúsculas/minúsculas não importam) */
  code: string;
  rewards: Reward[];
  /** opcional: validade */
  validFrom?: string;
  validUntil?: string;
  /** quantas vezes CADA conta pode usar (padrão 1) */
  perAccount?: number;
  /** limite total de usos no servidor (modo online) */
  maxUses?: number;
  /** desligar sem apagar */
  active?: boolean;
  note?: string;
}

export type MissionGoal = 'play' | 'win' | 'kills' | 'damage' | 'heal' | 'skulls' | 'supers' | 'skills' | 'boxes' | 'playRole' | 'winMode' | 'top3';

export interface MissionDef {
  id: string;
  text: string;
  goal: MissionGoal;
  target: number;
  role?: RoleId;
  mode?: ModeId;
  rewards: Reward[];
}

export interface PassTier {
  xp: number; // xp acumulado necessário
  free: Reward[];
  premium: Reward[];
}

export interface TrophyRoadStep {
  trophies: number;
  rewards: Reward[];
}

export interface LeagueDef {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
}
