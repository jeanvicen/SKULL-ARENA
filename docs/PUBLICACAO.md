# Publicação: PWA, Vercel e Play Store

Data de referência deste guia: **outubro de 2026**. Regras de loja mudam — confira os links oficiais antes de enviar.

## 1. PWA (“download real” imediato) ✅
- `public/manifest.webmanifest`: nome, ícones (`any` + `maskable`), `display: standalone`, `orientation: portrait`, cores, screenshots.
- `sw.js` gerado no build: precache do app inteiro (JS, CSS, fontes, ícones) → modo bots **100% offline**.
- Verificado por `npm run e2e:offline`: 0 erros de instalabilidade no Chrome e partida rodando sem rede.
- No celular: abrir a URL → “Adicionar à tela inicial” (Android) / Compartilhar → “Adicionar à Tela de Início” (iPhone). As Configurações do jogo mostram o botão “Instalar” quando o navegador oferece.

## 2. Vercel
1. Repositório no GitHub → [vercel.com/new](https://vercel.com/new) → Import.
2. Framework **Vite**, build `npm run build`, saída `dist` (já em `vercel.json`, com cabeçalhos certos para `sw.js`, manifest e `/.well-known/assetlinks.json`).
3. Deploy. Domínio próprio (opcional) em Settings → Domains — use o domínio definitivo **antes** de gerar o app Android, porque o TWA fica preso a ele.

## 3. Play Store via TWA (Bubblewrap)
Pré-requisitos: Node 18+, JDK 17, conta Google Play Console (taxa única), site publicado em HTTPS.

```bash
npm i -g @bubblewrap/cli
mkdir android && cd android
bubblewrap init --manifest https://SEU-DOMINIO/manifest.webmanifest
#   applicationId sugerido: com.klipzastudio.skullarena
#   orientação: portrait · cores: #140a24 / #0b0616 · ícone: icons/play-store-512.png
bubblewrap build          # gera app-release-bundle.aab (+ apk) e pede/gera a keystore
```

**Keystore:** guarde `android.keystore` + senhas fora do git (o `.gitignore` já bloqueia). Perder = não conseguir atualizar o app.

### Digital Asset Links (tela cheia sem barra de endereço)
1. No Play Console → *Integridade do app* → *Assinatura do app*, copie o **SHA-256 da chave de assinatura do Google Play** (com Play App Signing, é essa chave que assina o app instalado — não só a sua chave de upload).
2. `bubblewrap fingerprint add <SHA256>` e `bubblewrap fingerprint generateAssetLinks`.
3. Copie o `assetlinks.json` para `public/.well-known/assetlinks.json` (modelo em `android/assetlinks.template.json`) e faça deploy.
4. Se o app abrir com barra de endereço, o problema quase sempre é o fingerprint.

### Requisitos de 2026 que afetam você
- **Target API:** desde **31/08/2026**, apps novos e atualizações precisam mirar **Android 16 (API 36)** — atualize o Bubblewrap e regenere com `bubblewrap update` antes de enviar. ([Android Developers](https://developer.android.com/google/play/requirements/target-sdk))
- **Conta pessoal nova:** precisa de **teste fechado com ≥ 12 testadores por 14 dias seguidos** antes de liberar Produção. Conta de organização é isenta. ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465))
- **Verificação de desenvolvedor Android:** em vigor desde **30/09/2026 no Brasil** (e Indonésia, Singapura, Tailândia; global em 2027). Apps de desenvolvedores não verificados exigem fluxo extra para instalar. Publicando pela Play com conta verificada, você já cumpre. ([Android Developers](https://developer.android.com/developer-verification/guides))

## 4. Checklist da ficha da loja
- [ ] Ícone 512×512 (`public/icons/play-store-512.png`)
- [ ] Gráfico de recursos 1024×500 (criar arte de destaque)
- [ ] 2–8 screenshots de celular em retrato (base: `public/screenshots/` ou `npm run e2e`)
- [ ] Descrição curta (≤ 80 caracteres): “Brawler de caveiras feito pra tela em pé: anda, mira e ataca com um dedo.”
- [ ] Descrição completa (deixe claro: offline contra bots; online em breve)
- [ ] Classificação etária (questionário IARC — violência cartunesca, sem sangue)
- [ ] **Política de privacidade:** `https://SEU-DOMINIO/privacidade.html` (já incluída em `public/`)
- [ ] Segurança dos dados: hoje **nenhum dado é coletado ou compartilhado** (save fica no aparelho)
- [ ] Anúncios: não · Compras no app: não (pagamento real desativado)
- [ ] Categoria: Jogos → Ação · Público-alvo e conteúdo
- [ ] Teste fechado (12 testadores × 14 dias, se conta pessoal) → Produção

## 5. Plano de atualizações
- Conteúdo novo (personagens/mapas/eventos) = JSON + deploy na Vercel → chega no PWA e no TWA **sem nova versão na loja**.
- Nova versão Android só quando mudar o wrapper (ícone, nome, target API): `bubblewrap update && bubblewrap build`.
- Evento sazonal a cada ~6 semanas; personagem novo a cada evento; balanceamento guiado por `npm run balance` (e, com online, por telemetria real).
