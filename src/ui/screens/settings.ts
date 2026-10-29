import { audio } from '../../audio/audio';
import { allCharacters } from '../../content/characters';
import { CHESTS } from '../../content/chests';
import { ADMIN_PIN, CODES } from '../../content/codes';
import { allPets } from '../../content/pets';
import type { PromoCodeDef, Reward } from '../../content/types';
import { normCode, rewardText } from '../../meta/economy';
import { store, type Settings } from '../../meta/store';
import { net } from '../../net/online';
import type { App, Screen } from '../app';
import { btn, confirmBox, h, modal, toast, fill } from '../dom';
import { showGains } from '../rewards';

/**
 * CONFIGURAÇÕES: som, gráficos, controles, conta, código de prêmio,
 * servidor online e o PAINEL DO CRIADOR (criar/apagar códigos).
 */
export function settingsScreen(app: App): Screen {
  const s = store.settings;
  const save = () => {
    store.saveSettings();
    audio.setVolumes(store.settings);
  };

  const slider = (label: string, get: () => number, set: (v: number) => void, min = 0, max = 1, step = 0.05, fmt = (v: number) => `${Math.round(v * 100)}%`) => {
    const out = h('b', null, fmt(get()));
    const inp = h<'input'>('input.range', { type: 'range', min, max, step, value: get() });
    inp.addEventListener('input', () => {
      set(Number(inp.value));
      out.textContent = fmt(Number(inp.value));
      save();
    });
    inp.addEventListener('change', () => audio.play('ui_click'));
    return h('label.set-row', null, h('span', null, label), inp, out);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = btn(get() ? 'LIGADO' : 'DESLIGADO', `toggle${get() ? ' on' : ''}`, () => {
      set(!get());
      b.textContent = get() ? 'LIGADO' : 'DESLIGADO';
      b.classList.toggle('on', get());
      save();
    });
    return h('div.set-row', null, h('span', null, label), b);
  };
  const select = <K extends string>(label: string, opts: Array<[K, string]>, get: () => K, set: (v: K) => void) => {
    const sel = h<'select'>('select.inp', null, ...opts.map(([v, t]) => h('option', { value: v }, t)));
    sel.value = get();
    sel.addEventListener('change', () => {
      set(sel.value as K);
      save();
    });
    return h('label.set-row', null, h('span', null, label), sel);
  };

  // código de prêmio
  const codeInp = h<'input'>('input.inp', { placeholder: 'Digite o código', maxlength: 32, spellcheck: 'false', autocapitalize: 'characters' });
  const redeem = async () => {
    try {
      const g = await store.run('redeem', { code: codeInp.value });
      codeInp.value = '';
      showGains('CÓDIGO RESGATADO!', g);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };
  codeInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void redeem();
  });

  // servidor
  const srvInp = h<'input'>('input.inp', { placeholder: 'ex.: http://192.168.0.10:8787', value: net.url });

  const body = h(
    'div.settings',
    null,
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🎁 CÓDIGO DE PRÊMIO'),
      h(
        'div.row',
        null,
        codeInp,
        btn('RESGATAR', 'btn-yellow', () => void redeem()),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🔊 SOM'),
      slider(
        'Música',
        () => s.music,
        (v) => (s.music = v),
      ),
      slider(
        'Efeitos',
        () => s.sfx,
        (v) => (s.sfx = v),
      ),
      slider(
        'Locutor',
        () => s.voice,
        (v) => (s.voice = v),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🖥️ GRÁFICOS'),
      select<Settings['quality']>(
        'Qualidade',
        [
          ['auto', 'Automática'],
          ['alta', 'Alta'],
          ['media', 'Média'],
          ['baixa', 'Baixa (celular fraco)'],
        ],
        () => s.quality,
        (v) => (s.quality = v),
      ),
      toggle(
        'Tremer a tela',
        () => s.shake,
        (v) => (s.shake = v),
      ),
      toggle(
        'Mostrar FPS',
        () => s.showFps,
        (v) => (s.showFps = v),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🎮 CONTROLES'),
      slider(
        'Tamanho dos botões',
        () => s.controls.size,
        (v) => (s.controls.size = v),
        0.75,
        1.35,
        0.05,
      ),
      slider(
        'Transparência',
        () => s.controls.opacity,
        (v) => (s.controls.opacity = v),
        0.3,
        1,
        0.05,
      ),
      toggle(
        'Canhoto (inverte lados)',
        () => s.controls.swap,
        (v) => (s.controls.swap = v),
      ),
      toggle(
        'Vibração',
        () => s.controls.vibrate,
        (v) => (s.controls.vibrate = v),
      ),
      slider(
        'Dificuldade dos BOTs',
        () => s.botLevel,
        (v) => (s.botLevel = v),
        0.1,
        0.95,
        0.05,
        (v) => (v < 0.35 ? 'Fácil' : v < 0.6 ? 'Normal' : v < 0.8 ? 'Difícil' : 'Insano'),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '👤 CONTA'),
      h('p', null, `Jogador: `, h('b', null, store.profile?.name ?? ''), store.online ? ' · conta online' : ' · conta salva neste aparelho'),
      h(
        'div.row.wrap',
        null,
        !store.online
          ? btn('EXPORTAR BACKUP', 'btn-dark small', () => {
              const blob = new Blob([store.exportProfile()], { type: 'application/json' });
              const a = h<'a'>('a', { href: URL.createObjectURL(blob), download: `skull-arena-${store.profile?.name}.json` });
              a.click();
            })
          : null,
        !store.online
          ? btn('IMPORTAR BACKUP', 'btn-dark small', () => {
              const f = h<'input'>('input', { type: 'file', accept: 'application/json' });
              f.addEventListener('change', async () => {
                const file = f.files?.[0];
                if (!file) return;
                if (!(await confirmBox('Importar backup', 'Isso substitui o progresso desta conta pelo do arquivo. Continuar?'))) return;
                try {
                  store.importProfile(await file.text());
                  toast('Backup importado!', 'ok');
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e), 'err');
                }
              });
              f.click();
            })
          : null,
        btn('SAIR DA CONTA', 'btn-red small', () => {
          store.logout();
          location.reload();
        }),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🌐 SERVIDOR ONLINE'),
      h(
        'p.muted.small',
        null,
        'Sem servidor = modo local (tudo neste aparelho, partidas contra BOTs). Com servidor (npm run server) você tem conta online, amigos, chat e salas. Ao trocar, entre de novo.',
      ),
      h(
        'div.row',
        null,
        srvInp,
        btn('SALVAR', 'btn-yellow small', () => {
          net.setServer(srvInp.value);
          store.logout();
          toast(net.configured() ? 'Servidor salvo. Entre com sua conta online.' : 'Modo local.', 'ok');
          setTimeout(() => location.reload(), 600);
        }),
      ),
    ),
    h(
      'section.pixel-panel',
      null,
      h('h3', null, '🛠️ PAINEL DO CRIADOR'),
      h('p.muted.small', null, 'Criar e apagar códigos de prêmio, testar eventos. Protegido por PIN (troque em src/content/codes.ts; no servidor use ADMIN_PIN).'),
      btn('ABRIR PAINEL', 'btn-dark small', () => askPin()),
    ),
    h('p.muted.small.center', null, `SKULL ARENA v${__APP_VERSION__} · sons CC0 (veja public/audio/CREDITS.txt) · feito com pixel art procedural`),
  );
  const pg = app.page('CONFIGURAÇÕES', body, { cls: 'page-settings' });
  return pg;
}

