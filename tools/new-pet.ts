/**
 * npm run novo:pet -- "Nome" [raridade] [corpo] [bonus=valor ...]
 *
 *   corpo: bat crow cat ghost slime drone skull dragon jelly frog snake eye flame
 *          robot bunny fox spider fish owl crystal        (padrão: ghost)
 *   bônus (opcional, pode juntar vários):
 *     speed=0.04  damage=0.05  hp=0.04  regen=40  reload=0.05  superCharge=0.08
 *     coinBonus=0.1  revealRadius=260  lowHpShield=1200  spark=200
 *   cores (opcional): cor1=#ff3df2 cor2=#3df2ff cor3=#ffffff
 *
 * Ex.: npm run novo:pet -- "Bafo" epico dragon damage=0.05 spark=260
 */
import { allPets } from '../src/content/pets';
import type { PetBody, RarityId } from '../src/content/types';
import { die, insertBefore, parseArgs, RARITIES, slug } from './lib';

const BODIES: PetBody[] = ['bat', 'crow', 'cat', 'ghost', 'slime', 'drone', 'skull', 'dragon', 'jelly', 'frog', 'snake', 'eye', 'flame', 'robot', 'bunny', 'fox', 'spider', 'fish', 'owl', 'crystal'];
const MOTION: Record<PetBody, string> = {
  bat: 'flap',
  crow: 'flap',
  cat: 'hop',
  ghost: 'float',
  slime: 'bounce',
  drone: 'float',
  skull: 'orbit',
  dragon: 'flap',
  jelly: 'float',
  frog: 'hop',
  snake: 'slither',
  eye: 'float',
  flame: 'float',
  robot: 'hop',
  bunny: 'hop',
  fox: 'hop',
  spider: 'hop',
  fish: 'float',
  owl: 'flap',
  crystal: 'orbit',
};

const { pos, kv } = parseArgs(process.argv.slice(2));
const name = pos[0]?.trim();
if (!name) die('Uso: npm run novo:pet -- "Nome" [raridade] [corpo] [bonus=valor ...]');
const rarity = (pos[1] ?? 'raro') as RarityId;
const body = (pos[2] ?? 'ghost') as PetBody;
if (!(RARITIES as readonly string[]).includes(rarity)) die(`Raridade inválida: ${rarity}`);
if (!BODIES.includes(body)) die(`Corpo inválido: ${body}. Use: ${BODIES.join(', ')}`);
const id = `pet_${slug(name)}`;
if (allPets().some((p) => p.id === id)) die(`Já existe um pet com id ${id}.`);

const bonus: string[] = [];
for (const k of ['speed', 'damage', 'hp', 'regen', 'reload', 'superCharge', 'coinBonus', 'revealRadius', 'lowHpShield']) if (kv[k]) bonus.push(`${k}: ${Number(kv[k])}`);
if (kv.spark) bonus.push(`spark: { damage: ${Number(kv.spark)}, interval: 3, range: 400 }`);
if (!bonus.length) bonus.push('regen: 30');
const colors = [kv.cor1 ?? '#b77bff', kv.cor2 ?? '#3df2ff', kv.cor3 ?? '#ffffff'];

insertBefore(
  'src/content/pets/index.ts',
  '// <novo-pet>',
  `  {
    id: '${id}',
    name: '${name.replace(/'/g, "\\'")}',
    rarity: '${rarity}',
    desc: 'Escreva aqui quem é ${name.replace(/'/g, "\\'")} e o que faz.',
    body: '${body}',
    colors: ['${colors[0]}', '${colors[1]}', '${colors[2]}'],
    motion: '${MOTION[body]}',
    bonus: { ${bonus.join(', ')} },
    handmade: true,
    unlock: { kind: 'chest' },
  },
`,
);
console.log(
  `\n✔ Pet criado: ${name} (${id}) em src/content/pets/index.ts\n  Veja em Menu → PETS. Desenho próprio? Coloque um PNG 128×32 (4 quadros 32×32) em public/sprites/ e adicione sheet: 'sprites/arquivo.png'.\n`,
);
