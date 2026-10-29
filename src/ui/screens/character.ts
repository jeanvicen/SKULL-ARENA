import { audio } from '../../audio/audio';
import type { ClipName } from '../../art/anims';
import { getCharacter, VICEN_ID } from '../../content/characters';
import { ECONOMY } from '../../content/economy';
import { RARITY, ROLES } from '../../content/rarities';
import type { AbilityDef, CharacterDef, EffectDef, PassiveDef } from '../../content/types';
import { upgradeCost } from '../../meta/economy';
import { store } from '../../meta/store';
import type { BaseState } from '../../pixel/animator';
import type { App, Screen } from '../app';
import { btn, coinIcon, h, num, toast, fill } from '../dom';
import { startMatch } from '../play';
import { CharView } from '../pixelView';

/**
 * DETALHES DO PERSONAGEM: preview animado (todas as animações), história de vida,
 * atributos, habilidades, subir de nível, escolher e testar no Treino.
 */

/** Resumo numérico de uma habilidade (dano total, alcance, recarga). */
export function abilityNumbers(ab: AbilityDef): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let dmg = 0;
  let heal = 0;
  let dps = 0;
  const walk = (e: EffectDef) => {
    switch (e.kind) {
      case 'projectile': {
        const n = (e.count ?? 1) * (e.burst ?? 1);
        dmg += e.proj.damage * n + (e.proj.explode?.damage ?? 0) * n;
        if (e.proj.heal) heal += e.proj.heal * n;
        break;
      }
      case 'melee':
        dmg += e.damage;
        break;
      case 'dash':
        dmg += e.damage ?? 0;
        break;
      case 'aoe':
        dmg += e.damage ?? 0;
        heal += e.heal ?? 0;
        break;
      case 'zone':
        if (e.dps) dps += e.dps;
        if (e.hps) heal += e.hps * e.duration;
        break;
      case 'heal':
        heal += e.amount;
        break;
      case 'beam':
        dps += e.dps;
        break;
      case 'trap':
        dmg += e.damage * (e.count ?? 1);
        break;
      case 'orbit':
        dmg += e.proj.damage * e.count;
        break;
      default:
        break;
    }
  };
  ab.effects.forEach(walk);
  if (dmg) out.push(['Dano', num(dmg)]);
  if (dps) out.push(['Dano/s', num(dps)]);
  if (heal) out.push(['Cura', num(heal)]);
  if (ab.range) out.push(['Alcance', `${(ab.range / 64).toFixed(1)} blocos`]);
  if (ab.cooldown) out.push(['Recarga', `${ab.cooldown}s`]);
  return out;
}

function passiveText(p: PassiveDef): string {
  return p.desc;
}

