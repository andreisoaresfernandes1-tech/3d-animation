# Como construir um túnel subterrâneo — animação 3D

Vídeo didático (90 s, 1280×720, 30 fps) feito com Three.js. A cena é uma vista em corte do
terreno e mostra, passo a passo, a construção de um túnel com tuneladora (TBM).

| Tempo | Etapa |
|---|---|
| 0–6 s | Abertura |
| 6–15 s | 1. Estudo do solo (sondagem e camadas) |
| 15–25 s | 2. Poço de acesso (paredes-diafragma) |
| 25–33 s | 3. Descida da tuneladora |
| 33–48 s | 4. Escavação (cabeça de corte, esteira) |
| 48–58 s | 5. Revestimento com anéis pré-moldados |
| 58–66 s | 6. Injeção de argamassa e drenagem; chegada da TBM |
| 66–74 s | 7. Acabamento (piso, trilhos, iluminação, ventilação) |
| 74–90 s | 8. Túnel em operação: trem e voo pelo interior |

## Ver no navegador

```bash
npx serve .        # ou qualquer servidor estático
# abra http://localhost:3000  (use ?t=45 para começar em 45 s)
```

## Renderizar o MP4

```bash
npm install
node render.mjs --out video/tunel.mp4          # vídeo completo
node render.mjs --start 33 --end 48 --out e4.mp4   # só um trecho
node render.mjs --still 10,44 --png quadro.png     # quadros soltos
```

Requer Node 18+, ffmpeg e Playwright (Chromium). Tudo na cena é função do tempo,
então cada renderização é idêntica.
