# Plano do online (Fase 5) — NÃO IMPLEMENTADO

O jogo hoje é offline. Este documento define como o online entra **sem reescrever o núcleo**.

## Princípios
1. **Servidor autoritativo.** O servidor roda `World` (mesmo código de `src/combat`). O cliente envia só `ClientInputFrame` (movimento, mira, ataque, especial). Dano, vida, recompensas, inventário e ranked são decididos e gravados no servidor.
2. **Predição só do próprio movimento** no cliente, com reconciliação pelo `ackSeq` do snapshot; os outros lutadores são interpolados ~100 ms no passado.
3. **Determinismo** já existe (RNG com semente, passo fixo) — facilita replays e auditoria anti-cheat.

## Contrato
`src/net/contract.ts`: `MatchTransport`, `ServerSnapshot`, `MatchmakingService`, `SocialService`, `RoomService`, `MatchResultAuthoritative`. A implementação atual (`OfflineServices`) rejeita chamadas online com mensagem honesta para a UI.

## Infra sugerida (avaliar custo antes)
- Partidas em tempo real precisam de processo de longa duração com WebSocket/UDP — **funções serverless da Vercel não servem para o loop da partida**. Opções: servidor Node (o próprio `World`) em Fly.io/Railway/VPS; ou serviço gerenciado de salas (Colyseus Cloud, Hathora, Edgegap).
- Contas, inventário, loja e matchmaking: API + banco (ex.: Supabase/Postgres) com regras no servidor.
- Tick do servidor: 30 Hz (simulação a 60 Hz, snapshot a 20–30 Hz com delta compression).

## Migração da economia
- Na primeira entrada online, o save local vira **perfil inicial** (opcional), sem importar diamantes/itens comprados (não confiáveis).
- Daí em diante, moedas/diamantes/baús/troféus só mudam via servidor. O save local vira cache.

## Anti-cheat básico
- Servidor valida velocidade, cadência e alcance (o cliente não manda posição, só intenção).
- Resultado de partida assinado (`signature`) e recompensas calculadas no servidor.
- Rate limit de ações sociais; presentes com limite diário.

## Social
Amigos por código (o código reservado já aparece na tela Social), convites, presentes, equipes (party → fila conjunta), salas privadas por código, arenas de até 20 jogadores (o motor já roda 20 lutadores com folga).
