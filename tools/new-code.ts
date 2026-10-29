/**
 * CÓDIGOS DE PRÊMIO pelo terminal
 *
 *   npm run novo:codigo -- VICEN100 moedas=500 isvoid=20 [xp=100] [passe=200] [bau=bau_mega]
 *                          [personagem=id] [pet=id] [titulo="Texto"] [usos=1] [ate=2026-12-31]
 *   npm run novo:codigo -- --apagar VICEN100
 *   npm run novo:codigo -- --listar
 *
 * Os códigos ficam em src/content/codes.ts (valem pra todo mundo depois de publicar).
 * Códigos criados DENTRO do jogo (Painel do Criador) ficam no aparelho/servidor.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODES } from '../src/content/codes';
import { die, insertBefore, parseArgs, ROOT } from './lib';

const { pos, kv, flags } = parseArgs(process.argv.slice(2));
const norm = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');

if (flags.has('listar')) {
  for (const c of CODES) console.log(`${c.code.padEnd(16)} ${c.rewards.map((r) => JSON.stringify(r)).join(' + ')}${c.active === false ? '  (desligado)' : ''}`);
  process.exit(0);
}

if (flags.has('apagar')) {
  const code = norm(pos[0] ?? '');
  if (!code) die('Uso: npm run novo:codigo -- --apagar CODIGO');
  const path = join(ROOT, 'src/content/codes.ts');
  const src = readFileSync(path, 'utf8');
  // acha o objeto { code: 'X', ... } (uma linha ou várias) e remove
  const re = new RegExp(`\\n\\s*\\{\\s*code: '${code}'[\\s\\S]*?\\n?\\s*\\},?(?=\\n)`, 'i');
  if (!re.test(src)) die(`Código ${code} não encontrado em src/content/codes.ts`);
  writeFileSync(path, src.replace(re, ''));
  console.log(`\n✔ Código ${code} apagado.\n`);
  process.exit(0);
}

const code = norm(pos[0] ?? '');
if (code.length < 3) die('Uso: npm run novo:codigo -- CODIGO moedas=500 isvoid=20 ...');
if (CODES.some((c) => norm(c.code) === code)) die(`O código ${code} já existe.`);
const r: string[] = [];
if (kv.moedas) r.push(`{ kind: 'moedas', amount: ${Number(kv.moedas)} }`);
if (kv.isvoid) r.push(`{ kind: 'isvoid', amount: ${Number(kv.isvoid)} }`);
if (kv.xp) r.push(`{ kind: 'xp', amount: ${Number(kv.xp)} }`);
if (kv.passe) r.push(`{ kind: 'passXp', amount: ${Number(kv.passe)} }`);
if (kv.trofeus) r.push(`{ kind: 'trophies', amount: ${Number(kv.trofeus)} }`);
if (kv.bau) r.push(`{ kind: 'chest', id: '${kv.bau}' }`);
if (kv.personagem) r.push(`{ kind: 'character', id: '${kv.personagem}' }`);
if (kv.pet) r.push(`{ kind: 'pet', id: '${kv.pet}' }`);
if (kv.titulo) r.push(`{ kind: 'title', id: 't_${code.toLowerCase()}', text: '${kv.titulo.replace(/'/g, "\\'")}' }`);
if (!r.length) die('Coloque pelo menos um prêmio (moedas=, isvoid=, xp=, passe=, bau=, personagem=, pet=, titulo=).');
const extra = [kv.usos ? `perAccount: ${Number(kv.usos)}` : '', kv.ate ? `validUntil: '${kv.ate}T23:59:59-03:00'` : ''].filter(Boolean);
insertBefore('src/content/codes.ts', '// <novo-codigo>', `  { code: '${code}', rewards: [${r.join(', ')}]${extra.length ? `, ${extra.join(', ')}` : ''} },\n`);
console.log(`\n✔ Código ${code} criado em src/content/codes.ts\n`);
