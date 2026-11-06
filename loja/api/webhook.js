// O Mercado Pago chama esta rota quando um pagamento muda. Se o Pix foi aprovado,
// manda o link de download pro e-mail do comprador (mesmo que ele tenha fechado a página).
// Não confiamos no corpo do aviso: o pagamento é sempre consultado de novo na API do Mercado Pago.
const { mp, pagamentoValido, linkDownload, idValido, enviarEmail, baseUrl } = require("./_lib");

module.exports = async (req, res) => {
  const b = req.body || {};
  const tipo = b.type || b.topic || req.query.type || req.query.topic;
  const id = String((b.data && b.data.id) || req.query["data.id"] || req.query.id || "");
  if (tipo && tipo !== "payment") return res.status(200).json({ ok: true, ignorado: tipo });
  if (!idValido(id)) return res.status(200).json({ ok: true, ignorado: "sem id" });
  try {
    const p = await mp("/v1/payments/" + id);
    if (pagamentoValido(p)) {
      const email = p.payer && p.payer.email;
      const enviado = await enviarEmail(email, linkDownload(id, baseUrl(req)));
      console.log("pagamento aprovado", id, "e-mail enviado:", enviado);
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false }); // o Mercado Pago tenta de novo mais tarde
  }
};
