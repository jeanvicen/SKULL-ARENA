import type {
  AbilityDef, AchievementDef, CharacterDef, ChestDef, ControlTuning, EventDef, MapDef, ModeDef,
  ObstacleType, ObstacleTypeDef, PetDef, ProgressionDef, ProjectileDef, RarityDef, ShopDef, SkinDef, TitleDef,
} from './types';
import { ContentDB, type RawContent } from './registry';

import rarities from '../../data/rarities.json';
import skins from '../../data/skins.json';
import modes from '../../data/modes.json';
import chests from '../../data/chests.json';
import shop from '../../data/shop.json';
import progression from '../../data/progression.json';
import achievements from '../../data/achievements.json';
import titles from '../../data/titles.json';
import events from '../../data/events.json';
import obstacles from '../../data/obstacles.json';
import control from '../../data/control.json';

/**
 * Carrega TODO o conteúdo de /data. Personagens, tiros, habilidades, pets e
 * mapas são descobertos automaticamente por glob: para adicionar o personagem
 * nº 1000, basta soltar um JSON em /data/characters — zero código.
 * (eager = embutido no bundle → funciona offline via Service Worker.)
 */
const characters = import.meta.glob<CharacterDef>('../../data/characters/*.json', { eager: true, import: 'default' });
const abilities = import.meta.glob<AbilityDef>('../../data/abilities/*.json', { eager: true, import: 'default' });
const projectiles = import.meta.glob<ProjectileDef>('../../data/projectiles/*.json', { eager: true, import: 'default' });
const maps = import.meta.glob<MapDef>('../../data/maps/*.json', { eager: true, import: 'default' });
const pets = import.meta.glob<PetDef>('../../data/pets/*.json', { eager: true, import: 'default' });

export function rawContent(): RawContent {
  return {
    characters: Object.values(characters),
    abilities: Object.values(abilities),
    projectiles: Object.values(projectiles),
    maps: Object.values(maps),
    pets: Object.values(pets),
    rarities: rarities as unknown as Record<string, Omit<RarityDef, 'id'>>,
    skins: skins as unknown as SkinDef[],
    modes: modes as unknown as ModeDef[],
    chests: chests as unknown as ChestDef[],
    shop: shop as unknown as ShopDef,
    progression: progression as unknown as ProgressionDef,
    achievements: achievements as unknown as AchievementDef[],
    titles: titles as unknown as TitleDef[],
    events: events as unknown as EventDef[],
    obstacles: obstacles as unknown as Record<ObstacleType, ObstacleTypeDef>,
    control: control as unknown as ControlTuning,
  };
}

let db: ContentDB | null = null;

export function loadContent(): ContentDB {
  if (!db) {
    db = new ContentDB(rawContent());
    for (const issue of db.issues) {
      (issue.level === 'error' ? console.error : console.warn)(`[conteúdo] ${issue.kind}:${issue.id} — ${issue.message}`);
    }
  }
  return db;
}
