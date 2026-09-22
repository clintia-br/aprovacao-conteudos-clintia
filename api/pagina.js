// Serve a página de aprovação dos ciclos guardados no banco (criados pelo painel).
// Os ciclos que vêm do GitHub são arquivos estáticos e nem passam por aqui.
// Rota (vercel.json): /c/:cliente/:cicloToken  ->  /api/pagina
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");
const { valido } = require("../lib/token");
const { separarToken } = require("../lib/ciclo");

let TPL = null;
const template = () => (TPL = TPL || fs.readFileSync(path.join(process.cwd(), "template", "pagina.html"), "utf8"));

module.exports = async (req, res) => {
  const cliente = String(req.query.cliente || "");
  const sep = separarToken(req.query.cicloToken);
  if (!sep || !valido(cliente, sep.ciclo, sep.token)) return res.status(404).send("Página não encontrada");

  try {
    const r = await db().execute({
      sql: "SELECT dados FROM ciclos WHERE cliente = ? AND ciclo = ?",
      args: [cliente, sep.ciclo]
    });
    if (!r.rows.length) return res.status(404).send("Página não encontrada");

    const dados = JSON.parse(r.rows[0].dados);
    const base = `/api/midia?c=${encodeURIComponent(cliente)}&y=${encodeURIComponent(sep.ciclo)}&t=${sep.token}&f=`;
    const payload = { ...dados, slug: cliente, ciclo: sep.ciclo, token: sep.token, miniaturas: true, midia: { base } };
    const html = template().replace("__DATA__", JSON.stringify(payload).replace(/</g, "\\u003c"));

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30");
    return res.status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Erro ao carregar a página");
  }
};
