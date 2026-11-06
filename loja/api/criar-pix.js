// POST {email} -> cria uma cobrança Pix de R$ 15 no Mercado Pago e devolve o QR Code.
const crypto = require("crypto");
const { PRODUTO, PRECO, mp, baseUrl } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)
    return res.status(400).json({ erro: "Digite um e-mail válido." });

  try {
    const p = await mp("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: PRECO,
        description: "Método ASF (ZIP)",
        payment_method_id: "pix",
        external_reference: PRODUTO,
        payer: { email },
        notification_url: baseUrl(req) + "/api/webhook",
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
      }),
    });
    const t = (p.point_of_interaction || {}).transaction_data || {};
    res.status(200).json({ id: String(p.id), copiaECola: t.qr_code, qrBase64: t.qr_code_base64 });
  } catch (e) {
    console.error(e);
    res.status(502).json({ erro: "Não foi possível gerar o Pix agora. Tente de novo em instantes." });
  }
};
