# Aprovação de conteúdo ClintIA

Páginas de aprovação de posts por cliente/ciclo (Vercel + Turso). Visão geral, montagem e rotina da equipe: `README.md`.

- `clientes/<cliente>/<ciclo>/dados.json` + `midia/`: ciclos mantidos no GitHub (o Claude altera aqui).
- `template/pagina.html` (página do cliente), `template/painel.html` (painel interno), `api/` (funções da Vercel), `lib/`, `db/schema.sql`.
- Checar antes de commitar: `TOKEN_SECRET=teste node build.js` (valida os `dados.json` e as mídias). `public/c`, `public/painel` e `lib/ciclos.json` são gerados, não commitar.

## "Subi fotos": trocar artes a partir do painel

A equipe sobe as artes pelo botão **Subir fotos** do painel (ficam na tabela `fotos` do Turso, com a pasta de origem e um campo "O que é").

1. `node scripts/fotos.js novas [cliente]`: baixa só as fotos ainda não usadas em `_entrada/` (ignorado pelo git) e lista com id, pasta e "O que é".
2. Olhe cada imagem e compare com as artes atuais do ciclo (`clientes/<cliente>/<ciclo>/midia/` + `dados.json`) pra decidir onde entra. Na dúvida, mostre o mapeamento (antes → depois) e pergunte.
3. Converta para o padrão do ciclo, com os mesmos nomes do `dados.json` (tabela de nomes no README):
   - feed/carrossel: JPG 1080 px de largura (proporção da arte), ~qualidade 85
   - story de destaque: JPG 540x960 · capa de destaque: JPG 180x180
   - PNG com transparência → fundo branco
   Se mudou o número de lâminas/stories, atualize `imgs` no `dados.json`.
4. Rode o build, commit, PR. **Publicar (merge no main) só com o OK de quem pediu.**
5. Depois de publicado: `node scripts/fotos.js usar <ids...>` (a galeria do painel passa a mostrar "usada").

Precisa de `PAINEL_URL` e `CLAUDE_FOTOS_KEY` nas variáveis do ambiente do Claude e do domínio do painel liberado na rede. Se o script disser que não alcança o site ou que a chave está errada, avise a pessoa: é configuração do ambiente, não bug.

Artes enviadas direto no GitHub (Add file → Upload files, arquivos soltos na raiz ou em `public/assets`) também valem: aplique do mesmo jeito e **apague os originais** no mesmo commit.

## Cuidados

- Conteúdo é paciente-facing (saúde). Arte nova com **texto novo** → avisar que precisa de revisão de compliance (CFM 2336/2023 para médicos; CFP para psicólogos) antes de mandar pro cliente.
- Nunca trocar `TOKEN_SECRET`: muda todos os links já enviados.
- Preview da Vercel falha em todo PR (o `TOKEN_SECRET` só existe em Production). Não é erro do PR. O que vale é o deploy do main.
