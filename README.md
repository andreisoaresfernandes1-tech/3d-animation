# Como construir um túnel subterrâneo — animação 3D

Vídeo didático (2:16, 1280×720, 30 fps) feito com Three.js, numa vista em corte do terreno.
Cavar um túnel abre um buraco debaixo da terra, mas a terra em cima pesa e tudo desaba. O personagem
erra **5 vezes**: a cada erro o túnel desaba e o vídeo rebobina. Na **6ª tentativa** ele acerta.
O roteiro completo, com narração, está em [ROTEIRO.md](ROTEIRO.md).

| Tempo | Parte |
|---|---|
| 0:00–0:07 | Abertura |
| 0:07–0:21 | Tentativa 1: só cavar |
| 0:21–0:36 | Tentativa 2: escoras de madeira |
| 0:36–0:50 | Tentativa 3: teto reto de concreto |
| 0:50–1:05 | Tentativa 4: arco de tijolos (a água infiltra) |
| 1:05–1:19 | Tentativa 5: tuneladora com anéis atrasados |
| 1:19–2:16 | Tentativa 6: tuneladora + anéis logo atrás + argamassa → trem passando |

## Ver no navegador

```bash
npx serve .        # ou qualquer servidor estático
# abra http://localhost:3000  (?vertical para 9:16; use ?t=79.5 para pular para a 6ª tentativa)
```

## Renderizar o MP4

```bash
npm install
node render.mjs --out video/tunel.mp4          # vídeo completo 16:9
node render.mjs --vertical --out video/tunel-vertical.mp4   # 9:16 (1080×1920) para Reels/Shorts/TikTok
node render.mjs --start 33 --end 48 --out e4.mp4   # só um trecho
node render.mjs --still 10,44 --png quadro.png     # quadros soltos
```

Requer Node 18+, ffmpeg e Playwright (Chromium). Tudo na cena é função do tempo,
então cada renderização é idêntica.
