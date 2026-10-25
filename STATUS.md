# SKULL ARENA — STATUS

Legenda: ✅ Implementado e testado · 🟡 Em progresso / parcial · ⛔ Incompleto · 📋 Planejado

“Testado” aqui significa: coberto por teste automatizado (`npm test`, 62 testes) **e/ou** exercitado no navegador pelo e2e (`npm run e2e`, `npm run e2e:offline`) com screenshots revisados. Nada marcado ✅ sem ter rodado.

## Fase 1 — Planejamento
| Item | Status | Notas |
|---|---|---|
| Stack, estrutura de pastas, README | ✅ | TS + Vite + Canvas 2D; justificativa no README |
| Contrato de dados (`src/content/types.ts`) | ✅ | Personagem, tiro, especial, mapa, pet, raridade, economia, modos, controle |
| Validação de conteúdo | ✅ | Referências, spawns, kits duplicados; erros descartam só o item quebrado |

## Fase 2 — Núcleo jogável
| Item | Status | Notas |
|---|---|---|
| Regra ANDA = MIRA = ATACA | ✅ | Só dispara com inimigo no alcance **e à frente**; de costas não ataca; sem desperdício na parede (7 testes) |
| Joystick virtual (dead zone, normalização, suavização, multi-toque) | ✅ | e2e arrasta o joystick com eventos de toque reais |
| Botão de especial (prévia ao segurar, dispara ao soltar, cancela arrastando) | ✅ | Indicador de carga; não dispara durante o movimento |
| Física (círculo×retângulo, empurrão entre corpos, knockback) | ✅ | |
| Bots com a mesma regra/visão do jogador, 3 dificuldades | ✅ | Recuo para regenerar, esquiva, A* |
| Vida, dano, cooldown, vitória/derrota, reiniciar | ✅ | Partidas headless em todo modo×mapa terminam |
| Simulação determinística | ✅ | Testado (mesma semente = mesmo resultado) |

## Fase 3 — Polish
| Item | Status | Notas |
|---|---|---|
| Arte procedural de caveiras (7 animações via transformações) | ✅ | idle/move/attack/hurt/death/special/victory; costas ao andar para cima |
| 8 temas de arena, obstáculos 3/4, mato | ✅ | |
| Hit feedback: números, flash, partículas, trilhas, hit-stop, screenshake com parcimônia, vibração | ✅ | Pooling em projéteis/partículas/números |
| Som e música (sintetizados) | ✅ | Revisado só por código (headless não tem saída de áudio) — **ouça e ajuste** |
| Transições de tela animadas | ✅ | Íris de caveira e corte diagonal |
| HUD (timer, vivos/placar, feed de abates, aviso de bots) | ✅ | |
| Arte final desenhada à mão | 📋 | Slots prontos (`portrait`/`sprite` nos JSONs); hoje 100% procedural |
| Falas gravadas (áudio) | 📋 | Texto pronto; slot `voiceLines.audio` |

## Fase 4 — Conteúdo + progressão
| Item | Status | Notas |
|---|---|---|
| 17 personagens (todas as raridades), lore + falas únicas | ✅ | Matriz 1v1: 42%–63% de vitória; CREATOR/GOD não dominam |
| 21 projéteis, 17 especiais (14 tipos), 4 pets, 8 mapas | ✅ | |
| Skins (globais + lendárias exclusivas) | ✅ | |
| Baús com loot por raridade, chances visíveis, abertura animada | ✅ | Resultado salvo antes da animação |
| Loja (presente diário, vitrine, baús, pets, personagens) | ✅ | **Pagamento real desativado** (aviso na UI) |
| XP/níveis, moedas, diamantes, upgrades | ✅ | |
| Troféus, trilha, conquistas, títulos | ✅ | |
| Missões diárias/semanais + evento sazonal | ✅ | Reset por data testado |
| Coleção/inventário | ✅ | |
| Save local com migração e backup (exportar/importar) | ✅ | Fallback em memória se o storage estiver bloqueado |
| Modos: Caçada (FFA 6), Treino 1v1, Equipe 3v3, Arena Caótica (20) | ✅ | Todos offline com bots |
| Partida rápida (matchmaking) | 🟡 | **Stub local**: “procura” e preenche com bots marcados |
| Salas privadas | 🟡 | Sala local configurável; **entrar por código requer servidor** |
| Configurações (áudio, controles, qualidade, bots, vibração) | ✅ | |
| Créditos | ✅ | Klipza Studio · jeanvicen · @0neajx |

## Fase 5 — Online (requer servidor)
| Item | Status | Notas |
|---|---|---|
| Contrato da camada `/net` | ✅ | Interfaces definidas; implementação atual offline e honesta |
| Servidor autoritativo, matchmaking real, reconexão | 📋 | Plano em `docs/ONLINE.md` |
| Login com conta online | 📋 | Hoje: conta local |
| Amigos, convites, presentes, equipes | ⛔ | UI de prévia com dados de EXEMPLO marcados; nada conecta |
| Arena de 20 jogadores reais | 📋 | Motor já roda 20 lutadores (bots) |
| Anti-cheat / validação de economia no servidor | 📋 | |

## Fase 6 — Publicação
| Item | Status | Notas |
|---|---|---|
| PWA instalável + offline | ✅ | 0 erros de instalabilidade (Chrome/CDP); partida jogada com a rede desligada |
| Deploy Vercel | 🟡 | `vercel.json` pronto; **deploy depende da sua conta** (passo a passo no README) |
| Play Store via TWA (Bubblewrap) | 📋 | Guia e checklist em `docs/PUBLICACAO.md`; requer keystore e conta Play |
| Política de privacidade | ✅ | `public/privacidade.html` |
| Perf: metas e medição | 🟡 | Medido em Chromium desktop: sim 0,1–0,45 ms, desenho 1–2,5 ms (20 lutadores). **Falta medir em Android fraco real** |
| Analytics | 📋 | Nenhum dado é coletado hoje |

## Riscos conhecidos
- Medição de desempenho em aparelho Android fraco real ainda não feita (só Chromium headless).
- Áudio sintetizado não foi ouvido por humano neste ciclo — ajustar volumes/timbres por ouvido.
- Balanceamento foi feito com bots; com humanos vai mudar (o desktop com mira de mouse tem vantagem de “kiting”; separar filas por perfil quando o online existir).
