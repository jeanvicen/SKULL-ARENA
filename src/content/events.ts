import type { EventDef } from './types';

/**
 * EVENTOS
 * -------
 * Pra criar um evento: copie um bloco abaixo, mude `id`, datas e o que ele dá
 * (ou rode `npm run novo:evento`). Datas no formato ISO com fuso de Brasília (-03:00).
 *
 * O que um evento pode fazer:
 *  • multipliers  → multiplica moedas/xp/troféus/xp do passe nas partidas
 *  • modeId/mapId → libera um modo especial (aparece no seletor de partida)
 *  • chestId      → baú especial na loja
 *  • featuredCharacter → personagem com chance em dobro nos baús
 *  • missions     → missões só do evento
 *  • loginGift    → presente ao abrir o jogo (1x por conta)
 *  • weekly       → repete toda semana nos dias escolhidos (0 = domingo)
 */
export const EVENTS: EventDef[] = [
  {
    id: 'noite_caveiras_2026',
    name: 'Noite das Caveiras',
    desc: 'Halloween na arena: chuva de meteoros, moedas x1,5 e a Abóbora Maldita na loja.',
    start: '2026-10-24T00:00:00-03:00',
    end: '2026-11-08T23:59:59-03:00',
    banner: { color: '#ff7a1a', color2: '#3a0a4a', emoji: '🎃' },
    multipliers: { moedas: 1.5, passXp: 1.25 },
    modeId: 'meteoro',
    chestId: 'bau_evento_halloween',
    featuredCharacter: 'vicen_creator',
    missions: [
      { id: 'hw_kills', text: 'Elimine 30 inimigos durante o evento', goal: 'kills', target: 30, rewards: [{ kind: 'isvoid', amount: 25 }] },
      { id: 'hw_meteoro', text: 'Vença 3 partidas de Chuva de Meteoros', goal: 'winMode', mode: 'meteoro', target: 3, rewards: [{ kind: 'chest', id: 'bau_evento_halloween' }] },
      { id: 'hw_play', text: 'Jogue 10 partidas', goal: 'play', target: 10, rewards: [{ kind: 'moedas', amount: 400 }] },
    ],
    loginGift: [
      { kind: 'moedas', amount: 300 },
      { kind: 'title', id: 'abobora', text: 'Abóbora Maldita' },
    ],
  },
  {
    id: 'fds_so_supers',
    name: 'Fim de Semana Só Supers',
    desc: 'Todo sábado e domingo: o super enche 4x mais rápido e o XP do passe vem em dobro.',
    start: '2026-01-01T00:00:00-03:00',
    end: '2027-12-31T23:59:59-03:00',
    banner: { color: '#ffd23f', color2: '#7a2aff', emoji: '🌀' },
    multipliers: { passXp: 2 },
    modeId: 'so_super',
    weekly: [0, 6],
  },
  {
    id: 'quarta_chefao',
    name: 'Quarta da Caveira Gigante',
    desc: 'Toda quarta e quinta: juntem forças contra a Caveira Gigante. Vitória = moedas em dobro.',
    start: '2026-01-01T00:00:00-03:00',
    end: '2027-12-31T23:59:59-03:00',
    banner: { color: '#ff3d4d', color2: '#1a0a2a', emoji: '👑' },
    multipliers: { moedas: 2 },
    modeId: 'chefao',
    weekly: [3, 4],
  },
  {
    id: 'natal_neon_2026',
    name: 'Natal Neon',
    desc: 'Presente todo dia, moedas x1,5 e um título exclusivo.',
    start: '2026-12-18T00:00:00-03:00',
    end: '2027-01-06T23:59:59-03:00',
    banner: { color: '#3dff9a', color2: '#ff3d4d', emoji: '🎄' },
    multipliers: { moedas: 1.5, xp: 1.5 },
    loginGift: [
      { kind: 'chest', id: 'bau_mega' },
      { kind: 'title', id: 'natal', text: 'Papai Caveira' },
    ],
  },
];

/** Agora (dá pra "viajar no tempo" pra testar: localStorage skull.now = '2026-12-20') */
export function now(): Date {
  try {
    const fake = typeof localStorage !== 'undefined' ? localStorage.getItem('skull.now') : null;
    if (fake) return new Date(fake);
  } catch {
    /* sem storage */
  }
  return new Date();
}

export function isEventActive(e: EventDef, at: Date = now()): boolean {
  const t = at.getTime();
  if (t < Date.parse(e.start) || t > Date.parse(e.end)) return false;
  if (e.weekly && !e.weekly.includes(at.getDay())) return false;
  return true;
}

export function activeEvents(at: Date = now()): EventDef[] {
  return EVENTS.filter((e) => isEventActive(e, at));
}

/** Próximos eventos (que ainda não começaram) — pra mostrar "em breve". */
export function upcomingEvents(at: Date = now(), days = 30): EventDef[] {
  const t = at.getTime();
  return EVENTS.filter((e) => !e.weekly && Date.parse(e.start) > t && Date.parse(e.start) - t < days * 86400000);
}

/** Multiplicador combinado dos eventos ativos. */
export function eventMultiplier(kind: 'moedas' | 'xp' | 'trophies' | 'passXp', at: Date = now()): number {
  return activeEvents(at).reduce((m, e) => m * (e.multipliers?.[kind] ?? 1), 1);
}

/** Quanto falta pro evento acabar (texto curto). */
export function timeLeftText(e: EventDef, at: Date = now()): string {
  let end = Date.parse(e.end);
  if (e.weekly) {
    // evento semanal: acaba no fim do dia (ou do bloco de dias seguidos)
    const d = new Date(at);
    d.setHours(23, 59, 59, 999);
    while (e.weekly.includes((d.getDay() + 1) % 7) && d.getTime() < end) d.setDate(d.getDate() + 1);
    end = Math.min(end, d.getTime());
  }
  const ms = Math.max(0, end - at.getTime());
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h ${Math.floor((ms % 3600000) / 60000)}min`;
  return `${Math.max(1, Math.floor(ms / 60000))}min`;
}
