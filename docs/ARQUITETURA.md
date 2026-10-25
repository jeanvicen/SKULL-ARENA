# Arquitetura

## Camadas (dependência só para baixo)

| Camada | Pasta | Conhece | Não conhece |
|---|---|---|---|
| Dados | `data/` | — | código |
| Conteúdo | `src/content` | tipos, JSON | combate, UI |
| Motor | `src/engine` | matemática | tudo de jogo |
| Combate | `src/combat`, `src/entities` | conteúdo, motor | DOM, canvas, áudio, menus |
| Apresentação | `src/render`, `src/audio`, `src/input` | combate (leitura) | menus |
| Sistemas | `src/systems` | conteúdo | DOM (exceto `SaveStore`) |
| Rede | `src/net` | tipos do combate | UI |
| UI | `src/ui` | tudo acima | — |

**Regra:** a lógica de combate nunca importa nada de `ui/`, `render/` ou `audio/`. Por isso `World` roda em Node nos testes headless e é o mesmo código que um servidor autoritativo rodará.

## Fluxo de um frame

```
GameLoop (rAF)
 ├─ update(1/60) × N    ← passo fixo, acumulador, máx. 5 passos/frame
 │   ├─ controller.update → escreve FighterInput do jogador (touch|desktop)
 │   ├─ BotBrain.update   → escreve FighterInput dos bots
 │   └─ World.step        → movimento, regra de ataque, especiais, projéteis,
 │                           zonas, armadilhas, almas, névoa, vitória → events[]
 └─ render(alpha)
     ├─ FxDirector.process(events) → partículas, números, som, vibração, shake, hit-stop
     ├─ Camera.follow
     ├─ GameRenderer.render  → piso assado, Y-sort (obstáculos/caixas/lutadores/pets),
     │                          mato, feixes, projéteis, partículas, névoa, barras
     └─ HUD (DOM)
```

## A regra de ataque (`src/combat/targeting.ts`)

`findAttackTarget(world, fighter, range, needsLos)`:
1. Para cada inimigo visível (respeita o mato), mede a distância até a **borda** do corpo.
2. Aceita se `distância ≤ alcance` e se o desvio angular para a direção do personagem é ≤ `attackConeHalfDeg` (+ tolerância pelo tamanho aparente do alvo).
3. Tiros diretos exigem linha de visão (não desperdiça ataque na parede). Arremessos em arco não.
4. Sem inimigo: caixas/urnas no cone também valem (dá pra quebrar cobertura).
5. O tiro sai com `aimAssist` (0,9) em direção ao alvo escolhido.

No touch, a direção do personagem **é** a direção do joystick; no desktop pode vir do mouse (`aimX/aimY`). Todos os parâmetros estão em `data/control.json`.

## Determinismo
- `Rng` (mulberry32) com semente por partida; a simulação nunca usa `Math.random`.
- Passo fixo de 60 Hz; o render interpola posições (`px/py → x/y`).
- Partículas/efeitos visuais podem usar `Math.random` (não afetam o resultado).
- Hit-stop congela **o loop local**, não a simulação: no online vira efeito só visual.

## Desempenho
- Object pooling: projéteis (`Pool<Projectile>`), partículas, números de dano.
- Arte assada: piso inteiro, obstáculos, mato, partes dos personagens, sprites de projéteis e de brilho — o frame só faz `drawImage` + transformações.
- Resolução limitada por qualidade (DPR máx. 2/1,5/1) e piso com teto de pixels.
- Medido (Chromium, 1440×900 e 390×844 @2x): simulação 0,1–0,45 ms; desenho 1–2,5 ms com 20 lutadores e ~800 partículas. Metas: 60 fps alvo, 30 fps mínimo. **Pendente: medir em Android fraco real** (overlay de FPS nas Configurações).
- Pausa automática ao ir para segundo plano (`visibilitychange`) e suspensão do áudio.

## Riscos técnicos e mitigação
| Risco | Mitigação |
|---|---|
| Canvas 2D lento em aparelho fraco | Sprites assados, cache de brilho, qualidade baixa reduz DPR/partículas; renderer isolado para trocar por WebGL se o profiling mandar |
| Conteúdo quebrado derrubar o jogo | Validação no boot descarta só o item inválido; testes impedem merge com erro |
| Escala para 1000+ personagens | Glob de JSON; retratos gerados sob demanda com cache; o bundle cresce ~1–2 KB/personagem (trocar `eager` por lazy se passar de alguns MB) |
| Online “de mentira” | Contrato em `src/net/contract.ts`; UI marca BOTS e recursos que exigem servidor |
| Trapaça no save local | Assumido: offline é confiável só para o próprio jogador. Itens valiosos/ranked migram para o servidor (ver ONLINE.md) |
| Vantagem do mouse no desktop | Modo “Clássico” disponível; no online, filas separadas por perfil ou normalização |
