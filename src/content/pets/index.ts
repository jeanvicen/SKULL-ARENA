import { Rng } from '../../engine/rng';
import { RARITY } from '../rarities';
import type { PetBody, PetBonus, PetDef, RarityId } from '../types';

/**
 * PETS — seguem o personagem e dão um bônus PEQUENO e claro.
 * Feitos à mão em HANDMADE_PETS + gerados (GENERATED_PETS). Total passa de 500.
 * Pra criar um pet novo: copie um item de HANDMADE_PETS (ou `npm run novo:pet`).
 */

export const HANDMADE_PETS: PetDef[] = [
  { id: 'pet_morcego', name: 'Chiclete', rarity: 'comum', desc: 'Morceguinho que dorme de cabeça pra baixo no seu capuz. Dá uma faísca fraca de vez em quando.', body: 'bat', colors: ['#3a2a4a', '#ff8de8', '#ffe14d'], motion: 'flap', bonus: { spark: { damage: 160, interval: 3, range: 380 } }, handmade: true, unlock: { kind: 'starter' } },
  { id: 'pet_corvo', name: 'Neon', rarity: 'incomum', desc: 'Corvo que roubou um letreiro e ficou brilhando. Enxerga quem está escondido no arbusto perto de você.', body: 'crow', colors: ['#1c1a24', '#3df2ff', '#ff3df2'], motion: 'flap', bonus: { revealRadius: 260 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_gato', name: 'Sete', rarity: 'raro', desc: 'Gato fantasma com sete rabos. Quando sua vida fica baixa, solta um escudo (1x por vida).', body: 'cat', colors: ['#d8e6ff', '#7a3dff', '#56f2a0'], motion: 'hop', bonus: { lowHpShield: 1200 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_gosma', name: 'Pudim', rarity: 'comum', desc: 'Gosma de groselha que pula atrás de você e cura um pouquinho o tempo todo.', body: 'slime', colors: ['#ff4f7b', '#ffd0dc', '#2a1020'], motion: 'bounce', bonus: { regen: 30 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_drone', name: 'Bip', rarity: 'incomum', desc: 'Drone de entrega que perdeu o emprego. Te deixa um pouco mais rápido.', body: 'drone', colors: ['#c9ccd6', '#ff7a2e', '#58ffd0'], motion: 'float', bonus: { speed: 0.04 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_cranio', name: 'Risadinha', rarity: 'epico', desc: 'Um crânio flutuante que ri igual à caveira da abertura. Acelera seu super.', body: 'skull', colors: ['#efe6d2', '#ff3df2', '#3df2ff'], motion: 'orbit', bonus: { superCharge: 0.08, spark: { damage: 220, interval: 2.6, range: 420 } }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_dragao', name: 'Brasinha', rarity: 'god', desc: 'Filhote de dragão que o Brasa achou numa chapa. Cospe fogo e aumenta seu dano.', body: 'dragon', colors: ['#d6453a', '#ffd23f', '#ff8a3d'], motion: 'flap', bonus: { damage: 0.05, spark: { damage: 300, interval: 2.2, range: 460 } }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_olho', name: 'Vigia', rarity: 'extremo', desc: 'Um olho do Vazio que nunca pisca. Revela arbustos de longe e acelera a recarga.', body: 'eye', colors: ['#2a1a40', '#b77bff', '#ffffff'], motion: 'float', bonus: { revealRadius: 340, reload: 0.05 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_cristal', name: 'Isvoidinho', rarity: 'creators', desc: 'Um fragmento vivo de Isvoid. Só os CREATORs sabem de onde veio. Dá um pouco de tudo.', body: 'crystal', colors: ['#ff3df2', '#3df2ff', '#ffffff'], motion: 'orbit', bonus: { damage: 0.05, speed: 0.04, regen: 50, superCharge: 0.08, coinBonus: 0.1 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_coruja', name: 'Doutora', rarity: 'raro', desc: 'Coruja de óculos que estudou medicina à noite. Cura constante.', body: 'owl', colors: ['#8a6a4a', '#f2e6c8', '#ffd23f'], motion: 'flap', bonus: { regen: 55 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_aranha', name: 'Tricô', rarity: 'incomum', desc: 'Aranha que tece cachecóis. Dá mais Moedas da Morte no fim da partida.', body: 'spider', colors: ['#2a2622', '#ff4fb4', '#9ef08a'], motion: 'hop', bonus: { coinBonus: 0.08 }, handmade: true, unlock: { kind: 'chest' } },
  { id: 'pet_peixe', name: 'Bolha', rarity: 'comum', desc: 'Peixe que nada no ar dentro de um aquário invisível. Mais vida máxima.', body: 'fish', colors: ['#ff9d3d', '#ffffff', '#141218'], motion: 'float', bonus: { hp: 0.04 }, handmade: true, unlock: { kind: 'chest' } },
];

/** Quantos pets o gerador cria (aumente pra ter mais). */
export const GENERATED_PETS = 512;

const BODIES: PetBody[] = ['bat', 'crow', 'cat', 'ghost', 'slime', 'drone', 'skull', 'dragon', 'jelly', 'frog', 'snake', 'eye', 'flame', 'robot', 'bunny', 'fox', 'spider', 'fish', 'owl', 'crystal'];
const BODY_PT: Record<PetBody, string> = {
  bat: 'Morcego', crow: 'Corvo', cat: 'Gato', ghost: 'Fantasminha', slime: 'Gosma', drone: 'Drone', skull: 'Crânio', dragon: 'Dragãozinho', jelly: 'Água-viva', frog: 'Sapo',
  snake: 'Cobrinha', eye: 'Olho', flame: 'Chaminha', robot: 'Robozinho', bunny: 'Coelho', fox: 'Raposa', spider: 'Aranha', fish: 'Peixe', owl: 'Coruja', crystal: 'Cristal',
};
const MOTION: Record<PetBody, PetDef['motion']> = {
  bat: 'flap', crow: 'flap', cat: 'hop', ghost: 'float', slime: 'bounce', drone: 'float', skull: 'orbit', dragon: 'flap', jelly: 'float', frog: 'hop',
  snake: 'slither', eye: 'float', flame: 'float', robot: 'hop', bunny: 'hop', fox: 'hop', spider: 'hop', fish: 'float', owl: 'flap', crystal: 'orbit',
};
const PET_NAMES = [
  'Pipoca', 'Paçoca', 'Torresmo', 'Farofa', 'Bolacha', 'Brigadeiro', 'Coxinha', 'Pastel', 'Tapioca', 'Quindim', 'Jujuba', 'Pirulito', 'Biscoito', 'Cocada',
  'Rapadura', 'Moranguinho', 'Feijão', 'Tremoço', 'Mingau', 'Sushi', 'Nugget', 'Waffle', 'Panqueca', 'Churros', 'Cuscuz', 'Bolinho', 'Picolé', 'Granola',
  'Fumacinha', 'Faísca', 'Trovãozinho', 'Breu', 'Cinzinha', 'Neonzinho', 'Glitchy', 'Pixelzinho', 'Bit', 'Byte', 'Bug', 'Pane', 'Ruído', 'Eco', 'Zumbido',
  'Osso', 'Ossinho', 'Tumbinha', 'Lápide', 'Cripta', 'Velório', 'Assombra', 'Boo', 'Sustinho', 'Arrepio', 'Calafrio', 'Gemido', 'Uivo', 'Grito',
  'Duque', 'Duquesa', 'Barão', 'Conde', 'Princesa', 'Rei Bob', 'Madame', 'Sir Bigode', 'Dom Pedrinho', 'Lady Lama', 'Capitão', 'Sargento', 'Cabo',
  'Kiwi', 'Manga', 'Caju', 'Pitaya', 'Acerola', 'Jabuticaba', 'Pequi', 'Cupuaçu', 'Goiaba', 'Melancia', 'Limão', 'Abacate', 'Cereja', 'Uva',
];
const ADJ = ['Ácido', 'Neon', 'Ossudo', 'Sonolento', 'Turbinado', 'do Vazio', 'Elétrico', 'Gelado', 'Flamejante', 'Venenoso', 'Dourado', 'Prismático', 'Pixelado', 'Fofo', 'Bravo', 'Glitchado', 'Sombrio', 'Sagrado', 'Enferrujado', 'Brilhante'];
const PET_COLORS = [
  ['#3a2a4a', '#ff8de8', '#ffe14d'], ['#1c1a24', '#3df2ff', '#ff3df2'], ['#d8e6ff', '#7a3dff', '#56f2a0'], ['#ff4f7b', '#ffd0dc', '#2a1020'],
  ['#c9ccd6', '#ff7a2e', '#58ffd0'], ['#efe6d2', '#ff3df2', '#3df2ff'], ['#d6453a', '#ffd23f', '#ff8a3d'], ['#2a1a40', '#b77bff', '#ffffff'],
  ['#9ef08a', '#2f6a3a', '#ffe14d'], ['#7dc6ff', '#ffffff', '#1b3a6a'], ['#ffd23f', '#141218', '#ff3d3d'], ['#5aa05a', '#e8ff9a', '#141218'],
  ['#ff9d3d', '#ffffff', '#141218'], ['#8a6a4a', '#f2e6c8', '#ffd23f'], ['#2a2622', '#ff4fb4', '#9ef08a'], ['#e6dcff', '#ff8de8', '#3a1d5c'],
];

function bonusFor(rng: Rng, rarity: RarityId): PetBonus {
  const t = RARITY[rarity].tier;
  const k = 1 + t * 0.35; // raridade aumenta um pouco o bônus
  const kinds = rng.shuffle(['speed', 'damage', 'hp', 'regen', 'reload', 'superCharge', 'spark', 'lowHpShield', 'revealRadius', 'coinBonus']);
  const n = t >= 5 ? 3 : t >= 3 ? 2 : 1;
  const b: PetBonus = {};
  for (const kind of kinds.slice(0, n)) {
    switch (kind) {
      case 'speed':
        b.speed = Math.round(0.025 * k * 1000) / 1000;
        break;
      case 'damage':
        b.damage = Math.round(0.02 * k * 1000) / 1000;
        break;
      case 'hp':
        b.hp = Math.round(0.03 * k * 1000) / 1000;
        break;
      case 'regen':
        b.regen = Math.round(25 * k);
        break;
      case 'reload':
        b.reload = Math.round(0.03 * k * 1000) / 1000;
        break;
      case 'superCharge':
        b.superCharge = Math.round(0.04 * k * 1000) / 1000;
        break;
      case 'spark':
        b.spark = { damage: Math.round(140 * k), interval: Math.max(1.8, 3.2 - t * 0.2), range: 380 + t * 15 };
        break;
      case 'lowHpShield':
        b.lowHpShield = Math.round(700 * k);
        break;
      case 'revealRadius':
        b.revealRadius = Math.round(200 + t * 30);
        break;
      case 'coinBonus':
        b.coinBonus = Math.round(0.05 * k * 100) / 100;
        break;
    }
  }
  return b;
}

export function describeBonus(b: PetBonus): string[] {
  const out: string[] = [];
  if (b.speed) out.push(`+${Math.round(b.speed * 100)}% velocidade`);
  if (b.damage) out.push(`+${Math.round(b.damage * 100)}% dano`);
  if (b.hp) out.push(`+${Math.round(b.hp * 100)}% vida máxima`);
  if (b.regen) out.push(`Cura ${b.regen}/s sempre`);
  if (b.reload) out.push(`Recarga ${Math.round(b.reload * 100)}% mais rápida`);
  if (b.superCharge) out.push(`Super ${Math.round(b.superCharge * 100)}% mais rápido`);
  if (b.spark) out.push(`Faísca de ${b.spark.damage} a cada ${b.spark.interval.toFixed(1)}s`);
  if (b.lowHpShield) out.push(`Escudo de ${b.lowHpShield} com pouca vida`);
  if (b.revealRadius) out.push(`Revela arbustos a ${Math.round(b.revealRadius / 64)} blocos`);
  if (b.coinBonus) out.push(`+${Math.round(b.coinBonus * 100)}% Moedas da Morte`);
  return out;
}

const PET_RARITY: Array<[RarityId, number]> = [
  ['comum', 32],
  ['incomum', 26],
  ['raro', 19],
  ['extremo', 12],
  ['epico', 7],
  ['god', 4],
];

function generatePets(count: number): PetDef[] {
  const out: PetDef[] = [];
  const used = new Set(HANDMADE_PETS.map((p) => p.name));
  for (let i = 0; i < count; i++) {
    const rng = new Rng(`skull-arena-pet-${i}`);
    const block = Math.floor(i / 100);
    const list: RarityId[] = [];
    for (const [r, n] of PET_RARITY) for (let k = 0; k < n; k++) list.push(r);
    new Rng(`pet-rar-${block}`).shuffle(list);
    const rarity = list[i % 100]!;
    const body = rng.pick(BODIES);
    let name = rng.pick(PET_NAMES);
    let tries = 0;
    while (used.has(name) && tries++ < 20) name = `${rng.pick(PET_NAMES)} ${rng.pick(ADJ)}`;
    if (used.has(name)) name = `${name} ${i}`;
    used.add(name);
    const bonus = bonusFor(rng, rarity);
    out.push({
      id: `pet_${String(i + 1).padStart(3, '0')}`,
      name,
      rarity,
      desc: `${BODY_PT[body]} ${rng.pick(ADJ).toLowerCase()} que segue você pela arena. ${describeBonus(bonus).join(' · ')}.`,
      body,
      colors: rng.pick(PET_COLORS) as [string, string, string],
      motion: MOTION[body],
      bonus,
      unlock: { kind: 'chest' },
    });
  }
  return out;
}

let all: PetDef[] | null = null;
let byId: Map<string, PetDef> | null = null;

export function allPets(): PetDef[] {
  if (!all) {
    all = [...HANDMADE_PETS, ...generatePets(GENERATED_PETS)];
    all.sort((a, b) => RARITY[a.rarity].tier - RARITY[b.rarity].tier);
    byId = new Map(all.map((p) => [p.id, p]));
  }
  return all;
}

export function getPet(id: string | null | undefined): PetDef | null {
  if (!id) return null;
  allPets();
  return byId!.get(id) ?? null;
}

export const STARTER_PET = 'pet_morcego';
export { BODY_PT };
