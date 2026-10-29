#!/usr/bin/env node
/**
 * npm run audio — gera public/audio/*.mp3 a partir de GRAVAÇÕES CC0 (domínio público).
 *
 * Fontes (baixe uma vez numa pasta e aponte AUDIO_SRC pra ela):
 *   git clone --depth 1 https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds  $AUDIO_SRC/L
 *   git clone --depth 1 https://github.com/jupixels/game-sounds                     $AUDIO_SRC/J
 *   git clone --depth 1 https://github.com/Shunding-L/tauhuke-assets                $AUDIO_SRC/S
 *
 *   AUDIO_SRC=/caminho/das/fontes npm run audio
 *
 * Precisa do ffmpeg instalado. Cada som:
 *   1) corta o silêncio do começo   2) corta no tamanho máximo com fade
 *   3) normaliza o pico (-1 dB)      4) mono 44,1 kHz MP3 (música: estéreo)
 * Quer trocar um som? Mude o caminho no MAPA abaixo e rode de novo.
 * Usamos SÓ arquivos CC0 → não precisa dar crédito, mas listamos em CREDITS.txt.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.AUDIO_SRC ?? join(process.cwd(), 'audio-src');
const OUT = join(process.cwd(), 'public', 'audio');
const ROOTS = {
  L: 'L', // lavenderdotpet/CC0-Public-Domain-Sounds
  J: 'J/sounds', // jupixels/game-sounds (só as pastas Kenney/CC0)
  S: 'S/music', // Shunding-L/tauhuke-assets (músicas CC0 do OpenGameArt)
};
// pastas alternativas (nome que o `git clone` cria)
const ALT = {
  L: ['L', 'lavenderdotpet_CC0-Public-Domain-Sounds', 'CC0-Public-Domain-Sounds'],
  J: ['J/sounds', 'jupixels_game-sounds/sounds', 'game-sounds/sounds'],
  S: ['S/music', 'Shunding-L_tauhuke-assets/music', 'tauhuke-assets/music'],
};

const WF = 'L:warfork-cc0/sounds';
const BFH = 'L:75-cc0-breaking-falling-hit-sfx';
const WOOSH = 'L:Micro Pack - Organic Wooshes';
const VO = 'L:kenney_voiceoverfighter/Audio';

/**
 * MAPA: nome final → { src, max (s), fade (s), pitch (fator), extra (filtros ffmpeg) }
 * O nome final é o que o catálogo (src/audio/catalog.ts) usa.
 */
