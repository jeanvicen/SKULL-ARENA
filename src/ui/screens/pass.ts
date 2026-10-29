import { audio } from '../../audio/audio';
import { ECONOMY } from '../../content/economy';
import { PASS_TIERS, passTierFor, SEASON } from '../../content/pass';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, coinIcon, confirmBox, h, num, toast, fill } from '../dom';
import { rewardChip, showGains } from '../rewards';

/**
 * SKULL PASS — trilha grátis (embaixo) e premium (em cima).
 * Premium é liberado com Isvoid ganho jogando (sem dinheiro real).
 */
export function passScreen(app: App): Screen {
  const body = h('div.pass');
  const track = h('div.pass-track');
  const head = h('div.pass-head');

  const claim = async (tier: number, premium: boolean) => {
    try {
      const g = await store.run('claimPass', { tier, premium });
      showGains(`NÍVEL ${tier}${premium ? ' · PREMIUM' : ''}`, g);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const render = () => {
    const p = store.profile!;
    const tier = passTierFor(p.pass.xp);
    const prevXp = PASS_TIERS[tier - 1]?.xp ?? 0;
    const nextXp = PASS_TIERS[tier]?.xp ?? prevXp;
    const daysLeft = Math.max(0, Math.ceil((Date.parse(SEASON.end) - Date.now()) / 86400000));
    fill(
      head,
      h('div.ph-left', null, h('h2', null, SEASON.name), h('small', null, `acaba em ${daysLeft} dias · ${SEASON.tiers} níveis`)),
      h('div.ph-tier', null, h('span', null, 'NÍVEL'), h('b', null, String(tier))),
      h(
        'div.ph-xp',
        null,
        h('div.bar', null, h('i', { style: `width:${nextXp > prevXp ? ((p.pass.xp - prevXp) / (nextXp - prevXp)) * 100 : 100}%` })),
        h('small', null, nextXp > prevXp ? `${num(p.pass.xp - prevXp)}/${num(nextXp - prevXp)} XP` : 'MÁXIMO'),
      ),
      p.pass.premium
        ? h('div.premium-on', null, '👑 PREMIUM ATIVO')
        : btn(h('span', null, '👑 LIBERAR PREMIUM · ', coinIcon('isvoid'), num(ECONOMY.passPremiumIsvoid)), 'btn-pink', async () => {
            if (!(await confirmBox('Skull Pass Premium', `Liberar a trilha premium por ${ECONOMY.passPremiumIsvoid} Isvoid? Você pode resgatar na hora todos os níveis que já alcançou.`))) return;
            try {
              await store.run('buyPassPremium');
              audio.play('ui_level');
              toast('Premium liberado! 👑', 'ok');
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), 'err');
            }
          }),
    );
    fill(
      track,
      ...PASS_TIERS.map((t, i) => {
        const n = i + 1;
        const reached = tier >= n;
        const cell = (premium: boolean) => {
          const list = premium ? p.pass.prem : p.pass.free;
          const got = list.includes(n);
          const can = reached && !got && (!premium || p.pass.premium);
          return h(
            `div.pass-cell${premium ? '.prem' : '.free'}${got ? '.got' : ''}${can ? '.can' : ''}${!reached ? '.locked' : ''}`,
            null,
            ...(premium ? t.premium : t.free).map(rewardChip),
            can
              ? btn('PEGAR', 'btn-yellow tiny', () => claim(n, premium))
              : got
                ? h('i.check', null, '✔')
                : premium && !p.pass.premium
                  ? h('i.lock', null, '👑')
                  : !reached
                    ? h('i.lock', null, '🔒')
                    : null,
          );
        };
        return h(`div.pass-col${reached ? '.reached' : ''}${n === tier + 1 ? '.next' : ''}`, null, cell(true), h('div.pass-n', null, String(n)), cell(false));
      }),
    );
    // rola até o nível atual
    requestAnimationFrame(() => {
      const cur = track.children[Math.max(0, tier - 2)] as HTMLElement | undefined;
      if (cur && !track.dataset.scrolled) {
        track.scrollLeft = cur.offsetLeft - 20;
        track.dataset.scrolled = '1';
      }
    });
  };
  render();
  const off = store.on(render);
  body.append(
    head,
    h('div.pass-labels', null, h('span', null, '👑 PREMIUM'), h('span', null, 'GRÁTIS')),
    track,
    h('p.muted.small', null, 'XP do passe: partidas (vitória vale o dobro), missões, Drops da Caveira e eventos.'),
  );
  const s = app.page('SKULL PASS', body, { cls: 'page-pass' });
  return { el: s.el, dispose: off };
}
