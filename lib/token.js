// Gera e confere o código aleatório do link de cada cliente/ciclo.
// O código sai de um HMAC com TOKEN_SECRET: ninguém adivinha o link trocando o nome na URL.
const crypto = require("crypto");

function gerar(cliente, ciclo) {
  const segredo = process.env.TOKEN_SECRET;
  if (!segredo) throw new Error("TOKEN_SECRET não configurado");
  return crypto.createHmac("sha256", segredo).update(`${cliente}/${ciclo}`).digest("hex").slice(0, 12);
}

function valido(cliente, ciclo, token) {
  if (typeof cliente !== "string" || typeof ciclo !== "string" || typeof token !== "string") return false;
  if (!/^[a-z0-9-]+$/.test(cliente) || !/^[a-z0-9-]+$/.test(ciclo)) return false;
  const esperado = Buffer.from(gerar(cliente, ciclo));
  const recebido = Buffer.from(token);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

module.exports = { gerar, valido };