const MAP = {
  // armas de verdade (gravações)
  pistol_1: { src: 'L:25-CC0-bang-sfx/shot_01.ogg', max: 0.45 },
  pistol_2: { src: 'L:25-CC0-bang-sfx/shot_02.ogg', max: 0.4 },
  pistol_3: { src: `${WF}/weapons/machinegun_fire.ogg`, max: 0.35 },
  shotgun_1: { src: `${WF}/weapons/riotgun_fire_strong.ogg`, max: 0.9 },
  shotgun_2: { src: 'L:25-CC0-bang-sfx/cannon_01.ogg', max: 0.8, pitch: 1.3 },
  sniper_1: { src: 'J:ww2/rifle_shot_01.mp3', max: 0.9 },
  sniper_2: { src: 'J:ww2/rifle_shot_03.mp3', max: 0.9 },
  laser_1: { src: 'J:scifi/laser_small_01.mp3', max: 0.5 },
  laser_2: { src: 'J:scifi/laser_small_02.mp3', max: 0.5 },
  laser_3: { src: 'J:scifi/laser_small_03.mp3', max: 0.5 },
  zap_1: { src: `${WF}/weapons/electrobolt_strong.ogg`, max: 0.8 },
  zap_2: { src: `${WF}/weapons/electrobolt_hit.ogg`, max: 0.6 },
  magic_1: { src: 'L:80-CC0-RPG-SFX/spell_01.ogg', max: 0.9 },
  magic_2: { src: 'L:80-CC0-RPG-SFX/spell_02.ogg', max: 0.9 },
  magic_3: { src: `${WF}/weapons/plasmagun_strong1.ogg`, max: 0.6 },
  flame_1: { src: 'L:80-CC0-RPG-SFX/spell_fire_01.ogg', max: 0.8 },
  flame_2: { src: 'L:80-CC0-RPG-SFX/spell_fire_03.ogg', max: 0.8 },
  throw_1: { src: `${WOOSH}/Swish 1.wav`, max: 0.6 },
  throw_2: { src: `${WOOSH}/Swish 3.wav`, max: 0.6 },
  whoosh_1: { src: `${WOOSH}/Classic Swish 1.wav`, max: 0.5 },
  whoosh_2: { src: `${WOOSH}/Classic Swish 2.wav`, max: 0.5 },
  whoosh_3: { src: `${WOOSH}/Swish 5.wav`, max: 0.5 },
  punch_1: { src: 'J:impacts/punch_medium_01.mp3', max: 0.5 },
  punch_2: { src: 'J:impacts/punch_medium_02.mp3', max: 0.5 },
  punch_3: { src: 'J:impacts/punch_medium_03.mp3', max: 0.5 },
  wave_1: { src: 'J:scifi/force_field_03.mp3', max: 0.8, pitch: 0.8 },
  wave_2: { src: 'J:scifi/laser_large_02.mp3', max: 0.8, pitch: 0.7 },
  coin_1: { src: 'L:80-CC0-RPG-SFX/item_coins_01.ogg', max: 0.6 },
  coin_2: { src: 'L:80-CC0-RPG-SFX/item_coins_02.ogg', max: 0.6 },
  coin_3: { src: 'J:rpg/coins_01.mp3', max: 0.6 },
  reload_1: { src: 'J:rpg/metal_click_01.mp3', max: 0.5 },
  reload_2: { src: 'J:rpg/metal_latch_01.mp3', max: 0.6 },
  // habilidades
  dash_1: { src: `${WOOSH}/Twirl 1.wav`, max: 0.6 },
  dash_2: { src: `${WOOSH}/Twirl 2.wav`, max: 0.6 },
  blink_1: { src: `${WF}/world/tele_in.ogg`, max: 0.9 },
  blink_2: { src: 'J:arcade/phaser_up_03.mp3', max: 0.6 },
  heal_1: { src: `${WF}/items/health_25.ogg`, max: 1 },
  heal_2: { src: `${WF}/items/regen_pickup.ogg`, max: 1 },
  shield_1: { src: 'J:scifi/force_field_01.mp3', max: 1 },
  shield_2: { src: `${WF}/items/armor_yellow.ogg`, max: 1 },
  powerup_1: { src: `${WF}/items/quad_pickup.ogg`, max: 1.2 },
  powerup_2: { src: 'J:arcade/power_up_11.mp3', max: 1 },
  deploy_1: { src: 'L:100-CC0-wood-metal-SFX/metal_open_01.ogg', max: 0.8 },
  deploy_2: { src: 'J:rpg/metal_latch_01.mp3', max: 0.6 },
  summon_1: { src: 'L:80-CC0-RPG-SFX/creature_roar_01.ogg', max: 1.2 },
  summon_2: { src: 'L:80-CC0-RPG-SFX/creature_monster_02.ogg', max: 1.2 },
  freeze_1: { src: `${BFH}/bfh1_glass_breaking_03.ogg`, max: 0.9, pitch: 1.2 },
  freeze_2: { src: 'J:impacts/glass_medium_02.mp3', max: 0.7 },
  rewind_1: { src: `${WOOSH}/Twirl 3.wav`, max: 1, extra: 'areverse' },
  zone_1: { src: 'J:scifi/slime_01.mp3', max: 0.9 },
  zone_2: { src: 'L:80-CC0-RPG-SFX/creature_slime_02.ogg', max: 0.9 },
  // supers
  super_1: { src: `${WF}/weapons/bladegun_strong_fire.ogg`, max: 1.2 },
  super_2: { src: `${WF}/weapons/instagun_strong.ogg`, max: 1.2 },
  super_3: { src: `${WF}/weapons/rocket_fire_strong.ogg`, max: 1.2 },
  super_laser_1: { src: `${WF}/weapons/laser_strong_fire.ogg`, max: 1.4 },
  slam_1: { src: 'J:impacts/punch_heavy_03.mp3', max: 0.8, pitch: 0.7 },
  slam_2: { src: `${BFH}/bfh1_rock_hit_01.ogg`, max: 1 },
  // impactos / mundo
  hit_1: { src: `${WF}/misc/hit_0.wav`, max: 0.4 },
  hit_2: { src: `${WF}/misc/hit_1.wav`, max: 0.4 },
  hit_3: { src: 'J:impacts/soft_heavy_01.mp3', max: 0.4 },
  hit_crit_1: { src: 'J:impacts/punch_heavy_01.mp3', max: 0.6 },
  hit_crit_2: { src: 'J:impacts/punch_heavy_02.mp3', max: 0.6 },
  hit_wall_1: { src: `${WF}/weapons/ric1.ogg`, max: 0.6 },
  hit_wall_2: { src: `${WF}/weapons/ric2.ogg`, max: 0.6 },
  hurt_1: { src: `${WF}/players/male/pain25.ogg`, max: 0.8 },
  hurt_2: { src: `${WF}/players/male/pain50.ogg`, max: 0.8 },
  hurt_3: { src: `${WF}/players/female/pain50.ogg`, max: 0.8 },
  kill_1: { src: `${WF}/misc/kill.wav`, max: 1 },
  kill_2: { src: `${BFH}/bfh1_breaking_02.ogg`, max: 0.9 },
  explosion_1: { src: `${WF}/weapons/gren_strong_explosion1.ogg`, max: 1.6 },
  explosion_2: { src: `${WF}/weapons/gren_strong_explosion2.ogg`, max: 1.6 },
  explosion_3: { src: `${WF}/weapons/rocket_strong_explosion.ogg`, max: 1.6 },
  explosion_big_1: { src: 'J:ww2/artillery_04.mp3', max: 2.2 },
  explosion_big_2: { src: 'J:ww2/howitzer_02.mp3', max: 2.2 },
  wall_break_1: { src: `${BFH}/bfh1_rock_breaking_01.ogg`, max: 1.4 },
  wall_break_2: { src: `${BFH}/bfh1_rock_breaking_02.ogg`, max: 1.4 },
  glass_1: { src: `${BFH}/bfh1_glass_breaking_01.ogg`, max: 1.4 },
  glass_2: { src: `${BFH}/bfh1_glass_breaking_02.ogg`, max: 1.4 },
  wood_break_1: { src: `${BFH}/bfh1_wood_breaking_01.ogg`, max: 1.2 },
  wood_break_2: { src: `${BFH}/bfh1_wood_breaking_02.ogg`, max: 1.2 },
  wood_hit_1: { src: 'L:100-CC0-wood-metal-SFX/wood_hit_01.ogg', max: 0.5 },
  wood_hit_2: { src: 'L:100-CC0-wood-metal-SFX/wood_hit_04.ogg', max: 0.5 },
  metal_1: { src: `${BFH}/bfh1_metal_hit_01.ogg`, max: 0.8 },
  metal_2: { src: `${BFH}/bfh1_metal_hit_02.ogg`, max: 0.8 },
  jump_1: { src: `${WF}/players/male/jump_1.ogg`, max: 0.6 },
  jump_2: { src: `${WF}/players/female/jump_1.ogg`, max: 0.6 },
  land_1: { src: 'J:impacts/soft_medium_01.mp3', max: 0.5 },
  land_2: { src: 'J:impacts/soft_medium_02.mp3', max: 0.5 },
  pickup_1: { src: `${WF}/items/ammo_pickup.ogg`, max: 0.7 },
  pickup_2: { src: `${WF}/items/shell_pickup.ogg`, max: 0.7 },
  skull_pickup_1: { src: `${BFH}/bfh1_misc_02.ogg`, max: 0.6 },
  skull_pickup_2: { src: 'L:80-CC0-RPG-SFX/item_stone_02.ogg', max: 0.6 },
  respawn_1: { src: `${WF}/world/player_respawn.ogg`, max: 1.4 },
  super_ready_1: { src: `${WF}/items/quad_spawn.ogg`, max: 1.2 },
  score_good_1: { src: 'J:arcade/two_tone_01.mp3', max: 0.6 },
  score_bad_1: { src: 'J:arcade/low_down_01.mp3', max: 0.6 },
  meteor_1: { src: `${WF}/weapons/rocket_fly_strong.ogg`, max: 1.4 },
  wanted_1: { src: 'J:ww2/air_raid_siren_02.mp3', max: 1.8, fade: 0.6 },
  // locutor (voz gravada)
  vo_3: { src: `${VO}/3.ogg`, max: 1.2 },
  vo_2: { src: `${VO}/2.ogg`, max: 1.2 },
  vo_1: { src: `${VO}/1.ogg`, max: 1.2 },
  vo_fight: { src: `${VO}/fight.ogg`, max: 1.5 },
  vo_combo: { src: `${VO}/combo.ogg`, max: 1.5 },
  vo_multikill: { src: `${VO}/multi_kill.ogg`, max: 1.8 },
  vo_victory: { src: `${VO}/you_win.ogg`, max: 2 },
  vo_defeat: { src: `${VO}/you_lose.ogg`, max: 2 },
  // interface
  ui_click_1: { src: 'J:ui/click_01.mp3', max: 0.3 },
  ui_click_2: { src: 'J:ui/click_02.mp3', max: 0.3 },
  ui_back_1: { src: 'J:ui/back_01.mp3', max: 0.4 },
  ui_open_1: { src: 'J:ui/open_01.mp3', max: 0.5 },
  ui_tab_1: { src: 'J:ui/switch_01.mp3', max: 0.3 },
  ui_error_1: { src: 'J:ui/error_01.mp3', max: 0.6 },
  ui_buy_1: { src: 'J:rpg/coins_02.mp3', max: 0.8 },
  ui_play_1: { src: 'J:ui/confirm_01.mp3', max: 0.8 },
  ui_reward_1: { src: 'J:arcade/pep_05.mp3', max: 0.6 },
  ui_level_1: { src: 'J:arcade/power_up_10.mp3', max: 1.2 },
  chest_drop_1: { src: 'J:impacts/wood_heavy_02.mp3', max: 0.8 },
  chest_shake_1: { src: 'L:80-CC0-RPG-SFX/chain_02.ogg', max: 0.6 },
  chest_open_1: { src: 'J:rpg/creak_01.mp3', max: 1.2 },
  card_flip_1: { src: 'J:tabletop/card_slide_01.mp3', max: 0.5 },
  rare_reveal_1: { src: 'J:jingles/jingle_hit_03.mp3', max: 2 },
  epic_reveal_1: { src: 'J:jingles/jingle_hit_09.mp3', max: 2.5 },
  god_reveal_1: { src: 'J:jingles/jingle_sax_05.mp3', max: 3 },
  victory_1: { src: 'J:jingles/jingle_sax_01.mp3', max: 3.5 },
  defeat_1: { src: 'J:jingles/jingle_sax_14.mp3', max: 3.5 },
  // risada da caveira (abertura): risada humana gravada + efeito glitch
  skull_laugh_1: {
    src: 'L:BB_Retail Therapy Sample Pack/Laughing on Company Time.wav',
    max: 2.6,
    fade: 0.4,
    pitch: 0.82,
    // gaguejo (repete pedacinhos), "bitcrush" e eco = risada quebrada
    glitch: true,
  },
  // música (loops)
  music_menu: { src: 'L:warfork-cc0/music/fvi-HippetyHop.ogg', max: 116, fade: 2, music: true },
  music_battle: { src: 'S:game-virtual-rush.mp3', max: 150, fade: 2, music: true },
  music_boss: { src: 'S:game-pursuit.mp3', max: 74, fade: 1.5, music: true },
};

