/**
 * SERVIDOR ONLINE DO SKULL ARENA (opcional)
 * ========================================
 *   npm run build      → gera o jogo em dist/
 *   npm run server     → sobe em http://localhost:8787 (jogo + API + tempo real)
 *
 * Variáveis de ambiente:
 *   PORT=8787            porta
 *   ADMIN_PIN=xxxx       PIN do Painel do Criador (códigos). OBRIGATÓRIO trocar!
 *   DATA=server-data     pasta do banco (db.json)
 *
 * O que ele faz:
 *   • contas (senha com scrypt) e PERFIL guardado no servidor (moedas não dá pra editar no cliente)
 *   • todas as ações da economia rodam AQUI (src/meta/actions.ts)
 *   • amigos por TAG, chat geral e privado, salas com código, convites
 *   • partidas online autoritativas (server/match.ts), BOTs preenchem as vagas
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ADMIN_PIN as FILE_PIN } from '../src/content/codes';
import { hasCharacter } from '../src/content/characters';
import { MODE } from '../src/content/modes';
import { getPet } from '../src/content/pets';
import type { ModeId, PromoCodeDef } from '../src/content/types';
import { Rng } from '../src/engine/rng';
import { ACTIONS } from '../src/meta/actions';
import { applyMatch, EconomyError } from '../src/meta/economy';
import { validName } from '../src/meta/validate';
import { Db, type Account } from './db';
import { ServerMatch, type Player } from './match';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ADMIN_PIN = process.env.ADMIN_PIN ?? FILE_PIN;
if (!process.env.ADMIN_PIN) console.warn('⚠ ADMIN_PIN não definido: usando o PIN do arquivo src/content/codes.ts. Defina ADMIN_PIN no ambiente!');

const db = new Db(join(ROOT, process.env.DATA ?? 'server-data', 'db.json'));
const rng = new Rng((Math.random() * 2 ** 32) >>> 0);

// ---------------------------------------------------------------------------
// HTTP: API + arquivos do jogo
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization' });
  res.end(JSON.stringify(data));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64 * 1024) throw new EconomyError('Pedido grande demais.');
    chunks.push(c as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new EconomyError('JSON inválido.');
  }
}

/** limite simples por IP (login/cadastro) */
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > windowMs) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > max;
}

function token(req: IncomingMessage): string | null {
  const a = req.headers.authorization;
  return a?.startsWith('Bearer ') ? a.slice(7) : null;
}

/** ações que o cliente pode pedir (match local contra BOTs tem limite de tempo) */
const MIN_MATCH_GAP_MS = 45_000;

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const ip = req.socket.remoteAddress ?? '?';
  try {
    if (path === '/api/register' || path === '/api/login') {
      if (limited(ip)) return json(res, 429, { error: 'Muitas tentativas. Espere um minuto.' });
      const b = await body(req);
      const name = String(b.name ?? '').trim();
      const password = String(b.password ?? '');
      if (path === '/api/register') {
        const err = validName(name);
        if (err) return json(res, 400, { error: err });
        if (password.length < 4) return json(res, 400, { error: 'A senha precisa de pelo menos 4 caracteres.' });
        if (db.byName(name)) return json(res, 409, { error: 'Esse nome já existe. Escolha outro.' });
        const acc = db.create(name, password);
        return json(res, 200, { token: db.newToken(acc.id), profile: acc.profile });
      }
      const acc = db.byName(name);
      if (!acc || !db.checkPassword(acc, password)) return json(res, 401, { error: 'Nome ou senha errados.' });
      return json(res, 200, { token: db.newToken(acc.id), profile: acc.profile });
    }
    if (path === '/api/me') {
      const acc = db.auth(token(req));
      if (!acc) return json(res, 401, { error: 'Entre de novo.' });
      return json(res, 200, { profile: acc.profile });
    }
    if (path === '/api/act') {
      const acc = db.auth(token(req));
      if (!acc) return json(res, 401, { error: 'Entre de novo.' });
      const b = await body(req);
      const name = String(b.name) as keyof typeof ACTIONS;
      const fn = ACTIONS[name] as ((p: Account['profile'], c: unknown, a: unknown) => unknown) | undefined;
      if (!fn) return json(res, 400, { error: 'Ação desconhecida.' });
      if (name === 'match') {
        // partida contra BOTs jogada no aparelho: limite pra evitar "farm"
        if (Date.now() - acc.lastMatchAt < MIN_MATCH_GAP_MS) return json(res, 429, { error: 'Resultado enviado rápido demais.' });
        acc.lastMatchAt = Date.now();
      }
      const draft = structuredClone(acc.profile);
      const result = fn(draft, { rng, codes: db.codes }, b.args ?? {});
      acc.profile = draft;
      db.save();
      pushFriends(acc);
      return json(res, 200, { profile: acc.profile, result });
    }
    if (path === '/api/admin/codes') {
      if (limited(`admin:${ip}`, 10)) return json(res, 429, { error: 'Muitas tentativas.' });
      const b = await body(req);
      if (String(b.pin ?? '') !== ADMIN_PIN) return json(res, 403, { error: 'PIN errado.' });
      if (Array.isArray(b.list)) db.codes = (b.list as PromoCodeDef[]).filter((c) => c && typeof c.code === 'string' && Array.isArray(c.rewards)).slice(0, 500);
      return json(res, 200, { codes: db.codes });
    }
    return json(res, 404, { error: 'Não encontrado.' });
  } catch (e) {
    return json(res, e instanceof EconomyError ? 400 : 500, { error: e instanceof Error ? e.message : 'Erro.' });
  }
}

