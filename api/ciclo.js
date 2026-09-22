// GET    /api/ciclo?cliente=&ciclo=   (x-admin-password) -> dados do ciclo + token, pra editar no montador
// DELETE /api/ciclo?cliente=&ciclo=   (x-admin-password) -> remove o ciclo e as fotos do banco
const db = require("../lib/db");
const { gerar } = require("../lib/token");
const { SLUG, admin } = require("../lib/ciclo");

module.exports = async (req, res) => {
  if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
  const cliente = String(req.query.cliente || ""), ciclo = String(req.query.ciclo || "");
  if (!SLUG.test(cliente) || !SLUG.test(ciclo)) return res.status(400).json({ erro: "Cliente/ciclo inválido" });

  try {
    if (req.method === "GET") {
      const r = await db().execute({
        sql: "SELECT dados FROM ciclos WHERE cliente = ? AND ciclo = ?",
        args: [cliente, ciclo]
      });
      if (!r.rows.length) return res.status(404).json({ erro: "Ciclo não encontrado" });
      return res.json({ cliente, ciclo, token: gerar(cliente, ciclo), dados: JSON.parse(r.rows[0].dados) });
    }

    if (req.method === "DELETE") {
      await db().batch([
        { sql: "DELETE FROM midias WHERE cliente = ? AND ciclo = ?", args: [cliente, ciclo] },
        { sql: "DELETE FROM ciclos WHERE cliente = ? AND ciclo = ?", args: [cliente, ciclo] }
      ], "write");
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao ler/remover o ciclo" });
  }
};
