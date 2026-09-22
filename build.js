// Gera uma página por cliente/ciclo a partir de clientes/<cliente>/<ciclo>/dados.json
// Saída: public/c/<cliente>/<ciclo>-<token>/  +  public/painel/  +  lib/ciclos.json
const fs = require("fs");
const path = require("path");
const { gerar } = require("./lib/token");

const RAIZ = __dirname;
const PUB = path.join(RAIZ, "public");
const TPL = fs.readFileSync(path.join(RAIZ, "template", "pagina.html"), "utf8");
const TPL_PAINEL = fs.readFileSync(path.join(RAIZ, "template", "painel.html"), "utf8");
const SLUG = /^[a-z0-9-]+$/;

fs.rmSync(path.join(PUB, "c"), { recursive: true, force: true });
fs.rmSync(path.join(PUB, "painel"), { recursive: true, force: true });

const erros = [];
const ciclos = [];
const pastas = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith("_")).map(e => e.name);

for (const cliente of pastas(path.join(RAIZ, "clientes"))) {
  if (!SLUG.test(cliente)) { erros.push(`Pasta "${cliente}": use só letras minúsculas, números e hífen`); continue; }
  for (const ciclo of pastas(path.join(RAIZ, "clientes", cliente))) {
    const dir = path.join(RAIZ, "clientes", cliente, ciclo);
    const ref = `${cliente}/${ciclo}`;
    if (!SLUG.test(ciclo)) { erros.push(`${ref}: nome do ciclo com caractere inválido`); continue; }
    if (!fs.existsSync(path.join(dir, "dados.json"))) { erros.push(`${ref}: falta dados.json`); continue; }

    let dados;
    try { dados = JSON.parse(fs.readFileSync(path.join(dir, "dados.json"), "utf8")); }
    catch (e) { erros.push(`${ref}: dados.json com erro de sintaxe (${e.message})`); continue; }

    // confere ids e mídias
    const usaBase = dados.midia && dados.midia.base;
    const midiaDir = path.join(dir, "midia");
    const ids = new Set();
    const arquivo = k => (/\.\w{2,4}$/.test(k) ? k : `${k}.jpg`);
    const conferir = (k, onde) => {
      if (!k || usaBase || /^https?:\/\//.test(k)) return;
      if (!fs.existsSync(path.join(midiaDir, arquivo(k)))) erros.push(`${ref}: arquivo "${arquivo(k)}" não encontrado em midia/ (${onde})`);
    };
    (dados.itens || []).forEach(it => {
      if (ids.has(it.id)) erros.push(`${ref}: id repetido "${it.id}"`);
      ids.add(it.id);
      (it.imgs || []).forEach(k => conferir(k, it.id));
      if (it.capa) conferir(it.capa, it.id);
      if (it.video) conferir(it.video, it.id);
    });
    (dados.publicados || []).forEach(k => conferir(k, "publicados"));
    if (dados.perfil && dados.perfil.avatar) conferir(dados.perfil.avatar, "avatar");

    const token = gerar(cliente, ciclo);
    const saida = path.join(PUB, "c", cliente, `${ciclo}-${token}`);
    fs.mkdirSync(saida, { recursive: true });
    if (fs.existsSync(midiaDir)) fs.cpSync(midiaDir, path.join(saida, "midia"), { recursive: true });

    const payload = { ...dados, slug: cliente, ciclo, token };
    const html = TPL.replace("__DATA__", JSON.stringify(payload).replace(/</g, "\\u003c"));
    fs.writeFileSync(path.join(saida, "index.html"), html);

    ciclos.push({ cliente, ciclo, nome: dados.cliente || cliente, titulo: dados.titulo || ciclo, total: (dados.itens || []).length });
    console.log(`✓ ${ref}  →  /c/${cliente}/${ciclo}-${token}`);
  }
}

fs.writeFileSync(path.join(RAIZ, "lib", "ciclos.json"), JSON.stringify(ciclos, null, 2));
fs.mkdirSync(path.join(PUB, "painel"), { recursive: true });
fs.writeFileSync(path.join(PUB, "painel", "index.html"), TPL_PAINEL);

if (erros.length) {
  console.error("\nErros encontrados:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`\n${ciclos.length} página(s) gerada(s).`);
