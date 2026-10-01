// GET /api/envios?cliente=&ciclo=  (x-admin-password) -> resumos que o cliente mandou em "Enviar respostas"
// O resumo é o retrato das respostas na hora do envio, com os comentários de cada ajuste.
const db = require("../lib/db");
const { SLUG, admin } = require("../lib/ciclo");

module.exports = async (req, res) => {
  if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
  const cliente = String(req.query.cliente || ""), ciclo = String(req.query.ciclo || "");
  if (!SLUG.test(cliente) || !SLUG.test(ciclo)) return res.status(400).json({ erro: "Cliente/ciclo inválido" });
  try {
    const r = await db().execute({
      sql: "SELECT rodada, resumo, enviado_em FROM envios WHERE cliente = ? AND ciclo = ? ORDER BY rodada DESC",
      args: [cliente, ciclo]
    });
    return res.json({ envios: r.rows.map(x => ({ rodada: Number(x.rodada), resumo: x.resumo, enviado_em: x.enviado_em })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao ler os envios" });
  }
};
