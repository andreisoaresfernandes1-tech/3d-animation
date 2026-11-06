// Funções compartilhadas (o "_" no nome impede a Vercel de expor este arquivo como rota).
const crypto = require("crypto");

const PRODUTO = "metodo-asf";
const PRECO = 15.0; // mude aqui E no index.html se trocar o preço
const VALIDADE_LINK_S = 60 * 60 * 24 * 7; // link de download vale 7 dias

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

function linkDownload(id, base = "") {
  const exp = Math.floor(Date.now() / 1000) + VALIDADE_LINK_S;
  return base + "/api/baixar?id=" + encodeURIComponent(id) + "&exp=" + exp + "&sig=" + assinar(id, exp);
}

function assinaturaOk(id, exp, sig) {
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const certo = Buffer.from(assinar(id, exp));
  const veio = Buffer.from(String(sig));
  return certo.length === veio.length && crypto.timingSafeEqual(certo, veio);
}

// Manda o link por e-mail (Resend). Se RESEND_API_KEY não estiver configurada, só pula.
async function enviarEmail(para, link) {
  if (!process.env.RESEND_API_KEY || !para) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Método ASF <onboarding@resend.dev>",
      to: [para],
      subject: "Seu Método ASF chegou",
      html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1b1916">
        <h2 style="margin:0 0 12px">Pagamento confirmado!</h2>
        <p>Obrigado pela compra. Clique no botão para baixar o <b>Método ASF</b>:</p>
        <p><a href="${link}" style="display:inline-block;background:#ff7a3d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Baixar o Método ASF</a></p>
        <p style="font-size:14px;color:#6b6259">O link vale por 7 dias. Depois de baixar, extraia o ZIP e abra o arquivo index.html.</p>
      </div>`,
    }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text().catch(() => ""));
  return r.ok;
}

function idValido(id) { return /^\d{1,20}$/.test(String(id || "")); }

function baseUrl(req) { return "https://" + (req.headers["x-forwarded-host"] || req.headers.host); }

module.exports = { PRODUTO, PRECO, env, mp, pagamentoValido, linkDownload, assinaturaOk, idValido, enviarEmail, baseUrl };
