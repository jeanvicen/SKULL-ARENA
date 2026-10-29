import { audio } from '../../audio/audio';
import { store, validName } from '../../meta/store';
import { net } from '../../net/online';
import { btn, h, toast, fill } from '../dom';
import type { Screen } from '../app';

/**
 * LOGIN / CRIAR CONTA
 * Modo local: a conta fica neste aparelho (senha com hash PBKDF2).
 * Modo online: conta no servidor (se configurado em Configurações → Servidor).
 */
export function authScreen(onDone: () => void): Screen {
  let mode: 'login' | 'register' = store.accounts().length ? 'login' : 'register';
  const name = h<'input'>('input.inp', { type: 'text', maxlength: 16, autocomplete: 'username', placeholder: 'Seu nome de jogador', spellcheck: 'false' });
  const pass = h<'input'>('input.inp', { type: 'password', autocomplete: 'current-password', placeholder: 'Senha' });
  const pass2 = h<'input'>('input.inp', { type: 'password', autocomplete: 'new-password', placeholder: 'Repita a senha' });
  const tabs = h('div.tabs');
  const form = h('form.auth-form');
  const status = h('p.auth-mode');
  const submit = h<'button'>('button.btn.btn-yellow.big', { type: 'submit' });

  const render = () => {
    fill(
      tabs,
      btn(
        'ENTRAR',
        `tab${mode === 'login' ? ' active' : ''}`,
        () => {
          mode = 'login';
          render();
        },
        { type: 'button' },
      ),
      btn(
        'CRIAR CONTA',
        `tab${mode === 'register' ? ' active' : ''}`,
        () => {
          mode = 'register';
          render();
        },
        { type: 'button' },
      ),
    );
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    submit.textContent = mode === 'login' ? 'ENTRAR' : 'CRIAR E JOGAR';
    fill(form, h('label', null, 'Nome', name), h('label', null, 'Senha', pass), ...(mode === 'register' ? [h('label', null, 'Confirmar senha', pass2)] : []), submit);
    const known = store.accounts();
    if (mode === 'login' && known.length && !name.value) name.value = known[known.length - 1]!.name;
    status.innerHTML = net.configured()
      ? `🌐 <b>Modo online</b>: conta no servidor <code>${net.url}</code>.`
      : '📱 <b>Modo local</b>: sua conta e progresso ficam salvos <b>neste aparelho</b> (sem servidor). Pra jogar online com amigos, configure um servidor em Configurações.';
  };

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    audio.unlock();
    if (busy) return;
    const n = name.value.trim();
    const err = validName(n);
    if (err) return toast(err, 'err');
    if (pass.value.length < 4) return toast('A senha precisa de pelo menos 4 caracteres.', 'err');
    if (mode === 'register' && pass.value !== pass2.value) return toast('As senhas não batem.', 'err');
    busy = true;
    submit.disabled = true;
    try {
      if (mode === 'login') await store.login(n, pass.value);
      else await store.register(n, pass.value);
      audio.play('ui_play');
      toast(mode === 'login' ? `Bem-vindo de volta, ${n}!` : `Conta criada! Bem-vindo, ${n}!`, 'ok');
      onDone();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : String(ex), 'err');
    } finally {
      busy = false;
      submit.disabled = false;
    }
  });

  render();
  const el = h('div.screen.auth', null, h('div.auth-bg'), h('div.auth-box.pixel-panel', null, h('h1.logo-small', null, 'SKULL ARENA'), tabs, form, status));
  setTimeout(() => name.focus(), 300);
  return { el };
}