function serveStatic(req: IncomingMessage, res: ServerResponse, path: string): void {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SKULL ARENA servidor no ar. Rode "npm run build" pra servir o jogo por aqui também.');
    return;
  }
  let file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  if (file.endsWith('index.html')) {
    // avisa o cliente que ele foi aberto pelo servidor (modo online automático)
    const html = readFileSync(file, 'utf8').replace('</head>', '<script>window.__SKULL_SERVER__=true</script></head>');
    res.writeHead(200, { 'content-type': MIME['.html']!, 'cache-control': 'no-cache' });
    res.end(html);
    return;
  }
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  res.end(readFileSync(file));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST' });
    res.end();
    return;
  }
  if (url.pathname.startsWith('/api/')) void api(req, res, url.pathname);
  else serveStatic(req, res, url.pathname);
});

// ---------------------------------------------------------------------------
// TEMPO REAL: amigos, chat, salas, partidas
// ---------------------------------------------------------------------------

interface Conn {
  ws: WebSocket;
  acc: Account;
  room: Room | null;
  lastChat: number;
}

interface Room {
  code: string;
  mode: ModeId;
  members: Array<{ id: string; char: string; pet: string | null; ready: boolean }>;
  leader: string;
  match: ServerMatch | null;
}

const online = new Map<string, Conn>();
const rooms = new Map<string, Room>();
const globalChat: Array<{ from: string; fromName: string; to: string; text: string; at: number }> = [];
const BAD_WORDS = ['caralho', 'porra', 'puta', 'fdp', 'viado', 'arrombado', 'buceta', 'cuzao', 'merda'];

