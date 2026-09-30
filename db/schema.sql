-- Rodar uma vez no Turso (turso db shell aprovacao-clintia < db/schema.sql)

CREATE TABLE IF NOT EXISTS decisoes (
  cliente       TEXT NOT NULL,
  ciclo         TEXT NOT NULL,
  item          TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('ok', 'fix')),
  comentario    TEXT DEFAULT '',
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (cliente, ciclo, item)
);

CREATE TABLE IF NOT EXISTS envios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente    TEXT NOT NULL,
  ciclo      TEXT NOT NULL,
  rodada     INTEGER NOT NULL,
  resumo     TEXT NOT NULL,
  enviado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS envios_ciclo ON envios (cliente, ciclo);

-- Conteúdo dos ciclos criados pelo painel (montador → "Salvar no painel").
-- Os ciclos que vêm do GitHub continuam funcionando por cima do build; estes ficam aqui.
CREATE TABLE IF NOT EXISTS ciclos (
  cliente       TEXT NOT NULL,
  ciclo         TEXT NOT NULL,
  nome          TEXT NOT NULL DEFAULT '',
  titulo        TEXT NOT NULL DEFAULT '',
  total         INTEGER NOT NULL DEFAULT 0,
  dados         TEXT NOT NULL,           -- JSON: perfil, publicados, itens
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (cliente, ciclo)
);

-- Fotos dos ciclos do painel. nome guarda o arquivo cheio ("p1.jpg") e a
-- miniatura ("_t/p1.jpg"). Servidas por /api/midia com cache longo.
CREATE TABLE IF NOT EXISTS midias (
  cliente TEXT NOT NULL,
  ciclo   TEXT NOT NULL,
  nome    TEXT NOT NULL,
  mime    TEXT NOT NULL,
  dados   BLOB NOT NULL,
  PRIMARY KEY (cliente, ciclo, nome)
);

-- Caixa de fotos do botão "Subir fotos" do painel: artes e fotos que a equipe/designer
-- manda pra um cliente/ciclo. Comprimidas no navegador antes de subir (JPG até 2160 px),
-- com miniatura. Vistas no painel e na galeria /fotos/<cliente>/<ciclo>/<código>.
CREATE TABLE IF NOT EXISTS fotos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente    TEXT NOT NULL,
  ciclo      TEXT NOT NULL,
  pasta      TEXT NOT NULL DEFAULT '',   -- subpasta de onde veio ("destaques/quem sou")
  nome       TEXT NOT NULL,              -- nome original do arquivo
  mime       TEXT NOT NULL,
  largura    INTEGER NOT NULL DEFAULT 0,
  altura     INTEGER NOT NULL DEFAULT 0,
  tamanho    INTEGER NOT NULL DEFAULT 0,
  dados      BLOB NOT NULL,
  mini       BLOB,
  enviado_em TEXT NOT NULL,
  obs        TEXT NOT NULL DEFAULT '',   -- "O que é" digitado no envio (pra onde vai a arte)
  usada_em   TEXT,                       -- quando o Claude aplicou no site (NULL = nova)
  UNIQUE (cliente, ciclo, pasta, nome)   -- mesmo nome na mesma pasta = versão nova, substitui
);

-- "Limpar considerações" do painel: quando a equipe apagou os pedidos de ajuste do ciclo.
-- A página do cliente compara com o que guardou no aparelho pra não reenviar considerações velhas.
CREATE TABLE IF NOT EXISTS zerados (
  cliente   TEXT NOT NULL,
  ciclo     TEXT NOT NULL,
  zerado_em TEXT NOT NULL,
  PRIMARY KEY (cliente, ciclo)
);
