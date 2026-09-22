// POST /api/enviar { cliente, ciclo, token, resumo, titulo, link }
// Registra a rodada de envio e dispara o webhook do Zapier (que cria a task no ClickUp).
const db = require("../lib/db");
const { valido } = require("../lib/token");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const p = req.body || {};
  if (!valido(p.cliente, p.ciclo, p.token)) return res.status(403).json({ erro: "Link inválido" });

  try {
    const e = await db().execute({
      sql: "SELECT COUNT(*) AS n FROM envios WHERE cliente = ? AND ciclo = ?",
      args: [p.cliente, p.ciclo]
    });
    const rodada = Number(e.rows[0].n) + 1;
    const resumo = String(p.resumo || "").slice(0, 20000);

    await db().execute({
      sql: "INSERT INTO envios (cliente, ciclo, rodada, resumo, enviado_em) VALUES (?, ?, ?, ?, ?)",
      args: [p.cliente, p.ciclo, rodada, resumo, new Date().toISOString()]
    });

    if (process.env.ZAPIER_WEBHOOK_URL) {
      try {
        await fetch(process.env.ZAPIER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: p.cliente,
            ciclo: p.ciclo,
            titulo: String(p.titulo || "").slice(0, 200),
            rodada,
            resumo,
            link: String(p.link || "").slice(0, 500)
          })
        });
      } catch (err) {
        console.error("Webhook do Zapier falhou:", err);
      }
    }
    return res.json({ ok: true, rodada });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao enviar. Tente de novo." });
  }
};
