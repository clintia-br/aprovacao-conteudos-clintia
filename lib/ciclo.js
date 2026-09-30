// Helpers compartilhados dos ciclos guardados no banco (criados pelo painel).
const crypto = require("crypto");
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

// Código da galeria de fotos enviadas ("Subir fotos"). É diferente do código do link
// de aprovação: quem recebe o link do cliente não enxerga a caixa de fotos da equipe.
const tokenFotos = (cliente, ciclo) => gerar(cliente, `${ciclo}#fotos`);
function fotosOk(cliente, ciclo, k) {
  if (!SLUG.test(String(cliente || "")) || !SLUG.test(String(ciclo || "")) || typeof k !== "string") return false;
  const a = Buffer.from(tokenFotos(cliente, ciclo)), b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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
  await db().execute(`CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, cliente TEXT NOT NULL, ciclo TEXT NOT NULL,
    pasta TEXT NOT NULL DEFAULT '', nome TEXT NOT NULL, mime TEXT NOT NULL,
    largura INTEGER NOT NULL DEFAULT 0, altura INTEGER NOT NULL DEFAULT 0, tamanho INTEGER NOT NULL DEFAULT 0,
    dados BLOB NOT NULL, mini BLOB, enviado_em TEXT NOT NULL, obs TEXT NOT NULL DEFAULT '', usada_em TEXT,
    UNIQUE (cliente, ciclo, pasta, nome))`);
  // colunas que chegaram depois da 1ª versão da tabela (já criada em produção)
  const cols = new Set((await db().execute("PRAGMA table_info(fotos)")).rows.map(r => r.name));
  if (!cols.has("obs")) await db().execute("ALTER TABLE fotos ADD COLUMN obs TEXT NOT NULL DEFAULT ''");
  if (!cols.has("usada_em")) await db().execute("ALTER TABLE fotos ADD COLUMN usada_em TEXT");
  await db().execute(`CREATE TABLE IF NOT EXISTS zerados (
    cliente TEXT NOT NULL, ciclo TEXT NOT NULL, zerado_em TEXT NOT NULL, PRIMARY KEY (cliente, ciclo))`);
  tabelasOk = true;
}

module.exports = { SLUG, MIDIA, admin, separarToken, link, tokenFotos, fotosOk, garantirTabelas };