function send(c: Conn | undefined, msg: unknown): void {
  if (c && c.ws.readyState === c.ws.OPEN) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

function friendInfo(a: Account) {
  const c = online.get(a.id);
  return {
    id: a.id,
    name: a.name,
    tag: a.profile.tag,
    online: !!c,
    status: !c ? 'offline' : c.room?.match ? 'partida' : c.room ? 'sala' : 'menu',
    trophies: a.profile.trophies,
    char: a.profile.selected,
  };
}

function pushFriendList(a: Account): void {
  const c = online.get(a.id);
  if (!c) return;
  send(c, {
    t: 'friends',
    list: a.friends
      .map((id) => db.byId(id))
      .filter(Boolean)
      .map((x) => friendInfo(x!)),
    requests: a.requests
      .map((id) => db.byId(id))
      .filter(Boolean)
      .map((x) => friendInfo(x!)),
  });
}

/** avisa os amigos que meu status mudou */
function pushFriends(a: Account): void {
  pushFriendList(a);
  for (const id of a.friends) {
    const f = db.byId(id);
    if (f) pushFriendList(f);
  }
}

function roomInfo(r: Room) {
  return {
    code: r.code,
    mode: r.mode,
    state: r.match ? 'playing' : 'lobby',
    members: r.members.map((m) => {
      const a = db.byId(m.id)!;
      return { id: m.id, name: a.name, char: m.char, pet: m.pet, level: a.profile.chars[m.char]?.level ?? 1, ready: m.ready, leader: m.id === r.leader };
    }),
  };
}

function pushRoom(r: Room): void {
  const info = roomInfo(r);
  for (const m of r.members) send(online.get(m.id), { t: 'room', room: info });
}

function leaveRoom(c: Conn): void {
  const r = c.room;
  if (!r) return;
  c.room = null;
  if (r.match) r.match.disconnect(c.acc.id);
  r.members = r.members.filter((m) => m.id !== c.acc.id);
  send(c, { t: 'room', room: null });
  if (!r.members.length) {
    r.match?.abort();
    rooms.delete(r.code);
    return;
  }
  if (r.leader === c.acc.id) r.leader = r.members[0]!.id;
  pushRoom(r);
}

function code(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  do {
    s = '';
    for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  } while (rooms.has(s));
  return s;
}

function memberChar(acc: Account, charId: unknown, petId: unknown): { char: string; pet: string | null } {
  const ch = typeof charId === 'string' && hasCharacter(charId) && acc.profile.chars[charId] ? charId : acc.profile.selected;
  const pet = typeof petId === 'string' && getPet(petId) && acc.profile.pets[petId] ? petId : null;
  return { char: ch, pet };
}

function startRoomMatch(r: Room): void {
  const players: Player[] = r.members.map((m) => {
    const a = db.byId(m.id)!;
    return { accountId: a.id, name: a.name, charId: m.char, petId: m.pet, level: a.profile.chars[m.char]?.level ?? 1, send: (msg) => send(online.get(a.id), msg) };
  });
  const match = new ServerMatch(`m_${Date.now().toString(36)}`, r.mode, players, (m, results) => {
    for (const { player, summary } of results) {
      const acc = db.byId(player.accountId);
      if (!acc) continue;
      let rewards = null;
      try {
        const draft = structuredClone(acc.profile);
        rewards = applyMatch(draft, summary, rng);
        acc.profile = draft;
      } catch (e) {
        console.error('erro ao aplicar prêmio', e);
      }
      send(online.get(acc.id), { t: 'match.end', summary, rewards, profile: acc.profile });
    }
    db.save();
    r.match = null;
    for (const mb of r.members) mb.ready = false;
    if (rooms.has(r.code)) pushRoom(r);
    for (const mb of r.members) {
      const a = db.byId(mb.id);
      if (a) pushFriends(a);
    }
    void m;
  });
  r.match = match;
  pushRoom(r);
  match.start();
  for (const m of r.members) {
    const a = db.byId(m.id);
    if (a) pushFriends(a);
  }
}

function handle(c: Conn, m: Record<string, unknown>): void {
  const acc = c.acc;
  switch (m.t) {
    case 'ping':
      return send(c, { t: 'pong', at: m.at });
    case 'friend.add': {
      const target = db.byTag(String(m.tag ?? ''));
      if (!target) return send(c, { t: 'error', msg: 'Ninguém com essa TAG.' });
      if (target.id === acc.id) return send(c, { t: 'error', msg: 'Essa é a sua TAG 😅' });
      if (acc.friends.includes(target.id)) return send(c, { t: 'error', msg: 'Vocês já são amigos.' });
      if (acc.requests.includes(target.id)) {
        // ele já tinha me chamado → vira amizade
        acc.requests = acc.requests.filter((x) => x !== target.id);
        acc.friends.push(target.id);
        target.friends.push(acc.id);
      } else if (!target.requests.includes(acc.id)) target.requests.push(acc.id);
      db.save();
      pushFriendList(acc);
      pushFriendList(target);
      return;
    }
    case 'friend.accept': {
      const id = String(m.id);
      const other = db.byId(id);
      if (!other || !acc.requests.includes(id)) return;
      acc.requests = acc.requests.filter((x) => x !== id);
      if (!acc.friends.includes(id)) acc.friends.push(id);
      if (!other.friends.includes(acc.id)) other.friends.push(acc.id);
      db.save();
      pushFriendList(acc);
      pushFriendList(other);
      return;
    }
    case 'friend.remove': {
      const id = String(m.id);
      const other = db.byId(id);
      acc.friends = acc.friends.filter((x) => x !== id);
      acc.requests = acc.requests.filter((x) => x !== id);
      if (other) other.friends = other.friends.filter((x) => x !== acc.id);
      db.save();
      pushFriendList(acc);
      if (other) pushFriendList(other);
      return;
    }
    case 'chat.send': {
      const now = Date.now();
      if (now - c.lastChat < 700) return send(c, { t: 'error', msg: 'Calma aí, mais devagar no chat.' });
      c.lastChat = now;
      let text = String(m.text ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 200);
      if (!text) return;
      for (const w of BAD_WORDS) text = text.replace(new RegExp(w, 'gi'), '***');
      const to = String(m.to ?? 'global');
      const msg = { t: 'chat', from: acc.id, fromName: acc.name, to, text, at: now };
      if (to === 'global') {
        globalChat.push(msg);
        if (globalChat.length > 100) globalChat.shift();
        for (const o of online.values()) send(o, msg);
      } else if (acc.friends.includes(to)) {
        send(c, msg);
        send(online.get(to), msg);
      }
      return;
    }
    case 'room.create': {
      leaveRoom(c);
      const r: Room = { code: code(), mode: 'guerra', members: [{ id: acc.id, ...memberChar(acc, m.char, m.pet), ready: true }], leader: acc.id, match: null };
      rooms.set(r.code, r);
      c.room = r;
      pushRoom(r);
      pushFriends(acc);
      return;
    }
    case 'room.join': {
      const r = rooms.get(String(m.code ?? '').toUpperCase());
      if (!r) return send(c, { t: 'error', msg: 'Sala não encontrada.' });
      if (r.match) return send(c, { t: 'error', msg: 'Essa sala está em partida. Espere acabar.' });
      const max = MODE[r.mode].teams === 0 ? MODE[r.mode].players : MODE[r.mode].teamSize;
      if (r.members.length >= max) return send(c, { t: 'error', msg: 'Sala cheia.' });
      leaveRoom(c);
      r.members.push({ id: acc.id, ...memberChar(acc, m.char, m.pet), ready: false });
      c.room = r;
      pushRoom(r);
      pushFriends(acc);
      return;
    }
    case 'room.leave':
      leaveRoom(c);
      pushFriends(acc);
      return;
    case 'room.ready': {
      const r = c.room;
      if (!r || r.match) return;
      const me = r.members.find((x) => x.id === acc.id);
      if (!me) return;
      Object.assign(me, memberChar(acc, m.char, m.pet), { ready: !!m.ready });
      pushRoom(r);
      return;
    }
    case 'room.mode': {
      const r = c.room;
      const mode = String(m.mode) as ModeId;
      if (!r || r.leader !== acc.id || !MODE[mode] || mode === 'treino') return;
      r.mode = mode;
      pushRoom(r);
      return;
    }
    case 'room.invite': {
      const r = c.room;
      const id = String(m.id);
      if (!r || !acc.friends.includes(id)) return;
      send(online.get(id), { t: 'invite', from: acc.id, fromName: acc.name, code: r.code });
      return;
    }
    case 'room.start': {
      const r = c.room;
      if (!r || r.leader !== acc.id || r.match) return;
      const notReady = r.members.filter((x) => x.id !== r.leader && !x.ready);
      if (notReady.length) return send(c, { t: 'error', msg: `Esperando ${notReady.length} jogador(es) ficar(em) pronto(s).` });
      startRoomMatch(r);
      return;
    }
    case 'match.input': {
      c.room?.match?.input(acc.id, (m.i ?? {}) as Record<string, number>);
      return;
    }
    case 'match.leave': {
      // sai da partida (vira BOT) mas fica na sala
      c.room?.match?.disconnect(acc.id);
      return;
    }
  }
}

const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 512 }, maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://x');
  const acc = db.auth(url.searchParams.get('token'));
  if (!acc) {
    ws.close(4001, 'auth');
    return;
  }
  // derruba conexão antiga da mesma conta
  const old = online.get(acc.id);
  if (old) {
    old.ws.close(4000, 'outra conexão');
    online.delete(acc.id);
  }
  const c: Conn = { ws, acc, room: null, lastChat: 0 };
  // voltou no meio da partida? reconecta
  for (const r of rooms.values())
    if (r.members.some((x) => x.id === acc.id)) {
      c.room = r;
      if (r.match) r.match.reconnect(acc.id, (msg) => send(c, msg));
    }
  online.set(acc.id, c);
  send(c, { t: 'hello', me: { id: acc.id, name: acc.name, tag: acc.profile.tag } });
  send(c, { t: 'chatHistory', list: globalChat });
  if (c.room) send(c, { t: 'room', room: roomInfo(c.room) });
  pushFriends(acc);
  ws.on('message', (data) => {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    try {
      handle(c, m);
    } catch (e) {
      console.error('erro na mensagem', m.t, e);
    }
  });
  ws.on('close', () => {
    if (online.get(acc.id) !== c) return;
    online.delete(acc.id);
    const r = c.room;
    if (r?.match) r.match.disconnect(acc.id);
    else if (r) leaveRoom(c);
    pushFriends(acc);
  });
});

server.listen(PORT, () => {
  console.log(`\n💀 SKULL ARENA online em http://localhost:${PORT}`);
  console.log(existsSync(DIST) ? '   servindo o jogo de dist/' : '   (rode "npm run build" pra servir o jogo também)');
  console.log(`   banco: ${process.env.DATA ?? 'server-data'}/db.json\n`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    db.flush();
    process.exit(0);
  });
