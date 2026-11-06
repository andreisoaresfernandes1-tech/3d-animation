# Loja do Método ASF — venda automática por R$ 15 (Pix)

Fluxo: o comprador digita o e-mail → recebe um QR Code Pix do Mercado Pago → quando o Pix é aprovado:
- a página mostra o botão **Baixar o Método ASF** (ela confere sozinha a cada 4 s);
- o Mercado Pago avisa o site (`/api/webhook`) e o link chega no e-mail do comprador, mesmo que ele tenha fechado a página.

O link de download é assinado, vale 7 dias e só funciona para Pix aprovado deste produto.

## Colocar no ar (uma vez)

1. **ZIP do produto:** rode `./gerar-zip.sh` (gera `metodo-asf.zip` a partir da pasta `metodo-asf/`).
   Suba no Google Drive ou Dropbox e copie um link de **download direto**.
2. **Mercado Pago:** cadastre sua chave Pix na conta e pegue o *Access Token de produção* em
   <https://www.mercadopago.com.br/developers/panel/app> (crie uma aplicação → Credenciais de produção).
3. **E-mail automático (opcional, recomendado):** crie conta grátis em <https://resend.com>, verifique o seu
   domínio e crie uma API key. Sem domínio verificado, o Resend só entrega para o seu próprio e-mail.
4. **Vercel:** importe o repositório em <https://vercel.com/new>, em *Root Directory* escolha `loja`,
   e em *Environment Variables* crie (veja `.env.example`):
   - `MP_ACCESS_TOKEN` — passo 2
   - `LINK_SECRET` — qualquer texto longo e aleatório
   - `ZIP_URL` — passo 1
   - `RESEND_API_KEY` e `EMAIL_FROM` — passo 3 (ex.: `Método ASF <vendas@seudominio.com.br>`)
5. Deploy e faça uma compra de teste você mesmo.

Trocar o preço: mude `PRECO` em `api/_lib.js` e os "R$ 15" do `index.html`.
O dinheiro cai no saldo do Mercado Pago; dali você transfere pra sua chave Pix.
