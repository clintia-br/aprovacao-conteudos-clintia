// POST /api/limpar  (x-admin-password)  { cliente, ciclo }   -> pelo painel
// POST /api/limpar  { cliente, ciclo, token }                  -> pela página do cliente (o próprio link autoriza)
// "Limpar considerações": apaga os pedidos de ajuste e comentários do cliente (as aprovações ficam)
// e marca a hora, pra página do cliente descartar o que tiver guardado no aparelho em vez de reenviar.
const db = require("../lib/db");
const { SLUG, admin, garantirTabelas } = require("../lib/ciclo");
const { valido } = require("../lib/token");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const p = req.body || {};
  if (!admin(req) && !valido(p.cliente, p.ciclo, p.token)) return res.status(401).json({ erro: "Sem permissão" });
  const cliente = String(p.cliente || ""), ciclo = String(p.ciclo || "");
  if (!SLUG.test(cliente) || !SLUG.test(ciclo)) return res.status(400).json({ erro: "Cliente/ciclo inválido" });

  try {
    await garantirTabelas();
    const agora = new Date().toISOString();
    const r = await db().batch([
      { sql: "DELETE FROM decisoes WHERE cliente = ? AND ciclo = ? AND status = 'fix'", args: [cliente, ciclo] },
      {
        sql: `INSERT INTO zerados (cliente, ciclo, zerado_em) VALUES (?, ?, ?)
              ON CONFLICT (cliente, ciclo) DO UPDATE SET zerado_em = excluded.zerado_em`,
        args: [cliente, ciclo, agora]
      }
    ], "write");
    return res.json({ ok: true, apagados: r[0].rowsAffected });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao limpar: " + (err.message || err) });
  }
};
