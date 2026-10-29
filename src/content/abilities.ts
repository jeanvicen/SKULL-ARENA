import type { AbilityDef, ProjLook, ProjectileDef, StatusApply, SummonDef, ZoneEffect } from './types';

/**
 * BIBLIOTECA DE HABILIDADES (receitas prontas)
 * --------------------------------------------
 * Funções que montam habilidades com números ajustáveis. Personagens feitos à mão
 * e o gerador usam estas receitas. Pra uma habilidade 100% nova, escreva o objeto
 * AbilityDef direto no arquivo do personagem (veja kaze.ts como exemplo).
 *
 * Valores de referência: vida 3000–6500 · dano por tiro 300–1600 · alcance 200–820 px
 * · 1 bloco do mapa = 64 px.
 */

export const look = (shape: ProjLook['shape'], color: string, extra: Partial<ProjLook> = {}): ProjLook => ({ shape, color, ...extra });

export function proj(p: Partial<ProjectileDef> & Pick<ProjectileDef, 'damage' | 'look'>): ProjectileDef {
  return { speed: 1200, range: 500, radius: 10, ...p };
}

// ===========================================================================
// ATAQUES BÁSICOS
// ===========================================================================

export const atk = {
  /** rajada de N balas seguidas */
  burst(o: { name: string; dmg: number; range?: number; n?: number; color?: string; shape?: ProjLook['shape']; sfx?: string }): AbilityDef {
    return {
      id: 'atk_burst',
      name: o.name,
      desc: `Rajada de ${o.n ?? 3} tiros rápidos.`,
      icon: '🔫',
      aim: 'direction',
      range: o.range ?? 560,
      indicator: 'line',
      indicatorSize: 18,
      pose: 'shoot',
      sfx: o.sfx ?? 'pistol',
      cooldown: 0.42,
      effects: [
        {
          kind: 'projectile',
          burst: o.n ?? 3,
          burstDelay: 0.07,
          proj: proj({ damage: o.dmg, speed: 1500, range: o.range ?? 560, radius: 9, look: look(o.shape ?? 'bullet', o.color ?? '#ffe08a', { trail: 'spark' }) }),
        },
      ],
    };
  },
  /** espingarda: leque de balas, forte de perto */
  shotgun(o: { name: string; dmg: number; range?: number; n?: number; spread?: number; color?: string; shape?: ProjLook['shape']; knock?: number; sfx?: string }): AbilityDef {
    const n = o.n ?? 5;
    return {
      id: 'atk_shotgun',
      name: o.name,
      desc: `Leque de ${n} projéteis. Devastador de perto.`,
      icon: '💥',
      aim: 'direction',
      range: o.range ?? 330,
      indicator: 'cone',
      indicatorSize: o.spread ?? 34,
      pose: 'shoot',
      sfx: o.sfx ?? 'shotgun',
      cooldown: 0.5,
      effects: [
        {
          kind: 'projectile',
          count: n,
          spread: o.spread ?? 34,
          proj: proj({
            damage: o.dmg,
            speed: 1300,
            range: o.range ?? 330,
            radius: 10,
            falloff: 0.6,
            knockback: o.knock ?? 60,
            look: look(o.shape ?? 'bullet', o.color ?? '#ffcf6b', { trail: 'spark' }),
          }),
        },
      ],
    };
  },
  /** tiro único de longe que fica mais forte com a distância */
  sniper(o: { name: string; dmg: number; range?: number; color?: string; shape?: ProjLook['shape']; pierce?: boolean; sfx?: string }): AbilityDef {
    return {
      id: 'atk_sniper',
      name: o.name,
      desc: 'Tiro de longe. Quanto mais longe acerta, mais dói.',
      icon: '🎯',
      aim: 'direction',
      range: o.range ?? 820,
      indicator: 'line',
      indicatorSize: 14,
      pose: 'shoot',
      sfx: o.sfx ?? 'sniper',
      cooldown: 0.6,
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 2100,
            range: o.range ?? 820,
            radius: 11,
            ramp: 0.45,
            pierce: o.pierce ? 2 : 0,
            look: look(o.shape ?? 'bolt', o.color ?? '#9ef0ff', { trail: 'glow', size: 1.2 }),
          }),
        },
      ],
    };
  },
  /** arremesso por cima das paredes que explode */
  lob(o: { name: string; dmg: number; radius?: number; range?: number; color?: string; shape?: ProjLook['shape']; zone?: ZoneEffect; status?: StatusApply; sfx?: string }): AbilityDef {
    return {
      id: 'atk_lob',
      name: o.name,
      desc: 'Arremessa por cima das paredes e explode na área.',
      icon: '💣',
      aim: 'point',
      range: o.range ?? 520,
      indicator: 'circle',
      indicatorSize: o.radius ?? 90,
      pose: 'throw',
      sfx: o.sfx ?? 'throw',
      cooldown: 0.55,
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 900,
            range: o.range ?? 520,
            radius: 14,
            lob: true,
            explode: { radius: o.radius ?? 90, damage: o.dmg, knockback: 160, zone: o.zone, status: o.status },
            look: look(o.shape ?? 'skull', o.color ?? '#ff9d3d', { spin: true, trail: 'smoke' }),
          }),
        },
      ],
    };
  },
  /** golpe corpo a corpo em arco */
  melee(o: { name: string; dmg: number; range?: number; arc?: number; knock?: number; status?: StatusApply; lifesteal?: number; sfx?: string; heavy?: boolean }): AbilityDef {
    return {
      id: 'atk_melee',
      name: o.name,
      desc: 'Golpe corpo a corpo em arco. Quebra parede.',
      icon: '🗡️',
      aim: 'direction',
      range: o.range ?? 150,
      indicator: 'cone',
      indicatorSize: o.arc ?? 110,
      pose: 'swing',
      sfx: o.sfx ?? (o.heavy ? 'heavy_swing' : 'swing'),
      cooldown: o.heavy ? 0.55 : 0.4,
      castTime: o.heavy ? 0.12 : 0.05,
      effects: [{ kind: 'melee', range: o.range ?? 150, arc: o.arc ?? 110, damage: o.dmg, knockback: o.knock ?? 120, status: o.status, lifesteal: o.lifesteal, wallDamage: 1.2 }],
    };
  },
  /** bumerangue: vai e volta acertando duas vezes */
  boomerang(o: { name: string; dmg: number; range?: number; color?: string; shape?: ProjLook['shape']; sfx?: string }): AbilityDef {
    return {
      id: 'atk_boomerang',
      name: o.name,
      desc: 'Vai e volta, atravessando inimigos nas duas direções.',
      icon: '🪃',
      aim: 'direction',
      range: o.range ?? 480,
      indicator: 'line',
      indicatorSize: 26,
      pose: 'throw',
      sfx: o.sfx ?? 'whoosh',
      cooldown: 0.55,
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 950,
            range: o.range ?? 480,
            radius: 16,
            boomerang: true,
            pierce: true,
            look: look(o.shape ?? 'blade', o.color ?? '#d9e2f2', { spin: true, trail: 'glow' }),
          }),
        },
      ],
    };
  },
  /** projétil que pula entre inimigos */
  chain(o: { name: string; dmg: number; range?: number; color?: string; jumps?: number; sfx?: string }): AbilityDef {
    return {
      id: 'atk_chain',
      name: o.name,
      desc: `Raio que pula em até ${o.jumps ?? 2} inimigos próximos.`,
      icon: '⚡',
      aim: 'direction',
      range: o.range ?? 520,
      indicator: 'line',
      indicatorSize: 16,
      pose: 'cast',
      sfx: o.sfx ?? 'zap',
      cooldown: 0.5,
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 1600,
            range: o.range ?? 520,
            radius: 12,
            chain: { count: o.jumps ?? 2, range: 260, falloff: 0.7 },
            look: look('bolt', o.color ?? '#7df9ff', { trail: 'glow' }),
          }),
        },
      ],
    };
  },
  /** ondas que atravessam (som, vento, energia) */
  wave(o: { name: string; dmg: number; range?: number; color?: string; shape?: ProjLook['shape']; heal?: number; n?: number; spread?: number; sfx?: string }): AbilityDef {
    const n = o.n ?? 1;
    return {
      id: 'atk_wave',
      name: o.name,
      desc: o.heal ? 'Onda que atravessa: fere inimigos e cura aliados.' : 'Onda larga que atravessa inimigos.',
      icon: '〰️',
      aim: 'direction',
      range: o.range ?? 480,
      indicator: n > 1 ? 'cone' : 'line',
      indicatorSize: n > 1 ? (o.spread ?? 24) : 40,
      pose: 'play',
      sfx: o.sfx ?? 'wave',
      cooldown: 0.5,
      effects: [
        {
          kind: 'projectile',
          count: n,
          spread: o.spread ?? 24,
          proj: proj({ damage: o.dmg, speed: 900, range: o.range ?? 480, radius: 22, pierce: true, heal: o.heal, look: look(o.shape ?? 'wave', o.color ?? '#7dffcf', { trail: 'glow', size: 1.2 }) }),
        },
      ],
    };
  },
  /** orbes teleguiados lentos */
  homing(o: { name: string; dmg: number; range?: number; color?: string; n?: number; shape?: ProjLook['shape']; sfx?: string }): AbilityDef {
    const n = o.n ?? 2;
    return {
      id: 'atk_homing',
      name: o.name,
      desc: `${n} orbes que perseguem o inimigo mais perto.`,
      icon: '🔮',
      aim: 'direction',
      range: o.range ?? 520,
      indicator: 'cone',
      indicatorSize: 30,
      pose: 'cast',
      sfx: o.sfx ?? 'magic',
      cooldown: 0.5,
      effects: [
        {
          kind: 'projectile',
          count: n,
          spread: 28,
          proj: proj({ damage: o.dmg, speed: 760, range: o.range ?? 520, radius: 13, homing: 3.2, look: look(o.shape ?? 'orb', o.color ?? '#c58bff', { trail: 'glow' }) }),
        },
      ],
    };
  },
  /** jato curto contínuo (lança-chamas, spray) */
  spray(o: { name: string; dmg: number; range?: number; color?: string; status?: StatusApply; shape?: ProjLook['shape']; sfx?: string }): AbilityDef {
    return {
      id: 'atk_spray',
      name: o.name,
      desc: 'Jato curto que atravessa e deixa efeito.',
      icon: '🔥',
      aim: 'direction',
      range: o.range ?? 280,
      indicator: 'cone',
      indicatorSize: 26,
      pose: 'shoot',
      sfx: o.sfx ?? 'flame',
      cooldown: 0.45,
      effects: [
        {
          kind: 'projectile',
          count: 4,
          spread: 22,
          burst: 2,
          burstDelay: 0.09,
          proj: proj({ damage: o.dmg, speed: 820, range: o.range ?? 280, radius: 16, pierce: true, status: o.status, look: look(o.shape ?? 'fire', o.color ?? '#ff8a3d', { trail: 'fire' }) }),
        },
      ],
    };
  },
  /** tiros ricocheteando nas paredes */
  ricochet(o: { name: string; dmg: number; range?: number; color?: string; n?: number; shape?: ProjLook['shape']; sfx?: string }): AbilityDef {
    return {
      id: 'atk_ricochet',
      name: o.name,
      desc: 'Projéteis que ricocheteiam nas paredes.',
      icon: '↩️',
      aim: 'direction',
      range: o.range ?? 600,
      indicator: 'cone',
      indicatorSize: 14,
      pose: 'shoot',
      sfx: o.sfx ?? 'pistol',
      cooldown: 0.42,
      effects: [
        {
          kind: 'projectile',
          count: o.n ?? 2,
          spread: 8,
          proj: proj({ damage: o.dmg, speed: 1250, range: o.range ?? 600, radius: 10, bounces: 2, look: look(o.shape ?? 'coin', o.color ?? '#ffd23f', { spin: true, trail: 'spark' }) }),
        },
      ],
    };
  },
  /** cartas/lâminas em leque fino de longe */
  fan(o: { name: string; dmg: number; range?: number; color?: string; n?: number; shape?: ProjLook['shape']; sfx?: string; status?: StatusApply }): AbilityDef {
    const n = o.n ?? 3;
    return {
      id: 'atk_fan',
      name: o.name,
      desc: `${n} projéteis em leque.`,
      icon: '🃏',
      aim: 'direction',
      range: o.range ?? 600,
      indicator: 'cone',
      indicatorSize: 20,
      pose: 'throw',
      sfx: o.sfx ?? 'throw_light',
      cooldown: 0.45,
      effects: [
        {
          kind: 'projectile',
          count: n,
          spread: 20,
          proj: proj({ damage: o.dmg, speed: 1300, range: o.range ?? 600, radius: 10, status: o.status, look: look(o.shape ?? 'card', o.color ?? '#f7f4ec', { spin: true }) }),
        },
      ],
    };
  },
  /** soco rápido de curto alcance com empurrão */
  punch(o: { name: string; dmg: number; range?: number; knock?: number; sfx?: string }): AbilityDef {
    return {
      id: 'atk_punch',
      name: o.name,
      desc: 'Combo de socos curtos com empurrão.',
      icon: '👊',
      aim: 'direction',
      range: o.range ?? 130,
      indicator: 'cone',
      indicatorSize: 70,
      pose: 'swing',
      sfx: o.sfx ?? 'punch',
      cooldown: 0.3,
      effects: [
        { kind: 'melee', range: o.range ?? 130, arc: 70, damage: o.dmg * 0.5, knockback: 40 },
        { kind: 'melee', range: o.range ?? 130, arc: 70, damage: o.dmg * 0.5, knockback: o.knock ?? 220, delay: 0.12 },
      ],
    };
  },
};

