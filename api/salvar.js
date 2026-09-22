// POST /api/salvar  (header x-admin-password: ADMIN_PASSWORD)
// Cria/atualiza um ciclo no banco a partir do montador. As fotos sobem antes por /api/midia.
// Body: { cliente, ciclo, dados }  (dados = { cliente, titulo, whatsappAgencia, perfil, publicados, itens })
const db = require("../lib/db");
const { gerar } = require("../lib/token");
const { SLUG, admin, link } = require("../lib/ciclo");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });

  const p = req.body || {};
  const cliente = String(p.cliente || "").trim();
  const ciclo = String(p.ciclo || "").trim();
  const dados = p.dados;

  if (!SLUG.test(cliente)) return res.status(400).json({ erro: "Pasta do cliente inválida (use minúsculas, números e hífen)." });
  if (!SLUG.test(ciclo)) return res.status(400).json({ erro: "Ciclo inválido (use minúsculas, números e hífen)." });
  if (!dados || typeof dados !== "object" || !Array.isArray(dados.itens) || !dados.perfil)
    return res.status(400).json({ erro: "Dados incompletos." });

  const json = JSON.stringify(dados);
  if (json.length > 500000) return res.status(400).json({ erro: "Conteúdo grande demais." });

  try {
    const agora = new Date().toISOString();
    await db().execute({
      sql: `INSERT INTO ciclos (cliente, ciclo, nome, titulo, total, dados, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (cliente, ciclo) DO UPDATE SET
              nome = excluded.nome, titulo = excluded.titulo, total = excluded.total,
              dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
      args: [cliente, ciclo, String(dados.cliente || cliente).slice(0, 120),
             String(dados.titulo || ciclo).slice(0, 200), dados.itens.length, json, agora, agora]
    });
    return res.json({ ok: true, token: gerar(cliente, ciclo), link: link(cliente, ciclo) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao salvar no banco." });
  }
};
