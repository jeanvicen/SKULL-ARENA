# 💀 SKULL ARENA

**Brawler de arena 2.5D feito de raiz para celular em paisagem, com arenas e modelos de personagens tridimensionais.** Heróis-caveira estilizados, controle de um dedo onde **andar = mirar = atacar**, partidas rápidas e uma coleção de personagens com raridades.

**Klipza Studio** · Criador **jeanvicen** · Instagram **[@0neajx](https://instagram.com/0neajx)**

> ⚠️ **Honestidade sobre o online:** hoje o jogo é **offline contra bots** (marcados como BOT em todo lugar). Multiplayer real, amigos, presentes e ranked exigem servidor — estão planejados (Fase 5) com o contrato de rede já definido em `src/net/contract.ts`, mas **não estão implementados**. Ver [STATUS.md](STATUS.md).

---

## Jogar

```bash
npm install
npm run dev        # http://localhost:5173 (abre no celular pela rede local também)
```

| | Celular (paisagem) | Computador |
|---|---|---|
| Mover | Joystick (faixa de baixo) | `WASD` / setas |
| Mirar | **A direção em que você anda** | Mouse (ou modo “Clássico” = igual ao celular) |
| Atacar | **Automático**: só dispara se houver inimigo **no alcance e à frente** | Clique (ou tiro automático nas configurações) |
| Especial | Botão redondo — **segure** para ver a prévia, **solte** para usar | `Espaço` / `E` / botão direito |
| Pausa | Botão ⏸ | `Esc` |
| Menus | toque | `Enter` joga, `1–5` abas, `M` modos, `Esc` volta |

**A regra que define o jogo:** virar as costas e correr = **não ataca**, só reposiciona. *A caveira encara, não foge.* O cone de ataque no chão acende em amarelo quando o próximo ataque vai sair.

## Comandos

```bash
npm run dev           # desenvolvimento
npm run build         # typecheck + build de produção (dist/)
npm run preview       # serve o build (PWA + service worker ativos)
npm test              # 62 testes: regra de controle, projéteis, especiais, determinismo,
                      # partidas headless em todo modo×mapa, economia, save, conteúdo
npm run balance       # relatório 1v1 (todos contra todos) — lento
npm run icons         # regenera ícones do PWA a partir do SVG do logo
npm run e2e           # (com `npm run preview` rodando) fluxo completo + screenshots, paisagem e desktop
npm run e2e:offline   # verifica instalabilidade (0 erros) e partida rodando SEM rede
```

## Stack (e por quê)

- **TypeScript + Vite** — projeto grande demais para single-file; tipos seguram o contrato de dados; Vite faz build estático trivial para a Vercel.
- **Canvas 2D (não PixiJS)** — toda a arte é **procedural** (caveiras, arenas, efeitos) e o Canvas 2D desenha paths/gradientes nativamente; as peças são “assadas” em sprites no início da partida, então o custo por frame é baixo (medido: ~1–2,5 ms de desenho com 20 lutadores e 800 partículas). Zero dependência de runtime, sem risco de perda de contexto WebGL em Android fraco. O renderizador é isolado (`src/render`) — trocar por PixiJS depois não toca no combate.
- **HTML/CSS para menus** — mais fácil de deixar bonito e responsivo que desenhar UI em canvas.
- **Web Audio sintetizado** — todos os sons e músicas são gerados em código: funcionam offline e não pesam nada.
- **Service Worker próprio** (plugin de ~40 linhas no `vite.config.ts`, sem Workbox) — precache do core para jogar offline.
- Dependências de runtime: só as fontes (`@fontsource/lilita-one`, `@fontsource/nunito`, licença OFL).

## Arquitetura em 30 segundos

```
data/*.json ──► content (loader + validação) ──► combat (simulação determinística) ◄── input / IA dos bots / (rede, futuro)
                                                       │ eventos
                                                       ▼
                                   render (canvas) · fx (partículas, som, vibração) · ui (menus)
```

- `src/combat/world.ts` é **a simulação**: recebe intenções (`FighterInput`), emite eventos (`GameEvent`). Não conhece DOM, canvas nem menus. Roda em Node (testes headless) — é exatamente o que um servidor autoritativo vai rodar.
- Passo fixo de 60 Hz + render interpolado; RNG com semente (mesma semente + mesmas entradas = mesmo resultado, testado).
- Bots (`src/entities/bot.ts`) usam **o mesmo input do jogador** e a mesma visibilidade do mato — sem trapaça.
- Detalhes: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

```
src/
  engine/    loop de passo fixo, colisão círculo×retângulo, pooling, RNG, A*
  combat/    mundo, projéteis, especiais, mira (a regra), partida local
  entities/  IA dos bots
  input/     perfis touch | desktop (trocáveis em runtime), joystick
  content/   tipos (contrato), loader por glob, validação, simetria de mapas
  render/    renderer, câmera, partículas, fx, arte procedural (caveiras, mapas, pets)
  audio/     síntese de sfx e música
  systems/   save, economia/baús/missões, matchmaking (stub local)
  net/       contrato da camada de rede (Fase 5) — implementação atual: offline
  ui/        app/roteador, telas, componentes, estilos
data/        characters, abilities, projectiles, maps, pets + raridades, economia, modos, controle
docs/        arquitetura, esquema de dados, plano online, publicação
```

## Adicionar conteúdo (sem código)

Tudo é JSON em `data/` — descoberto automaticamente pelo loader:

- **Personagem:** crie `data/characters/<id>.json` (copie um existente). Aponte `basicAttack.projectile` e `special.ability` para JSONs existentes ou novos. A aparência vem de `art` (crânio × chapéu × olhos × mandíbula × roupa × arma × aura → milhares de combinações).
- **Tiro:** `data/projectiles/<id>.json` — combine `direct`/`lob`/`melee` com `bounces`, `pierce`, `count`+`spreadDeg`, `burst`, `homing`, `orbit`, `aoeRadius`, `zone`, `onHit`, `lifesteal`, `falloffMul`.
- **Especial:** `data/abilities/<id>.json` — 14 tipos (`dash`, `aoe_burst`, `shield`, `heal`, `summon`, `buff`, `debuff`, `teleport`, `trap`, `beam`, `transform`, `multi_shot`, `zone`, `pull`) + parâmetros.
- **Mapa:** `data/maps/<id>.json` — escreva meia arena e use `"symmetry": "point" | "mirror_x" | "quad"`.
- `npm test` valida referências, spawns dentro de paredes, kits duplicados (“nunca dois iguais”) etc.

Referência completa: [docs/DADOS.md](docs/DADOS.md).

## Deploy na Vercel (passo a passo)

1. Suba o repositório no GitHub (`jeanvicen/skull-arena`).
2. Em [vercel.com/new](https://vercel.com/new), **Import** o repositório.
3. Framework: **Vite** (detectado). Build: `npm run build`. Output: `dist`. (Já configurado em `vercel.json`.)
4. **Deploy.** Cada push na branch principal gera deploy novo; o Service Worker aplica a versão atualizada automaticamente ao assumir o controle da página.
5. Abra a URL no celular → menu do navegador → **Adicionar à tela inicial**. Pronto: instalado e jogável offline.

Play Store (TWA/Bubblewrap), checklist de publicação e requisitos de 2026: [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

## Conteúdo inicial

- **17 personagens** em todas as raridades (Comum → Incomum → Raro → Extrema Rara → MAX → GOD → **CREATOR**), cada um com kit, fala e história únicos; 9 skins (4 lendárias exclusivas).
- **8 arenas** em 8 temas (cripta, cemitério, lava, gelo, pântano, templo, neon, vazio).
- **4 pets**, **3 baús**, **4 modos** (Caçada FFA 6, Treino 1v1, Equipe 3v3, Arena Caótica 20), salas locais.
- Progressão: XP/níveis, moedas e diamantes, upgrades, trilha de troféus, 13 conquistas, 10 títulos, missões diárias/semanais e o evento sazonal **Noite das Caveiras** (20/10–08/11).

## Créditos

**Klipza Studio** — criador **jeanvicen** — Instagram **[@0neajx](https://instagram.com/0neajx)**.
Fontes Lilita One e Nunito (SIL OFL). Arte, sons e música procedurais; nenhum asset de terceiros. Inspiração de game feel em brawlers mobile — nada copiado.
