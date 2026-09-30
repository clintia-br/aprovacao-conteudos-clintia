// Caixa de fotos do botão "Subir fotos" do painel.
// GET    /api/fotos?resumo=1                        (x-admin-password) -> fotos por cliente/ciclo
// GET    /api/fotos?cliente=&ciclo=                 (x-admin-password) -> { k, fotos } pro painel
// GET    /api/fotos?cliente=&ciclo=&k=              -> galeria (quem tem o link vê e baixa)
// GET    /api/fotos?cliente=&ciclo=&k=&formato=json -> lista em JSON
// GET    /api/fotos?cliente=&ciclo=&k=&id=[&mini=1][&baixar=1] -> a foto
// POST   /api/fotos  (x-admin-password)  { cliente, ciclo, pasta, nome, obs, largura, altura, b64, mini } -> grava 1 foto
// DELETE /api/fotos?cliente=&ciclo=&id=  (x-admin-password)
// Uma foto por requisição: a Vercel corta corpo acima de 4,5 MB, então o painel comprime antes.
const db = require("../lib/db");
const { SLUG, admin, tokenFotos, fotosOk, garantirTabelas } = require("../lib/ciclo");

const MAX_FOTO = 3000000; // bytes, já comprimida (em base64 + miniatura cabe nos 4,5 MB)
const MAX_MINI = 300000;
const limpar = (s, n) => String(s || "").replace(/[\u0000-\u001f\\]/g, "").trim().slice(0, n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ordenar = (a, b) => a.pasta.localeCompare(b.pasta, "pt-BR", { numeric: true }) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });

async function listar(cliente, ciclo) {
  const r = await db().execute({
    sql: `SELECT id, pasta, nome, obs, largura, altura, tamanho, enviado_em, usada_em FROM fotos
          WHERE cliente = ? AND ciclo = ?`,
    args: [cliente, ciclo]
  });
  return r.rows.map(x => ({
    id: Number(x.id), pasta: x.pasta, nome: x.nome, obs: x.obs || "", largura: Number(x.largura), altura: Number(x.altura),
    tamanho: Number(x.tamanho), enviado_em: x.enviado_em, usada_em: x.usada_em || null
  })).sort(ordenar);
}

