# Android (TWA)

Esta pasta recebe o projeto gerado pelo **Bubblewrap** (`bubblewrap init` dentro dela). Passo a passo e requisitos de 2026 em [`../docs/PUBLICACAO.md`](../docs/PUBLICACAO.md).

- `assetlinks.template.json` → preencha o SHA-256 da chave de assinatura do Google Play e publique como `public/.well-known/assetlinks.json`.
- **Nunca** commite `*.keystore` / `*.jks` (já bloqueado no `.gitignore`).
