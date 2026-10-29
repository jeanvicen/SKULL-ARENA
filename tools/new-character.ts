/**
 * npm run novo:personagem -- "Nome do Personagem" [raridade] [função] [--seed=123]
 *
 *   raridade: comum | incomum | raro | extremo | epico | god | creators   (padrão: raro)
 *   função:   atacante | tanque | suporte | assassino | atirador | controle | lancador (padrão: atacante)
 *
 * Cria src/content/characters/handmade/<id>.ts com TUDO preenchido (história,
 * atributos, ataque, habilidade, super, visual 16-bit aleatório) e registra no jogo.
 * Depois é só abrir o arquivo e mudar o que quiser.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomLook } from '../src/content/generator/characters';
import { allCharacters } from '../src/content/characters';
import type { RarityId, RoleId } from '../src/content/types';
import { die, insertBefore, parseArgs, RARITIES, ROLES, ROOT, slug } from './lib';

const { pos, kv } = parseArgs(process.argv.slice(2));
const name = pos[0]?.trim();
if (!name) die('Uso: npm run novo:personagem -- "Nome" [raridade] [função]');
const rarity = (pos[1] ?? 'raro') as RarityId;
const role = (pos[2] ?? 'atacante') as RoleId;
if (!(RARITIES as readonly string[]).includes(rarity)) die(`Raridade inválida: ${rarity}. Use: ${RARITIES.join(', ')}`);
if (!(ROLES as readonly string[]).includes(role)) die(`Função inválida: ${role}. Use: ${ROLES.join(', ')}`);
const id = slug(name);
if (!id) die('Nome inválido.');
if (allCharacters().some((c) => c.id === id || c.name.toLowerCase() === name.toLowerCase())) die(`Já existe personagem com id/nome "${id}".`);
const file = join(ROOT, 'src/content/characters/handmade', `${id}.ts`);
if (existsSync(file)) die(`O arquivo ${file} já existe.`);

const seed = Number(kv.seed ?? Math.floor(Math.random() * 1e9));
const { look, anim } = randomLook(seed, role, rarity);
const color = look.top.color2 ?? look.top.color;
const tier = RARITIES.indexOf(rarity);
const hpBase: Record<RoleId, number> = { atacante: 3400, tanque: 5600, suporte: 3200, assassino: 3300, atirador: 2700, controle: 3300, lancador: 3000 };

// kit inicial por função (todas as peças vêm de src/content/abilities.ts)
const KITS: Record<RoleId, { atk: string; skill: string; sup: string }> = {
  atacante: {
    atk: `atk.burst({ name: 'Rajada', dmg: 380, range: 600, n: 3, color: '${color}' })`,
    skill: `skill.dash({ name: 'Arrancada', dist: 300, cd: 6 })`,
    sup: `sup.rain({ name: 'Chuva de Balas', dmg: 700, color: '${color}' })`,
  },
  tanque: {
    atk: `atk.shotgun({ name: 'Estouro', dmg: 300, range: 420, n: 5, color: '${color}' })`,
    skill: `skill.shield({ name: 'Couraça', amount: 1500, cd: 10 })`,
    sup: `sup.charge({ name: 'Atropelo', dmg: 1800, dist: 500, status: st.stun(1) })`,
  },
  suporte: {
    atk: `atk.wave({ name: 'Onda Boa', dmg: 650, range: 560, color: '${color}', heal: 400 })`,
    skill: `skill.heal({ name: 'Pulso de Cura', amount: 1200, radius: 220, cd: 10 })`,
    sup: `sup.healField({ name: 'Zona Sagrada', hps: 600 })`,
  },
  assassino: {
    atk: `atk.melee({ name: 'Corte', dmg: 1300, range: 150 })`,
    skill: `skill.blink({ name: 'Sumiço', dist: 320, cd: 7 })`,
    sup: `sup.shadowStrike({ name: 'Golpe das Sombras', dmg: 2600 })`,
  },
  atirador: {
    atk: `atk.sniper({ name: 'Tiro Longo', dmg: 1500, range: 900, color: '${color}' })`,
    skill: `skill.trap({ name: 'Armadilha', dmg: 900, n: 2, cd: 9 })`,
    sup: `sup.bigShot({ name: 'Tiro Perfurante', dmg: 2400, color: '${color}', pierce: true })`,
  },
  controle: {
    atk: `atk.chain({ name: 'Choque em Cadeia', dmg: 700, range: 620, color: '${color}', jumps: 3 })`,
    skill: `skill.freeze({ name: 'Congelar', dmg: 600, radius: 140, cd: 10 })`,
    sup: `sup.storm({ name: 'Tempestade', dps: 700, kind: 'electric', color: '${color}' })`,
  },
  lancador: {
    atk: `atk.lob({ name: 'Arremesso', dmg: 900, radius: 90, range: 640, color: '${color}' })`,
    skill: `skill.grenade({ name: 'Granada', dmg: 1000, radius: 120, cd: 8, color: '${color}' })`,
    sup: `sup.nuke({ name: 'Bomba Gigante', dmg: 2600, color: '${color}' })`,
  },
};
const kit = KITS[role];
const ind = (o: unknown) =>
  JSON.stringify(o, null, 2)
    .replace(/\n/g, '\n  ')
    .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1:')
    .replace(/"/g, "'");

const usesSt = Object.values(kit).some((x) => x.includes('st.'));
const ident = /^[a-z_]/.test(id) ? id : `c_${id}`;
const src = `import { atk, skill, sup${usesSt ? ', st' : ''} } from '../../abilities';
import { defineCharacter } from '../define';

/**
 * ${name.toUpperCase()} — criado com \`npm run novo:personagem\`.
 * Mude o que quiser: história, atributos, habilidades (peças em src/content/abilities.ts)
 * e o visual (ou use \`sheet: 'sprites/${id}.png'\` com seu próprio desenho).
 */
