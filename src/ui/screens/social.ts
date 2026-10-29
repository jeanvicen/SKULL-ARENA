import { audio } from '../../audio/audio';
import { getCharacter } from '../../content/characters';
import { MODE } from '../../content/modes';
import type { ModeId } from '../../content/types';
import { store, validName } from '../../meta/store';
import { net, type FriendInfo } from '../../net/online';
import type { App, Screen } from '../app';
import { btn, coinIcon, esc, h, num, toast, fill } from '../dom';
import { startMatch } from '../play';
import { portraitCanvas } from '../pixelView';

/**
 * SOCIAL: amigos, chat e SALAS (jogar com amigos no mesmo time).
 * • Online (com servidor): amigos por TAG, chat global e privado, salas com código.
 * • Local (sem servidor): sala local — os nomes dos amigos entram no SEU time como
 *   BOTs (identificados), pra treinar a formação. A tela explica a diferença.
 */
type Tab = 'amigos' | 'chat' | 'sala';

const ROOM_MODES: ModeId[] = ['guerra', 'ffa', 'so_super', 'chefao', 'meteoro'];

export function socialScreen(app: App, start: Tab = 'amigos'): Screen {
  let tab: Tab = start;
  const tabs = h('div.tabs');
  const body = h('div.social-body');
  const offs: Array<() => void> = [];
  let chatTo = 'global';

  const render = () => {
    fill(
      tabs,
      ...(
        [
          ['amigos', `👥 AMIGOS${net.requests.length ? ` (${net.requests.length})` : ''}`],
          ['chat', '💬 CHAT'],
          ['sala', '🚪 SALA'],
        ] as const
      ).map(([k, l]) =>
        btn(l, `tab${tab === k ? ' active' : ''}`, () => {
          tab = k;
          audio.play('ui_tab');
          render();
        }),
      ),
    );
    if (!net.configured()) return renderLocal();
    if (!net.connected) {
      fill(
        body,
        h(
          'div.offline-box.pixel-panel',
          null,
          h('h3', null, 'Conectando ao servidor…'),
          h('p.muted', null, net.url),
          btn('TENTAR DE NOVO', 'btn-dark small', () => net.connect()),
        ),
      );
      return;
    }
    if (tab === 'amigos') renderFriends();
    else if (tab === 'chat') renderChat();
    else renderRoom();
  };

  // ---------------------------------------------------------------- local
  const localParty: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('skull.localParty') ?? '[]') as string[];
    } catch {
      return [];
    }
  })();
  const saveParty = () => {
    try {
      localStorage.setItem('skull.localParty', JSON.stringify(localParty));
    } catch {
      /* ok */
    }
  };
  let localMode: ModeId = 'guerra';
  const renderLocal = () => {
    const p = store.profile!;
    if (tab !== 'sala') {
      fill(
        body,
        h(
          'div.offline-box.pixel-panel',
          null,
          h('h3', null, '📱 MODO LOCAL (sem servidor)'),
          h(
            'p',
            null,
            'Amigos, chat e salas online precisam de um servidor. É fácil: no PC rode ',
            h('code', null, 'npm run server'),
            ' e coloque o endereço em Configurações → Servidor online. Seus amigos na mesma rede (ou na internet) entram pelo mesmo endereço.',
          ),
          h('p', null, 'Sua TAG: ', h('b', null, `#${p.tag}`)),
          h('p.muted', null, 'Enquanto isso, use a aba SALA pra montar um time local com os nomes dos seus amigos (eles jogam como BOTs).'),
          btn('IR PRA SALA LOCAL', 'btn-yellow small', () => {
            tab = 'sala';
            render();
          }),
        ),
      );
      return;
    }
    const nameInp = h<'input'>('input.inp', { placeholder: 'Nome do amigo', maxlength: 16 });
    const add = () => {
      const n = nameInp.value.trim();
      const err = validName(n);
      if (err) return toast(err, 'err');
      if (localParty.length >= 9) return toast('Máximo de 9 amigos no time.', 'err');
      localParty.push(n);
      saveParty();
      render();
    };
    nameInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') add();
    });
    const me = getCharacter(p.selected);
    fill(
      body,
      h(
        'div.room.pixel-panel',
        null,
        h('h3', null, '🚪 SALA LOCAL'),
        h('p.muted.small', null, 'Os amigos abaixo entram no SEU time, controlados pela IA e marcados como BOT. Pra jogar com pessoas de verdade, use um servidor online.'),
        h(
          'div.room-members',
          null,
          h('div.member.me', null, portraitCanvas(me, 1), h('b', null, p.name), h('small', null, `${me.name} · LÍDER`)),
          ...localParty.map((n, i) =>
            h(
              'div.member',
              null,
              h('div.member-ico', null, '🤖'),
              h('b', null, n),
              h('small', null, 'BOT aliado'),
              btn('✕', 'btn-dark tiny', () => {
                localParty.splice(i, 1);
                saveParty();
                render();
              }),
            ),
          ),
        ),
        h('div.row', null, nameInp, btn('ADICIONAR', 'btn-dark small', add)),
        h(
          'div.map-row',
          null,
          ...ROOM_MODES.filter((m) => MODE[m].teams === 2).map((m) =>
            btn(`${MODE[m].icon} ${MODE[m].name}`, `chip${localMode === m ? ' active' : ''}`, () => {
              localMode = m;
              render();
            }),
          ),
        ),
        btn('JOGAR', 'btn-play small', () => startMatch(app, { mode: localMode, map: 'random' }, { partyNames: [...localParty] })),
      ),
    );
  };

  // ---------------------------------------------------------------- amigos
  const friendRow = (f: FriendInfo, actions: HTMLElement[]) =>
    h(
      `div.friend${f.online ? '.on' : ''}`,
      null,
      h('div.f-art', null, portraitCanvas(getCharacter(f.char), 1)),
      h(
        'div.f-txt',
        null,
        h('b', null, f.name),
        h('small', null, `#${f.tag} · ${f.online ? (f.status === 'partida' ? '🎮 em partida' : f.status === 'sala' ? '🚪 numa sala' : '🟢 online') : '⚫ offline'}`),
      ),
      h('span.f-tr', null, coinIcon('trophy'), num(f.trophies)),
      ...actions,
    );
  const renderFriends = () => {
    const tagInp = h<'input'>('input.inp', { placeholder: 'TAG do amigo (ex.: K7QX2M)', maxlength: 8 });
    const add = () => {
      const t = tagInp.value.trim().replace(/^#/, '').toUpperCase();
      if (t.length < 4) return toast('TAG inválida.', 'err');
      net.send('friend.add', { tag: t });
      tagInp.value = '';
      toast('Pedido enviado!', 'ok');
    };
    fill(
      body,
      h('div.row', null, h('span.my-tag', null, 'Sua TAG: ', h('b', null, `#${net.me?.tag ?? store.profile?.tag ?? ''}`)), tagInp, btn('ADICIONAR', 'btn-yellow small', add)),
      net.requests.length ? h('h4', null, 'PEDIDOS DE AMIZADE') : null,
      ...net.requests.map((f) =>
        friendRow(f, [btn('ACEITAR', 'btn-green tiny', () => net.send('friend.accept', { id: f.id })), btn('RECUSAR', 'btn-dark tiny', () => net.send('friend.remove', { id: f.id }))]),
      ),
      h('h4', null, `AMIGOS (${net.friends.length})`),
      ...(net.friends.length
        ? net.friends
            .slice()
            .sort((a, b) => Number(b.online) - Number(a.online))
            .map((f) =>
              friendRow(
                f,
                [
                  btn('💬', 'btn-dark tiny', () => {
                    chatTo = f.id;
                    tab = 'chat';
                    render();
                  }),
                  f.online && net.room ? btn('CHAMAR', 'btn-yellow tiny', () => net.send('room.invite', { id: f.id })) : null,
                  btn('✕', 'btn-dark tiny', () => net.send('friend.remove', { id: f.id })),
                ].filter(Boolean) as HTMLElement[],
              ),
            )
        : [h('p.muted', null, 'Nenhum amigo ainda. Passe sua TAG pra galera!')]),
    );
  };

  // ---------------------------------------------------------------- chat
  const renderChat = () => {
    const msgs = h('div.chat-msgs');
    const myId = net.me?.id;
    const list = net.chat.filter((m) => (chatTo === 'global' ? m.to === 'global' : (m.from === chatTo && m.to === myId) || (m.to === chatTo && m.from === myId)));
    fill(
      msgs,
      ...list.map((m) =>
        h(
          `div.msg${m.from === myId ? '.mine' : ''}`,
          null,
          h('b', null, m.fromName),
          h('span', null, m.text),
          h('small', null, new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
        ),
      ),
    );
    const inp = h<'input'>('input.inp', { placeholder: 'Mensagem…', maxlength: 200 });
    const send = () => {
      const t = inp.value.trim();
      if (!t) return;
      net.send('chat.send', { to: chatTo, text: t });
      inp.value = '';
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    const sel = h<'select'>('select.inp', null, h('option', { value: 'global' }, '🌎 Chat geral'), ...net.friends.map((f) => h('option', { value: f.id }, `💬 ${f.name}`)));
    sel.value = chatTo;
    sel.addEventListener('change', () => {
      chatTo = sel.value;
      render();
    });
    fill(
      body,
      h(
        'div.chat',
        null,
        sel,
        msgs,
        h('div.row', null, inp, btn('ENVIAR', 'btn-yellow small', send)),
        h('p.muted.small', null, 'Seja gente boa. Mensagens ofensivas podem ser filtradas pelo servidor.'),
      ),
    );
    requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight));
    setTimeout(() => inp.focus(), 50);
  };

  // ---------------------------------------------------------------- sala online
  const renderRoom = () => {
    const r = net.room;
    if (!r) {
      const codeInp = h<'input'>('input.inp', { placeholder: 'Código da sala', maxlength: 6 });
      fill(
        body,
        h(
          'div.room.pixel-panel',
          null,
          h('h3', null, '🚪 JOGAR COM AMIGOS'),
          h('p', null, 'Crie uma sala e passe o código. Todo mundo da sala joga no MESMO time; as vagas que sobrarem são preenchidas com BOTs (identificados).'),
          btn('CRIAR SALA', 'btn-yellow', () => net.send('room.create', { char: store.profile!.selected, pet: store.profile!.selectedPet })),
          h(
            'div.row',
            null,
            codeInp,
            btn('ENTRAR', 'btn-dark small', () => net.send('room.join', { code: codeInp.value.trim().toUpperCase(), char: store.profile!.selected, pet: store.profile!.selectedPet })),
          ),
        ),
      );
      return;
    }
    const me = r.members.find((m) => m.id === net.me?.id);
    const leader = !!me?.leader;
    fill(
      body,
      h(
        'div.room.pixel-panel',
        null,
        h('h3', null, `🚪 SALA `, h('b.room-code', null, r.code)),
        h('p.muted.small', null, 'Passe o código pros amigos. O líder escolhe o modo e começa.'),
        h(
          'div.room-members',
          null,
          ...r.members.map((m) =>
            h(
              `div.member${m.ready ? '.ready' : ''}${m.id === net.me?.id ? '.me' : ''}`,
              null,
              portraitCanvas(getCharacter(m.char), 1),
              h('b', null, esc(m.name)),
              h('small', null, `${getCharacter(m.char).name}${m.leader ? ' · LÍDER' : ''}${m.ready ? ' · PRONTO' : ''}`),
            ),
          ),
        ),
        h(
          'div.map-row',
          null,
          ...ROOM_MODES.map((m) =>
            btn(`${MODE[m].icon} ${MODE[m].name}`, `chip${r.mode === m ? ' active' : ''}`, () => {
              if (leader) net.send('room.mode', { mode: m });
              else toast('Só o líder escolhe o modo.', 'info');
            }),
          ),
        ),
        h(
          'div.row.wrap',
          null,
          btn(me?.ready ? 'NÃO ESTOU PRONTO' : 'ESTOU PRONTO', me?.ready ? 'btn-dark' : 'btn-green', () =>
            net.send('room.ready', { ready: !me?.ready, char: store.profile!.selected, pet: store.profile!.selectedPet }),
          ),
          leader ? btn('COMEÇAR', 'btn-play small', () => net.send('room.start')) : null,
          btn('SAIR DA SALA', 'btn-red small', () => net.send('room.leave')),
        ),
      ),
    );
  };

  for (const t of ['friends', 'chat', 'chatHistory', 'room', 'status']) offs.push(net.on(t, () => render()));
  offs.push(net.on('error', (m) => toast(String(m.msg ?? 'Erro'), 'err')));
  offs.push(net.on('invite', (m) => toast(`${String(m.fromName)} te chamou pra sala ${String(m.code)}!`, 'info', 5000)));
  if (net.configured()) net.connect();
  render();
  const s = app.page('SOCIAL', h('div.social', null, tabs, body), { cls: 'page-social' });
  return { el: s.el, dispose: () => offs.forEach((f) => f()) };
}
