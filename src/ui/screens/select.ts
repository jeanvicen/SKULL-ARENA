import { audio } from '../../audio/audio';
import type { CharacterDef, PetDef, ProjectileDef } from '../../content/types';
import { buySkin, upgradeCharacter, upgradeCost } from '../../systems/economy';
import { drawPet } from '../../render/art/fxart';
import type { App, Screen } from '../app';
import { charCard, menuBg, notice, portraitOf, priceLabel, rarityTag, skinName, topbar } from '../components';
import { ABILITY_ICON, fmt, h, ICON, svg } from '../dom';
import { Showcase } from '../showcase';

const ROLE_NAME: Record<string, string> = {
  tanque: 'Tanque', assassino: 'Assassino', atirador: 'Atirador', suporte: 'Suporte', lutador: 'Lutador', controlador: 'Controlador', artilheiro: 'Artilheiro',
};

export function describeProjectile(p: ProjectileDef): string {
  const parts: string[] = [];
  const kind = p.type === 'melee' ? `Golpe corpo a corpo em arco de ${p.meleeArcDeg ?? 90}°` : p.type === 'lob' ? 'Arremesso em arco que passa POR CIMA de paredes' : 'Tiro direto';
  parts.push(kind);
  if (p.count && p.count > 1) parts.push(`leque de ${p.count}`);
  if (p.burst) parts.push(`rajada de ${p.burst.count}`);
  if (p.bounces) parts.push(p.bounceOnEnemies ? `ricocheteia entre inimigos ${p.bounces}x` : `quica na parede ${p.bounces}x`);
  if (p.pierce) parts.push(`atravessa ${p.pierce} inimigo${p.pierce > 1 ? 's' : ''}`);
  if (p.homing) parts.push('curva até o alvo');
  if (p.aoeRadius) parts.push('explode em área');
  if (p.zone) parts.push(`deixa uma área por ${p.zone.duration}s`);
  if (p.onHit) parts.push({ burn: 'queima', slow: 'deixa lento', poison: 'envenena', stun: 'atordoa', freeze: 'congela', root: 'prende', weaken: 'enfraquece', mark: 'marca', haste: '', rage: '', regen: '', reveal: 'revela', silence: 'silencia' }[p.onHit.effect]);
  if (p.lifesteal) parts.push(`rouba ${Math.round(p.lifesteal * 100)}% de vida`);
  if (p.falloffMul) parts.push(`até +${Math.round((p.falloffMul - 1) * 100)}% de dano de longe`);
  if (p.knockback) parts.push('empurra');
  return parts.filter(Boolean).join(' · ') + '.';
}