// ===========================================================================
// HABILIDADES (botões com recarga)
// ===========================================================================

export const skill = {
  dash(o: { name?: string; dist?: number; dmg?: number; cd?: number; knock?: number; status?: StatusApply; invuln?: boolean } = {}): AbilityDef {
    return {
      id: 'sk_dash',
      name: o.name ?? 'Arrancada',
      desc: o.dmg ? 'Avança rápido derrubando quem estiver no caminho.' : 'Avança rápido na direção mirada.',
      icon: '💨',
      cooldown: o.cd ?? 6,
      aim: 'direction',
      range: o.dist ?? 300,
      indicator: 'line',
      indicatorSize: 40,
      pose: 'dash',
      sfx: 'dash',
      effects: [{ kind: 'dash', distance: o.dist ?? 300, speed: 1600, damage: o.dmg, knockback: o.knock ?? (o.dmg ? 300 : 0), status: o.status, invuln: o.invuln }],
    };
  },
  blink(o: { name?: string; dist?: number; cd?: number; dmg?: number } = {}): AbilityDef {
    const effects: AbilityDef['effects'] = [{ kind: 'blink', distance: o.dist ?? 280 }];
    if (o.dmg) effects.push({ kind: 'aoe', at: 'self', radius: 110, damage: o.dmg, knockback: 200, fx: '#b77bff' });
    return {
      id: 'sk_blink',
      name: o.name ?? 'Teleporte',
      desc: o.dmg ? 'Teleporta e explode ao chegar.' : 'Teleporta na direção mirada (atravessa paredes finas).',
      icon: '✨',
      cooldown: o.cd ?? 8,
      aim: 'direction',
      range: o.dist ?? 280,
      indicator: 'line',
      indicatorSize: 30,
      pose: 'cast',
      sfx: 'blink',
      effects,
    };
  },
  heal(o: { name?: string; amount: number; radius?: number; cd?: number }): AbilityDef {
    return {
      id: 'sk_heal',
      name: o.name ?? 'Pulso de Cura',
      desc: `Cura ${o.amount} de vida (você${o.radius ? ' e aliados perto' : ''}).`,
      icon: '💚',
      cooldown: o.cd ?? 10,
      aim: 'self',
      range: o.radius ?? 0,
      indicator: o.radius ? 'circle' : 'none',
      indicatorSize: o.radius,
      pose: 'cast',
      sfx: 'heal',
      effects: [{ kind: 'heal', amount: o.amount, radius: o.radius }],
    };
  },
  shield(o: { name?: string; amount: number; dur?: number; radius?: number; cd?: number }): AbilityDef {
    return {
      id: 'sk_shield',
      name: o.name ?? 'Escudo',
      desc: `Escudo de ${o.amount} por ${o.dur ?? 4}s${o.radius ? ' pra você e aliados perto' : ''}.`,
      icon: '🛡️',
      cooldown: o.cd ?? 10,
      aim: 'self',
      range: o.radius ?? 0,
      indicator: o.radius ? 'circle' : 'none',
      indicatorSize: o.radius,
      pose: 'cast',
      sfx: 'shield',
      effects: [{ kind: 'shield', amount: o.amount, duration: o.dur ?? 4, radius: o.radius }],
    };
  },
  haste(o: { name?: string; mult?: number; dur?: number; radius?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_haste',
      name: o.name ?? 'Turbo',
      desc: `+${Math.round(((o.mult ?? 1.4) - 1) * 100)}% de velocidade por ${o.dur ?? 3}s.`,
      icon: '⚡',
      cooldown: o.cd ?? 9,
      aim: 'self',
      range: o.radius ?? 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'buff',
      effects: [{ kind: 'buff', stat: 'speed', mult: o.mult ?? 1.4, duration: o.dur ?? 3, radius: o.radius }],
    };
  },
  rage(o: { name?: string; mult?: number; dur?: number; radius?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_rage',
      name: o.name ?? 'Fúria',
      desc: `+${Math.round(((o.mult ?? 1.3) - 1) * 100)}% de dano por ${o.dur ?? 4}s.`,
      icon: '😤',
      cooldown: o.cd ?? 11,
      aim: 'self',
      range: o.radius ?? 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'buff',
      effects: [{ kind: 'buff', stat: 'damage', mult: o.mult ?? 1.3, duration: o.dur ?? 4, radius: o.radius }],
    };
  },
  armor(o: { name?: string; mult?: number; dur?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_armor',
      name: o.name ?? 'Casca Dura',
      desc: `Reduz ${Math.round(((o.mult ?? 1.4) - 1) * 100)}% do dano recebido por ${o.dur ?? 3}s.`,
      icon: '🪨',
      cooldown: o.cd ?? 11,
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'shield',
      effects: [{ kind: 'buff', stat: 'armor', mult: o.mult ?? 1.4, duration: o.dur ?? 3 }],
    };
  },
  grenade(o: { name?: string; dmg: number; radius?: number; range?: number; cd?: number; color?: string; status?: StatusApply; shape?: ProjLook['shape'] }): AbilityDef {
    return {
      id: 'sk_grenade',
      name: o.name ?? 'Granada',
      desc: `Arremessa uma bomba que explode em área${o.status ? ' e aplica efeito' : ''}.`,
      icon: '💣',
      cooldown: o.cd ?? 7,
      aim: 'point',
      range: o.range ?? 480,
      indicator: 'circle',
      indicatorSize: o.radius ?? 110,
      pose: 'throw',
      sfx: 'throw',
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 850,
            range: o.range ?? 480,
            radius: 14,
            lob: true,
            explode: { radius: o.radius ?? 110, damage: o.dmg, knockback: 280, status: o.status },
            look: look(o.shape ?? 'skull', o.color ?? '#ff6a3d', { spin: true, trail: 'smoke', size: 1.3 }),
          }),
        },
      ],
    };
  },
  nova(o: { name?: string; dmg: number; radius?: number; status?: StatusApply; knock?: number; cd?: number; color?: string; pull?: number }): AbilityDef {
    return {
      id: 'sk_nova',
      name: o.name ?? 'Explosão',
      desc: `Explode em volta de você${o.status ? ' aplicando efeito' : ''}${o.pull ? ' e puxa os inimigos' : ''}.`,
      icon: '💥',
      cooldown: o.cd ?? 9,
      aim: 'self',
      range: o.radius ?? 160,
      indicator: 'circle',
      indicatorSize: o.radius ?? 160,
      pose: 'slam',
      sfx: 'boom',
      effects: [{ kind: 'aoe', at: 'self', radius: o.radius ?? 160, damage: o.dmg, status: o.status, knockback: o.knock ?? (o.pull ? 0 : 340), pull: o.pull, fx: o.color, wallDamage: 1 }],
    };
  },
  zone(o: {
    name?: string;
    radius?: number;
    dur?: number;
    dps?: number;
    hps?: number;
    status?: StatusApply;
    kind: ZoneEffect['look']['kind'];
    color: string;
    range?: number;
    cd?: number;
    atSelf?: boolean;
  }): AbilityDef {
    const atSelf = !!o.atSelf;
    return {
      id: 'sk_zone',
      name: o.name ?? 'Zona',
      desc: `Cria uma área por ${o.dur ?? 4}s${o.dps ? ` que causa ${o.dps}/s` : ''}${o.hps ? ` que cura ${o.hps}/s` : ''}${o.status ? ' com efeito' : ''}.`,
      icon: o.hps ? '🌿' : '☠️',
      cooldown: o.cd ?? 10,
      aim: atSelf ? 'self' : 'point',
      range: atSelf ? (o.radius ?? 130) : (o.range ?? 460),
      indicator: 'circle',
      indicatorSize: o.radius ?? 130,
      pose: 'cast',
      sfx: 'zone',
      effects: [{ kind: 'zone', at: atSelf ? 'self' : 'target', radius: o.radius ?? 130, duration: o.dur ?? 4, dps: o.dps, hps: o.hps, status: o.status, look: { color: o.color, kind: o.kind } }],
    };
  },
  turret(o: { name?: string; hp?: number; dmg: number; dur?: number; cd?: number; color?: string; range?: number; interval?: number; kind?: SummonDef['look']['kind'] }): AbilityDef {
    const unit: SummonDef = {
      id: 'turret',
      name: o.name ?? 'Torreta',
      hp: o.hp ?? 1600,
      duration: o.dur ?? 9,
      speed: 0,
      radius: 22,
      attack: {
        projectile: proj({ damage: o.dmg, speed: 1300, range: o.range ?? 520, radius: 9, look: look('bullet', o.color ?? '#7df9ff', { trail: 'glow' }) }),
        interval: o.interval ?? 0.7,
        range: o.range ?? 520,
      },
      look: { kind: o.kind ?? 'turret', color: o.color ?? '#7df9ff' },
    };
    return {
      id: 'sk_turret',
      name: o.name ?? 'Torreta',
      desc: `Coloca uma torreta que atira sozinha por ${unit.duration}s.`,
      icon: '🗼',
      cooldown: o.cd ?? 12,
      aim: 'point',
      range: 220,
      indicator: 'circle',
      indicatorSize: 40,
      pose: 'throw',
      sfx: 'deploy',
      effects: [{ kind: 'summon', at: 'target', unit }],
    };
  },
  minions(o: { name?: string; n?: number; hp?: number; dmg: number; dur?: number; cd?: number; color?: string; kind?: SummonDef['look']['kind'] }): AbilityDef {
    const unit: SummonDef = {
      id: 'minion',
      name: o.name ?? 'Capanga',
      hp: o.hp ?? 900,
      duration: o.dur ?? 10,
      speed: 230,
      radius: 18,
      attack: { projectile: proj({ damage: o.dmg, speed: 900, range: 140, radius: 14, look: look('bone', o.color ?? '#efe6d2') }), interval: 0.6, range: 140 },
      look: { kind: o.kind ?? 'skeleton', color: o.color ?? '#efe6d2' },
    };
    return {
      id: 'sk_minions',
      name: o.name ?? 'Capangas',
      desc: `Invoca ${o.n ?? 2} capangas que perseguem inimigos.`,
      icon: '💀',
      cooldown: o.cd ?? 13,
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'summon',
      effects: [{ kind: 'summon', at: 'self', unit, count: o.n ?? 2 }],
    };
  },
  healTotem(o: { name?: string; hps: number; radius?: number; dur?: number; cd?: number; color?: string }): AbilityDef {
    const unit: SummonDef = {
      id: 'totem',
      name: o.name ?? 'Totem',
      hp: 1400,
      duration: o.dur ?? 8,
      speed: 0,
      radius: 20,
      healAura: { radius: o.radius ?? 200, hps: o.hps },
      look: { kind: 'speaker', color: o.color ?? '#5dffa0' },
    };
    return {
      id: 'sk_totem',
      name: o.name ?? 'Totem de Cura',
      desc: `Coloca um totem que cura ${o.hps}/s em volta.`,
      icon: '📻',
      cooldown: o.cd ?? 14,
      aim: 'point',
      range: 200,
      indicator: 'circle',
      indicatorSize: o.radius ?? 200,
      pose: 'throw',
      sfx: 'deploy',
      effects: [{ kind: 'summon', at: 'target', unit }],
    };
  },
  wall(o: { name?: string; len?: number; hp?: number; dur?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_wall',
      name: o.name ?? 'Barricada',
      desc: `Levanta uma parede temporária por ${o.dur ?? 6}s.`,
      icon: '🧱',
      cooldown: o.cd ?? 12,
      aim: 'point',
      range: 300,
      indicator: 'line',
      indicatorSize: o.len ?? 192,
      pose: 'slam',
      sfx: 'wall',
      effects: [{ kind: 'wall', at: 'target', length: o.len ?? 192, hp: o.hp ?? 2000, duration: o.dur ?? 6 }],
    };
  },
  trap(o: { name?: string; dmg: number; n?: number; status?: StatusApply; cd?: number; dur?: number }): AbilityDef {
    return {
      id: 'sk_trap',
      name: o.name ?? 'Armadilha',
      desc: `Esconde ${o.n ?? 1} armadilha(s) no chão${o.status ? ' que prendem o inimigo' : ''}.`,
      icon: '🪤',
      cooldown: o.cd ?? 9,
      aim: 'point',
      range: 320,
      indicator: 'circle',
      indicatorSize: 40,
      pose: 'throw',
      sfx: 'deploy',
      effects: [{ kind: 'trap', at: 'target', radius: 34, damage: o.dmg, status: o.status, duration: o.dur ?? 14, count: o.n ?? 1 }],
    };
  },
  hook(o: { name?: string; dmg: number; range?: number; cd?: number; color?: string }): AbilityDef {
    return {
      id: 'sk_hook',
      name: o.name ?? 'Gancho',
      desc: 'Lança um gancho que puxa o inimigo até você.',
      icon: '🪝',
      cooldown: o.cd ?? 10,
      aim: 'direction',
      range: o.range ?? 520,
      indicator: 'line',
      indicatorSize: 20,
      pose: 'throw',
      sfx: 'chain',
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 1500,
            range: o.range ?? 520,
            radius: 14,
            pull: 900,
            status: { kind: 'slow', duration: 1, power: 0.4 },
            look: look('blade', o.color ?? '#c9ccd6', { trail: 'spark' }),
          }),
        },
      ],
    };
  },
  stealth(o: { name?: string; dur?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_stealth',
      name: o.name ?? 'Sumir',
      desc: `Fica invisível por ${o.dur ?? 3}s (inimigo colado ainda te vê).`,
      icon: '👻',
      cooldown: o.cd ?? 12,
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'stealth',
      effects: [
        { kind: 'stealth', duration: o.dur ?? 3 },
        { kind: 'buff', stat: 'speed', mult: 1.2, duration: o.dur ?? 3 },
      ],
    };
  },
  clone(o: { name?: string; hp?: number; dur?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_clone',
      name: o.name ?? 'Clone',
      desc: 'Solta um clone que corre na direção mirada enquanto você some.',
      icon: '🪞',
      cooldown: o.cd ?? 12,
      aim: 'direction',
      range: 400,
      indicator: 'line',
      indicatorSize: 30,
      pose: 'cast',
      sfx: 'stealth',
      effects: [{ kind: 'clone', duration: o.dur ?? 4, hp: o.hp ?? 1200 }],
    };
  },
  barrage(o: { name?: string; dmg: number; n?: number; range?: number; cd?: number; color?: string; shape?: ProjLook['shape'] }): AbilityDef {
    return {
      id: 'sk_barrage',
      name: o.name ?? 'Saraivada',
      desc: `Dispara ${o.n ?? 8} projéteis em sequência.`,
      icon: '🚀',
      cooldown: o.cd ?? 9,
      aim: 'direction',
      range: o.range ?? 560,
      indicator: 'cone',
      indicatorSize: 18,
      pose: 'shoot',
      sfx: 'barrage',
      effects: [
        {
          kind: 'projectile',
          burst: o.n ?? 8,
          burstDelay: 0.06,
          spread: 16,
          proj: proj({ damage: o.dmg, speed: 1300, range: o.range ?? 560, radius: 11, look: look(o.shape ?? 'bullet', o.color ?? '#ffd23f', { trail: 'smoke' }) }),
        },
      ],
    };
  },
  laser(o: { name?: string; dps: number; len?: number; dur?: number; cd?: number; color?: string; status?: StatusApply }): AbilityDef {
    return {
      id: 'sk_laser',
      name: o.name ?? 'Laser',
      desc: `Feixe contínuo por ${o.dur ?? 1.5}s que segue sua mira.`,
      icon: '🔦',
      cooldown: o.cd ?? 11,
      aim: 'direction',
      range: o.len ?? 600,
      indicator: 'line',
      indicatorSize: 28,
      pose: 'cast',
      sfx: 'laser',
      effects: [{ kind: 'beam', length: o.len ?? 600, width: 34, duration: o.dur ?? 1.5, dps: o.dps, color: o.color ?? '#ff3df2', status: o.status }],
    };
  },
  blades(o: { name?: string; dmg: number; n?: number; radius?: number; dur?: number; cd?: number; color?: string; shape?: ProjLook['shape'] }): AbilityDef {
    return {
      id: 'sk_orbit',
      name: o.name ?? 'Lâminas Giratórias',
      desc: `${o.n ?? 3} projéteis giram em volta de você por ${o.dur ?? 4}s.`,
      icon: '🌀',
      cooldown: o.cd ?? 11,
      aim: 'self',
      range: o.radius ?? 90,
      indicator: 'circle',
      indicatorSize: o.radius ?? 90,
      pose: 'cast',
      sfx: 'whoosh',
      effects: [
        {
          kind: 'orbit',
          count: o.n ?? 3,
          radius: o.radius ?? 90,
          duration: o.dur ?? 4,
          proj: proj({ damage: o.dmg, speed: 0, range: 1e9, radius: 16, look: look(o.shape ?? 'blade', o.color ?? '#d9e2f2', { spin: true, trail: 'glow' }) }),
        },
      ],
    };
  },
  rewind(o: { name?: string; secs?: number; heal?: number; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_rewind',
      name: o.name ?? 'Voltar no Tempo',
      desc: `Volta pra onde estava ${o.secs ?? 3}s atrás, com a vida daquela hora.`,
      icon: '⏪',
      cooldown: o.cd ?? 16,
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'rewind',
      effects: [{ kind: 'rewind', seconds: o.secs ?? 3, heal: o.heal }],
    };
  },
  cleanse(o: { name?: string; radius?: number; cd?: number; heal?: number } = {}): AbilityDef {
    const effects: AbilityDef['effects'] = [{ kind: 'cleanse', radius: o.radius ?? 220 }];
    if (o.heal) effects.push({ kind: 'heal', amount: o.heal, radius: o.radius ?? 220 });
    return {
      id: 'sk_cleanse',
      name: o.name ?? 'Purificar',
      desc: 'Remove lentidão, veneno e atordoamento de você e aliados perto.',
      icon: '✨',
      cooldown: o.cd ?? 12,
      aim: 'self',
      range: o.radius ?? 220,
      indicator: 'circle',
      indicatorSize: o.radius ?? 220,
      pose: 'cast',
      sfx: 'heal',
      effects,
    };
  },
  reload(o: { name?: string; cd?: number } = {}): AbilityDef {
    return {
      id: 'sk_reload',
      name: o.name ?? 'Recarga Rápida',
      desc: 'Recarrega toda a munição na hora e acelera a recarga.',
      icon: '🔄',
      cooldown: o.cd ?? 10,
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'reload',
      effects: [
        { kind: 'ammo', amount: 9 },
        { kind: 'buff', stat: 'reload', mult: 1.8, duration: 3 },
      ],
    };
  },
  freeze(o: { name?: string; dmg: number; radius?: number; dur?: number; cd?: number }): AbilityDef {
    return {
      id: 'sk_freeze',
      name: o.name ?? 'Congelar',
      desc: 'Explosão de gelo que congela quem estiver perto.',
      icon: '❄️',
      cooldown: o.cd ?? 12,
      aim: 'self',
      range: o.radius ?? 150,
      indicator: 'circle',
      indicatorSize: o.radius ?? 150,
      pose: 'slam',
      sfx: 'freeze',
      effects: [{ kind: 'aoe', at: 'self', radius: o.radius ?? 150, damage: o.dmg, status: { kind: 'freeze', duration: o.dur ?? 1.2 }, fx: '#9ef0ff' }],
    };
  },
};

