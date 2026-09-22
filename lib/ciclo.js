// Helpers compartilhados dos ciclos guardados no banco (criados pelo painel).
const { gerar } = require("./token");
const db = require("./db");

const SLUG = /^[a-z0-9-]+$/;
// nome de arquivo de mídia: "p1.jpg", "c1.jpg", "_t/p1.jpg", "avatar.jpg"...
const MIDIA = /^(_t\/)?[a-z0-9_]+\.(jpg|jpeg|png|webp)$/i;

const admin = req =>
  !!process.env.ADMIN_PASSWORD && req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;

// "2026-10-outubro-ab12cd34ef56" -> { ciclo:"2026-10-outubro", token:"ab12cd34ef56" }
function separarToken(cicloToken) {
  const s = String(cicloToken || "");
  const m = s.match(/^(.+)-([0-9a-f]{12})$/);
  if (!m) return null;
  return { ciclo: m[1], token: m[2] };
}

const link = (cliente, ciclo) => `/c/${cliente}/${ciclo}-${gerar(cliente, ciclo)}`;

// Cria as tabelas do painel na 1ª vez que precisar (idempotente, não apaga nada).
// Assim o "Adicionar cliente" funciona mesmo se ninguém rodou o schema.sql à mão.
let tabelasOk = false;
async function garantirTabelas() {
  if (tabelasOk) return;
  await db().execute(`CREATE TABLE IF NOT EXISTS ciclos (
    cliente TEXT NOT NULL, ciclo TEXT NOT NULL, nome TEXT NOT NULL DEFAULT '',
    titulo TEXT NOT NULL DEFAULT '', total INTEGER NOT NULL DEFAULT 0, dados TEXT NOT NULL,
    criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (cliente, ciclo))`);
  await db().execute(`CREATE TABLE IF NOT EXISTS midias (
    cliente TEXT NOT NULL, ciclo TEXT NOT NULL, nome TEXT NOT NULL, mime TEXT NOT NULL,
    dados BLOB NOT NULL, PRIMARY KEY (cliente, ciclo, nome))`);
  tabelasOk = true;
}

module.exports = { SLUG, MIDIA, admin, separarToken, link, garantirTabelas };
