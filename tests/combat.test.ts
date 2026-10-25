import { describe, expect, it } from 'vitest';
import { emptyMap, makeWorld, place, run } from './helpers';

const shots = (w: ReturnType<typeof makeWorld>, ownerId: number) => w.events.filter((e) => e.t === 'shot' && e.ownerId === ownerId).length;

describe('regra assinatura: ANDA = MIRA = ATACA', () => {
  it('dispara quando há inimigo à frente, dentro do alcance', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 560); // 240 acima, alcance 300
    const p = w.fighters[0];
    p.input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    expect(shots(w, p.id)).toBe(1);
  });

  it('NÃO dispara de costas para o inimigo (recuar = só reposiciona)', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 600);
    const p = w.fighters[0];
    p.input = { moveX: 0, moveY: 1, attackHeld: true, special: false }; // anda pra baixo, inimigo em cima
    run(w, 1);
    expect(shots(w, p.id)).toBe(0);
  });

  it('NÃO dispara se o inimigo está fora do alcance (não desperdiça ataque)', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 1100);
    place(w, 1, 600, 100);
    const p = w.fighters[0];
    p.input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    expect(shots(w, p.id)).toBe(0);
  });

  it('soltar o joystick para de atacar', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 600);
    const p = w.fighters[0];
    p.facing = -Math.PI / 2;
    p.input = { moveX: 0, moveY: 0, attackHeld: false, special: false };
    run(w, 1);
    expect(shots(w, p.id)).toBe(0);
  });

  it('respeita o intervalo de ataque (cooldown)', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'tita_blindado' }]);
    place(w, 0, 600, 900);
    place(w, 1, 600, 640);
    const p = w.fighters[0];
    w.fighters[1].hp = w.fighters[1].maxHp = 1e9;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      p.x = 600; p.y = 900; // mantém posição
      p.input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
      w.events.length = 0;
      w.step(1 / 60);
      total += shots(w, p.id);
    }
    // 1s com intervalo 0.55 => 2 disparos
    expect(total).toBe(2);
  });

  it('não dispara através de parede (linha de visão)', () => {
    const map = emptyMap({ obstacles: [{ type: 'wall', x: 500, y: 680, w: 200, h: 40 }] });
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }], map);
    place(w, 0, 600, 800);
    place(w, 1, 600, 560);
    const p = w.fighters[0];
    p.input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    expect(shots(w, p.id)).toBe(0);
  });

  it('desktop: mira separada (mouse) define a direção do ataque', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 600);
    const p = w.fighters[0];
    // anda pra baixo mas mira pra cima
    p.input = { moveX: 0, moveY: 1, aimX: 0, aimY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    expect(shots(w, p.id)).toBe(1);
  });
});

describe('projéteis data-driven', () => {
  it('direto acerta e causa dano', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 600);
    const e = w.fighters[1];
    w.fighters[0].input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    w.fighters[0].input = { moveX: 0, moveY: 0, attackHeld: false, special: false };
    run(w, 0.6);
    expect(e.hp).toBe(e.maxHp - w.fighters[0].basic.damage);
  });

  it('lob passa por cima de paredes', () => {
    const map = emptyMap({ obstacles: [{ type: 'wall', x: 500, y: 680, w: 200, h: 40 }] });
    const w = makeWorld([{ characterId: 'bruxo_verde' }, { characterId: 'rachada' }], map);
    place(w, 0, 600, 800);
    place(w, 1, 600, 560);
    const e = w.fighters[1];
    w.fighters[0].input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    w.fighters[0].input = { moveX: 0, moveY: 0, attackHeld: false, special: false };
    run(w, 1);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('ricochete quica na parede', () => {
    const map = emptyMap({ obstacles: [{ type: 'wall', x: 400, y: 500, w: 400, h: 40 }] });
    const w = makeWorld([{ characterId: 'ricochete' }, { characterId: 'rachada' }], map);
    place(w, 0, 600, 800);
    place(w, 1, 600, 880); // inimigo atrás; vamos disparar manualmente pra parede
    const p = w.fighters[0];
    p.facing = -Math.PI / 2;
    w.fireBasic(p, p.basic, 600, 400, null);
    run(w, 1.2);
    expect(w.events.some((e) => e.t === 'bounce')).toBe(true);
  });

  it('perfurante atravessa e acerta dois inimigos em linha', () => {
    const w = makeWorld([{ characterId: 'rainha_gelida' }, { characterId: 'rachada' }, { characterId: 'coveiro' }]);
    place(w, 0, 600, 900);
    place(w, 1, 600, 760);
    place(w, 2, 600, 640);
    w.fighters[0].input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    w.fighters[0].input = { moveX: 0, moveY: 0, attackHeld: false, special: false };
    run(w, 0.8);
    expect(w.fighters[1].hp).toBeLessThan(w.fighters[1].maxHp);
    expect(w.fighters[2].hp).toBeLessThan(w.fighters[2].maxHp);
  });

  it('melee acerta em arco curto', () => {
    const w = makeWorld([{ characterId: 'rachada' }, { characterId: 'ossinho' }]);
    place(w, 0, 600, 700);
    place(w, 1, 600, 640);
    w.fighters[0].input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    expect(w.fighters[1].hp).toBeLessThan(w.fighters[1].maxHp);
  });

  it('acertos do básico carregam o especial', () => {
    const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'tita_blindado' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 600);
    const p = w.fighters[0];
    const before = p.specialCd;
    p.input = { moveX: 0, moveY: -1, attackHeld: true, special: false };
    w.step(1 / 60);
    p.input = { moveX: 0, moveY: 0, attackHeld: false, special: false };
    run(w, 0.5);
    expect(p.specialCd).toBeLessThan(before - 0.5 - p.ability.chargePerHit! + 0.05);
  });
});

