// GET  /api/midia?c=&y=&t=&f=   -> devolve a foto (token do link exigido). Cache longo.
// POST /api/midia  (x-admin-password)  { cliente, ciclo, midias:[{nome, mime, b64}] }  -> grava as fotos.
const db = require("../lib/db");
const { valido } = require("../lib/token");
const { SLUG, MIDIA, admin, garantirTabelas } = require("../lib/ciclo");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const { c, y, t, f } = req.query;
      if (!valido(c, y, t)) return res.status(403).end("Link inválido");
      if (!MIDIA.test(String(f || ""))) return res.status(400).end("Arquivo inválido");
      const r = await db().execute({
        sql: "SELECT mime, dados FROM midias WHERE cliente = ? AND ciclo = ? AND nome = ?",
        args: [c, y, f]
      });
      if (!r.rows.length) return res.status(404).end("Não encontrado");
      res.setHeader("Content-Type", r.rows[0].mime || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(Buffer.from(r.rows[0].dados));
    }

    if (req.method === "POST") {
      if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
      const p = req.body || {};
      const cliente = String(p.cliente || ""), ciclo = String(p.ciclo || "");
      if (!SLUG.test(cliente) || !SLUG.test(ciclo)) return res.status(400).json({ erro: "Cliente/ciclo inválido" });
      const midias = Array.isArray(p.midias) ? p.midias : [];
      if (!midias.length) return res.status(400).json({ erro: "Nenhuma foto" });

      await garantirTabelas();
      const stmts = [];
      for (const m of midias) {
        if (!MIDIA.test(String(m.nome || ""))) return res.status(400).json({ erro: `Nome inválido: ${m.nome}` });
        const buf = Buffer.from(String(m.b64 || ""), "base64");
        if (!buf.length) return res.status(400).json({ erro: `Foto vazia: ${m.nome}` });
        if (buf.length > 3000000) return res.status(400).json({ erro: `Foto grande demais: ${m.nome}` });
        stmts.push({
          sql: `INSERT INTO midias (cliente, ciclo, nome, mime, dados) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (cliente, ciclo, nome) DO UPDATE SET mime = excluded.mime, dados = excluded.dados`,
          args: [cliente, ciclo, m.nome, String(m.mime || "image/jpeg"), buf]
        });
      }
      await db().batch(stmts, "write");
      return res.json({ ok: true, n: stmts.length });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).end(req.method === "GET" ? "Erro" : JSON.stringify({ erro: "Falha na mídia: " + (err.message || err) }));
  }
};
