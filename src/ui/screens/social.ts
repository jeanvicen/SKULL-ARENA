import { hashString } from '../../engine/math';
import type { App, Screen } from '../app';
import { menuBg, notice, topbar } from '../components';
import { h, ICON, svg } from '../dom';

/**
 * Social — PRÉVIA DE INTERFACE. Amigos, convites, presentes e equipes exigem
 * servidor (Fase 5). Esta tela mostra como vai ser, com dados de exemplo
 * claramente marcados, e NÃO finge que algo online funciona.
 */
export function socialScreen(app: App): Screen {
  const s = app.save;
  const code = (hashString(s.createdAt + s.player.name) % 1e8).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  const examples = [
    { name: 'Exemplo · Ossudo', status: 'online', trophies: 320 },
    { name: 'Exemplo · Tíbia_Lord', status: 'em partida', trophies: 512 },
    { name: 'Exemplo · CaveiraZ', status: 'offline', trophies: 88 },
  ];
  const disabledBtn = (label: string) => h('button', { class: 'btn small dark disabled', disabled: true, title: 'Requer servidor (Fase 5)' }, label);
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Social' }),
    h('div', { class: 'scroll' },
      notice('PRÉVIA: amigos, convites, presentes e equipes funcionam só com o servidor online (Fase 5). Nada aqui conecta a outras pessoas ainda — os nomes abaixo são EXEMPLOS.'),
      h('div', { class: 'panel', style: 'padding:14px;margin-top:12px;text-align:center' },
        h('div', { class: 'display muted', style: 'font-size:12px' }, 'SEU CÓDIGO DE AMIGO (reservado)'),
        h('div', { class: 'display stroke', style: 'font-size:34px;letter-spacing:5px;color:var(--cyan)' }, code),
        h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap' }, disabledBtn('Adicionar amigo'), disabledBtn('Convites (0)'))),
      h('div', { class: 'section-title' }, 'Amigos', h('small', null, 'exemplo de interface')),
      h('div', { class: 'list' }, ...examples.map((f) => h('div', { class: 'quest', style: 'grid-template-columns:auto 1fr auto;opacity:.7' },
        h('div', { style: 'width:40px;height:40px' }, svg(ICON.skull)),
        h('div', null, h('div', { class: 'qt' }, f.name), h('div', { class: 'small muted', style: 'font-weight:800' }, `${f.status} · 🏆 ${f.trophies}`)),
        h('div', { style: 'display:flex;gap:6px' }, disabledBtn('Presentear'), disabledBtn('Chamar'))))),
      h('div', { class: 'section-title' }, 'Equipe'),
      h('div', { class: 'panel', style: 'padding:14px;text-align:center' },
        h('div', { style: 'width:60px;height:60px;margin:0 auto' }, svg(ICON.team)),
        h('div', { class: 'display', style: 'font-size:18px;margin:6px 0' }, 'Jogue com amigos (até 20 na arena)'),
        h('div', { class: 'small muted', style: 'font-weight:700;margin-bottom:10px' }, 'Hoje: Equipe 3v3 e Arena Caótica funcionam OFFLINE com bots no lugar das pessoas.'),
        h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap' },
          h('button', { class: 'btn small pink', onclick: () => { app.click(); s.lastMode = 'equipe'; app.persist(); void app.go('menu'); } }, 'Equipe 3v3 com bots'),
          disabledBtn('Criar equipe online'))),
      h('div', { class: 'section-title' }, 'O que chega com o servidor'),
      h('div', { class: 'panel', style: 'padding:12px 14px;font-size:13px;font-weight:700;color:var(--ink2);line-height:1.7' },
        '• Lista de amigos e convites', h('br'), '• Presentes (moedas/itens) validados no servidor', h('br'), '• Equipes e salas privadas por código', h('br'),
        '• Partidas de amizade organizadas', h('br'), '• Matchmaking e ranked com anti-cheat'),
    ));
  return { el, back: 'menu' };
}
