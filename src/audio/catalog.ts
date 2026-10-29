/**
 * CATÁLOGO DE SONS
 * ----------------
 * Cada id aponta pra 1+ arquivos em public/audio/ (o jogo sorteia uma variação).
 * Os arquivos são GRAVAÇÕES reais CC0 (domínio público) processadas pelo
 * `npm run audio` (tools/build-audio.mjs) — créditos em public/audio/CREDITS.txt.
 *
 * Quer trocar um som? Coloque seu .mp3/.ogg em public/audio/ e mude o nome aqui.
 *   vol    → volume base (0..1)
 *   pitch  → variação aleatória de tom [mín, máx] (1 = normal)
 *   bus    → canal: sfx | ui | voice | music
 *   max    → quantos desse som tocam ao mesmo tempo (evita "parede" de som)
 *   gap    → intervalo mínimo entre dois disparos (segundos)
 */
export type Bus = 'sfx' | 'ui' | 'voice' | 'music';

export interface SoundDef {
  files: string[];
  vol?: number;
  pitch?: [number, number];
  bus?: Bus;
  max?: number;
  gap?: number;
}

const v = (n: string, count: number) => Array.from({ length: count }, (_, i) => `${n}_${i + 1}`);

export const SOUNDS: Record<string, SoundDef> = {
  // ------------------------------------------------------------ armas / ataques
  pistol: { files: v('pistol', 3), vol: 0.55, pitch: [0.92, 1.1], max: 6, gap: 0.03 },
  shotgun: { files: v('shotgun', 2), vol: 0.7, pitch: [0.92, 1.06], max: 4 },
  sniper: { files: v('sniper', 2), vol: 0.75, pitch: [0.95, 1.05], max: 3 },
  laser: { files: v('laser', 3), vol: 0.5, pitch: [0.9, 1.15], max: 5 },
  zap: { files: v('zap', 2), vol: 0.55, pitch: [0.9, 1.15], max: 4 },
  magic: { files: v('magic', 3), vol: 0.5, pitch: [0.9, 1.2], max: 5 },
  flame: { files: v('flame', 2), vol: 0.45, pitch: [0.9, 1.1], max: 3, gap: 0.08 },
  throw: { files: v('throw', 2), vol: 0.55, pitch: [0.9, 1.1], max: 4 },
  throw_light: { files: v('whoosh', 3), vol: 0.45, pitch: [1.05, 1.3], max: 5 },
  whoosh: { files: v('whoosh', 3), vol: 0.5, pitch: [0.9, 1.15], max: 5 },
  swing: { files: v('whoosh', 3), vol: 0.55, pitch: [0.85, 1.05], max: 5 },
  heavy_swing: { files: v('whoosh', 3), vol: 0.7, pitch: [0.6, 0.75], max: 4 },
  punch: { files: v('punch', 3), vol: 0.7, pitch: [0.9, 1.1], max: 5 },
  wave: { files: v('wave', 2), vol: 0.5, pitch: [0.9, 1.1], max: 4 },
  coin_shot: { files: v('coin', 3), vol: 0.5, pitch: [1.1, 1.4], max: 5 },
  boom: { files: v('explosion', 3), vol: 0.6, pitch: [1.1, 1.3], max: 4 },
  chain: { files: v('zap', 2), vol: 0.6, pitch: [0.8, 1], max: 3 },
  barrage: { files: v('pistol', 3), vol: 0.6, pitch: [0.8, 0.95], max: 4 },
  reload: { files: v('reload', 2), vol: 0.5, max: 3 },
  // ------------------------------------------------------------ habilidades
  dash: { files: v('dash', 2), vol: 0.55, pitch: [0.9, 1.15], max: 4 },
  blink: { files: v('blink', 2), vol: 0.55, pitch: [0.9, 1.2], max: 3 },
  heal: { files: v('heal', 2), vol: 0.5, max: 3 },
  shield: { files: v('shield', 2), vol: 0.55, max: 3 },
  stealth: { files: v('blink', 2), vol: 0.45, pitch: [0.6, 0.75], max: 2 },
  buff: { files: v('powerup', 2), vol: 0.5, max: 3 },
  deploy: { files: v('deploy', 2), vol: 0.55, max: 3 },
  summon: { files: v('summon', 2), vol: 0.55, max: 3 },
  wall: { files: v('wall_break', 2), vol: 0.5, pitch: [1.2, 1.4], max: 2 },
  freeze: { files: v('freeze', 2), vol: 0.55, max: 3 },
  rewind: { files: v('rewind', 1), vol: 0.6, max: 2 },
  zone: { files: v('zone', 2), vol: 0.5, max: 3 },
  // ------------------------------------------------------------ supers
  super_generic: { files: v('super', 3), vol: 0.75, max: 3 },
  super_shot: { files: v('super', 3), vol: 0.75, max: 3 },
  super_laser: { files: v('super_laser', 1), vol: 0.75, max: 2 },
  super_nuke: { files: v('explosion_big', 2), vol: 0.9, pitch: [0.8, 0.9], max: 2 },
  super_storm: { files: v('zap', 2), vol: 0.8, pitch: [0.6, 0.8], max: 2 },
  super_slam: { files: v('slam', 2), vol: 0.9, max: 2 },
  super_shield: { files: v('shield', 2), vol: 0.8, pitch: [0.7, 0.8], max: 2 },
  super_heal: { files: v('heal', 2), vol: 0.8, pitch: [0.8, 0.9], max: 2 },
  super_summon: { files: v('summon', 2), vol: 0.8, pitch: [0.7, 0.8], max: 2 },
  super_rain: { files: v('explosion', 3), vol: 0.7, pitch: [1.2, 1.4], max: 2 },
  super_barrage: { files: v('super', 3), vol: 0.75, max: 2 },
  super_shadow: { files: v('blink', 2), vol: 0.8, pitch: [0.5, 0.6], max: 2 },
  super_frenzy: { files: v('powerup', 2), vol: 0.8, pitch: [0.8, 0.9], max: 2 },
  super_charge: { files: v('dash', 2), vol: 0.85, pitch: [0.7, 0.8], max: 2 },
  // ------------------------------------------------------------ impacto / mundo
  hit: { files: v('hit', 3), vol: 0.5, pitch: [0.9, 1.15], max: 6, gap: 0.02 },
  hit_crit: { files: v('hit_crit', 2), vol: 0.7, pitch: [0.95, 1.05], max: 3 },
  hit_far: { files: v('hit', 3), vol: 0.25, pitch: [0.8, 1], max: 4, gap: 0.05 },
  hit_wall: { files: v('hit_wall', 2), vol: 0.35, pitch: [0.9, 1.2], max: 4, gap: 0.04 },
  hurt: { files: v('hurt', 3), vol: 0.6, pitch: [0.95, 1.1], max: 2, gap: 0.12 },
  kill: { files: v('kill', 2), vol: 0.8, max: 3 },
  explosion: { files: v('explosion', 3), vol: 0.75, pitch: [0.9, 1.1], max: 4 },
  explosion_big: { files: v('explosion_big', 2), vol: 0.95, pitch: [0.9, 1.05], max: 3 },
  wall_break: { files: v('wall_break', 2), vol: 0.7, pitch: [0.9, 1.1], max: 3 },
  glass_break: { files: v('glass', 2), vol: 0.65, pitch: [0.9, 1.1], max: 3 },
  wood_break: { files: v('wood_break', 2), vol: 0.65, pitch: [0.9, 1.1], max: 3 },
  wood_hit: { files: v('wood_hit', 2), vol: 0.4, pitch: [0.9, 1.2], max: 3, gap: 0.05 },
  metal_hit: { files: v('metal', 2), vol: 0.55, pitch: [0.9, 1.1], max: 3 },
  jump: { files: v('jump', 2), vol: 0.5, max: 3 },
  land: { files: v('land', 2), vol: 0.6, max: 3 },
  coin: { files: v('coin', 3), vol: 0.45, pitch: [0.95, 1.15], max: 4 },
  pickup: { files: v('pickup', 2), vol: 0.5, max: 3 },
  skull_pickup: { files: v('skull_pickup', 2), vol: 0.6, max: 3 },
  respawn: { files: v('respawn', 1), vol: 0.55 },
  super_ready: { files: v('super_ready', 1), vol: 0.6, bus: 'ui' },
  score_good: { files: v('score_good', 1), vol: 0.45, bus: 'ui', gap: 0.15 },
  score_bad: { files: v('score_bad', 1), vol: 0.4, bus: 'ui', gap: 0.15 },
  meteor_warn: { files: v('meteor', 1), vol: 0.55, max: 3 },
  wanted: { files: v('wanted', 1), vol: 0.6, bus: 'ui' },
  // ------------------------------------------------------------ locutor (voz real)
  vo_3: { files: ['vo_3'], vol: 0.9, bus: 'voice' },
  vo_2: { files: ['vo_2'], vol: 0.9, bus: 'voice' },
  vo_1: { files: ['vo_1'], vol: 0.9, bus: 'voice' },
  vo_fight: { files: ['vo_fight'], vol: 1, bus: 'voice' },
  vo_combo: { files: ['vo_combo'], vol: 0.85, bus: 'voice', gap: 1 },
  vo_multikill: { files: ['vo_multikill'], vol: 0.9, bus: 'voice', gap: 1 },
  vo_victory: { files: ['vo_victory'], vol: 1, bus: 'voice' },
  vo_defeat: { files: ['vo_defeat'], vol: 1, bus: 'voice' },
  // ------------------------------------------------------------ interface
  ui_click: { files: v('ui_click', 2), vol: 0.45, bus: 'ui', max: 3, gap: 0.03 },
  ui_back: { files: ['ui_back_1'], vol: 0.45, bus: 'ui' },
  ui_open: { files: ['ui_open_1'], vol: 0.45, bus: 'ui' },
  ui_tab: { files: ['ui_tab_1'], vol: 0.35, bus: 'ui', gap: 0.03 },
  ui_error: { files: ['ui_error_1'], vol: 0.5, bus: 'ui' },
  ui_buy: { files: ['ui_buy_1'], vol: 0.55, bus: 'ui' },
  ui_play: { files: ['ui_play_1'], vol: 0.6, bus: 'ui' },
  ui_reward: { files: ['ui_reward_1'], vol: 0.55, bus: 'ui', gap: 0.05 },
  ui_level: { files: ['ui_level_1'], vol: 0.6, bus: 'ui' },
  chest_drop: { files: ['chest_drop_1'], vol: 0.8, bus: 'ui' },
  chest_shake: { files: ['chest_shake_1'], vol: 0.6, bus: 'ui', gap: 0.08 },
  chest_open: { files: ['chest_open_1'], vol: 0.8, bus: 'ui' },
  card_flip: { files: ['card_flip_1'], vol: 0.5, bus: 'ui', gap: 0.05 },
  rare_reveal: { files: ['rare_reveal_1'], vol: 0.7, bus: 'ui' },
  epic_reveal: { files: ['epic_reveal_1'], vol: 0.8, bus: 'ui' },
  god_reveal: { files: ['god_reveal_1'], vol: 0.9, bus: 'ui' },
  skull_laugh: { files: ['skull_laugh_1'], vol: 0.9, bus: 'voice' },
  victory: { files: ['victory_1'], vol: 0.7, bus: 'ui' },
  defeat: { files: ['defeat_1'], vol: 0.65, bus: 'ui' },
  // ------------------------------------------------------------ música (loops)
  music_menu: { files: ['music_menu'], vol: 0.5, bus: 'music' },
  music_battle: { files: ['music_battle'], vol: 0.42, bus: 'music' },
  music_boss: { files: ['music_boss'], vol: 0.45, bus: 'music' },
};

/** Ids que não estão no catálogo caem num parecido (ex.: super_xyz → super_generic). */
export function resolveSound(id: string): SoundDef | null {
  if (SOUNDS[id]) return SOUNDS[id]!;
  if (id.startsWith('super_')) return SOUNDS.super_generic!;
  if (id.startsWith('vo_')) return null;
  return SOUNDS.pistol!;
}
