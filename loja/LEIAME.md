# Loja — venda automática do pacote por R$ 15 (Pix)

Fluxo: o comprador digita o e-mail → recebe um QR Code Pix do Mercado Pago → a página verifica
o pagamento a cada 4 s → quando o Pix é aprovado aparece o botão **Baixar o ZIP**.
O link de download é assinado, vale 3 dias e só funciona para pagamentos aprovados deste produto.

## Colocar no ar (uma vez)

1. **Mercado Pago**: crie/entre na sua conta, cadastre sua chave Pix nela e pegue o
   *Access Token de produção* em <https://www.mercadopago.com.br/developers/panel/app>
   (crie uma aplicação → Credenciais de produção).
2. **ZIP**: rode `./gerar-zip.sh`, suba o arquivo (Google Drive, Dropbox, etc.) e copie um link
   de download direto. Não coloque o ZIP dentro desta pasta.
3. **Vercel**: importe este repositório em <https://vercel.com/new>, em *Root Directory* escolha `loja`,
   e em *Environment Variables* crie:
   - `MP_ACCESS_TOKEN` — o token do passo 1
   - `LINK_SECRET` — qualquer texto longo e aleatório
   - `ZIP_URL` — o link do passo 2
4. Faça deploy e teste comprando você mesmo.

O dinheiro cai no saldo do Mercado Pago; dali você transfere para sua chave Pix.
