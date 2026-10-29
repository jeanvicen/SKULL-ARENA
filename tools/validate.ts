/**
 * npm run validar — confere TODO o conteúdo do jogo antes de publicar.
 *
 * Personagens, pets, mapas, modos, baús, eventos, códigos, passe, estrada,
 * missões, sons e folhas de sprite. Também roda uma partida rápida de BOTs em
 * cada mapa pra garantir que nada trava. Sai com erro (código 1) se achar problema.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOUNDS } from '../src/audio/catalog';
import { allCharacters, getCharacter, hasCharacter, HANDMADE, STARTERS, VICEN_ID } from '../src/content/characters';
import { CHEST, CHESTS, SHOP_CHESTS, DROP_REWARDS } from '../src/content/chests';
import { CODES } from '../src/content/codes';
import { EVENTS } from '../src/content/events';
import { MAPS, mapsForMode } from '../src/content/maps';
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from '../src/content/missions';
import { MODE, MODES } from '../src/content/modes';
import { PASS_TIERS } from '../src/content/pass';
import { allPets, getPet } from '../src/content/pets';
import { DAILY_REWARDS, TROPHY_ROAD } from '../src/content/progression';
import { RARITY, ROLES } from '../src/content/rarities';
import type { AbilityDef, Reward } from '../src/content/types';
import { GameMap } from '../src/sim/map';
import { runBotMatch } from '../tests/helpers';
import { ROOT } from './lib';

const errors: string[] = [];
const warns: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warns.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

console.log('\nSKULL ARENA — validando conteúdo…\n');

// ------------------------------------------------------------- personagens
const chars = allCharacters();
const ids = new Set<string>();
const names = new Set<string>();
const checkAbility = (cid: string, ab: AbilityDef, slot: string) => {
  if (!ab || !ab.effects?.length) err(`${cid}: ${slot} sem efeitos`);
  if (!ab.name) err(`${cid}: ${slot} sem nome`);
  if (ab.range < 0) err(`${cid}: ${slot} alcance negativo`);
};
for (const c of chars) {
  if (ids.has(c.id)) err(`personagem com id repetido: ${c.id}`);
  ids.add(c.id);
  if (names.has(c.name.toLowerCase())) err(`nome repetido: ${c.name}`);
  names.add(c.name.toLowerCase());
  if (!RARITY[c.rarity]) err(`${c.id}: raridade inválida ${c.rarity}`);
  if (!ROLES[c.role]) err(`${c.id}: função inválida ${c.role}`);
  if (!(c.stats.hp > 0) || !(c.stats.speed > 0) || !(c.stats.superRate > 0)) err(`${c.id}: atributos inválidos`);
  if (c.skills.length > 3) err(`${c.id}: mais de 3 habilidades (só existem botões Q/E/R)`);
  checkAbility(c.id, c.attack, 'ataque');
  c.skills.forEach((s, i) => checkAbility(c.id, s, `habilidade ${i + 1}`));
  checkAbility(c.id, c.super, 'super');
  if (!c.bio?.historia?.length) err(`${c.id}: sem história`);
  if (c.sheet) {
    const src = typeof c.sheet === 'string' ? c.sheet : c.sheet.src;
    if (!src.startsWith('data:') && !existsSync(join(ROOT, 'public', src))) err(`${c.id}: folha de sprite não encontrada em public/${src}`);
  }
  if (c.unlock.kind === 'trophyRoad' && !TROPHY_ROAD.some((s) => s.rewards.some((r) => r.kind === 'character' && r.id === c.id)))
    warn(`${c.id}: desbloqueio por troféus mas não está na Estrada da Morte`);
}
for (const s of STARTERS) if (!hasCharacter(s)) err(`personagem inicial não existe: ${s}`);
if (!hasCharacter(VICEN_ID) || getCharacter(VICEN_ID).rarity !== 'creators') err('Vicen₹ precisa existir e ser CREATORs');
if (chars.length < 500) warn(`só ${chars.length} personagens (meta: 500+)`);
ok(`${chars.length} personagens (${HANDMADE.length} feitos à mão)`);

// ------------------------------------------------------------- pets
const pets = allPets();
const pids = new Set<string>();
for (const p of pets) {
  if (pids.has(p.id)) err(`pet com id repetido: ${p.id}`);
  pids.add(p.id);
  if (!RARITY[p.rarity]) err(`${p.id}: raridade inválida`);
  if (p.colors.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) err(`${p.id}: cor inválida`);
  if (p.sheet && !existsSync(join(ROOT, 'public', p.sheet))) err(`${p.id}: sprite não encontrado public/${p.sheet}`);
}
if (pets.length < 500) warn(`só ${pets.length} pets (meta: 500+)`);
ok(`${pets.length} pets`);

// ------------------------------------------------------------- mapas e modos
for (const m of MAPS) {
  try {
    const gm = new GameMap(m);
    const s = gm.spawns;
    if (m.modes.some((x) => MODE[x]?.teams === 2) && (!s.teamA.length || !s.teamB.length)) err(`mapa ${m.id}: modo de equipes sem spawns A e Z`);
    if (m.modes.some((x) => MODE[x]?.teams === 0) && s.free.length < 4) err(`mapa ${m.id}: FFA precisa de spawns (S/A/Z)`);
    for (const md of m.modes) if (!MODE[md]) err(`mapa ${m.id}: modo desconhecido ${md}`);
  } catch (e) {
    err(`mapa ${m.id}: ${(e as Error).message}`);
  }
}
for (const md of MODES) if (!mapsForMode(md.id).length) err(`modo ${md.id} sem nenhum mapa`);
ok(`${MAPS.length} mapas · ${MODES.length} modos`);

// ------------------------------------------------------------- prêmios
const checkReward = (where: string, r: Reward) => {
  if (r.kind === 'character' && !hasCharacter(r.id)) err(`${where}: personagem inexistente ${r.id}`);
  if (r.kind === 'pet' && !getPet(r.id)) err(`${where}: pet inexistente ${r.id}`);
  if (r.kind === 'chest' && !CHEST[r.id]) err(`${where}: baú inexistente ${r.id}`);
  if ((r.kind === 'randomCharacter' || r.kind === 'randomPet') && !RARITY[r.rarity]) err(`${where}: raridade inválida`);
  if ((r.kind === 'moedas' || r.kind === 'isvoid' || r.kind === 'xp' || r.kind === 'passXp') && !(r.amount > 0)) err(`${where}: quantidade inválida`);
};
for (const c of CHESTS) {
  const sum = Object.values(c.characterOdds).reduce((a, b) => a + (b ?? 0), 0) + Object.values(c.petOdds).reduce((a, b) => a + (b ?? 0), 0);
  if (sum > 1) err(`baú ${c.id}: chances somam ${(sum * 100).toFixed(1)}% (máx 100%)`);
  if (c.moedas[0] > c.moedas[1]) err(`baú ${c.id}: moedas min > max`);
}
for (const id of SHOP_CHESTS) if (!CHEST[id]?.price) err(`baú da loja ${id} sem preço`);
for (const [r, list] of Object.entries(DROP_REWARDS)) list.forEach((x) => checkReward(`drop ${r}`, x.r));
ok(`${CHESTS.length} baús (chances conferidas)`);

const now = Date.now();
for (const e of EVENTS) {
  const a = Date.parse(e.start);
  const b = Date.parse(e.end);
  if (Number.isNaN(a) || Number.isNaN(b)) err(`evento ${e.id}: data inválida`);
  else if (b <= a) err(`evento ${e.id}: termina antes de começar`);
  if (e.modeId && !MODE[e.modeId]) err(`evento ${e.id}: modo inexistente ${e.modeId}`);
  if (e.chestId && !CHEST[e.chestId]) err(`evento ${e.id}: baú inexistente ${e.chestId}`);
  if (e.featuredCharacter && !hasCharacter(e.featuredCharacter)) err(`evento ${e.id}: destaque inexistente`);
  (e.loginGift ?? []).forEach((r) => checkReward(`evento ${e.id}`, r));
  (e.missions ?? []).forEach((m) => m.rewards.forEach((r) => checkReward(`evento ${e.id}/${m.id}`, r)));
  if (b < now) warn(`evento ${e.id} já acabou (pode apagar)`);
}
ok(`${EVENTS.length} eventos`);

const codes = new Set<string>();
for (const c of CODES) {
  const k = c.code.toUpperCase();
  if (codes.has(k)) err(`código repetido: ${k}`);
  codes.add(k);
  if (!c.rewards.length) err(`código ${k} sem prêmio`);
  c.rewards.forEach((r) => checkReward(`código ${k}`, r));
}
ok(`${CODES.length} códigos`);

PASS_TIERS.forEach((t, i) => [...t.free, ...t.premium].forEach((r) => checkReward(`passe nível ${i + 1}`, r)));
TROPHY_ROAD.forEach((s) => s.rewards.forEach((r) => checkReward(`estrada ${s.trophies}`, r)));
DAILY_REWARDS.forEach((d, i) => d.forEach((r) => checkReward(`diário ${i + 1}`, r)));
[...DAILY_MISSIONS, ...WEEKLY_MISSIONS].forEach((m) => m.rewards.forEach((r) => checkReward(`missão ${m.id}`, r)));
ok(`passe (${PASS_TIERS.length} níveis), estrada (${TROPHY_ROAD.length}), diário, missões`);

// ------------------------------------------------------------- sons
let missing = 0;
for (const [id, d] of Object.entries(SOUNDS))
  for (const f of d.files)
    if (!existsSync(join(ROOT, 'public/audio', `${f}.mp3`))) {
      missing++;
      warn(`som ${id}: falta public/audio/${f}.mp3 (rode npm run audio)`);
    }
ok(`${Object.keys(SOUNDS).length} sons no catálogo${missing ? ` (${missing} arquivos faltando)` : ''}`);

// ------------------------------------------------------------- partida rápida
for (const m of MAPS) {
  const mode = m.modes[0]!;
  try {
    const r = runBotMatch({ mode, map: m.id, seed: 7, maxSeconds: 12 });
    if (!r.events) warn(`mapa ${m.id}: partida de teste sem nenhum evento`);
  } catch (e) {
    err(`partida de teste em ${m.id} (${mode}) quebrou: ${(e as Error).message}`);
  }
}
ok('partida de 12s com BOTs em cada mapa');

console.log('');
for (const w of warns) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(errors.length ? `\n✗ ${errors.length} erro(s). Arrume antes de publicar.\n` : `\n✔ Tudo certo!${warns.length ? ` (${warns.length} aviso(s))` : ''}\n`);
process.exit(errors.length ? 1 : 0);
