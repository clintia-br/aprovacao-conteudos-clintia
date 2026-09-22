// GET  /api/decisoes?cliente=&ciclo=&token=   -> decisões salvas + nº de envios
// POST /api/decisoes { cliente, ciclo, token, item, status, comentario }
const db = require("../lib/db");
const { valido } = require("../lib/token");

module.exports = async (req, res) => {
  const p = req.method === "GET" ? req.query : (req.body || {});
  if (!valido(p.cliente, p.ciclo, p.token)) return res.status(403).json({ erro: "Link inválido" });

  try {
    if (req.method === "GET") {
      const d = await db().execute({
        sql: "SELECT item, status, comentario FROM decisoes WHERE cliente = ? AND ciclo = ?",
        args: [p.cliente, p.ciclo]
      });
      const e = await db().execute({
        sql: "SELECT COUNT(*) AS n FROM envios WHERE cliente = ? AND ciclo = ?",
        args: [p.cliente, p.ciclo]
      });
      return res.json({ decisoes: d.rows, envios: Number(e.rows[0].n) });
    }

    if (req.method === "POST") {
      const item = String(p.item || "").slice(0, 40);
      const status = p.status;
      const comentario = String(p.comentario || "").slice(0, 2000);
      if (!item) return res.status(400).json({ erro: "Item vazio" });

      if (status === "wait") {
        await db().execute({
          sql: "DELETE FROM decisoes WHERE cliente = ? AND ciclo = ? AND item = ?",
          args: [p.cliente, p.ciclo, item]
        });
      } else if (status === "ok" || status === "fix") {
        await db().execute({
          sql: `INSERT INTO decisoes (cliente, ciclo, item, status, comentario, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (cliente, ciclo, item) DO UPDATE SET
                  status = excluded.status, comentario = excluded.comentario, atualizado_em = excluded.atualizado_em`,
          args: [p.cliente, p.ciclo, item, status, comentario, new Date().toISOString()]
        });
      } else {
        return res.status(400).json({ erro: "Status inválido" });
      }
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao salvar. Tente de novo." });
  }
};