// ===========================================================================
// SUPERS (carregam causando dano)
// ===========================================================================

export const sup = {
  rain(o: { name: string; dmg: number; radius?: number; range?: number; color?: string; shape?: ProjLook['shape']; n?: number }): AbilityDef {
    const n = o.n ?? 6;
    const effects: AbilityDef['effects'] = [];
    for (let i = 0; i < n; i++)
      effects.push({ kind: 'aoe', at: 'target', radius: o.radius ?? 150, damage: o.dmg / n, knockback: 60, delay: 0.25 + i * 0.12, fx: o.color ?? '#ffd23f', wallDamage: 0.8 });
    return {
      id: 'sp_rain',
      name: o.name,
      desc: `Chuva de ataques numa área grande (${o.dmg} de dano total).`,
      icon: '🌧️',
      aim: 'point',
      range: o.range ?? 620,
      indicator: 'circle',
      indicatorSize: o.radius ?? 150,
      pose: 'cast',
      sfx: 'super_rain',
      effects,
    };
  },
  bigShot(o: { name: string; dmg: number; range?: number; color?: string; shape?: ProjLook['shape']; radius?: number; pierce?: boolean; explode?: number }): AbilityDef {
    return {
      id: 'sp_bigshot',
      name: o.name,
      desc: o.explode ? 'Disparo gigante que atravessa e explode no fim.' : 'Disparo gigante que atravessa tudo.',
      icon: '☄️',
      aim: 'direction',
      range: o.range ?? 760,
      indicator: 'line',
      indicatorSize: (o.radius ?? 30) * 2,
      pose: 'shoot',
      sfx: 'super_shot',
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 1250,
            range: o.range ?? 760,
            radius: o.radius ?? 30,
            pierce: o.pierce ?? true,
            knockback: 300,
            wallDamage: 3,
            explode: o.explode ? { radius: o.explode, damage: o.dmg * 0.6, knockback: 400 } : undefined,
            look: look(o.shape ?? 'skull', o.color ?? '#ff3d6e', { size: 2.2, trail: 'fire' }),
          }),
        },
      ],
    };
  },
  quake(o: { name: string; dmg: number; radius?: number; status?: StatusApply; color?: string }): AbilityDef {
    return {
      id: 'sp_quake',
      name: o.name,
      desc: 'Pula e cai causando um terremoto que atordoa e quebra paredes.',
      icon: '🌋',
      aim: 'point',
      range: 360,
      indicator: 'circle',
      indicatorSize: o.radius ?? 200,
      pose: 'slam',
      sfx: 'super_slam',
      effects: [
        { kind: 'leap', duration: 0.45 },
        {
          kind: 'aoe',
          at: 'target',
          radius: o.radius ?? 200,
          damage: o.dmg,
          knockback: 520,
          status: o.status ?? { kind: 'stun', duration: 0.9 },
          fx: o.color ?? '#ffb347',
          delay: 0.46,
          wallDamage: 2.5,
        },
      ],
    };
  },
  charge(o: { name: string; dmg: number; dist?: number; status?: StatusApply }): AbilityDef {
    return {
      id: 'sp_charge',
      name: o.name,
      desc: 'Investida imparável que atropela e derruba todo mundo no caminho.',
      icon: '🐂',
      aim: 'direction',
      range: o.dist ?? 520,
      indicator: 'line',
      indicatorSize: 64,
      pose: 'dash',
      sfx: 'super_charge',
      effects: [{ kind: 'dash', distance: o.dist ?? 520, speed: 1500, damage: o.dmg, radius: 50, knockback: 650, invuln: true, status: o.status ?? { kind: 'stun', duration: 0.6 } }],
    };
  },
  healField(o: { name: string; hps: number; radius?: number; dur?: number; dmg?: number }): AbilityDef {
    const effects: AbilityDef['effects'] = [{ kind: 'zone', at: 'target', radius: o.radius ?? 220, duration: o.dur ?? 5, hps: o.hps, look: { color: '#5dffa0', kind: 'music' } }];
    if (o.dmg) effects.push({ kind: 'aoe', at: 'target', radius: o.radius ?? 220, damage: o.dmg, knockback: 420, fx: '#5dffa0' });
    return {
      id: 'sp_heal',
      name: o.name,
      desc: `Área enorme de cura (${o.hps}/s)${o.dmg ? ' que empurra os inimigos pra longe' : ''}.`,
      icon: '💖',
      aim: 'point',
      range: 420,
      indicator: 'circle',
      indicatorSize: o.radius ?? 220,
      pose: 'play',
      sfx: 'super_heal',
      effects,
    };
  },
  storm(o: { name: string; dps: number; radius?: number; dur?: number; status?: StatusApply; kind: ZoneEffect['look']['kind']; color: string }): AbilityDef {
    return {
      id: 'sp_storm',
      name: o.name,
      desc: `Tempestade gigante por ${o.dur ?? 5}s que causa ${o.dps}/s.`,
      icon: '🌪️',
      aim: 'point',
      range: 560,
      indicator: 'circle',
      indicatorSize: o.radius ?? 230,
      pose: 'cast',
      sfx: 'super_storm',
      effects: [{ kind: 'zone', at: 'target', radius: o.radius ?? 230, duration: o.dur ?? 5, dps: o.dps, status: o.status, look: { color: o.color, kind: o.kind } }],
    };
  },
  army(o: { name: string; n?: number; dmg: number; hp?: number; color?: string; kind?: SummonDef['look']['kind'] }): AbilityDef {
    const s = skill.minions({ name: 'Exército', n: o.n ?? 4, dmg: o.dmg, hp: o.hp ?? 1300, dur: 14, color: o.color, kind: o.kind });
    return { ...s, id: 'sp_army', name: o.name, desc: `Invoca ${o.n ?? 4} capangas fortes que caçam inimigos.`, icon: '☠️', cooldown: undefined, sfx: 'super_summon' };
  },
  megaLaser(o: { name: string; dps: number; dur?: number; color?: string }): AbilityDef {
    const s = skill.laser({ name: o.name, dps: o.dps, len: 820, dur: o.dur ?? 2.6, color: o.color ?? '#ff3df2', status: { kind: 'slow', duration: 0.5, power: 0.3 } });
    return { ...s, id: 'sp_laser', cooldown: undefined, desc: `Feixe gigante por ${o.dur ?? 2.6}s que derrete tudo na frente.`, sfx: 'super_laser' };
  },
  fortress(o: { name: string; shield: number; radius?: number }): AbilityDef {
    return {
      id: 'sp_fortress',
      name: o.name,
      desc: 'Escudo enorme pro time inteiro em volta + parede de proteção.',
      icon: '🏰',
      aim: 'point',
      range: 300,
      indicator: 'circle',
      indicatorSize: o.radius ?? 260,
      pose: 'slam',
      sfx: 'super_shield',
      effects: [
        { kind: 'shield', amount: o.shield, duration: 5, radius: o.radius ?? 260 },
        { kind: 'wall', at: 'target', length: 320, hp: 3000, duration: 7 },
      ],
    };
  },
  shadowStrike(o: { name: string; dmg: number; dist?: number }): AbilityDef {
    return {
      id: 'sp_shadow',
      name: o.name,
      desc: 'Some, teleporta e explode em sombras no destino.',
      icon: '🌑',
      aim: 'point',
      range: o.dist ?? 460,
      indicator: 'circle',
      indicatorSize: 140,
      pose: 'cast',
      sfx: 'super_shadow',
      effects: [
        { kind: 'stealth', duration: 0.6 },
        { kind: 'blink', distance: o.dist ?? 460, delay: 0.15 },
        { kind: 'aoe', at: 'self', radius: 140, damage: o.dmg, knockback: 260, status: { kind: 'slow', duration: 1.5, power: 0.5 }, fx: '#7a3dff', delay: 0.2 },
      ],
    };
  },
  nuke(o: { name: string; dmg: number; radius?: number; range?: number; color?: string }): AbilityDef {
    return {
      id: 'sp_nuke',
      name: o.name,
      desc: 'Bomba gigante em arco que explode e deixa fogo no chão.',
      icon: '☢️',
      aim: 'point',
      range: o.range ?? 620,
      indicator: 'circle',
      indicatorSize: o.radius ?? 190,
      pose: 'throw',
      sfx: 'super_nuke',
      effects: [
        {
          kind: 'projectile',
          proj: proj({
            damage: o.dmg,
            speed: 780,
            range: o.range ?? 620,
            radius: 22,
            lob: true,
            explode: { radius: o.radius ?? 190, damage: o.dmg, knockback: 520, zone: { radius: (o.radius ?? 190) * 0.8, duration: 3, dps: 380, look: { color: '#ff6a2a', kind: 'fire' } } },
            look: look('skull', o.color ?? '#ff3d3d', { size: 2.4, spin: true, trail: 'fire' }),
          }),
        },
      ],
    };
  },
  frenzy(o: { name: string; dur?: number }): AbilityDef {
    return {
      id: 'sp_frenzy',
      name: o.name,
      desc: 'Entra em frenesi: mais dano, mais velocidade, recarga rápida e roubo de vida.',
      icon: '🔥',
      aim: 'self',
      range: 0,
      indicator: 'none',
      pose: 'cast',
      sfx: 'super_frenzy',
      effects: [
        { kind: 'buff', stat: 'damage', mult: 1.35, duration: o.dur ?? 6 },
        { kind: 'buff', stat: 'speed', mult: 1.3, duration: o.dur ?? 6 },
        { kind: 'buff', stat: 'reload', mult: 2, duration: o.dur ?? 6 },
        { kind: 'buff', stat: 'lifesteal', mult: 1.25, duration: o.dur ?? 6 },
        { kind: 'ammo', amount: 9 },
      ],
    };
  },
};

/** Pequenos atalhos de status */
export const st = {
  slow: (duration = 1.5, power = 0.35): StatusApply => ({ kind: 'slow', duration, power }),
  stun: (duration = 0.8): StatusApply => ({ kind: 'stun', duration }),
  burn: (duration = 3, power = 300): StatusApply => ({ kind: 'burn', duration, power }),
  poison: (duration = 3.5, power = 260): StatusApply => ({ kind: 'poison', duration, power }),
  freeze: (duration = 1): StatusApply => ({ kind: 'freeze', duration }),
  root: (duration = 1.2): StatusApply => ({ kind: 'root', duration }),
  silence: (duration = 2): StatusApply => ({ kind: 'silence', duration }),
  mark: (duration = 4, power = 0.2): StatusApply => ({ kind: 'mark', duration, power }),
  weaken: (duration = 3, power = 0.25): StatusApply => ({ kind: 'weaken', duration, power }),
};

/** Taxa de super: enche com ~`hits` acertos de `dmgPerAttack`. */
export function superRateFor(dmgPerAttack: number, hits = 4.5): number {
  return 1 / Math.max(200, dmgPerAttack * hits);
}