function askPin(): void {
  const pin = h<'input'>('input.inp', { type: 'password', inputmode: 'numeric', placeholder: 'PIN' });
  const m = modal('PAINEL DO CRIADOR', [
    h('p', null, 'Digite o PIN do criador:'),
    pin,
    h(
      'div.row.end',
      null,
      btn('ENTRAR', 'btn-yellow', async () => {
        if (net.configured()) {
          try {
            await net.adminCodes(pin.value);
          } catch (e) {
            return toast(e instanceof Error ? e.message : 'PIN errado.', 'err');
          }
        } else if (pin.value !== ADMIN_PIN) return toast('PIN errado.', 'err');
        m.close();
        adminPanel(pin.value);
      }),
    ),
  ]);
  setTimeout(() => pin.focus(), 100);
}

async function loadCodes(pin: string): Promise<PromoCodeDef[]> {
  if (net.configured()) return (await net.adminCodes(pin)) as PromoCodeDef[];
  return store.customCodes();
}
async function saveCodes(pin: string, list: PromoCodeDef[]): Promise<void> {
  if (net.configured()) await net.adminCodes(pin, list);
  else store.setCustomCodes(list);
}

function adminPanel(pin: string): void {
  const list = h('div.code-list');
  const render = async () => {
    const custom = await loadCodes(pin).catch(() => [] as PromoCodeDef[]);
    fill(
      list,
      h('h4', null, `Criados no painel (${custom.length})`),
      ...custom.map((c) =>
        h(
          'div.code-row',
          null,
          h('b', null, c.code),
          h('span', null, c.rewards.map(rewardText).join(' + ')),
          h('small', null, `${c.perAccount ?? 1}x por conta${c.validUntil ? ` · até ${new Date(c.validUntil).toLocaleDateString('pt-BR')}` : ''}${c.active === false ? ' · DESLIGADO' : ''}`),
          btn(c.active === false ? 'LIGAR' : 'DESLIGAR', 'btn-dark tiny', async () => {
            c.active = c.active === false;
            await saveCodes(pin, custom);
            void render();
          }),
          btn('APAGAR', 'btn-red tiny', async () => {
            if (!(await confirmBox('Apagar código', `Apagar o código ${c.code}?`, 'APAGAR'))) return;
            await saveCodes(
              pin,
              custom.filter((x) => x !== c),
            );
            toast('Código apagado.', 'ok');
            void render();
          }),
        ),
      ),
      h('h4', null, `No arquivo src/content/codes.ts (${CODES.length}) — edite lá`),
      ...CODES.map((c) => h('div.code-row.file', null, h('b', null, c.code), h('span', null, c.rewards.map(rewardText).join(' + ')), h('small', null, c.note ?? ''))),
    );
  };

  // formulário de novo código
  const code = h<'input'>('input.inp', { placeholder: 'CÓDIGO (ex.: VICEN100)', maxlength: 24 });
  const moedas = h<'input'>('input.inp', { type: 'number', min: 0, placeholder: 'Moedas' });
  const isvoid = h<'input'>('input.inp', { type: 'number', min: 0, placeholder: 'Isvoid' });
  const xp = h<'input'>('input.inp', { type: 'number', min: 0, placeholder: 'XP' });
  const passXp = h<'input'>('input.inp', { type: 'number', min: 0, placeholder: 'XP do passe' });
  const chest = h<'select'>('select.inp', null, h('option', { value: '' }, '— baú —'), ...CHESTS.map((c) => h('option', { value: c.id }, c.name)));
  const charList = h('datalist#dl-chars', null, ...allCharacters().map((c) => h('option', { value: c.id }, c.name)));
  const petList = h('datalist#dl-pets', null, ...allPets().map((c) => h('option', { value: c.id }, c.name)));
  const charInp = h<'input'>('input.inp', { list: 'dl-chars', placeholder: 'id do personagem (opcional)' });
  const petInp = h<'input'>('input.inp', { list: 'dl-pets', placeholder: 'id do pet (opcional)' });
  const title = h<'input'>('input.inp', { placeholder: 'Título de presente (opcional)', maxlength: 24 });
  const uses = h<'input'>('input.inp', { type: 'number', min: 1, value: 1, placeholder: 'Usos por conta' });
  const until = h<'input'>('input.inp', { type: 'date' });

  const create = async () => {
    const k = normCode(code.value);
    if (k.length < 3) return toast('Código muito curto (mín. 3).', 'err');
    const rewards: Reward[] = [];
    const n = (i: HTMLInputElement) => Math.max(0, Math.floor(Number(i.value) || 0));
    if (n(moedas)) rewards.push({ kind: 'moedas', amount: n(moedas) });
    if (n(isvoid)) rewards.push({ kind: 'isvoid', amount: n(isvoid) });
    if (n(xp)) rewards.push({ kind: 'xp', amount: n(xp) });
    if (n(passXp)) rewards.push({ kind: 'passXp', amount: n(passXp) });
    if (chest.value) rewards.push({ kind: 'chest', id: chest.value });
    if (charInp.value.trim()) rewards.push({ kind: 'character', id: charInp.value.trim() });
    if (petInp.value.trim()) rewards.push({ kind: 'pet', id: petInp.value.trim() });
    if (title.value.trim()) rewards.push({ kind: 'title', id: `t_${k.toLowerCase()}`, text: title.value.trim() });
    if (!rewards.length) return toast('Escolha pelo menos um prêmio.', 'err');
    const custom = await loadCodes(pin);
    if ([...custom, ...CODES].some((c) => normCode(c.code) === k)) return toast('Já existe um código com esse nome.', 'err');
    custom.push({
      code: k,
      rewards,
      perAccount: Math.max(1, n(uses) || 1),
      validUntil: until.value ? `${until.value}T23:59:59-03:00` : undefined,
      note: `criado no painel em ${new Date().toLocaleDateString('pt-BR')}`,
    });
    try {
      await saveCodes(pin, custom);
      toast(`Código ${k} criado!`, 'ok');
      code.value = moedas.value = isvoid.value = xp.value = passXp.value = charInp.value = petInp.value = title.value = '';
      chest.value = '';
      void render();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const fake = h<'input'>('input.inp', { type: 'date' });
  try {
    const f = localStorage.getItem('skull.now');
    if (f) fake.value = f.slice(0, 10);
  } catch {
    /* ok */
  }

  modal(
    'PAINEL DO CRIADOR',
    [
      h('h3', null, 'NOVO CÓDIGO'),
      h('div.admin-form', null, code, moedas, isvoid, xp, passXp, chest, charInp, petInp, title, h('label', null, 'Usos por conta', uses), h('label', null, 'Válido até', until), charList, petList),
      h(
        'div.row.end',
        null,
        btn('CRIAR CÓDIGO', 'btn-yellow', () => void create()),
      ),
      list,
      h('h3', null, 'TESTAR EVENTOS (viajar no tempo)'),
      h('p.muted.small', null, 'Muda a data SÓ neste aparelho pra ver eventos futuros. Deixe vazio pra voltar ao normal.'),
      h(
        'div.row',
        null,
        fake,
        btn('APLICAR', 'btn-dark small', () => {
          try {
            if (fake.value) localStorage.setItem('skull.now', `${fake.value}T12:00:00`);
            else localStorage.removeItem('skull.now');
          } catch {
            /* ok */
          }
          location.reload();
        }),
      ),
      !net.configured()
        ? h(
            'div',
            null,
            h('h3', null, 'DAR RECURSOS (só modo local, pra testar)'),
            h(
              'div.row.wrap',
              null,
              btn('+5.000 Moedas', 'btn-dark small', () => store.act((p) => void (p.moedas += 5000))),
              btn('+500 Isvoid', 'btn-dark small', () => store.act((p) => void (p.isvoid += 500))),
              btn('+500 Troféus', 'btn-dark small', () =>
                store.act((p) => {
                  p.trophies += 500;
                  p.bestTrophies = Math.max(p.bestTrophies, p.trophies);
                }),
              ),
              btn('+3 Drops', 'btn-dark small', () => store.act((p) => void (p.drops.pending += 3))),
            ),
          )
        : null,
    ].filter(Boolean) as HTMLElement[],
    { wide: true },
  );
  void render();
}
