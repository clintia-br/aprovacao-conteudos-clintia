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