module.exports = async (req, res) => {
  try {
    await garantirTabelas();
    const q = req.query || {};

    if (req.method === "GET" && q.resumo) {
      if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
      const r = await db().execute(
        `SELECT cliente, ciclo, COUNT(*) AS n, SUM(usada_em IS NULL) AS novas, SUM(tamanho) AS bytes, MAX(enviado_em) AS ult
         FROM fotos GROUP BY cliente, ciclo`
      );
      return res.json({ destinos: r.rows.map(x => ({ cliente: x.cliente, ciclo: x.ciclo, n: Number(x.n), novas: Number(x.novas), bytes: Number(x.bytes), ult: x.ult, k: tokenFotos(x.cliente, x.ciclo) })) });
    }

    const cliente = String(q.cliente || (req.body && req.body.cliente) || "");
    const ciclo = String(q.ciclo || (req.body && req.body.ciclo) || "");
    if (!SLUG.test(cliente) || !SLUG.test(ciclo)) return res.status(400).json({ erro: "Cliente/pasta inválido (use minúsculas, números e hífen)" });

    if (req.method === "GET" && q.id) {
      if (!fotosOk(cliente, ciclo, String(q.k || ""))) return res.status(403).end("Link inválido");
      const r = await db().execute({
        sql: `SELECT nome, mime, ${q.mini ? "COALESCE(mini, dados)" : "dados"} AS b FROM fotos WHERE id = ? AND cliente = ? AND ciclo = ?`,
        args: [Number(q.id) || 0, cliente, ciclo]
      });
      if (!r.rows.length) return res.status(404).end("Não encontrada");
      const f = r.rows[0];
      res.setHeader("Content-Type", q.mini ? "image/jpeg" : (f.mime || "image/jpeg"));
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable"); // a URL leva ?v= da versão
      if (q.baixar) res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.nome)}`);
      return res.end(Buffer.from(f.b));
    }

    if (req.method === "GET" && q.k !== undefined) {
      if (!fotosOk(cliente, ciclo, String(q.k))) return res.status(403).send("Link inválido");
      const fotos = await listar(cliente, ciclo);
      const base = `/api/fotos?cliente=${cliente}&ciclo=${ciclo}&k=${q.k}`;
      if (q.formato === "json") {
        return res.json({ cliente, ciclo, fotos: fotos.map(f => ({ ...f, url: `${base}&id=${f.id}&v=${encodeURIComponent(f.enviado_em)}` })) });
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      return res.send(galeria(cliente, ciclo, base, fotos));
    }

    if (req.method === "GET") {
      if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
      return res.json({ k: tokenFotos(cliente, ciclo), fotos: await listar(cliente, ciclo) });
    }

    if (req.method === "POST") {
      if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
      const p = req.body || {};
      const nome = limpar(p.nome, 160).replace(/\//g, "-");
      const pasta = limpar(p.pasta, 200).replace(/^\/+|\/+$/g, "");
      const obs = limpar(p.obs, 300);
      if (!nome) return res.status(400).json({ erro: "Foto sem nome" });
      const buf = Buffer.from(String(p.b64 || ""), "base64");
      const mini = p.mini ? Buffer.from(String(p.mini), "base64") : null;
      if (!buf.length) return res.status(400).json({ erro: `Foto vazia: ${nome}` });
      if (buf.length > MAX_FOTO) return res.status(413).json({ erro: `Foto grande demais mesmo comprimida: ${nome}` });
      if (mini && mini.length > MAX_MINI) return res.status(413).json({ erro: `Miniatura grande demais: ${nome}` });
      const agora = new Date().toISOString();
      await db().execute({
        // versão nova de um arquivo que já existia volta a ser "nova" (usada_em = NULL) pro Claude aplicar de novo
        sql: `INSERT INTO fotos (cliente, ciclo, pasta, nome, obs, mime, largura, altura, tamanho, dados, mini, enviado_em)
              VALUES (?, ?, ?, ?, ?, 'image/jpeg', ?, ?, ?, ?, ?, ?)
              ON CONFLICT (cliente, ciclo, pasta, nome) DO UPDATE SET
                obs = excluded.obs, largura = excluded.largura, altura = excluded.altura, tamanho = excluded.tamanho,
                dados = excluded.dados, mini = excluded.mini, enviado_em = excluded.enviado_em, usada_em = NULL`,
        args: [cliente, ciclo, pasta, nome, obs, Number(p.largura) || 0, Number(p.altura) || 0, buf.length, buf, mini, agora]
      });
      return res.json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (!admin(req)) return res.status(401).json({ erro: "Senha do painel incorreta" });
      await db().execute({ sql: "DELETE FROM fotos WHERE id = ? AND cliente = ? AND ciclo = ?", args: [Number(q.id) || 0, cliente, ciclo] });
      return res.json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Falha nas fotos: " + (err.message || err) });
  }
};

function galeria(cliente, ciclo, base, fotos) {
  const grupos = {};
  fotos.forEach(f => (grupos[f.pasta] = grupos[f.pasta] || []).push(f));
  const mb = fotos.reduce((s, f) => s + f.tamanho, 0) / 1048576;
  const url = (f, extra = "") => `${base}&id=${f.id}&v=${encodeURIComponent(f.enviado_em)}${extra}`;
  const lista = fotos.map(f => ({ n: (f.pasta ? f.pasta + "/" : "") + f.nome, u: url(f) }));
  const obsDo = g => { const o = [...new Set(g.map(f => f.obs).filter(Boolean))]; return o.length ? `<p class="obs">${o.map(esc).join(" · ")}</p>` : ""; };
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Fotos · ${esc(cliente)} / ${esc(ciclo)} | ClintIA</title>
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
:root{--ink:#051E32;--ink-2:#4A6177;--line:#D6E2EE;--card:#F5F9FD;--dodger:#0578DC;font-family:"Red Hat Display",system-ui,sans-serif;color:var(--ink)}
*{box-sizing:border-box}body{margin:0;background:#fff}
.stripe{display:flex;height:5px}.stripe i{display:block}
main{max-width:1100px;margin:0 auto;padding:18px 16px 60px}
h1{font-weight:900;color:var(--dodger);text-transform:uppercase;font-size:22px;margin:4px 0}
.top{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-bottom:8px}
small{color:var(--ink-2)}
button,.btn{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 14px;background:var(--dodger);color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
h2{font-size:15px;margin:26px 0 10px;color:var(--ink-2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
figure{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card)}
figure a.img{display:block;aspect-ratio:4/5;background:#fff}
figure img{width:100%;height:100%;object-fit:contain;display:block}
figcaption{padding:7px 9px;font-size:12px;display:flex;gap:6px;justify-content:space-between;align-items:center}
figcaption span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
figcaption a{color:var(--dodger);font-weight:700;text-decoration:none}
figure{position:relative}.selo{position:absolute;top:6px;left:6px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#0578DC;color:#fff}.selo.u{background:#1F8A55}
.obs{font-size:13px;color:var(--ink-2);margin:-4px 0 10px}
</style></head><body>
<div class="stripe" aria-hidden="true"><i style="flex:4;background:#051E32"></i><i style="flex:8;background:#053C73"></i><i style="flex:18;background:#0578DC"></i><i style="flex:30;background:#055AAA"></i><i style="flex:40;background:#05D2FF"></i></div>
<main>
  <div class="top">
    <div><h1>Fotos enviadas</h1><small>${esc(cliente)} / ${esc(ciclo)} · ${fotos.length} foto(s) · ${mb.toFixed(1).replace(".", ",")} MB</small></div>
    ${fotos.length ? `<button id="zip">Baixar todas (.zip)</button>` : ""}
  </div>
  ${fotos.length ? "" : "<p>Nenhuma foto ainda. Use o botão <b>Subir fotos</b> no painel.</p>"}
  ${Object.keys(grupos).map(p => `<h2>${esc(p || "Sem pasta")} <small>(${grupos[p].length})</small></h2>${obsDo(grupos[p])}<div class="grid">${grupos[p].map(f => `
    <figure>${f.usada_em ? `<span class="selo u">usada</span>` : `<span class="selo">nova</span>`}<a class="img" href="${esc(url(f))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(url(f, "&mini=1"))}" alt="${esc(f.nome)}"></a>
    <figcaption><span title="${esc(f.nome)}">${esc(f.nome)}</span><a href="${esc(url(f, "&baixar=1"))}" aria-label="Baixar ${esc(f.nome)}">↓</a></figcaption></figure>`).join("")}</div>`).join("")}
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
const FOTOS = ${JSON.stringify(lista).replace(/</g, "\\u003c")};
const b = document.getElementById("zip");
if (b) b.onclick = async () => {
  b.disabled = true;
  try {
    const zip = new JSZip();
    for (let i = 0; i < FOTOS.length; i++) {
      b.textContent = "Juntando " + (i + 1) + "/" + FOTOS.length + "…";
      zip.file(FOTOS[i].n, await (await fetch(FOTOS[i].u)).blob());
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = ${JSON.stringify(`fotos-${cliente}-${ciclo}.zip`)};
    a.click();
    b.textContent = "Baixar todas (.zip)";
  } catch (e) { b.textContent = "Falhou, tente de novo"; }
  b.disabled = false;
};
</script>
</body></html>`;
}
