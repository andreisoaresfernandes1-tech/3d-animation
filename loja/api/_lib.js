// Funções compartilhadas (o "_" no nome impede a Vercel de expor este arquivo como rota).
const crypto = require("crypto");

const PRODUTO = "tunel3d";
const PRECO = 15.0;
const VALIDADE_LINK_S = 60 * 60 * 24 * 3; // link de download vale 3 dias

function env(nome) {
  const v = process.env[nome];
  if (!v) throw new Error("Variável de ambiente ausente: " + nome);
  return v;
}

async function mp(caminho, opcoes = {}) {
  const r = await fetch("https://api.mercadopago.com" + caminho, {
    ...opcoes,
    headers: {
      Authorization: "Bearer " + env("MP_ACCESS_TOKEN"),
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error("Mercado Pago " + r.status + ": " + (dados.message || JSON.stringify(dados)));
    e.status = r.status;
    throw e;
  }
  return dados;
}

// Só vale pagamento aprovado, deste produto e com o valor certo.
function pagamentoValido(p) {
  return p && p.status === "approved" && p.external_reference === PRODUTO &&
    Number(p.transaction_amount) >= PRECO;
}

function assinar(id, exp) {
  return crypto.createHmac("sha256", env("LINK_SECRET")).update(id + "." + exp).digest("hex");
}

function linkDownload(id) {
  const exp = Math.floor(Date.now() / 1000) + VALIDADE_LINK_S;
  return "/api/baixar?id=" + encodeURIComponent(id) + "&exp=" + exp + "&sig=" + assinar(id, exp);
}

function assinaturaOk(id, exp, sig) {
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const certo = Buffer.from(assinar(id, exp));
  const veio = Buffer.from(String(sig));
  return certo.length === veio.length && crypto.timingSafeEqual(certo, veio);
}

function idValido(id) { return /^\d{1,20}$/.test(String(id || "")); }

module.exports = { PRODUTO, PRECO, env, mp, pagamentoValido, linkDownload, assinaturaOk, idValido };