describe('especiais data-driven', () => {
  const cast = (charId: string, setup?: (w: ReturnType<typeof makeWorld>) => void) => {
    const w = makeWorld([{ characterId: charId }, { characterId: 'rachada' }]);
    place(w, 0, 600, 800);
    place(w, 1, 600, 700);
    setup?.(w);
    const p = w.fighters[0];
    p.specialCd = 0;
    p.facing = -Math.PI / 2;
    p.input = { moveX: 0, moveY: 0, attackHeld: false, special: true };
    w.step(1 / 60);
    return w;
  };

  it('dash move e fica invulnerável', () => {
    const w = cast('po_pistoleira');
    const p = w.fighters[0];
    expect(p.dash).not.toBeNull();
    expect(p.invuln).toBeGreaterThan(0);
    run(w, 0.4);
    expect(p.y).toBeLessThan(700);
  });

  it('escudo absorve dano e reflete tiros', () => {
    const w = cast('tita_blindado');
    const p = w.fighters[0];
    expect(p.shield).toBeGreaterThan(1000);
    expect(p.shieldReflect).toBe(true);
    const hp = p.hp;
    w.damage(p, 500, w.fighters[1], 'basic');
    expect(p.hp).toBe(hp);
  });

  it('invocação cria minions aliados que somem com o tempo', () => {
    const w = cast('necromante', (w) => (w.fighters[1].hp = w.fighters[1].maxHp = 1e9));
    const minions = w.fighters.filter((f) => f.isMinion);
    expect(minions).toHaveLength(3);
    run(w, 11);
    expect(minions.every((m) => !m.alive)).toBe(true);
  });

  it('nova congelante congela inimigos próximos', () => {
    const w = cast('rainha_gelida');
    expect(w.fighters[1].hasStatus('freeze')).toBe(true);
  });

  it('puxão traz inimigos para perto', () => {
    const w = cast('rachada', (w) => place(w, 1, 600, 620));
    const d0 = 180;
    run(w, 0.3);
    expect(Math.abs(w.fighters[1].y - w.fighters[0].y)).toBeLessThan(d0);
  });

  it('feixe canaliza dano contínuo', () => {
    const w = cast('anubis');
    run(w, 2.1);
    expect(w.fighters[1].hp).toBeLessThan(w.fighters[1].maxHp);
  });

  it('transformação aumenta vida e troca o básico', () => {
    const w = cast('jeanvicen');
    const p = w.fighters[0];
    expect(p.transform).not.toBeNull();
    expect(p.maxHp).toBeGreaterThan(p.baseMaxHp);
    run(w, 6.5);
    expect(p.transform).toBeNull();
    expect(p.maxHp).toBe(p.baseMaxHp);
  });

  it('teleporte atravessa paredes finas', () => {
    const map = emptyMap({ obstacles: [{ type: 'wall', x: 500, y: 700, w: 200, h: 30 }] });
    const w = makeWorld([{ characterId: 'ceifador' }, { characterId: 'rachada' }], map);
    place(w, 0, 600, 800);
    place(w, 1, 1000, 1000);
    const p = w.fighters[0];
    p.specialCd = 0;
    p.facing = -Math.PI / 2;
    p.input = { moveX: 0, moveY: 0, attackHeld: false, special: true };
    w.step(1 / 60);
    expect(p.y).toBeLessThan(700);
  });
});

describe('determinismo', () => {
  it('mesma semente + mesmas entradas = mesmo resultado', () => {
    const sim = () => {
      const w = makeWorld([{ characterId: 'ossinho' }, { characterId: 'po_pistoleira' }, { characterId: 'bruxo_verde' }], emptyMap(), undefined, 42);
      place(w, 0, 300, 600);
      place(w, 1, 600, 300);
      place(w, 2, 900, 600);
      run(w, 5, () => {
        w.fighters.forEach((f, i) => {
          const a = w.tick * 0.05 + i;
          f.input = { moveX: Math.cos(a), moveY: Math.sin(a), attackHeld: true, special: w.tick % 120 === 0 };
        });
      });
      return w.fighters.map((f) => `${f.x.toFixed(3)},${f.y.toFixed(3)},${f.hp}`).join('|');
    };
    expect(sim()).toBe(sim());
  });
});