export function characterScreen(app: App, id: string, onBack?: () => void): Screen {
  const def: CharacterDef = getCharacter(id);
  const r = RARITY[def.rarity];
  const role = ROLES[def.role];
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const scale = Math.max(2, Math.floor((Math.min(window.innerHeight * 0.55, window.innerWidth * 0.3) * dpr) / 84));
  const view = new CharView(def, scale);
  view.el.style.width = `${view.el.width / dpr}px`;
  let back = false;

  const animBtn = (label: string, fn: () => void) =>
    btn(label, 'chip', () => {
      fn();
    });
  const st = (s: BaseState) => () => view.setState(s);
  const act = (k: 'attack' | 'cast' | 'hit' | ClipName) => () => {
    view.setState('idle');
    view.play(k);
  };
  const anims = h(
    'div.anim-row',
    null,
    animBtn('Parado', st('idle')),
    animBtn('Correndo', st('run')),
    animBtn('Ataque', act('attack')),
    animBtn('Habilidade', act('cast')),
    animBtn('Dano', act('hit')),
    animBtn('Arrancada', st('dash')),
    animBtn('Vitória', st('victory')),
    animBtn('Derrota', st('defeat')),
    animBtn('↻ Virar', () => {
      back = !back;
      view.sprite.anim.lookAt(back ? 0.2 : 1, back ? -1 : 0.2, false);
    }),
  );

  const tabBody = h('div.cd-tab');
  const tabs = h('div.tabs');
  let tab: 'bio' | 'skills' | 'stats' = 'bio';

  const renderTab = () => {
    const p = store.profile!;
    const oc = p.chars[def.id];
    const lvl = oc?.level ?? 1;
    fill(
      tabs,
      ...(
        [
          ['bio', 'HISTÓRIA'],
          ['skills', 'HABILIDADES'],
          ['stats', 'ATRIBUTOS'],
        ] as const
      ).map(([k, l]) =>
        btn(l, `tab${tab === k ? ' active' : ''}`, () => {
          tab = k;
          audio.play('ui_tab');
          renderTab();
        }),
      ),
    );
    if (tab === 'bio') {
      const b = def.bio;
      fill(
        tabBody,
        h('blockquote.quote', null, `“${def.quote}”`),
        h(
          'dl.bio-facts',
          null,
          h('dt', null, 'Origem'),
          h('dd', null, b.origem),
          h('dt', null, 'Idade'),
          h('dd', null, b.idade),
          b.rival ? h('dt', null, 'Rival') : null,
          b.rival ? h('dd', null, b.rival) : null,
        ),
        ...b.historia.map((t) => h('p', null, t)),
        h('dl.bio-facts', null, h('dt', null, 'Sonho'), h('dd', null, b.sonho), h('dt', null, 'Medo'), h('dd', null, b.medo), h('dt', null, 'Curiosidade'), h('dd', null, b.curiosidade)),
      );
    } else if (tab === 'skills') {
      const abCard = (ab: AbilityDef, kind: string, cls: string) =>
        h(
          `div.ab-card.${cls}`,
          null,
          h('div.ab-ico', null, ab.icon),
          h(
            'div.ab-txt',
            null,
            h('small', null, kind),
            h('b', null, ab.name),
            h('p', null, ab.desc),
            h('div.ab-nums', null, ...abilityNumbers(ab).map(([k, v]) => h('span', null, `${k}: `, h('b', null, v)))),
          ),
        );
      fill(
        tabBody,
        abCard(def.attack, 'ATAQUE', 'atk'),
        ...def.skills.map((s, i) => abCard(s, `HABILIDADE ${i + 1} · botão ${['Q', 'E', 'R'][i]}`, 'skill')),
        abCard(def.super, 'SUPER', 'super'),
        def.passive
          ? h('div.ab-card.passive', null, h('div.ab-ico', null, '✦'), h('div.ab-txt', null, h('small', null, 'PASSIVA'), h('b', null, def.passive.name), h('p', null, passiveText(def.passive))))
          : null,
      );
    } else {
      const power = r.power * (1 + 0.05 * (lvl - 1));
      const bar = (label: string, v: number, max: number, txt: string) =>
        h('div.stat-bar', null, h('span', null, label), h('div.bar', null, h('i', { style: `width:${Math.min(100, (v / max) * 100)}%` })), h('b', null, txt));
      const hp = Math.round(def.stats.hp * power);
      fill(
        tabBody,
        bar('Vida', hp, 9000, num(hp)),
        bar('Velocidade', def.stats.speed, 320, `${def.stats.speed}`),
        bar('Munição', def.stats.ammo, 5, `${def.stats.ammo}`),
        bar('Recarga', 3 - def.stats.reload, 2.5, `${def.stats.reload}s`),
        h('p.muted.small', null, `Raridade ${r.name}: poder ×${r.power.toFixed(2)} · Nível ${lvl}: +${(lvl - 1) * 5}% vida e dano.`),
        oc ? h('div.cd-trophies', null, coinIcon('trophy'), `${num(oc.trophies)} troféus (recorde ${num(oc.best)})`) : null,
      );
    }
  };

  const actions = h('div.cd-actions');
  const renderActions = () => {
    const p = store.profile!;
    const oc = p.chars[def.id];
    const cost = oc ? upgradeCost(oc.level) : null;
    fill(
      actions,
      oc
        ? p.selected === def.id
          ? h('div.selected-tag', null, '✔ SELECIONADO')
          : btn('SELECIONAR', 'btn-yellow', async () => {
              try {
                await store.run('select', { id: def.id });
                audio.play('ui_buy');
                toast(`${def.name} selecionado!`, 'ok');
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), 'err');
              }
            })
        : h('div.unlock-how', null, '🔒 ', unlockText(def)),
      oc && cost !== null
        ? btn(h('span', null, `SUBIR P/ NV ${oc.level + 1} · `, coinIcon('moedas'), num(cost)), 'btn-green', async () => {
            try {
              await store.run('upgrade', { id: def.id });
              audio.play('ui_level');
              view.play('cast');
              toast(`${def.name} agora é nível ${oc.level + 1}!`, 'ok');
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), 'err');
            }
          })
        : oc
          ? h('div.max-tag', null, `NÍVEL MÁXIMO (${ECONOMY.maxLevel})`)
          : null,
      btn('🎯 TESTAR NO TREINO', 'btn-dark', () => startMatch(app, { mode: 'treino', map: 'random' }, { charId: def.id, onBack: () => app.show(characterScreen(app, id, onBack)) })),
    );
  };

  const render = () => {
    renderTab();
    renderActions();
  };
  render();
  const off = store.on(render);

  const body = h(
    'div.char-detail',
    { style: `--rc:${r.color};--rc2:${r.color2}` },
    h('div.cd-left', null, h('div.cd-stage', null, h('div.stage-glow'), view.el), anims),
    h(
      'div.cd-right',
      null,
      h(
        'div.cd-head',
        null,
        h('span.rar-badge', null, r.badge),
        h('div', null, h('h2', null, def.name), h('div.cd-title', null, def.title)),
        h(
          'div.cd-tags',
          null,
          h('span.tag', { style: `background:${r.color};color:#160d22` }, r.name),
          h('span.tag', { style: `background:${role.color};color:#160d22` }, `${role.icon} ${role.name}`),
        ),
      ),
      tabs,
      tabBody,
      actions,
    ),
  );
  const s = app.page(def.name.toUpperCase(), body, { onBack: onBack ?? app.home, cls: 'page-char' });
  return { el: s.el, dispose: off };
}

function unlockText(c: CharacterDef): string {
  const u = c.unlock;
  switch (u.kind) {
    case 'starter':
      return 'Grátis no início';
    case 'chest':
      if (c.id === VICEN_ID) return 'Drop do Vazio: 1% por abertura (garantido em 100 aberturas)';
      return c.rarity === 'creators' ? 'Só nos baús (CREATORs são raríssimos!)' : 'Sai nos baús e na loja diária';
    case 'trophyRoad':
      return `Estrada da Morte: ${u.trophies} troféus`;
    case 'event':
      return 'Evento especial';
    case 'shop':
      return `Loja: ${u.price} ${u.currency === 'isvoid' ? 'Isvoid' : 'Moedas'}`;
    case 'pass':
      return `Skull Pass nível ${u.tier}`;
  }
}