// ---------------------------------------------------------------------------

function resolve(spec) {
  const [k, rel] = [spec.slice(0, 1), spec.slice(2)];
  for (const base of ALT[k] ?? [ROOTS[k]]) {
    const p = join(SRC, base, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

function ff(args) {
  return execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Pico (dB) do áudio depois dos filtros — o ffmpeg escreve o relatório no stderr. */
function maxVolume(file, filters) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `${filters},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /max_volume: (-?[\d.]+) dB/.exec(r.stderr ?? '');
  return m ? Number(m[1]) : -1;
}

function build(name, o) {
  const src = resolve(o.src);
  if (!src) return { name, ok: false, why: `não achei ${o.src}` };
  const fade = o.fade ?? Math.min(0.15, o.max * 0.3);
  const chain = [];
  if (!o.music) chain.push('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005');
  if (o.pitch) chain.push(`asetrate=44100*${o.pitch},aresample=44100`);
  if (o.extra) chain.push(o.extra);
  if (o.glitch) {
    // gaguejo: repete o começo, depois segue; bitcrush leve e eco curto
    chain.push('aloop=loop=2:size=6000:start=0', 'acrusher=bits=8:mode=log:aa=1:mix=0.35', 'aecho=0.7:0.6:45|90:0.35|0.2', 'atempo=1.08');
  }
  chain.push(`atrim=0:${o.max}`, `afade=t=out:st=${Math.max(0, o.max - fade)}:d=${fade}`);
  if (o.music) chain.push('afade=t=in:st=0:d=0.8');
  const pre = chain.join(',');
  const peak = maxVolume(src, `aresample=44100,${pre}`);
  const gain = Math.min(30, -1 - peak);
  const out = join(OUT, `${name}.mp3`);
  ff(['-i', src, '-af', `aresample=44100,${pre},volume=${gain.toFixed(2)}dB`, '-ac', o.music ? '2' : '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', o.music ? '96k' : '80k', out]);
  return { name, ok: true, src: o.src };
}

mkdirSync(OUT, { recursive: true });
const results = [];
for (const [name, o] of Object.entries(MAP)) {
  try {
    results.push(build(name, o));
  } catch (e) {
    results.push({ name, ok: false, why: String(e.stderr ?? e.message).slice(0, 200) });
  }
  const r = results[results.length - 1];
  process.stdout.write(r.ok ? '.' : `\n✗ ${name}: ${r.why}\n`);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} sons gerados em public/audio/`);

const credits = `SKULL ARENA — créditos de áudio
================================
Todos os sons e músicas são CC0 (domínio público): uso livre, inclusive comercial,
sem obrigação de crédito. Mesmo assim, valeu demais a quem gravou:

• Kenney (kenney.nl) — Impact Sounds, Interface Sounds, UI Audio, RPG Audio, Sci-fi Sounds,
  Music Jingles, Voiceover Pack: Fighter (via github.com/jupixels/game-sounds e
  github.com/lavenderdotpet/CC0-Public-Domain-Sounds)
• Team Forbidden — Warfork (assets CC0): armas, itens, dor/pulo, músicas "fvi-*"
• Pacotes "25 CC0 bang SFX", "75 CC0 breaking/falling/hit SFX", "80 CC0 RPG SFX" e
  "100 CC0 wood/metal SFX" (OpenGameArt, coletados em lavenderdotpet/CC0-Public-Domain-Sounds)
• Ben Burnes / Abstraction Music — Retail Therapy Sample Pack, Micro Pack Organic Wooshes
• Tabasco (OpenGameArt "Gunshot Sounds") — tiros de rifle
• qubodup (Freesound) — artilharia/obus
• nooly (Freesound) — sirene antiaérea
• vitalezzz (OpenGameArt) — "Virtual Rush" (música de batalha)
• Sudocolon (OpenGameArt) — "Vicegrip of Pursuit" (música do chefão)

Arquivo → fonte:
${results
  .filter((r) => r.ok)
  .map((r) => `  ${r.name}.mp3  ←  ${r.src}`)
  .join('\n')}
`;
writeFileSync(join(OUT, 'CREDITS.txt'), credits);
console.log('CREDITS.txt atualizado.');
