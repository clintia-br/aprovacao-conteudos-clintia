// Acesso do Claude às fotos do "Subir fotos", pra ele aplicar as artes no site sem ninguém mandar link.
// Chave própria (CLAUDE_FOTOS_KEY na Vercel e no ambiente do Claude), só de leitura + marcar como usada:
// não aprova, não apaga, não mexe em cliente.
// GET  /api/claude?acao=novas[&cliente=][&ciclo=][&todas=1]  (x-claude-key) -> fotos ainda não usadas
// GET  /api/claude?acao=foto&id=                              (x-claude-key) -> a foto
// POST /api/claude  { acao: "usar", ids: [..] }               (x-claude-key) -> marca como usadas
const crypto = require("crypto");
const db = require("../lib/db");
const { SLUG, garantirTabelas } = require("../lib/ciclo");

function chaveOk(req) {
  const certa = process.env.CLAUDE_FOTOS_KEY || "";
  const veio = String(req.headers["x-claude-key"] || "");
  if (certa.length < 20 || veio.length !== certa.length) return false;
  return crypto.timingSafeEqual(Buffer.from(veio), Buffer.from(certa));
}

module.exports = async (req, res) => {
  if (!process.env.CLAUDE_FOTOS_KEY) return res.status(503).json({ erro: "CLAUDE_FOTOS_KEY não configurada na Vercel" });
  if (!chaveOk(req)) return res.status(401).json({ erro: "Chave do Claude incorreta" });
  const q = req.query || {};
  const acao = req.method === "POST" ? (req.body && req.body.acao) : q.acao;

  try {
    await garantirTabelas();

    if (req.method === "GET" && acao === "novas") {
      const onde = [], args = [];
      if (!q.todas) onde.push("usada_em IS NULL");
      if (q.cliente) { if (!SLUG.test(q.cliente)) return res.status(400).json({ erro: "Cliente inválido" }); onde.push("cliente = ?"); args.push(q.cliente); }
      if (q.ciclo) { if (!SLUG.test(q.ciclo)) return res.status(400).json({ erro: "Ciclo inválido" }); onde.push("ciclo = ?"); args.push(q.ciclo); }
      const r = await db().execute({
        sql: `SELECT id, cliente, ciclo, pasta, nome, obs, largura, altura, tamanho, enviado_em, usada_em FROM fotos
              ${onde.length ? "WHERE " + onde.join(" AND ") : ""} ORDER BY cliente, ciclo, pasta, nome`,
        args
      });
      return res.json({
        fotos: r.rows.map(x => ({
          id: Number(x.id), cliente: x.cliente, ciclo: x.ciclo, pasta: x.pasta, nome: x.nome, obs: x.obs || "",
          largura: Number(x.largura), altura: Number(x.altura), tamanho: Number(x.tamanho),
          enviado_em: x.enviado_em, usada_em: x.usada_em || null
        }))
      });
    }

    if (req.method === "GET" && acao === "foto") {
      const r = await db().execute({ sql: "SELECT mime, dados FROM fotos WHERE id = ?", args: [Number(q.id) || 0] });
      if (!r.rows.length) return res.status(404).json({ erro: "Foto não encontrada" });
      res.setHeader("Content-Type", r.rows[0].mime || "image/jpeg");
      res.setHeader("Cache-Control", "private, no-store");
      return res.end(Buffer.from(r.rows[0].dados));
    }

    if (req.method === "POST" && acao === "usar") {
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(n => n > 0).slice(0, 500);
      if (!ids.length) return res.status(400).json({ erro: "Nenhum id" });
      const r = await db().execute({
        sql: `UPDATE fotos SET usada_em = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
        args: [new Date().toISOString(), ...ids]
      });
      return res.json({ ok: true, marcadas: r.rowsAffected });
    }

    return res.status(400).json({ erro: "Ação inválida (use novas, foto ou usar)" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha: " + (err.message || err) });
  }
};
