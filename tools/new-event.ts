/**
 * npm run novo:evento -- "Nome do Evento" AAAA-MM-DD AAAA-MM-DD [opções]
 *
 * opções:
 *   modo=meteoro|so_super|chefao|guerra|ffa   libera um modo especial
 *   moedas=1.5  xp=1.5  trofeus=1.2  passe=2    multiplicadores
 *   bau=bau_mega                                baú especial na loja
 *   destaque=vicen_creator                      personagem com chance x2
 *   presente_moedas=300  presente_isvoid=20     presente de login (1x por conta)
 *   semanal=0,6                                 repete toda semana (0=dom … 6=sáb)
 *   emoji=🔥  cor=#ff3d4d  cor2=#1a0a2a
 *
 * Ex.: npm run novo:evento -- "Carnaval Caveira" 2027-02-05 2027-02-17 moedas=2 emoji=🎭
 */
import { EVENTS } from '../src/content/events';
import { die, insertBefore, parseArgs, slug } from './lib';

const { pos, kv } = parseArgs(process.argv.slice(2));
const [name, start, end] = pos;
if (!name || !start || !end) die('Uso: npm run novo:evento -- "Nome" AAAA-MM-DD AAAA-MM-DD [opções]');
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) die('Datas no formato AAAA-MM-DD.');
if (end < start) die('A data de fim é antes do começo.');
const id = `${slug(name)}_${start.slice(0, 4)}`;
if (EVENTS.some((e) => e.id === id)) die(`Já existe evento ${id}.`);

const mult: string[] = [];
if (kv.moedas) mult.push(`moedas: ${Number(kv.moedas)}`);
if (kv.xp) mult.push(`xp: ${Number(kv.xp)}`);
if (kv.trofeus) mult.push(`trophies: ${Number(kv.trofeus)}`);
if (kv.passe) mult.push(`passXp: ${Number(kv.passe)}`);
const gift: string[] = [];
if (kv.presente_moedas) gift.push(`{ kind: 'moedas', amount: ${Number(kv.presente_moedas)} }`);
if (kv.presente_isvoid) gift.push(`{ kind: 'isvoid', amount: ${Number(kv.presente_isvoid)} }`);

const lines = [
  `    id: '${id}',`,
  `    name: '${name.replace(/'/g, "\\'")}',`,
  `    desc: 'Descreva o evento aqui.',`,
  `    start: '${start}T00:00:00-03:00',`,
  `    end: '${end}T23:59:59-03:00',`,
  `    banner: { color: '${kv.cor ?? '#ff3df2'}', color2: '${kv.cor2 ?? '#1a0a2a'}', emoji: '${kv.emoji ?? '💀'}' },`,
  mult.length ? `    multipliers: { ${mult.join(', ')} },` : '',
  kv.modo ? `    modeId: '${kv.modo}',` : '',
  kv.bau ? `    chestId: '${kv.bau}',` : '',
  kv.destaque ? `    featuredCharacter: '${kv.destaque}',` : '',
  gift.length ? `    loginGift: [${gift.join(', ')}],` : '',
  kv.semanal ? `    weekly: [${kv.semanal.split(',').map(Number).join(', ')}],` : '',
].filter(Boolean);
insertBefore('src/content/events.ts', '// <novo-evento>', `  {\n${lines.join('\n')}\n  },\n`);
console.log(`\n✔ Evento criado: ${name} (${id}) de ${start} a ${end} em src/content/events.ts\n  Teste antes da data: Configurações → Painel do Criador → "viajar no tempo".\n`);
