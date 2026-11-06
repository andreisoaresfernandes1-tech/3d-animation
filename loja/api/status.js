// GET ?id= -> diz se o Pix foi pago; se sim, devolve o link de download assinado.
const { mp, pagamentoValido, linkDownload, idValido } = require("./_lib");

module.exports = async (req, res) => {
  const id = String(req.query.id || "");
  if (!idValido(id)) return res.status(400).json({ erro: "id inválido" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const p = await mp("/v1/payments/" + id);
    if (pagamentoValido(p)) return res.status(200).json({ pago: true, link: linkDownload(id) });
    res.status(200).json({ pago: false, status: p.status });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ erro: "Pagamento não encontrado" });
    console.error(e);
    res.status(502).json({ erro: "Falha ao consultar o pagamento" });
  }
};
