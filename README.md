# 💀 SKULL ARENA

Arena brawler de celular (deitado/paisagem) em **pixel art 16-bit**, no estilo dos "brawlers"
de partida rápida: twin-stick, arbustos, paredes que quebram, super que carrega no dano,
Guerra de Gangues **10 vs 10**, Todos contra Todos, eventos, baús, passe e muita caveira.

- **527 personagens** (21 feitos à mão + 506 gerados), cada um com **história de vida**, atributos, ataque, habilidades, super e passiva
- **524 pets** que seguem você e dão bônus pequenos
- **7 raridades**: Comum, Incomum, Raro, Extremo, Épico, GOD e **CREATORs** — incluindo o **Vicen₹** (1% no Drop do Vazio, garantido em 100 aberturas)
- **Moedas da Morte** (moeda principal) e **Isvoid** (moeda rara) — **sem dinheiro real**
- **PWA**: instala no celular e joga **offline**
- **Online opcional**: contas, amigos, chat, salas com código e partidas no servidor
- **Sons reais** (gravações CC0) com mixer posicional
- Feito pra **você mexer**: comandos que criam personagem/pet/evento/código, Estúdio dentro do jogo e validador de conteúdo

> Versão do documento: 2.0 · Tudo neste README foi testado (`npm test`, `npm run validar`, `npm run e2e`).

---

## Índice