function statBars(app: App, def: CharacterDef, level: number): HTMLElement {
  const prog = app.content.progression.character;
  const p = app.content.projectile(def.basicAttack.projectile);
  const hp = Math.round(def.stats.hp * (1 + prog.hpPerLevel * (level - 1)));
  const dmg = p.damage * (1 + prog.damagePerLevel * (level - 1));
  const hits = (p.count ?? 1) * (p.burst?.count ?? 1);
  const dps = Math.round((dmg * hits) / def.stats.attackInterval);
  const rows: Array<[string, number, string]> = [
    ['Vida', hp / 11000, fmt(hp)],
    ['Dano/s', dps / 1500, fmt(dps)],
    ['Alcance', (p.type === 'melee' ? p.range + 22 : p.range) / 460, String(p.type === 'melee' ? p.range + 22 : p.range)],
    ['Velocidade', (def.stats.moveSpeed - 180) / 140, String(def.stats.moveSpeed)],
  ];
  return h('div', null, ...rows.map(([l, k, v]) => h('div', { class: 'stat-row' }, l, h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(6, Math.min(100, k * 100)).toFixed(0)}%` })), h('b', null, v))));
}

function petChip(app: App, pet: PetDef | null, on: boolean, owned: boolean, onClick: () => void): HTMLElement {
  const cv = h('canvas', { width: '128', height: '128' }) as HTMLCanvasElement;
  if (pet) {
    const c = cv.getContext('2d')!;
    c.scale(2.4, 2.4);
    drawPet(c, pet, 26.6, 22, 0.3, 0, false);
  }
  return h('button', { class: `pet-chip${on ? ' on' : ''}`, style: owned ? '' : 'opacity:.5', onclick: () => { app.click(); onClick(); } },
    pet ? cv : h('div', { style: 'width:64px;height:64px;display:grid;place-items:center;font-size:26px' }, '∅'),
    pet ? pet.name : 'Sem pet');
}

/**
 * Seleção de personagem (pré-partida: escolhe e TRAVA) e ficha da coleção
 * (detalhes, skins, upgrade). Mesma tela, dois modos.
 */
export function selectScreen(app: App, params: Record<string, unknown>): Screen {
  const s = app.save;
  const content = app.content;
  const prematch = !!params.prematch;
  const modeId = (params.modeId as string) ?? s.lastMode;
  let currentId = (params.characterId as string) ?? s.selectedCharacter;
  if (prematch && !s.characters[currentId]) currentId = Object.keys(s.characters)[0];
  const showCanvas = h('canvas');
  const show = new Showcase(showCanvas);
  show.mode = 'card';
  show.start();
  const body = h('div', { class: 'scroll', style: 'padding-left:0;padding-right:0' });

  const render = () => {
    const def = content.characters.get(currentId)!;
    const owned = s.characters[def.id];
    const r = content.rarity(def.rarity);
    const skin = owned && owned.skin !== 'default' ? content.skins.get(owned.skin) ?? null : null;
    show.set(def, skin, r.color);
    const ab = content.ability(def.special.ability);
    const proj = content.projectile(def.basicAttack.projectile);
    const level = owned?.level ?? 1;
    body.innerHTML = '';

    const lines = def.voiceLines.select;
    const bubble = h('div', { class: 'voice-bubble' }, `“${lines[Math.floor(Math.random() * lines.length)]}”`);
    const portrait = h('div', { class: 'portrait', style: `--rc:${r.color}` }, showCanvas, bubble);
    portrait.onclick = () => {
      show.poke();
      bubble.textContent = `“${lines[Math.floor(Math.random() * lines.length)]}”`;
    };
    body.append(
      h('div', { class: 'detail', style: `--rc:${r.color}` },
        portrait,
        h('div', { class: 'info' },
          h('h3', { class: 'stroke' }, def.name),
          h('div', { class: 'epithet' }, def.title),
          h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px' }, rarityTag(app, def.rarity), h('span', { class: 'chip' }, ROLE_NAME[def.role] ?? def.role), owned ? h('span', { class: 'chip' }, `Nível ${level}`) : h('span', { class: 'chip', style: 'color:var(--ink3)' }, 'Não obtido')),
          statBars(app, def, level),
        ),
      ),
      h('div', { class: 'kit', style: `--rc:${r.color}` },
        h('div', { class: 'k' }, h('div', { class: 'ki', style: `background:${proj.vfx.color}33` }, svg(ICON.swords)),
          h('div', null, h('div', { class: 'kt' }, `Ataque básico · ${fmt(proj.damage)} de dano`), h('div', { class: 'kd' }, describeProjectile(proj)))),
        h('div', { class: 'k' }, h('div', { class: 'ki', style: `background:${ab.vfx.color}` }, svg(ABILITY_ICON[ab.type] ?? ABILITY_ICON.aoe_burst)),
          h('div', null, h('div', { class: 'kt' }, `Especial · ${ab.name}`), h('div', { class: 'kd' }, `${ab.description} Recarga ${ab.cooldown}s${ab.chargePerHit ? ` (cada acerto básico adianta ${ab.chargePerHit}s)` : ''}.`))),
      ),
    );

    // Skins
    if (owned) {
      body.append(h('div', { class: 'section-title', style: 'margin-left:14px' }, 'Skins', h('small', null, 'toque para equipar ou comprar')));
      const row = h('div', { class: 'skin-row' });
      for (const sk of content.skinsFor(def.id)) {
        const has = owned.skins.includes(sk.id) || sk.id === 'default';
        row.append(h('button', {
          class: `skin-chip${owned.skin === sk.id ? ' on' : ''} ${sk.tier}`,
          onclick: async () => {
            app.click();
            if (has) {
              owned.skin = sk.id;
              app.persist();
              render();
              return;
            }
            const ok = await app.confirm(`Comprar ${sk.name}?`, `Skin ${skinName(app, sk)} para ${def.name}. Preço: ${sk.price?.gems ? `${sk.price.gems} diamantes` : `${sk.price?.coins} moedas`}.`, 'Comprar');
            if (!ok) return;
            if (buySkin(content, s, def.id, sk.id)) {
              owned.skin = sk.id;
              audio.play('reward');
              app.toast(`${sk.name} desbloqueada!`, 'gold');
              app.persist();
              render();
            } else app.toast('Diamantes/moedas insuficientes', 'bad');
          },
        },
          h('img', { src: portraitOf(app, def, sk.id, 128), alt: '' }),
          h('div', null, sk.name),
          has ? null : h('div', { class: 'price' }, priceLabel(sk.price)),
        ));
      }
      body.append(row);
    }

    // Pets (pré-partida)
    if (prematch) {
      body.append(h('div', { class: 'section-title', style: 'margin-left:14px' }, 'Pet', h('small', null, 'acompanha você na arena')));
      const prow = h('div', { class: 'pet-row' });
      prow.append(petChip(app, null, s.selectedPet === null, true, () => { s.selectedPet = null; app.persist(); render(); }));
      for (const pet of content.pets.values()) {
        const has = s.pets.includes(pet.id);
        prow.append(petChip(app, pet, s.selectedPet === pet.id, has, () => {
          if (!has) {
            app.toast(`${pet.name}: compre na Loja`, 'bad');
            return;
          }
          s.selectedPet = pet.id;
          app.persist();
          app.toast(`${pet.name}: ${pet.description}`);
          render();
        }));
      }
      body.append(prow);
    }

    body.append(h('div', { class: 'section-title', style: 'margin-left:14px' }, 'História'), h('div', { class: 'lore', style: `--rc:${r.color}` }, def.lore));

    // Grade
    const list = [...content.sortedCharacters()].filter((c) => !prematch || s.characters[c.id]);
    body.append(h('div', { class: 'section-title', style: 'margin-left:14px' }, prematch ? 'Seu inventário' : 'Personagens', h('small', null, `${Object.keys(s.characters).length}/${content.characters.size}`)));
    const grid = h('div', { class: 'grid chars', style: 'padding:0 12px' });
    for (const c of list) {
      const o = s.characters[c.id];
      grid.append(charCard(app, c, { selected: c.id === currentId, locked: !o, level: o?.level, skinId: o?.skin, onClick: () => { currentId = c.id; render(); body.scrollTo({ top: 0, behavior: 'smooth' }); } }));
    }
    body.append(grid);

    // CTA
    cta.innerHTML = '';
    if (prematch) {
      cta.append(h('button', { class: 'btn pink big', onclick: () => lockIn() }, 'LUTAR!', h('span', { class: 'kbd-hint' }, 'Enter')));
    } else if (owned) {
      const cost = upgradeCost(content, def, owned.level);
      cta.append(
        h('button', { class: `btn ${s.selectedCharacter === def.id ? 'dark' : 'green'}`, onclick: () => { app.click(); s.selectedCharacter = def.id; app.persist(); app.toast(`${def.name} selecionado!`, 'good'); render(); } }, s.selectedCharacter === def.id ? 'Selecionado' : 'Selecionar'),
        cost === null
          ? h('button', { class: 'btn gold disabled', disabled: true }, 'Nível máximo')
          : h('button', { class: 'btn gold', onclick: () => {
              if (upgradeCharacter(content, s, def.id)) {
                audio.play('level_up');
                app.toast(`${def.name} subiu para o nível ${s.characters[def.id].level}!`, 'gold');
                app.persist();
                render();
              } else app.toast('Moedas insuficientes', 'bad');
            } }, `Upgrade `, priceLabel({ coins: cost })),
      );
    } else {
      cta.append(h('div', { style: 'flex:1' }, notice(`Obtenha em: ${def.obtain.map((o) => ({ starter: 'inicial', chest: 'baús', shop: 'loja', event: 'eventos', creator: 'edição do criador' })[o]).join(', ')}. Chance por baú visível em Baús.`, 'info')));
    }
  };

  const lockIn = () => {
    const def = content.characters.get(currentId)!;
    if (!s.characters[def.id]) return;
    s.selectedCharacter = def.id;
    app.persist();
    audio.unlock();
    audio.play('fight', 0.6);
    void app.go('matchmaking', { modeId, ...(params.matchOpts as object ?? {}) });
  };

  const cta = h('div', { class: 'cta-bar' });
  render();
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: prematch ? 'menu' : 'collection', title: prematch ? 'Escolha e trave' : 'Ficha' }),
    prematch ? h('div', { style: 'padding:0 12px 6px' }, notice('Ao confirmar, seu personagem fica TRAVADO até o fim da partida.', 'info')) : null,
    body, cta);
  return {
    el,
    back: prematch ? 'menu' : 'collection',
    destroy: () => show.stop(),
    onKey: (e) => {
      if (e.key === 'Enter' && prematch) {
        e.preventDefault();
        lockIn();
      }
    },
  };
}

export function collectionScreen(app: App): Screen {
  const s = app.save;
  const content = app.content;
  let filter: string = 'todos';
  const grid = h('div', { class: 'grid chars' });
  const seg = h('div', { class: 'seg', style: 'margin:0 12px 8px;justify-content:flex-start' });
  const rarities = ['todos', ...content.sortedRarities().map((r) => r.id)];
  const render = () => {
    seg.innerHTML = '';
    for (const r of rarities) {
      const name = r === 'todos' ? 'Todos' : content.rarity(r as never).name;
      seg.append(h('button', { class: filter === r ? 'on' : '', onclick: () => { filter = r; render(); } }, name));
    }
    grid.innerHTML = '';
    for (const c of content.sortedCharacters()) {
      if (filter !== 'todos' && c.rarity !== filter) continue;
      const o = s.characters[c.id];
      grid.append(charCard(app, c, { selected: c.id === s.selectedCharacter, locked: !o, level: o?.level, skinId: o?.skin, onClick: () => void app.go('select', { characterId: c.id }) }));
    }
  };
  render();
  const total = content.characters.size;
  const have = Object.keys(s.characters).length;
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Coleção' }),
    h('div', { style: 'padding:0 12px 8px' },
      h('div', { class: 'display', style: 'display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px' }, h('span', null, 'Caveiras coletadas'), h('span', null, `${have}/${total}`)),
      h('div', { class: 'bar violet' }, h('i', { style: `width:${(have / total) * 100}%` }))),
    seg,
    h('div', { class: 'scroll' }, grid,
      h('div', { style: 'margin-top:14px' }, notice('O motor suporta milhares de personagens via JSON. O roster atual é o conjunto inicial — cada um completo, com fala, história e kit únicos.', 'info'))),
  );
  return { el, back: 'menu' };
}
