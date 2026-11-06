// GET ?id=&exp=&sig= -> confere a assinatura e o pagamento e redireciona para o ZIP.
const { mp, pagamentoValido, assinaturaOk, idValido, env } = require("./_lib");

module.exports = async (req, res) => {
  const { id, exp, sig } = req.query;
  res.setHeader("Cache-Control", "no-store");
  if (!idValido(id) || !assinaturaOk(String(id), String(exp), sig))
    return res.status(403).send("Link inválido ou expirado. Volte ao site e clique em “Já paguei” para gerar outro.");
  try {
    const p = await mp("/v1/payments/" + id);
    if (!pagamentoValido(p)) return res.status(403).send("Pagamento não confirmado.");
    res.writeHead(302, { Location: env("ZIP_URL") });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(502).send("Erro ao verificar o pagamento. Tente de novo.");
  }
};