1. [Rodar o jogo](#1-rodar-o-jogo)
2. [Instalar no celular (PWA) e jogar offline](#2-instalar-no-celular-pwa-e-jogar-offline)
3. [Como se joga](#3-como-se-joga)
4. [Telas do jogo](#4-telas-do-jogo)
5. [Estrutura do projeto](#5-estrutura-do-projeto)
6. [Como funciona por dentro](#6-como-funciona-por-dentro)
7. [Criar e mudar conteúdo (o guia que você mais vai usar)](#7-criar-e-mudar-conteúdo)
8. [Economia, baús e chances](#8-economia-baús-e-chances)
9. [Sons e música](#9-sons-e-música)
10. [Modo online (servidor)](#10-modo-online-servidor)
11. [Testes e verificação](#11-testes-e-verificação)
12. [Regras de transparência](#12-regras-de-transparência)
13. [Problemas comuns](#13-problemas-comuns)
14. [Limitações conhecidas (sendo honesto)](#14-limitações-conhecidas)
15. [Créditos e licenças](#15-créditos-e-licenças)

---

## 1. Rodar o jogo

Precisa de **Node.js 20+** (recomendado 22).

```bash
npm install          # instala as dependências (uma vez)
npm run dev          # abre em http://localhost:5173 (e no IP da sua rede, pra testar no celular)
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com recarga automática |
| `npm run build` | confere os tipos e gera o jogo pronto em `dist/` |
| `npm run preview` | testa o `dist/` como se estivesse publicado |
| `npm test` | testes automáticos (simulação, economia, conteúdo, pixel art, rede) |
| `npm run validar` | confere TODO o conteúdo (personagens, pets, mapas, baús, eventos, códigos, sons) |
| `npm run e2e` | abre o jogo no Chromium, passa por todas as telas e joga uma partida (prints em `e2e-shots/`) |
| `npm run novo:personagem` | cria um personagem novo (ver seção 7) |
| `npm run novo:pet` / `novo:evento` / `novo:codigo` | cria pet / evento / código de prêmio |
| `npm run audio` | regera os sons a partir das gravações CC0 (seção 9) |
| `npm run icons` | regera os ícones do app |
| `npm run server` | sobe o servidor online (seção 10) |
| `npm run format` | arruma a formatação do código (Prettier) |

**Testar no celular na mesma rede:** rode `npm run dev`, veja o endereço "Network" no terminal
(ex.: `http://192.168.0.10:5173`) e abra no celular.

---

## 2. Instalar no celular (PWA) e jogar offline

1. Publique o `dist/` (qualquer hospedagem estática com **HTTPS**: Netlify, Vercel, GitHub Pages, Cloudflare Pages) ou use `npm run server`.
2. Abra no celular:
   - **Android (Chrome):** menu ⋮ → **Instalar app** / "Adicionar à tela inicial".
   - **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.
3. Na primeira abertura o jogo baixa tudo (código, sons, ícones) pro aparelho. Depois **abre e joga sem internet** (modo local).

Detalhes:
- O **service worker** é gerado no build (`vite.config.ts` + `src/sw-template.js`) com a lista de todos os arquivos.
- Atualização: quando você publica uma versão nova, o jogo baixa em segundo plano e avisa; ela entra na próxima abertura.
- O jogo pede **tela cheia + paisagem** no primeiro toque (quando o navegador deixa). Em pé aparece "Gire o celular".

---

## 3. Como se joga

### Controles

| | Celular | PC |
|---|---|---|
| Andar | joystick à **esquerda** (nasce onde o dedão encosta) | WASD / setas |
| Mirar + atirar | botão vermelho à **direita**: arraste pra mirar, **solte pra atirar** | mouse mira, clique atira (segurar = rajada) |
| Mira automática | **toque rápido** no botão de ataque | — |
| Habilidades | botões azuis (até 3): arraste pra mirar, solte pra usar | Q / E / R |
| SUPER | botão amarelo (brilha quando carregou) | Espaço (ou botão direito) |
| Pausa | ❚❚ no canto | Esc / P |

Configurações → Controles: **tamanho**, **transparência**, **canhoto** (inverte lados), **vibração** e **dificuldade dos BOTs**.

### Regras básicas
- Vida volta sozinha depois de ~3 s sem atirar nem levar dano.
- **Munição**: 3 barras que recarregam sozinhas.
- **SUPER** carrega causando dano. **Arbustos** escondem (atirar/levar dano revela por um instante).
- **Paredes de tijolo e vidro quebram**; **barris explodem**; caixas e pneus são empurrados (física).
- Power-ups (`*`), altares de cura (`+`) e pads de salto (`^`) espalhados pelos mapas.

### Modos

| Modo | Como ganha |
|---|---|
| **Guerra de Gangues** (10 vs 10) | Eliminou? Cai uma caveira. Pegue as caveiras dos inimigos pra pontuar (e as do seu time pra negar). 40 pontos ou mais pontos em 4:00. |
| **Todos contra Todos** (10) | 1 ponto por eliminação. 3 seguidas = **PROCURADO** (vale 2). Mais pontos em 3:00. |
| **Jogar com Amigos** | Sala com código: todo mundo da sala no **mesmo time**, BOTs completam (online). No modo local, os nomes dos amigos entram como BOTs aliados. |
| **Treino** | Bonecos que mostram o dano. Dá pra **testar qualquer personagem** (até os que você não tem). |
| Eventos | **Chuva de Meteoros**, **Só Supers** (super 4x mais rápido), **Caveira Gigante** (chefão coop) — aparecem no seletor quando o evento está ativo. |

**BOTs são sempre identificados** (etiqueta `BOT` no nome, no placar e no feed).

---

## 4. Telas do jogo

| Tela | O que tem |
|---|---|
| **Abertura** | Caveira pixel que ri com risada "quebrada" (glitch). Toque pra começar (o toque libera o som). |
| **Login / Criar conta** | Modo local (conta no aparelho, senha com hash PBKDF2) ou online (conta no servidor). |
| **Menu** | Seu personagem **grande e animado** (faz gestos sozinho; toque nele), JOGAR, seletor de modo e mapa, prêmio diário, Drop da Caveira, baús guardados, eventos, Estrada da Morte, perfil, moedas. |
| **Personagens** | Os 527 com filtro por raridade/função, busca, "só os meus", ordenação. |
| **Detalhes** | Todas as animações (parado, correndo, ataque, habilidade, dano, arrancada, vitória, derrota, costas), **história de vida**, habilidades com números, atributos, subir de nível, selecionar, testar no Treino. |
| **Pets** | Os 524 pets animados, bônus e escolher qual te acompanha. |
| **Loja** | Baús (com botão **CHANCES**), baús guardados, ofertas do dia (renovam à meia-noite), troca de moedas por Isvoid. |
| **Abertura de baú** | O baú cai, você toca pra sacudir (a **cor do brilho entrega a raridade**), ele explode em luz e as cartas viram uma a uma. Vicen₹ tem efeito especial. |
| **Skull Pass** | 50 níveis, trilha grátis + premium (liberada com Isvoid ganho jogando). |
| **Missões e Eventos** | Eventos ativos, missões diárias (3), semanais (3) e de evento. |
| **Estrada da Morte** | Prêmios por troféus totais + 9 ligas (Osso → Vazio). |
| **Social** | Amigos por TAG, chat geral e privado, salas (online). |
| **Estúdio** | Ver qualquer personagem, **visual aleatório + copiar código**, exportar a folha de sprite (PNG), modelo vazio e **testar seu próprio PNG**. |
| **Configurações** | Som, gráficos, controles, conta/backup, **código de prêmio**, servidor online e **Painel do Criador**. |
| **Resultado** | Vitória/derrota, suas estatísticas, prêmios contando, missões que andaram, Drop ganho, placar completo. |

---

## 5. Estrutura do projeto

```
SKULL-ARENA/
├─ index.html                 página única do jogo
├─ public/
│  ├─ audio/                  129 sons .mp3 (gerados por `npm run audio`) + CREDITS.txt
│  ├─ icons/                  ícones do app (gerados por `npm run icons`)
│  ├─ sprites/                (opcional) seus desenhos PNG de personagem/pet
│  └─ manifest.webmanifest    instalação PWA (paisagem, tela cheia)
├─ src/
│  ├─ main.ts                 entrada: abertura → login → menu
│  ├─ content/                ★ TUDO QUE É CONTEÚDO (edite aqui) ★
│  │  ├─ characters/          personagens feitos à mão (handmade/) + registro (index.ts)
│  │  ├─ generator/           gerador dos personagens procedurais (nomes, histórias, kits)
│  │  ├─ pets/                pets feitos à mão + gerador
│  │  ├─ maps/                mapas desenhados em texto
│  │  ├─ abilities.ts         as "peças de LEGO" das habilidades (ataques, skills, supers)
│  │  ├─ rarities.ts          raridades (cor, poder, preço, conversão de repetido)
│  │  ├─ modes.ts             modos de jogo (tempo, pontos, renascimento)
│  │  ├─ chests.ts            baús e chances, Drop da Caveira
│  │  ├─ events.ts            eventos (datas, multiplicadores, modos especiais)
│  │  ├─ codes.ts             códigos de prêmio + PIN do Painel do Criador
│  │  ├─ pass.ts              Skull Pass
│  │  ├─ missions.ts          missões diárias e semanais
│  │  ├─ progression.ts       Estrada da Morte, ligas, prêmio diário
│  │  ├─ economy.ts           TODOS os números da economia
│  │  └─ types.ts             o "contrato" de tudo (com comentários)
│  ├─ sim/                    simulação da partida (sem tela: roda no navegador, teste e servidor)
│  │  ├─ world.ts             o mundo: movimento, dano, status, modos, pontuação
│  │  ├─ abilities.ts         executa os efeitos das habilidades
│  │  ├─ projectiles.ts       tiros (arco, teleguiado, ricochete, bumerangue, corrente…)
│  │  ├─ map.ts               grade, colisão, destruição
│  │  ├─ nav.ts               pathfinding (A*) dos BOTs
│  │  └─ bots.ts              cérebro dos BOTs (mesma entrada que um humano)
│  ├─ pixel/                  pixel art 16-bit: personagens, pets, animação, sprites
│  ├─ art/                    esqueleto (rig) e clipes de animação usados pela pixel art
│  ├─ render/                 desenho da partida (mapa, tiros, partículas, efeitos, câmera)
│  ├─ game/                   sessão de partida, HUD, elenco (BOTs)
│  ├─ input/controls.ts       controles touch + teclado/mouse
│  ├─ audio/                  motor de áudio + catálogo de sons
│  ├─ meta/                   perfil, economia (regras puras), ações, armazenamento
│  ├─ net/                    cliente online, snapshots, partida online
│  ├─ ui/                     telas e componentes de interface
│  └─ styles/main.css         visual da interface (cores e fontes no topo)
├─ server/                    servidor online (Node + WebSocket)
├─ tools/                     comandos de terminal (criar conteúdo, validar, áudio, ícones, e2e)
├─ tests/                     testes automáticos (vitest)
├─ dev/pixel.html             visualizador de pixel art pra desenvolvimento
└─ docs/PROMPT_MESTRE_SKULL_ARENA.txt   pesquisa do gênero + prompt mestre
```

---

## 6. Como funciona por dentro

```
 Controles ─┐                     ┌─► Renderer pixel (canvas) ─► tela
 BOTs ──────┼─► FighterInput ─► World.step() 60 Hz ─► eventos ─► Fx (partículas, câmera, som, HUD)
 Rede ──────┘     (intenções)       (simulação)
```

- **Simulação determinística a 60 Hz** (`src/sim/`): mesma semente + mesmas entradas = mesmo resultado
  (testado). Não usa DOM, então roda igual no navegador, nos testes e no servidor.
- **Entradas iguais pra todos**: humano, BOT e jogador online mandam o mesmo `FighterInput`
  (andar, mirar, atirar). Os BOTs não trapaceiam: veem o mesmo que um jogador (arbustos inclusos).
- **Pixel art 16-bit procedural** (`src/pixel/`): cada personagem é desenhado por código a partir do
  seu `look` (pele, cabelo, roupa, tênis, óculos, arma…), com rampas de cor com *hue shift*,
  sombreamento automático, contorno de 1 px e animação por esqueleto em quadros (8–16 fps).
  Quadros vão pra um cache. Quadro: **72×84 px**, pés em (36, 76). Pet: **32×32**.
- **Render em baixa resolução + escala inteira** (`src/render/worldRenderer.ts`): o mundo é desenhado
  num buffer pequeno (1 pixel de arte = 2 px do mundo) e ampliado com escala inteira, sem borrar.
  Nomes e números de dano vão por cima em resolução cheia com fonte pixel.
- **Economia como funções puras** (`src/meta/economy.ts`) + **lista de ações** (`src/meta/actions.ts`):
  no modo local rodam no aparelho; no modo online **o servidor roda exatamente as mesmas funções**
  (ninguém edita moeda no cliente).
- **Online**: o servidor simula a partida e manda ~20 fotos/s (snapshots); o cliente tem um mundo
  "espelho" e só desenha com interpolação (`src/net/snapshot.ts`, `src/net/match.ts`).

---

## 7. Criar e mudar conteúdo

### 7.1 Personagem novo (jeito fácil)

```bash
npm run novo:personagem -- "Zé Neon" epico atacante
#                          nome      raridade função
```
- **raridades:** `comum incomum raro extremo epico god creators`
- **funções:** `atacante tanque suporte assassino atirador controle lancador`

Isso cria `src/content/characters/handmade/ze_neon.ts` **completo** (história, atributos, ataque,
habilidade, super, passiva e um visual 16-bit aleatório) e registra no jogo. Depois:

1. Abra o arquivo e escreva a **história** (`bio`), mude o **título**, a **frase** e os **atributos**.
2. Troque as habilidades usando as peças de `src/content/abilities.ts` (veja 7.2).
3. Veja no jogo: **Menu → ESTÚDIO** ou **PERSONAGENS** (ou teste no **Treino** pelo botão 🎯).
4. Rode `npm run validar`.

Exemplo completo e comentado: `src/content/characters/handmade/kaze.ts`.

### 7.2 Habilidades = peças de LEGO

Em `src/content/abilities.ts`:

| Grupo | Peças |
|---|---|
| `atk.*` (ataque) | `burst` `shotgun` `sniper` `lob` `melee` `boomerang` `chain` `wave` `homing` `spray` `ricochet` `fan` `punch` |
| `skill.*` (botões Q/E/R) | `dash` `blink` `heal` `shield` `haste` `rage` `armor` `grenade` `nova` `zone` `turret` `minions` `healTotem` `wall` `trap` `hook` `stealth` `clone` `barrage` `laser` `blades` `rewind` `cleanse` `reload` `freeze` |
| `sup.*` (SUPER) | `rain` `bigShot` `quake` `charge` `healField` `storm` `army` `megaLaser` `fortress` `shadowStrike` `nuke` `frenzy` |
| `st.*` (status) | `slow` `stun` `burn` `poison` `freeze` `root` `silence` `mark` `weaken` |

```ts
attack: atk.shotgun({ name: 'Estouro', dmg: 300, range: 420, n: 5, color: '#ff3df2' }),
skills: [skill.dash({ name: 'Arrancada', dist: 300, cd: 6 }), skill.freeze({ dmg: 600, cd: 10 })],
super: sup.storm({ name: 'Tempestade', dps: 700, kind: 'electric', color: '#3df2ff', status: st.slow(2) }),
```

Quer algo que não existe? Monte direto com **efeitos** (`EffectDef` em `src/content/types.ts`):
`projectile`, `melee`, `dash`, `blink`, `leap`, `aoe`, `zone`, `heal`, `shield`, `buff`, `summon`,
`wall`, `beam`, `trap`, `stealth`, `clone`, `rewind`, `orbit`, `cleanse`, `ammo` — dá pra combinar
vários no mesmo botão (ex.: pular + explosão ao cair).

- Até **3 habilidades** (botões Q/E/R) + **SUPER** + **passiva**.
- **Raridade** dá um bônus de poder (`src/content/rarities.ts` → `power`) e o **nível** dá +5% por nível.

### 7.3 Visual do personagem

**Opção A — gerador (sem desenhar nada):** no `look` você escolhe espécie, corpo, cabelo, olhos,
boca, roupa (`hoodie`, `varsity`, `puffer`…), calça (`baggy`, `cargo`…), tênis (`chunky`, `hightop`…),
acessórios (óculos, fone, corrente, mochila, boné, asas…), arma e aura. Todas as opções estão
listadas em `src/content/types.ts` (`Look`). Dica: **ESTÚDIO → 🎲 VISUAL ALEATÓRIO → COPIAR CÓDIGO**
e cole no arquivo.

**Opção B — seu próprio desenho (Piskel/Aseprite/LibreSprite):**
1. **ESTÚDIO → EXPORTAR FOLHA DESTE** (ou **MODELO VAZIO**) pra pegar o PNG no formato certo.
2. Formato da folha: quadros **72×84 px**, pés no ponto **(36, 76)**, uma animação por linha:

   | linha | animação | quadros |
   |---|---|---|
   | 0 | parado | 8 |
   | 1 | correndo | 8 |
   | 2 | ataque | 6 |
   | 3 | habilidade | 6 |
   | 4 | dano | 3 |
   | 5 | vitória | 8 |
   | 6 | derrota | 4 |
   | 7 | arrancada | 2 |

3. Teste no próprio jogo: **ESTÚDIO → TESTAR MEU PNG**.
4. Salve em `public/sprites/ze_neon.png` e no personagem coloque `sheet: 'sprites/ze_neon.png'`.
   Tamanho de quadro diferente? Use `sheet: { src, frameW, frameH, originX, originY, frames: { idle: 4 } }`.
5. Desenhe olhando pra **direita** (o jogo espelha sozinho).

**Pets com desenho próprio:** PNG **128×32** (4 quadros de 32×32 lado a lado) + `sheet: 'sprites/x.png'`.

### 7.4 Pet novo
```bash
npm run novo:pet -- "Bafo" epico dragon damage=0.05 spark=260
```
Corpos: `bat crow cat ghost slime drone skull dragon jelly frog snake eye flame robot bunny fox spider fish owl crystal`.
Bônus: `speed damage hp regen reload superCharge coinBonus revealRadius lowHpShield spark` · cores: `cor1= cor2= cor3=`.
Fica em `src/content/pets/index.ts` (lista `HANDMADE_PETS`).

### 7.5 Mais personagens/pets gerados
- `src/content/characters/index.ts` → `GENERATED_COUNT` (hoje 506).
- `src/content/pets/index.ts` → `GENERATED_PETS` (hoje 512).

O gerador é **determinístico**: o nº 37 é sempre o mesmo; aumentar o número só **adiciona** novos no fim.

### 7.6 Mapa novo
Em `src/content/maps/index.ts`, mapas são desenhados em texto (cada caractere = bloco 64×64):

```
.  chão        #  parede          B  tijolo (quebra)   =  vidro (quebra fácil)
W  água        "  arbusto          ~  lava/ácido        ^  pad de salto
x  caixa       o  barril (explode) t  pneu              +  altar de cura   *  power-up
A  nascimento time A    Z  time B    S  nascimento livre (FFA)
```
Desenhe **só metade** e use `symmetry: 'mirror_x' | 'mirror_y' | 'point'` (ou `'none'`).
Escolha o tema (`theme`) e em quais modos ele aparece (`modes`). Rode `npm run validar`.

### 7.7 Evento novo
```bash
npm run novo:evento -- "Carnaval Caveira" 2027-02-05 2027-02-17 moedas=2 emoji=🎭 presente_moedas=300
```
Opções: `modo=` (meteoro, so_super, chefao…), `moedas= xp= trofeus= passe=` (multiplicadores),
`bau=`, `destaque=` (personagem com chance x2), `presente_moedas= presente_isvoid=`, `semanal=0,6`
(repete toda semana nesses dias), `emoji= cor= cor2=`. Fica em `src/content/events.ts`.
**Testar antes da data:** Configurações → Painel do Criador → "viajar no tempo".

### 7.8 Códigos de prêmio (criar e apagar)
Três jeitos:
1. **No jogo:** Configurações → **Painel do Criador** (PIN) → crie com moedas, Isvoid, XP, XP do passe,
   baú, personagem, pet e título; limite de usos por conta e validade; **desligar** ou **apagar**.
   (modo local: fica no aparelho; online: fica no servidor e vale pra todo mundo)
2. **No terminal:**
   ```bash
   npm run novo:codigo -- VICEN100 moedas=500 isvoid=20 titulo="Fã do Vicen" usos=1 ate=2026-12-31
   npm run novo:codigo -- --apagar VICEN100
   npm run novo:codigo -- --listar
   ```
3. **No arquivo** `src/content/codes.ts`.

> ⚠️ Troque o **PIN** (`ADMIN_PIN` em `src/content/codes.ts`). No modo local o PIN fica no código do
> jogo (serve pra impedir que alguém no seu aparelho mexa sem querer, não é segurança de verdade).
> No servidor use a variável de ambiente `ADMIN_PIN`.

### 7.9 Missões, passe, estrada, prêmio diário, ligas
- `src/content/missions.ts` — diárias/semanais (o jogo sorteia 3 de cada, igual pra todo mundo no mesmo dia).
- `src/content/pass.ts` — níveis, XP por nível, prêmios grátis/premium (`OVERRIDES` pra níveis especiais).
- `src/content/progression.ts` — Estrada da Morte, ligas e os 7 dias do prêmio diário.

### 7.10 Visual da interface
Cores e fontes no topo de `src/styles/main.css` (`--yellow`, `--pink`, `--cyan`…). Fontes:
**Pixelify Sans** (textos) e **Press Start 2P** (títulos/números), embutidas (funcionam offline).

---

## 8. Economia, baús e chances

Todos os números ficam em **`src/content/economy.ts`**:

| | Valor padrão |
|---|---|
| Começo | 500 Moedas da Morte, 20 Isvoid, 3 personagens (Kaze, Marreta, DJ Kiko) e o pet Chiclete |
| Partida | vitória 40 · derrota 18 · empate 25 · +2 por eliminação · +1 por caveira · teto 120 (antes de evento/pet) |
| Troféus | +10/+0 até 100, depois sobe menos e desce mais; FFA por colocação |
| Nível do personagem | 1 → 10, custo em moedas (40 … 1.400), +5% vida e dano por nível |
| Drop da Caveira | 1 por vitória (top 3 no FFA), até 5 por dia; a raridade "sobe" na animação |
| Skull Pass Premium | 250 Isvoid (ganho jogando) |

**Baús** (`src/content/chests.ts`) — cada carta sorteia, em ordem: personagem por raridade → pet por
raridade → senão moedas. Personagens que você **ainda não tem** pesam 4x mais. Repetido vira moedas
(e Isvoid nas raridades altas).

| Baú | Preço | Cartas | Destaque |
|---|---|---|---|
| Baú de Osso | 150 moedas | 2 | dia a dia |
| Baú da Caveira | 600 moedas | 4 | garantia de Épico em 25 |
| Mega Baú Neon | 1.800 moedas | 8 | garantia de GOD em 30 |
| **Drop do Vazio** | 120 Isvoid | 5 | **Vicen₹ 1% por abertura, garantido em 100** |
| Abóbora Maldita | 900 moedas | 5 | só no evento Noite das Caveiras |

O botão **CHANCES** de cada baú mostra a tabela completa (porcentagem por carta).

---

## 9. Sons e música

- 129 arquivos em `public/audio/` — **gravações reais** CC0 (tiros, ricochetes, madeira/vidro
  quebrando, voz de dor, locutor "3, 2, 1, FIGHT", moedas, baús…), músicas CC0 (trilha hip-hop no menu).
- A **risada da caveira** da abertura é uma risada humana gravada com efeito de glitch
  (gaguejo + bitcrush + eco).
- **Catálogo** em `src/audio/catalog.ts`: cada som tem volume, variação de tom, canal
  (efeitos/interface/voz/música), limite de vozes simultâneas e intervalo mínimo.
- **Motor** (`src/audio/audio.ts`): Web Audio com compressor, som **posicional** (volume e lado pela
  distância até a câmera), música abaixa quando o locutor fala, troca de música com fade.

**Trocar um som:** coloque seu `.mp3` em `public/audio/` e mude o nome no catálogo.

**Regerar tudo a partir das fontes:**
```bash
git clone --depth 1 https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds  fontes/L
git clone --depth 1 https://github.com/jupixels/game-sounds                     fontes/J
git clone --depth 1 https://github.com/Shunding-L/tauhuke-assets                fontes/S
AUDIO_SRC=fontes npm run audio      # precisa do ffmpeg
```
O mapa "som do jogo → arquivo de origem" está em `tools/build-audio.mjs` (e em `public/audio/CREDITS.txt`).

---

## 10. Modo online (servidor)

Sem servidor o jogo é **100% local** (conta e progresso no aparelho, partidas contra BOTs) — e as telas
dizem isso claramente. Com servidor você ganha:

- **Contas no servidor** (senha com `scrypt`), progresso salvo lá (dá pra jogar em outro aparelho)
- **Economia autoritativa**: abrir baú, resgatar código, comprar… tudo roda no servidor
- **Amigos por TAG**, **chat geral e privado** (com limite e filtro de palavrão), status online
- **Salas com código** e convites: todos da sala no **mesmo time**, BOTs completam
- **Partidas online autoritativas**: o servidor simula a 60 Hz e manda 20 fotos/s; quem cair vira BOT
  até voltar (reconecta sozinho); prêmios calculados no servidor
- **Painel do Criador** online (códigos valem pra todo mundo)

### Rodar
```bash
npm run build                       # gera o jogo em dist/
ADMIN_PIN=um-pin-forte npm run server
# → http://localhost:8787  (o servidor também serve o jogo; abrindo por ele, o modo online liga sozinho)
```
Ou aponte um jogo publicado em outro lugar pro servidor: **Configurações → Servidor online**.

| Variável | Padrão | |
|---|---|---|
| `PORT` | 8787 | porta |
| `ADMIN_PIN` | (o do arquivo) | **troque!** |
| `DATA` | `server-data` | pasta do banco (`db.json`) — faça backup dela |

**Produção:** `npm run server:build` gera `dist-server/index.mjs` (Node 20+, precisa do pacote `ws`).
Rode atrás de HTTPS (Caddy/Nginx ou plataformas como Render/Fly/Railway) — celulares exigem HTTPS
pra PWA, e o WebSocket vira `wss://` automaticamente.

---

## 11. Testes e verificação

```bash
npm test          # 24 testes: simulação (determinismo, todos os mapas), economia (chances do Vicen₹,
                  # garantia, códigos, diário, missões, passe, loja), conteúdo (500+), pixel art, rede
npm run validar   # confere conteúdo + roda uma partida curta em cada mapa
npm run e2e       # navegador de verdade: todas as telas + uma partida (prints em e2e-shots/)
npm run build     # inclui checagem de tipos (TypeScript estrito)
```

---

## 12. Regras de transparência

- **Sem dinheiro real.** Moedas da Morte e Isvoid só se ganham jogando.
- **Chances visíveis** em todo baú (botão CHANCES) e **garantias** (pity) explicadas.
- **BOTs sempre identificados** (etiqueta BOT) — inclusive "amigos" no modo local.
- **Modo local é dito como local**: nada de fingir servidor; amigos/chat/salas reais só com servidor.
- Personagens, nomes e artes são originais (nada copiado de outros jogos).

---

## 13. Problemas comuns

| Problema | Solução |
|---|---|
| Sem som | Toque na tela uma vez (navegadores só liberam áudio depois de um toque). Veja Configurações → Som. |
| Travando no celular | Configurações → Gráficos → Qualidade **Baixa** (ou deixe "Automática"). |
| Não instala como app | Precisa de **HTTPS** (ou `localhost`). No iPhone use o Safari. |
| Atualização não aparece | Feche e abra o app de novo (a versão nova entra na próxima abertura). |
| Esqueci a senha (modo local) | A senha não é guardada (só o hash). Use **Exportar backup** com antecedência. |
| `npm run validar` acusou erro | A mensagem diz o arquivo/id. Arrume e rode de novo. |
| Meu PNG não aparece | Confira o caminho (`public/sprites/...`) e o formato (seção 7.3); teste no Estúdio. |

---

## 14. Limitações conhecidas

Sendo direto sobre o que **não** é perfeito:

- **Partidas contra BOTs no modo online**: o resultado é jogado no aparelho e enviado ao servidor, que
  limita valores e frequência, mas não refaz a partida. As **partidas em sala** (online) são 100% no servidor.
- **Banco do servidor é um arquivo JSON** — ótimo pra dezenas/centenas de jogadores. Pra milhares,
  troque por SQLite/Postgres (`server/db.ts` está isolado pra isso).
- **Partida online sem predição**: seu personagem responde com o atraso da sua conexão (ok em Wi-Fi/4G
  bom; em conexão ruim fica "borrachudo").
- **Matchmaking aberto entre desconhecidos** não existe: online é por sala (amigos) — o resto das vagas são BOTs.
- **Skins**: o tipo de prêmio existe, mas hoje um prêmio de skin vira moedas.
- Os 506 personagens gerados têm histórias montadas por gerador (variadas, mas não escritas à mão
  como as dos 21 personagens feitos à mão).
- Vozes de locutor estão em inglês (únicas gravações CC0 de locutor encontradas).

---

## 15. Créditos e licenças

- **Código e arte (pixel art procedural):** este projeto.
- **Sons e músicas:** CC0 / domínio público — lista completa em `public/audio/CREDITS.txt`
  (Kenney, Warfork/Team Forbidden, OpenGameArt: Tabasco, vitalezzz, Sudocolon, packs "CC0 SFX";
  Freesound: qubodup, nooly; Ben Burnes/Abstraction Music).
- **Fontes:** Pixelify Sans e Press Start 2P — SIL Open Font License (via `@fontsource`).
- **Pesquisa do gênero e prompt mestre:** `docs/PROMPT_MESTRE_SKULL_ARENA.txt`.
