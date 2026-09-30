#!/usr/bin/env node
// Uso do Claude: puxa as fotos do "Subir fotos" do painel pra aplicar no site.
//   node scripts/fotos.js novas [cliente] [ciclo]   -> baixa as fotos ainda não usadas em _entrada/
//   node scripts/fotos.js todas [cliente] [ciclo]   -> idem, incluindo as já usadas
//   node scripts/fotos.js usar <id> [id...]         -> marca como usadas (depois de publicar)
// Precisa de PAINEL_URL (ex.: https://aprovacao.vercel.app) e CLAUDE_FOTOS_KEY nas variáveis do ambiente.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// o fetch do Node só passa pelo proxy da sessão com NODE_USE_ENV_PROXY=1
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" } });
  process.exit(r.status ?? 1);
}

const BASE = String(process.env.PAINEL_URL || "").replace(/\/+$/, "");
const KEY = process.env.CLAUDE_FOTOS_KEY || "";
const RAIZ = path.join(__dirname, "..");
const SAIDA = path.join(RAIZ, "_entrada");
const [cmd, ...args] = process.argv.slice(2);

function sair(msg) { console.error("✗ " + msg); process.exit(1); }

async function api(caminho, opts = {}) {
  let r;
  try { r = await fetch(BASE + caminho, { ...opts, headers: { "x-claude-key": KEY, ...(opts.headers || {}) } }); }
  catch (e) { sair(`Não consegui acessar ${BASE} (${(e.cause && e.cause.code) || e.message}). A rede do ambiente libera esse domínio?`); }
  if (!r.ok) sair(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
const seguro = s => String(s).replace(/[\\:*?"<>|]/g, "-").replace(/\.\.+/g, ".");

async function baixar(todas, cliente, ciclo) {
  const qs = new URLSearchParams({ acao: "novas" });
  if (todas) qs.set("todas", "1");
  if (cliente) qs.set("cliente", cliente);
  if (ciclo) qs.set("ciclo", ciclo);
  const { fotos } = await (await api("/api/claude?" + qs)).json();
  if (!fotos.length) { console.log(todas ? "Nenhuma foto no painel." : "Nenhuma foto nova no painel."); return; }
  for (const f of fotos) {
    const dest = path.join(SAIDA, f.cliente, f.ciclo, ...f.pasta.split("/").filter(Boolean).map(seguro), seguro(f.nome));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await (await api(`/api/claude?acao=foto&id=${f.id}`)).arrayBuffer()));
    f.arquivo = path.relative(RAIZ, dest);
  }
  fs.writeFileSync(path.join(SAIDA, "lista.json"), JSON.stringify(fotos, null, 2));
  let grupo = "";
  for (const f of fotos) {
    const g = `${f.cliente} / ${f.ciclo}${f.pasta ? " / " + f.pasta : ""}`;
    if (g !== grupo) { grupo = g; console.log(`\n${g}${f.obs ? `  — "${f.obs}"` : ""}`); }
    console.log(`  #${f.id}  ${f.arquivo}  ${f.largura}x${f.altura}${f.usada_em ? "  (usada)" : ""}`);
  }
  console.log(`\n${fotos.length} foto(s) em _entrada/ · lista em _entrada/lista.json`);
}

async function usar(ids) {
  if (!ids.length) sair("Informe os ids: node scripts/fotos.js usar 12 13 14");
  const j = await (await api("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "usar", ids })
  })).json();
  console.log(`✓ ${j.marcadas} foto(s) marcada(s) como usada(s).`);
}

(async () => {
  if (cmd !== "novas" && cmd !== "todas" && cmd !== "usar")
    return console.log("Uso: node scripts/fotos.js novas [cliente] [ciclo] | todas [cliente] [ciclo] | usar <id...>");
  if (!BASE) sair("PAINEL_URL não configurada (variáveis de ambiente do Claude).");
  if (!KEY) sair("CLAUDE_FOTOS_KEY não configurada (variáveis de ambiente do Claude).");
  if (cmd === "usar") return usar(args.map(Number).filter(n => n > 0));
  return baixar(cmd === "todas", args[0], args[1]);
})();