export default defineCharacter({
  id: '${id}',
  name: '${name.replace(/'/g, "\\'")}',
  rarity: '${rarity}',
  role: '${role}',
  title: 'O Novato da Arena',
  quote: 'Cheguei agora, mas já tô dominando.',
  bio: {
    origem: 'Necrópolis',
    idade: '20 anos',
    historia: [
      'Escreva aqui a história de vida de ${name}: de onde veio, o que aconteceu, por que entrou na Skull Arena.',
      'Segundo parágrafo: o que ${name} quer provar e como luta.',
    ],
    sonho: 'O maior sonho de ${name}.',
    medo: 'O maior medo de ${name}.',
    curiosidade: 'Uma curiosidade engraçada.',
  },
  stats: { hp: ${Math.round(hpBase[role] * (1 + tier * 0.02))}, speed: ${role === 'assassino' ? 280 : role === 'tanque' ? 240 : 255}, ammo: 3, reload: 1.4 },
  attack: ${kit.atk},
  skills: [${kit.skill}],
  super: ${kit.sup},
  passive: { name: 'Sangue Novo', desc: '+5% de velocidade.', speedMult: 1.05 },
  look: ${ind(look)},
  anim: ${ind(anim)},
  unlock: { kind: 'chest' },
  tags: ['novo'],
});
`;

writeFileSync(file, src);
insertBefore('src/content/characters/index.ts', '// <novo-personagem-import>', `import ${ident} from './handmade/${id}';\n`);
insertBefore('src/content/characters/index.ts', '// <novo-personagem-lista>', `  ${ident},\n`);
console.log(`
✔ Personagem criado: ${name} (${rarity}, ${role})
  arquivo: src/content/characters/handmade/${id}.ts
  id:      ${id}

Próximos passos:
  1) Abra o arquivo e escreva a história, mude atributos e habilidades.
  2) Veja como ficou no jogo: Menu → ESTÚDIO (ou PERSONAGENS).
  3) Rode: npm run validar
`);
