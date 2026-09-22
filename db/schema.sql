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
