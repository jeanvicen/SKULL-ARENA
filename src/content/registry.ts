import type {
  AbilityDef, AchievementDef, CharacterDef, ChestDef, ControlTuning, EventDef, MapDef, ModeDef,
  ObstacleType, ObstacleTypeDef, PetDef, ProgressionDef, ProjectileDef, RarityDef, RarityId, ShopDef,
  SkinDef, TitleDef,
} from './types';
import { expandMapSymmetry } from './maps';
import { validateContent, type ContentIssue } from './validate';

export interface RawContent {
  characters: CharacterDef[];
  abilities: AbilityDef[];
  projectiles: ProjectileDef[];
  maps: MapDef[];
  pets: PetDef[];
  rarities: Record<string, Omit<RarityDef, 'id'>>;
  skins: SkinDef[];
  modes: ModeDef[];
  chests: ChestDef[];
  shop: ShopDef;
  progression: ProgressionDef;
  achievements: AchievementDef[];
  titles: TitleDef[];
  events: EventDef[];
  obstacles: Record<ObstacleType, ObstacleTypeDef>;
  control: ControlTuning;
}

/**
 * Banco de conteúdo em memória. Indexa tudo por id e descarta (com aviso)
 * entradas inválidas em vez de quebrar o jogo inteiro.
 */
export class ContentDB {
  readonly characters = new Map<string, CharacterDef>();
  readonly abilities = new Map<string, AbilityDef>();
  readonly projectiles = new Map<string, ProjectileDef>();
  readonly maps = new Map<string, MapDef>();
  readonly pets = new Map<string, PetDef>();
  readonly rarities = new Map<RarityId, RarityDef>();
  readonly skins = new Map<string, SkinDef>();
  readonly modes = new Map<string, ModeDef>();
  readonly chests = new Map<string, ChestDef>();
  readonly titles = new Map<string, TitleDef>();
  readonly achievements: AchievementDef[];
  readonly events: EventDef[];
  readonly shop: ShopDef;
  readonly progression: ProgressionDef;
  readonly obstacles: Record<ObstacleType, ObstacleTypeDef>;
  readonly control: ControlTuning;
  readonly issues: ContentIssue[];

  constructor(raw: RawContent) {
    for (const [id, r] of Object.entries(raw.rarities)) this.rarities.set(id as RarityId, { ...r, id: id as RarityId });
    for (const p of raw.projectiles) this.projectiles.set(p.id, p);
    for (const a of raw.abilities) this.abilities.set(a.id, a);
    for (const s of raw.skins) this.skins.set(s.id, s);
    for (const p of raw.pets) this.pets.set(p.id, p);
    for (const m of raw.modes) this.modes.set(m.id, m);
    for (const c of raw.chests) this.chests.set(c.id, c);
    for (const t of raw.titles) this.titles.set(t.id, t);
    for (const m of raw.maps) this.maps.set(m.id, expandMapSymmetry(m));
    for (const c of raw.characters) this.characters.set(c.id, c);
    this.achievements = raw.achievements;
    this.events = raw.events;
    this.shop = raw.shop;
    this.progression = raw.progression;
    this.obstacles = raw.obstacles;
    this.control = raw.control;

    this.issues = validateContent(this);
    // Remove personagens/mapas com erro fatal (referência quebrada) — o jogo segue rodando.
    for (const issue of this.issues) {
      if (issue.level !== 'error') continue;
      if (issue.kind === 'character') this.characters.delete(issue.id);
      if (issue.kind === 'map') this.maps.delete(issue.id);
      if (issue.kind === 'pet') this.pets.delete(issue.id);
    }
  }

  rarity(id: RarityId): RarityDef {
    return this.rarities.get(id) ?? this.rarities.get('comum')!;
  }

  projectile(id: string): ProjectileDef {
    const p = this.projectiles.get(id);
    if (!p) throw new Error(`Projétil desconhecido: ${id}`);
    return p;
  }

  ability(id: string): AbilityDef {
    const a = this.abilities.get(id);
    if (!a) throw new Error(`Habilidade desconhecida: ${id}`);
    return a;
  }

  character(id: string): CharacterDef {
    const c = this.characters.get(id);
    if (!c) throw new Error(`Personagem desconhecido: ${id}`);
    return c;
  }

  /** Personagens ordenados por raridade e nome (para a coleção). */
  sortedCharacters(): CharacterDef[] {
    return [...this.characters.values()].sort(
      (a, b) => this.rarity(a.rarity).order - this.rarity(b.rarity).order || a.name.localeCompare(b.name, 'pt-BR'),
    );
  }

  sortedRarities(): RarityDef[] {
    return [...this.rarities.values()].sort((a, b) => a.order - b.order);
  }

  mapsForMode(modeId: string): MapDef[] {
    return [...this.maps.values()].filter((m) => m.modes.includes(modeId));
  }

  skinsFor(characterId: string): SkinDef[] {
    const c = this.characters.get(characterId);
    if (!c) return [];
    const out: SkinDef[] = [];
    for (const id of c.skins) {
      const s = this.skins.get(id);
      if (s) out.push(s);
    }
    for (const s of this.skins.values()) if (s.characterId === characterId && !out.includes(s)) out.push(s);
    return out;
  }
}
