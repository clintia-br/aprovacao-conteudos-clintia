// GET /api/painel  (header x-admin-password: ADMIN_PASSWORD)
// Lista todos os ciclos publicados com progresso de aprovação e rodadas enviadas.
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");
const { gerar } = require("../lib/token");

module.exports = async (req, res) => {
  if (!process.env.ADMIN_PASSWORD || req.headers["x-admin-password"] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }
  try {
    const ciclos = JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib", "ciclos.json"), "utf8"));
    const d = await db().execute(
      "SELECT cliente, ciclo, status, COUNT(*) AS n, MAX(atualizado_em) AS ult FROM decisoes GROUP BY cliente, ciclo, status"
    );
    const e = await db().execute(
      "SELECT cliente, ciclo, COUNT(*) AS n, MAX(enviado_em) AS ult FROM envios GROUP BY cliente, ciclo"
    );
    const chave = r => `${r.cliente}/${r.ciclo}`;
    const dec = {}, env = {};
    d.rows.forEach(r => {
      const k = chave(r);
      dec[k] = dec[k] || { ok: 0, fix: 0, ult: null };
      dec[k][r.status] = Number(r.n);
      if (!dec[k].ult || r.ult > dec[k].ult) dec[k].ult = r.ult;
    });
    e.rows.forEach(r => { env[chave(r)] = { n: Number(r.n), ult: r.ult }; });

    const lista = ciclos.map(c => {
      const k = `${c.cliente}/${c.ciclo}`;
      return {
        ...c,
        link: `/c/${c.cliente}/${c.ciclo}-${gerar(c.cliente, c.ciclo)}`,
        aprovados: dec[k]?.ok || 0,
        ajustes: dec[k]?.fix || 0,
        ultimaAcao: dec[k]?.ult || null,
        envios: env[k]?.n || 0,
        ultimoEnvio: env[k]?.ult || null
      };
    });
    return res.json({ ciclos: lista });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha ao carregar o painel" });
  }
};
