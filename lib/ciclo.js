// Helpers compartilhados dos ciclos guardados no banco (criados pelo painel).
const { gerar } = require("./token");

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

module.exports = { SLUG, MIDIA, admin, separarToken, link };
