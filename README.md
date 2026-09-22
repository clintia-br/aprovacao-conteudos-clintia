# Aprovação de conteúdo ClintIA

Uma página de aprovação por cliente e por ciclo (mês, estruturação de perfil, campanha). O cliente abre o link, vê a prévia do perfil, aprova ou pede ajuste em cada item e envia. Cada clique fica gravado no Turso, e o envio avisa a equipe pelo Zapier (task no ClickUp).

```
aprovacao-clintia/
├── clientes/
│   ├── _modelo/                    ← copie daqui (pastas com _ não são publicadas)
│   └── gabriela-kaufman/
│       └── 2026-09-estruturacao/
│           ├── dados.json          ← textos, ordem dos posts, legendas
│           └── midia/              ← artes em JPG (nomes batem com o dados.json)
├── template/pagina.html            ← layout da página do cliente
├── template/painel.html            ← painel interno
├── api/                            ← funções da Vercel (decisões, envio, painel)
├── lib/                            ← banco e geração do link
├── db/schema.sql                   ← tabelas do Turso
├── build.js                        ← gera as páginas no deploy
└── vercel.json
```

## Montagem (uma vez só)

### 1. GitHub
1. Crie um repositório **privado** chamado `aprovacao-clintia`.
2. Descompacte este zip e suba tudo pelo navegador (Add file → Upload files). Dá pra arrastar as pastas inteiras. O GitHub aceita até 100 arquivos por envio, então suba a pasta `midia` da Gabriela num envio separado se ele reclamar.

### 2. Turso
1. No painel do Turso, crie um banco chamado `aprovacao-clintia` (mesma conta do QR Placas serve).
2. Abra o banco → **Edit Data / SQL console**, cole o conteúdo de `db/schema.sql` e rode.
3. Copie a **URL do banco** (`libsql://...`) e gere um **token** (Create Token).

### 3. Vercel
1. Add New → Project → importe `aprovacao-clintia`.
2. Framework Preset: **Other**. Não mexa em Build/Output: o `vercel.json` já define.
3. Em **Environment Variables**, cadastre:

| Variável | Valor |
|---|---|
| `TURSO_DATABASE_URL` | URL `libsql://...` do passo 2 |
| `TURSO_AUTH_TOKEN` | token do passo 2 |
| `TOKEN_SECRET` | uma frase longa e aleatória (ex.: gere em passwordsgenerator.net, 40 caracteres) |
| `ADMIN_PASSWORD` | senha do painel interno |
| `ZAPIER_WEBHOOK_URL` | opcional, ver passo 4 |

4. Deploy. No log do build aparecem os links gerados, ex.:
   `✓ gabriela-kaufman/2026-09-estruturacao → /c/gabriela-kaufman/2026-09-estruturacao-a1b2c3d4e5f6`

> **Nunca troque o `TOKEN_SECRET` depois de mandar links.** Ele gera o código final de cada URL. Se mudar, todos os links enviados param de funcionar.

### 4. Zapier → ClickUp (aviso de envio)
1. Novo Zap. Gatilho: **Webhooks by Zapier → Catch Hook**. Copie a URL do hook.
2. Ação: **ClickUp → Create Task**, na lista de conteúdo, com responsável (Rayane).
   - Nome: `Aprovação {{cliente}} | rodada {{rodada}}`
   - Descrição: `{{resumo}}` + `{{link}}`
3. Cole a URL do hook em `ZAPIER_WEBHOOK_URL` na Vercel e faça **Redeploy**.
4. Teste: abra a página da Gabriela, aprove um item e clique em Enviar.

O Zapier recebe: `cliente`, `ciclo`, `titulo`, `rodada`, `resumo`, `link`.

### 5. Painel interno
`https://SEU-DOMINIO/painel` → senha do `ADMIN_PASSWORD`. Mostra todos os ciclos, quanto já foi aprovado, ajustes pedidos, quantas rodadas o cliente enviou e o link pra copiar.

## Rotina: novo cliente ou novo ciclo

1. Crie a pasta `clientes/<cliente>/<ciclo>/` (só minúsculas, números e hífen: `clinica-bem-viver/2026-10`).
2. Copie o `dados.json` de `_modelo` e preencha.
3. Coloque as artes em `midia/` com os mesmos nomes usados no `dados.json`.
4. Commit na `main`. A Vercel publica sozinha em ~1 minuto.
5. Pegue o link no painel e mande pro cliente.

Se algo estiver errado (arquivo faltando, id repetido, vírgula sobrando no JSON), o build falha e o log da Vercel diz exatamente o quê e onde. O site que já está no ar continua funcionando.

### Padrão de nomes das mídias
| O quê | Nome | Exemplo |
|---|---|---|
| Post único | `p<nº>` | `p2.jpg` |
| Carrossel | `p<nº>`, `p<nº>_2`, `p<nº>_3`... | `p3.jpg`, `p3_2.jpg` |
| Story de destaque | `s_<destaque>_<nº>` | `s_ansiedade_1.jpg` |
| Capa de destaque | `c_<destaque>` | `c_ansiedade.jpg` |
| Posts já publicados | `old1`... | `old1.jpg` |
| Foto de perfil | `avatar` | `avatar.jpg` |

**Artes:** JPG, 1080 px de largura, até ~400 KB cada. PNG direto do Canva/Figma pesa 3 MB e deixa a página lenta. No Canva: Baixar → JPG → qualidade ~80.

**Vídeos (reels):** não coloque no repositório (pesado e o GitHub limita 25 MB por upload no navegador). Suba no Cloudinary e use o link completo no campo `"video"`. Sem vídeo ainda? Apague o campo `"video"` e deixe o `"roteiro"`: a página mostra o roteiro pra aprovação.

### Campos do dados.json
- `cliente`, `titulo`: aparecem no topo da página e no painel.
- `perfil`: usuário, nome, linhas da bio, link, `rodape` (registro profissional/RT que aparece embaixo de cada legenda), `avatar`, números do perfil.
- `publicados`: posts que já estão no ar, mostrados no fim do grid (sem aprovação).
- `itens`: tudo que precisa de aprovação, na ordem da lista.
  - `grupo`: `"perfil"` (bio e destaques) ou `"feed"`.
  - `tipo`: `bio`, `destaque`, `imagem`, `carrossel`, `reels`.
  - `num`: ordem de publicação (`"01"`, `"02"`).
  - `fixado: true`: vai para o topo do grid com ícone de fixado.
  - `legenda: null`: a página avisa que a legenda ainda não foi definida.
  - Qualquer mídia pode ser um link completo (`https://...`) em vez de nome de arquivo.

## Dúvidas comuns
- **O cliente respondeu no celular e depois abriu no computador?** Tudo aparece igual: as respostas ficam no banco, não no aparelho.
- **Caiu a internet dele no meio?** A página guarda no aparelho e sobe sozinha quando ele abrir de novo com conexão.
- **Quero refazer um ciclo depois dos ajustes?** Edite as artes/legendas na mesma pasta e faça commit. O link continua o mesmo e as aprovações anteriores ficam (o cliente vê o que já aprovou). Pra zerar, crie um ciclo novo (`2026-10-v2`).
- **Domínio próprio:** em Vercel → Settings → Domains, adicione `aprovacao.clintia.com.br`. Links antigos em `.vercel.app` continuam funcionando.
